-- Make invite confirmation join immediately unless a future event setting
-- explicitly opts into approval, and make repeated joins idempotent.

alter table public.events
  alter column join_policy set default 'auto';

-- Approval mode was not exposed in the app, so existing approval values were
-- implicit rather than an organiser choice.
update public.events
set join_policy = 'auto',
    updated_at = now()
where join_policy = 'approval';

create or replace function public.join_event_by_invite(raw_token text)
returns table(event_id uuid, membership_status public.membership_status)
language plpgsql security definer set search_path = '' as $$
declare
  selected_invite public.event_invites%rowtype;
  selected_event public.events%rowtype;
  existing_status public.membership_status;
  next_status public.membership_status;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles profile where profile.id = auth.uid()) then
    raise exception 'profile_not_found';
  end if;

  select invite.*
  into selected_invite
  from public.event_invites invite
  where invite.token_hash = encode(extensions.digest(upper(trim(raw_token)), 'sha256'), 'hex')
    and invite.revoked_at is null
    and (invite.expires_at is null or invite.expires_at > now())
  for update;

  if selected_invite.id is null then
    raise exception 'invalid_invite';
  end if;

  select event.*
  into selected_event
  from public.events event
  where event.id = selected_invite.event_id
  for update;

  if selected_event.id is null or selected_event.status = 'cancelled' then
    raise exception 'event_unavailable';
  end if;

  select member.status
  into existing_status
  from public.event_members member
  where member.event_id = selected_invite.event_id
    and member.user_id = auth.uid();

  if existing_status in ('approved', 'pending') then
    return query select selected_invite.event_id, existing_status;
    return;
  end if;

  if selected_invite.max_uses is not null and selected_invite.use_count >= selected_invite.max_uses then
    raise exception 'invalid_invite';
  end if;

  next_status := case
    when selected_event.join_policy = 'auto' then 'approved'::public.membership_status
    else 'pending'::public.membership_status
  end;

  if next_status = 'approved' and (
    select count(*)
    from public.event_members member
    where member.event_id = selected_invite.event_id
      and member.status = 'approved'
  ) >= selected_event.capacity then
    raise exception 'event_full';
  end if;

  insert into public.event_members(event_id, user_id, role, status, attendance_label)
  values (
    selected_invite.event_id,
    auth.uid(),
    'member',
    next_status,
    case when next_status = 'approved' then '未定' else null end
  )
  on conflict on constraint event_members_pkey do update
  set role = 'member',
      status = excluded.status,
      attendance_label = excluded.attendance_label,
      joined_at = now(),
      updated_at = now();

  update public.event_invites invite
  set use_count = invite.use_count + 1
  where invite.id = selected_invite.id;

  return query select selected_invite.event_id, next_status;
end;
$$;

revoke all on function public.join_event_by_invite(text) from public, anon;
grant execute on function public.join_event_by_invite(text) to authenticated;
