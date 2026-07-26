-- An invite sets attendance to "参加" only for the first successful join.
-- Re-entering a code must not overwrite a later "未定" or "不参加" choice.

create or replace function public.join_event_by_invite(raw_token text)
returns table(event_id uuid, membership_status public.membership_status)
language plpgsql security definer set search_path = '' as $$
declare
  selected_invite public.event_invites%rowtype;
  selected_event public.events%rowtype;
  existing_status public.membership_status;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles profile where profile.id = auth.uid()) then
    raise exception 'profile_not_found';
  end if;

  select invite.* into selected_invite
  from public.event_invites invite
  where invite.token_hash = encode(extensions.digest(upper(trim(raw_token)), 'sha256'), 'hex')
    and invite.revoked_at is null
    and (invite.expires_at is null or invite.expires_at > now())
  for update;
  if selected_invite.id is null then raise exception 'invalid_invite'; end if;

  select event.* into selected_event
  from public.events event
  where event.id = selected_invite.event_id
  for update;
  if selected_event.id is null or selected_event.status = 'cancelled' then raise exception 'event_unavailable'; end if;

  select member.status into existing_status
  from public.event_members member
  where member.event_id = selected_invite.event_id and member.user_id = auth.uid();

  if existing_status = 'approved' then
    return query select selected_invite.event_id, 'approved'::public.membership_status;
    return;
  end if;

  if selected_invite.max_uses is not null and selected_invite.use_count >= selected_invite.max_uses then
    raise exception 'invalid_invite';
  end if;
  if (
    select count(*) from public.event_members member
    where member.event_id = selected_invite.event_id and member.status = 'approved'
  ) >= selected_event.capacity then
    raise exception 'event_full';
  end if;

  insert into public.event_members(event_id, user_id, role, status, attendance_label)
  values (selected_invite.event_id, auth.uid(), 'member', 'approved', '参加')
  on conflict on constraint event_members_pkey do update
  set role = 'member',
      status = 'approved',
      attendance_label = '参加',
      joined_at = now(),
      updated_at = now();

  update public.event_invites invite
  set use_count = invite.use_count + 1
  where invite.id = selected_invite.id;

  return query select selected_invite.event_id, 'approved'::public.membership_status;
end;
$$;

revoke all on function public.join_event_by_invite(text) from public, anon;
grant execute on function public.join_event_by_invite(text) to authenticated;
