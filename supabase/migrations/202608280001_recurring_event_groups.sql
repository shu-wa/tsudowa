-- Recurring groups and explicitly-undated follow-up events.

alter table public.events
  add column if not exists group_id uuid,
  add column if not exists date_status text not null default 'scheduled';

alter table public.events
  drop constraint if exists events_date_status_check;
alter table public.events
  add constraint events_date_status_check
  check (date_status in ('undecided', 'scheduled'));

create table public.event_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 80),
  cover_color text not null default '#242A26' check (cover_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events
  add constraint events_group_id_fkey
  foreign key (group_id) references public.event_groups(id) on delete set null;

create table public.event_group_members (
  group_id uuid not null references public.event_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.event_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index events_group_idx on public.events(group_id, start_date desc);
create index event_group_members_user_idx on public.event_group_members(user_id, group_id);
create trigger event_groups_updated_at before update on public.event_groups
for each row execute function private.set_updated_at();

create or replace function private.is_group_member(
  target_group_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_group_members member
    where member.group_id = target_group_id and member.user_id = target_user_id
  );
$$;

create or replace function private.can_manage_group(
  target_group_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_group_members member
    where member.group_id = target_group_id
      and member.user_id = target_user_id
      and member.role in ('host', 'cohost')
  );
$$;

create or replace function private.shares_event(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_members mine
    join public.event_members theirs on theirs.event_id = mine.event_id
    where mine.user_id = auth.uid() and mine.status = 'approved'
      and theirs.user_id = target_user_id and theirs.status = 'approved'
  ) or exists (
    select 1 from public.event_group_members mine
    join public.event_group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = target_user_id
  );
$$;

alter table public.event_groups enable row level security;
alter table public.event_group_members enable row level security;
revoke all on public.event_groups, public.event_group_members from public, anon, authenticated;
grant select on public.event_groups, public.event_group_members to authenticated;

create policy event_groups_read_members on public.event_groups
for select to authenticated using (private.is_group_member(id));
create policy event_groups_update_managers on public.event_groups
for update to authenticated using (private.can_manage_group(id))
with check (private.can_manage_group(id));
create policy event_groups_delete_owner on public.event_groups
for delete to authenticated using (owner_id = auth.uid());
create policy event_group_members_read_group on public.event_group_members
for select to authenticated using (private.is_group_member(group_id));

-- Membership is changed only by security-definer RPCs, so a client cannot
-- assign itself the host role or insert arbitrary users.

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
    on conflict (group_id, user_id) do update set role = 'host';

    update public.events set group_id = created_group_id where id = source_event.id;
  elsif not private.can_manage_group(created_group_id) then
    raise exception 'not_allowed';
  end if;

  normalized_event_title := coalesce(nullif(trim(next_event_title), ''), source_event.title);
  if char_length(normalized_event_title) not between 1 and 140 then raise exception 'invalid_event_title'; end if;

  -- date_status is authoritative. Valid placeholder columns keep older clients
  -- safe, but are never displayed, sorted, or used for reminders.
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

  -- A single group-event notification may be enqueued by the event insert.
  -- Suppress only the per-member status notifications from the bulk copy.
  perform set_config('tsudowa.suppress_notifications', 'on', true);
  insert into public.event_members(event_id, user_id, role, status, attendance_label, joined_at)
  select created_event_id, member.user_id, member.role, 'approved', '参加', now()
  from public.event_group_members member
  where member.group_id = created_group_id
  on conflict (event_id, user_id) do update
  set role = excluded.role, status = 'approved', attendance_label = '参加';
  perform set_config('tsudowa.suppress_notifications', 'off', true);

  return query select created_group_id, created_event_id;
end;
$$;

create or replace function public.create_group_event(
  target_group_id uuid,
  event_title text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target_group public.event_groups%rowtype;
  created_event_id uuid;
  normalized_title text := trim(event_title);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not private.can_manage_group(target_group_id) then raise exception 'not_allowed'; end if;
  if char_length(normalized_title) not between 1 and 140 then raise exception 'invalid_event_title'; end if;

  select group_row.* into target_group
  from public.event_groups group_row where group_row.id = target_group_id;
  if target_group.id is null then raise exception 'group_not_found'; end if;

  insert into public.events(
    owner_id, group_id, title, category, start_date, end_date, start_time,
    time_mode, time_zone, capacity, status, join_policy, cover_color,
    accent_color, date_status
  ) values (
    target_group.owner_id, target_group.id, normalized_title, 'EVENT',
    (now() at time zone 'Asia/Tokyo')::date,
    (now() at time zone 'Asia/Tokyo')::date,
    '09:00', 'start', 'Asia/Tokyo', 10000, 'draft', 'approval',
    target_group.cover_color, '#A8442F', 'undecided'
  ) returning id into created_event_id;

  perform set_config('tsudowa.suppress_notifications', 'on', true);
  insert into public.event_members(event_id, user_id, role, status, attendance_label, joined_at)
  select created_event_id, member.user_id, member.role, 'approved', '参加', now()
  from public.event_group_members member
  where member.group_id = target_group.id
  on conflict (event_id, user_id) do update
  set role = excluded.role, status = 'approved', attendance_label = '参加';
  perform set_config('tsudowa.suppress_notifications', 'off', true);

  return created_event_id;
end;
$$;

revoke all on function public.create_group_from_event(uuid, text, text) from public, anon;
revoke all on function public.create_group_event(uuid, text) from public, anon;
grant execute on function public.create_group_from_event(uuid, text, text) to authenticated;
grant execute on function public.create_group_event(uuid, text) to authenticated;

create or replace function public.confirm_event_date_candidate(target_candidate_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare candidate public.date_candidates%rowtype;
begin
  select * into candidate from public.date_candidates where id = target_candidate_id;
  if candidate.id is null then raise exception 'candidate_not_found'; end if;
  if not private.can_manage_event(candidate.event_id) then raise exception 'not_allowed'; end if;
  update public.events
  set start_date = candidate.candidate_date,
      end_date = candidate.candidate_date,
      start_time = candidate.start_time,
      end_time = null,
      time_mode = 'start',
      date_status = 'scheduled',
      status = 'scheduled',
      updated_at = now()
  where id = candidate.event_id;
end;
$$;

drop function if exists public.preview_event_invite(text);
create function public.preview_event_invite(raw_token text)
returns table(
  event_id uuid,
  event_title text,
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  time_mode public.event_time_mode,
  date_status text
)
language sql stable security definer set search_path = '' as $$
  select event.id, event.title, event.start_date, event.end_date,
    event.start_time, event.end_time, event.time_mode, event.date_status
  from public.event_invites invite
  join public.events event on event.id = invite.event_id
  where invite.token_hash = encode(extensions.digest(upper(trim(raw_token)), 'sha256'), 'hex')
    and invite.revoked_at is null
    and (invite.expires_at is null or invite.expires_at > now())
    and (invite.max_uses is null or invite.use_count < invite.max_uses)
    and event.status <> 'cancelled'
  limit 1;
$$;
revoke all on function public.preview_event_invite(text) from public;
grant execute on function public.preview_event_invite(text) to authenticated;

alter publication supabase_realtime add table public.event_groups;
alter publication supabase_realtime add table public.event_group_members;
