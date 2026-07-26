-- Profile/event images, immediate attendance, and consent-based event leaving.

alter table public.profiles
  add column if not exists avatar_path text
    check (avatar_path is null or char_length(avatar_path) <= 500);

alter table public.events
  add column if not exists cover_image_path text
    check (cover_image_path is null or char_length(cover_image_path) <= 500);

create table if not exists public.event_leave_requests (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  primary key (event_id, user_id)
);

alter table public.event_leave_requests enable row level security;
grant select on public.event_leave_requests to authenticated;

drop policy if exists leave_requests_read on public.event_leave_requests;
create policy leave_requests_read on public.event_leave_requests for select to authenticated
using (user_id = auth.uid() or private.can_manage_event(event_id));

-- Joining through an invite means both membership approval and attendance.
update public.event_members
set attendance_label = '参加',
    updated_at = now()
where status = 'approved'
  and coalesce(attendance_label, '未定') = '未定';

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
    update public.event_members
    set attendance_label = '参加', updated_at = now()
    where event_id = selected_invite.event_id and user_id = auth.uid();
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

create or replace function public.request_event_leave(target_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare member_role public.event_member_role;
begin
  select member.role into member_role
  from public.event_members member
  where member.event_id = target_event_id
    and member.user_id = auth.uid()
    and member.status = 'approved';
  if member_role is null then raise exception 'membership_not_found'; end if;
  if member_role = 'host' then raise exception 'host_cannot_leave'; end if;

  insert into public.event_leave_requests(event_id, user_id, status, requested_at, reviewed_at, reviewed_by)
  values (target_event_id, auth.uid(), 'pending', now(), null, null)
  on conflict (event_id, user_id) do update
  set status = 'pending', requested_at = now(), reviewed_at = null, reviewed_by = null;
end;
$$;

create or replace function public.cancel_event_leave_request(target_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.event_leave_requests
  set status = 'cancelled'
  where event_id = target_event_id and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'request_not_found'; end if;
end;
$$;

create or replace function public.review_event_leave_request(
  target_event_id uuid,
  target_user_id uuid,
  decision text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if decision not in ('approved', 'declined') then raise exception 'invalid_decision'; end if;
  if not private.can_manage_event(target_event_id) then raise exception 'not_allowed'; end if;
  if target_user_id = auth.uid() then raise exception 'self_review_not_allowed'; end if;

  update public.event_leave_requests
  set status = decision, reviewed_at = now(), reviewed_by = auth.uid()
  where event_id = target_event_id and user_id = target_user_id and status = 'pending';
  if not found then raise exception 'request_not_found'; end if;

  if decision = 'approved' then
    update public.event_members
    set status = 'removed', attendance_label = '不参加', updated_at = now()
    where event_id = target_event_id
      and user_id = target_user_id
      and role <> 'host'
      and status = 'approved';
    if not found then raise exception 'membership_not_found'; end if;
  end if;
end;
$$;

create or replace function public.delete_owned_event(target_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.events
  where id = target_event_id and owner_id = auth.uid();
  if not found then raise exception 'not_allowed'; end if;
end;
$$;

revoke all on function public.join_event_by_invite(text) from public, anon;
revoke all on function public.request_event_leave(uuid) from public, anon;
revoke all on function public.cancel_event_leave_request(uuid) from public, anon;
revoke all on function public.review_event_leave_request(uuid, uuid, text) from public, anon;
revoke all on function public.delete_owned_event(uuid) from public, anon;
grant execute on function public.join_event_by_invite(text) to authenticated;
grant execute on function public.request_event_leave(uuid) to authenticated;
grant execute on function public.cancel_event_leave_request(uuid) to authenticated;
grant execute on function public.review_event_leave_request(uuid, uuid, text) to authenticated;
grant execute on function public.delete_owned_event(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-media',
  'app-media',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists app_media_read on storage.objects;
create policy app_media_read on storage.objects for select to authenticated using (
  bucket_id = 'app-media' and (
    (
      (storage.foldername(name))[1] = 'profiles'
      and exists (
        select 1 from public.profiles profile
        where profile.id::text = (storage.foldername(name))[2]
          and (profile.id = auth.uid() or private.shares_event(profile.id))
      )
    )
    or (
      (storage.foldername(name))[1] = 'events'
      and private.is_event_member(((storage.foldername(name))[2])::uuid)
    )
  )
);

drop policy if exists app_media_upload on storage.objects;
create policy app_media_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'app-media' and (
    (
      (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'events'
      and private.can_manage_event(((storage.foldername(name))[2])::uuid)
    )
  )
);

drop policy if exists app_media_update on storage.objects;
create policy app_media_update on storage.objects for update to authenticated
using (
  bucket_id = 'app-media' and (
    ((storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'events' and private.can_manage_event(((storage.foldername(name))[2])::uuid))
  )
)
with check (
  bucket_id = 'app-media' and (
    ((storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'events' and private.can_manage_event(((storage.foldername(name))[2])::uuid))
  )
);

drop policy if exists app_media_delete on storage.objects;
create policy app_media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'app-media' and (
    ((storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'events' and private.can_manage_event(((storage.foldername(name))[2])::uuid))
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_leave_requests'
  ) then
    alter publication supabase_realtime add table public.event_leave_requests;
  end if;
end;
$$;
