-- Security hardening for hostile clients that bypass the application UI.
-- Authorization is enforced in Postgres; the publishable client key remains public by design.

create index if not exists events_owner_created_idx
  on public.events(owner_id, created_at desc);
create index if not exists messages_author_created_idx
  on public.messages(author_id, created_at desc);
create index if not exists reports_reporter_created_idx
  on public.safety_reports(reporter_id, created_at desc);
create index if not exists invites_creator_created_idx
  on public.event_invites(created_by, created_at desc);

-- A cohost may edit event details, but ownership and system timestamps are immutable.
revoke update on public.events from authenticated;
grant update (
  title, category, tagline, description,
  start_date, end_date, start_time, end_time, time_mode, time_zone,
  location_name, address, latitude, longitude, capacity, status, join_policy,
  cover_color, accent_color, cover_image_path
) on public.events to authenticated;

-- Membership state and roles may only change through the checked RPCs below and
-- the existing join/leave/review RPCs. This prevents cohosts from promoting
-- themselves or demoting the host with a handcrafted REST request.
revoke insert, update, delete on public.event_members from authenticated;

-- Messages are append-only. Editing event_id on an existing message would allow
-- cross-event injection, so inserts go through a validating, rate-limited RPC.
revoke insert, update on public.messages from authenticated;

-- Invite rows are private implementation details. Managers issue invitations via RPC.
revoke insert, update, delete on public.event_invites from authenticated;

-- Consent evidence is an immutable server-timestamped audit trail.
revoke insert, update, delete on public.consent_records from authenticated;

-- Reports are validated and rate limited by RPC; clients cannot forge relationships.
revoke insert on public.safety_reports from authenticated;

-- Only user-editable profile fields can be changed from a client. Verification and
-- audit columns are server controlled.
revoke update on public.profiles from authenticated;
grant update (
  display_name, handle, city, date_of_birth, avatar_color, locale, time_zone, avatar_path
) on public.profiles to authenticated;

create or replace function private.validate_profile_age()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.date_of_birth is not null and new.date_of_birth is null then
    raise exception 'date_of_birth_cannot_be_cleared';
  end if;
  if new.date_of_birth is not null then
    if new.date_of_birth < date '1900-01-01'
      or new.date_of_birth > (current_date - interval '16 years')::date then
      raise exception 'age_requirement_not_met';
    end if;
    if tg_op = 'INSERT' or new.date_of_birth is distinct from old.date_of_birth then
      new.age_verified_at = now();
    end if;
  else
    new.age_verified_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_validate_age on public.profiles;
create trigger profiles_validate_age
before insert or update of date_of_birth on public.profiles
for each row execute function private.validate_profile_age();

create or replace function private.enforce_event_creation_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or new.owner_id <> auth.uid() then
    raise exception 'not_allowed';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 11));
  if (select count(*) from public.events event
      where event.owner_id = auth.uid() and event.created_at > now() - interval '1 hour') >= 20
    or (select count(*) from public.events event
      where event.owner_id = auth.uid() and event.created_at > now() - interval '1 day') >= 100 then
    raise exception 'event_rate_limit_exceeded';
  end if;
  new.created_at = now();
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_enforce_creation_rate on public.events;
create trigger events_enforce_creation_rate
before insert on public.events
for each row execute function private.enforce_event_creation_rate();

create or replace function public.record_legal_consents(
  terms_version text,
  privacy_version text,
  community_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if terms_version is null or char_length(terms_version) not between 1 and 40
    or privacy_version is null or char_length(privacy_version) not between 1 and 40
    or community_version is null or char_length(community_version) not between 1 and 40 then
    raise exception 'invalid_consent_version';
  end if;

  insert into public.consent_records(user_id, document, version, accepted, recorded_at, source)
  values
    (auth.uid(), 'terms', terms_version, true, now(), 'mobile'),
    (auth.uid(), 'privacy', privacy_version, true, now(), 'mobile'),
    (auth.uid(), 'community', community_version, true, now(), 'mobile');
end;
$$;

revoke all on function public.record_legal_consents(text, text, text) from public, anon;
grant execute on function public.record_legal_consents(text, text, text) to authenticated;

create or replace function public.create_event_invite(
  target_event_id uuid,
  valid_for interval default interval '7 days',
  allowed_uses integer default 50
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare raw_token text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not private.can_manage_event(target_event_id) then raise exception 'not_allowed'; end if;
  if valid_for is null or valid_for < interval '1 hour' or valid_for > interval '30 days' then
    raise exception 'invalid_invite_duration';
  end if;
  if allowed_uses is null or allowed_uses < 1 or allowed_uses > 1000 then
    raise exception 'invalid_invite_uses';
  end if;
  if exists (select 1 from public.events event
      where event.id = target_event_id and event.status = 'cancelled') then
    raise exception 'event_unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 12));
  if (select count(*) from public.event_invites invite
      where invite.created_by = auth.uid() and invite.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'invite_rate_limit_exceeded';
  end if;

  raw_token := upper(encode(extensions.gen_random_bytes(10), 'hex'));
  insert into public.event_invites(event_id, token_hash, created_by, expires_at, max_uses)
  values (
    target_event_id,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    auth.uid(),
    now() + valid_for,
    allowed_uses
  );
  return raw_token;
end;
$$;

revoke all on function public.create_event_invite(uuid, interval, integer) from public, anon;
grant execute on function public.create_event_invite(uuid, interval, integer) to authenticated;

create or replace function public.send_event_message(
  message_id uuid,
  target_event_id uuid,
  message_body text,
  message_image_path text,
  message_image_mime_type text,
  message_image_width integer,
  message_image_height integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_prefix text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not private.is_event_member(target_event_id) then raise exception 'not_allowed'; end if;
  if char_length(coalesce(message_body, '')) > 2000
    or (char_length(btrim(coalesce(message_body, ''))) = 0 and message_image_path is null) then
    raise exception 'invalid_message';
  end if;

  expected_prefix := target_event_id::text || '/' || auth.uid()::text || '/' || message_id::text || '.';
  if message_image_path is not null and (
    message_image_path not like expected_prefix || '%'
    or substring(message_image_path from char_length(expected_prefix) + 1) !~* '^(jpg|jpeg|png|webp|heic|heif)$'
    or message_image_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
    or message_image_width not between 1 and 20000
    or message_image_height not between 1 and 20000
  ) then
    raise exception 'invalid_message_image';
  end if;
  if message_image_path is null and (
    message_image_mime_type is not null or message_image_width is not null or message_image_height is not null
  ) then
    raise exception 'invalid_message_image';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 13));
  if (select count(*) from public.messages message
      where message.author_id = auth.uid() and message.created_at > now() - interval '1 minute') >= 30
    or (select count(*) from public.messages message
      where message.author_id = auth.uid() and message.created_at > now() - interval '1 day') >= 1000 then
    raise exception 'message_rate_limit_exceeded';
  end if;

  insert into public.messages(
    id, event_id, author_id, body, image_path, image_mime_type, image_width, image_height, created_at
  ) values (
    message_id, target_event_id, auth.uid(), coalesce(message_body, ''),
    message_image_path, message_image_mime_type, message_image_width, message_image_height, now()
  );
end;
$$;

revoke all on function public.send_event_message(uuid, uuid, text, text, text, integer, integer) from public, anon;
grant execute on function public.send_event_message(uuid, uuid, text, text, text, integer, integer) to authenticated;

create or replace function public.submit_safety_report(
  target_event_id uuid,
  target_message_id uuid,
  reported_user_id uuid,
  reported_user_name text,
  report_reason text,
  report_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_id uuid := extensions.gen_random_uuid();
  message_event_id uuid;
  message_author_id uuid;
  canonical_target_name text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if report_reason not in ('harassment', 'hate', 'sexual', 'violence', 'spam', 'privacy', 'other') then
    raise exception 'invalid_report_reason';
  end if;
  if report_details is not null and char_length(report_details) > 4000 then
    raise exception 'report_too_long';
  end if;

  if target_message_id is not null then
    select message.event_id, message.author_id
      into message_event_id, message_author_id
    from public.messages message
    where message.id = target_message_id;
    if message_event_id is null or not private.is_event_member(message_event_id) then
      raise exception 'message_not_reportable';
    end if;
    if target_event_id is not null and target_event_id <> message_event_id then
      raise exception 'report_target_mismatch';
    end if;
    if reported_user_id is not null and reported_user_id <> message_author_id then
      raise exception 'report_target_mismatch';
    end if;
    target_event_id := message_event_id;
    reported_user_id := message_author_id;
  elsif target_event_id is not null and not private.is_event_member(target_event_id) then
    raise exception 'event_not_reportable';
  end if;

  if reported_user_id is not null then
    if reported_user_id = auth.uid() then raise exception 'self_report_not_allowed'; end if;
    if target_event_id is not null then
      if not exists (
        select 1 from public.event_members member
        where member.event_id = target_event_id
          and member.user_id = reported_user_id
          and member.status = 'approved'
      ) then raise exception 'user_not_reportable'; end if;
    elsif not private.shares_event(reported_user_id) then
      raise exception 'user_not_reportable';
    end if;
    select profile.display_name into canonical_target_name
    from public.profiles profile where profile.id = reported_user_id;
    if canonical_target_name is null then raise exception 'user_not_found'; end if;
  else
    canonical_target_name := nullif(left(btrim(coalesce(reported_user_name, '')), 80), '');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 14));
  if (select count(*) from public.safety_reports report
      where report.reporter_id = auth.uid() and report.created_at > now() - interval '1 hour') >= 10
    or (select count(*) from public.safety_reports report
      where report.reporter_id = auth.uid() and report.created_at > now() - interval '1 day') >= 30 then
    raise exception 'report_rate_limit_exceeded';
  end if;

  insert into public.safety_reports(
    id, reporter_id, event_id, message_id, target_user_id, target_user_name,
    reason, details, status, created_at
  ) values (
    report_id, auth.uid(), target_event_id, target_message_id, reported_user_id,
    canonical_target_name, report_reason, nullif(btrim(coalesce(report_details, '')), ''), 'received', now()
  );
  return report_id;
end;
$$;

revoke all on function public.submit_safety_report(uuid, uuid, uuid, text, text, text) from public, anon;
grant execute on function public.submit_safety_report(uuid, uuid, uuid, text, text, text) to authenticated;

-- Storage object names must exactly match the paths generated by the app.
-- The per-uploader quota limits damage from abandoned or intentionally spammed uploads.
create or replace function private.storage_upload_within_quota(target_bucket text, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) < 500
    and coalesce(sum(coalesce((object.metadata ->> 'size')::bigint, 0)), 0) < 209715200
  from storage.objects object
  where object.bucket_id = target_bucket and object.owner_id = target_user_id::text;
$$;

drop policy if exists chat_media_read_members on storage.objects;
create policy chat_media_read_members on storage.objects
for select to authenticated
using (
  bucket_id = 'chat-media'
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|heic|heif)$'
  and private.is_event_member(private.storage_event_id(name))
);

drop policy if exists chat_media_upload_members on storage.objects;
create policy chat_media_upload_members on storage.objects
for insert to authenticated
with check (
  bucket_id = 'chat-media'
  and owner_id = auth.uid()::text
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|heic|heif)$'
  and private.is_event_member(private.storage_event_id(name))
  and (storage.foldername(name))[2] = auth.uid()::text
  and private.storage_upload_within_quota('chat-media', auth.uid())
);

drop policy if exists app_media_read on storage.objects;
create policy app_media_read on storage.objects for select to authenticated using (
  bucket_id = 'app-media' and (
    (
      name ~* '^profiles/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|heic|heif)$'
      and exists (
        select 1 from public.profiles profile
        where profile.id::text = (storage.foldername(name))[2]
          and (profile.id = auth.uid() or private.shares_event(profile.id))
      )
    ) or (
      name ~* '^events/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/cover/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|heic|heif)$'
      and private.is_event_member(((storage.foldername(name))[2])::uuid)
    )
  )
);

drop policy if exists app_media_upload on storage.objects;
create policy app_media_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'app-media'
  and owner_id = auth.uid()::text
  and private.storage_upload_within_quota('app-media', auth.uid())
  and (
    (
      name ~* '^profiles/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|heic|heif)$'
      and (storage.foldername(name))[2] = auth.uid()::text
    ) or (
      name ~* '^events/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/cover/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|heic|heif)$'
      and private.can_manage_event(((storage.foldername(name))[2])::uuid)
    )
  )
);

drop policy if exists app_media_update on storage.objects;
-- Uploads use unique object names and never need in-place mutation.

drop policy if exists app_media_delete on storage.objects;
create policy app_media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'app-media' and (
    (
      name ~* '^profiles/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|heic|heif)$'
      and (storage.foldername(name))[2] = auth.uid()::text
    ) or (
      name ~* '^events/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/cover/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|heic|heif)$'
      and private.can_manage_event(((storage.foldername(name))[2])::uuid)
    )
  )
);
