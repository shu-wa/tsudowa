-- The TABLE return columns of create_group_from_event become PL/pgSQL output
-- variables. Use a parameterized dynamic UPDATE so the output variable named
-- group_id cannot conflict with public.events.group_id.

create or replace function public.create_group_from_event(
  source_event_id uuid,
  group_name text,
  next_event_title text default null
)
returns table(group_id uuid, event_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  source_event public.events%rowtype;
  created_group_id uuid;
  created_event_id uuid;
  source_end timestamptz;
  normalized_group_name text := trim(group_name);
  normalized_event_title text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if char_length(normalized_group_name) not between 1 and 80 then raise exception 'invalid_group_name'; end if;

  select event.* into source_event
  from public.events event where event.id = source_event_id for update;
  if source_event.id is null then raise exception 'event_not_found'; end if;
  if source_event.archived_at is not null then raise exception 'event_already_archived'; end if;
  if source_event.date_status <> 'scheduled' then raise exception 'event_date_undecided'; end if;
  if not private.can_manage_event(source_event.id) then raise exception 'not_allowed'; end if;

  source_end := (
    source_event.end_date::text || ' ' ||
    case when source_event.time_mode = 'range' and source_event.end_time is not null
      then source_event.end_time::text else '23:59:59' end
  )::timestamp at time zone source_event.time_zone;
  if source_end >= now() then raise exception 'event_not_finished'; end if;

  created_group_id := source_event.group_id;
  if created_group_id is null then
    insert into public.event_groups(owner_id, name, cover_color)
    values (source_event.owner_id, normalized_group_name, source_event.cover_color)
    returning id into created_group_id;

    insert into public.event_group_members(group_id, user_id, role, joined_at)
    select created_group_id, member.user_id, member.role, member.joined_at
    from public.event_members member
    where member.event_id = source_event.id and member.status = 'approved';
    insert into public.event_group_members(group_id, user_id, role, joined_at)
    values (created_group_id, source_event.owner_id, 'host', now())
    on conflict on constraint event_group_members_pkey do update set role = 'host';

    execute 'update public.events set group_id = $1 where id = $2'
    using created_group_id, source_event.id;
  elsif not private.can_manage_group(created_group_id) then
    raise exception 'not_allowed';
  end if;

  normalized_event_title := coalesce(nullif(trim(next_event_title), ''), source_event.title);
  if char_length(normalized_event_title) not between 1 and 140 then raise exception 'invalid_event_title'; end if;

  insert into public.events(
    owner_id, group_id, title, category, tagline, description,
    start_date, end_date, start_time, end_time, time_mode, time_zone,
    location_name, address, capacity, status, join_policy,
    cover_color, accent_color, date_status
  ) values (
    source_event.owner_id, created_group_id, normalized_event_title,
    source_event.category, null, null,
    (now() at time zone source_event.time_zone)::date,
    (now() at time zone source_event.time_zone)::date,
    '09:00', null, 'start', source_event.time_zone,
    null, null, source_event.capacity, 'draft', 'approval',
    source_event.cover_color, source_event.accent_color, 'undecided'
  ) returning id into created_event_id;

  perform set_config('tsudowa.suppress_notifications', 'on', true);
  insert into public.event_members(event_id, user_id, role, status, attendance_label, joined_at)
  select created_event_id, member.user_id, member.role, 'approved', '参加', now()
  from public.event_group_members member
  where member.group_id = created_group_id
  on conflict on constraint event_members_pkey do update
  set role = excluded.role, status = 'approved', attendance_label = '参加';
  perform set_config('tsudowa.suppress_notifications', 'off', true);

  return query select created_group_id, created_event_id;
end;
$$;

revoke all on function public.create_group_from_event(uuid, text, text) from public, anon;
grant execute on function public.create_group_from_event(uuid, text, text) to authenticated;
