-- Manual, immutable event archives.
-- This migration is intentionally applied only after the client changes have been reviewed.

alter table public.events
  add column if not exists archived_at timestamptz;

create index if not exists events_archived_at_idx
  on public.events(archived_at desc)
  where archived_at is not null;

create or replace function private.is_event_archived(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events event
    where event.id = target_event_id and event.archived_at is not null
  );
$$;

create or replace function public.archive_event(target_event_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.events%rowtype;
  event_end timestamptz;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not private.can_manage_event(target_event_id) then raise exception 'not_allowed'; end if;

  select * into target from public.events event where event.id = target_event_id for update;
  if target.id is null then raise exception 'event_not_found'; end if;
  if target.archived_at is not null then return target.archived_at; end if;

  event_end := (
    target.end_date::text || ' ' ||
    case when target.time_mode = 'range' and target.end_time is not null
      then target.end_time::text else '23:59:59' end
  )::timestamp at time zone target.time_zone;
  if event_end >= now() then raise exception 'event_not_finished'; end if;

  update public.events set archived_at = now(), status = 'completed'
  where id = target_event_id
  returning archived_at into target.archived_at;
  return target.archived_at;
end;
$$;

revoke all on function public.archive_event(uuid) from public, anon;
grant execute on function public.archive_event(uuid) to authenticated;

create or replace function private.reject_archived_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
  target_collection_id uuid;
  target_candidate_id uuid;
begin
  if auth.role() = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name = 'events' then
    if tg_op in ('UPDATE', 'DELETE') and old.archived_at is not null then
      raise exception 'archived_event_is_read_only';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name = 'collection_shares' then
    target_collection_id := case when tg_op = 'DELETE' then old.collection_id else new.collection_id end;
    select collection.event_id into target_event_id from public.collections collection where collection.id = target_collection_id;
  elsif tg_table_name = 'date_candidate_votes' then
    target_candidate_id := case when tg_op = 'DELETE' then old.candidate_id else new.candidate_id end;
    select candidate.event_id into target_event_id from public.date_candidates candidate where candidate.id = target_candidate_id;
  else
    target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  end if;

  if target_event_id is not null and private.is_event_archived(target_event_id) then
    raise exception 'archived_event_is_read_only';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists events_reject_archived_mutation on public.events;
create trigger events_reject_archived_mutation
before update or delete on public.events
for each row execute function private.reject_archived_event_mutation();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'event_members', 'schedule_items', 'collections', 'collection_shares',
    'messages', 'event_invites', 'date_candidates', 'date_candidate_votes',
    'event_leave_requests'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_reject_archived_mutation', table_name);
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function private.reject_archived_event_mutation()',
      table_name || '_reject_archived_mutation', table_name
    );
  end loop;
end;
$$;

-- Archived event media stays readable, but clients cannot upload or delete it.
drop policy if exists chat_media_upload_members on storage.objects;
create policy chat_media_upload_members on storage.objects
for insert to authenticated
with check (
  bucket_id = 'chat-media'
  and owner_id = auth.uid()::text
  and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|heic|heif)$'
  and private.is_event_member(private.storage_event_id(name))
  and not private.is_event_archived(private.storage_event_id(name))
  and (storage.foldername(name))[2] = auth.uid()::text
  and private.storage_upload_within_quota('chat-media', auth.uid())
);

drop policy if exists chat_media_delete_owner_or_manager on storage.objects;
create policy chat_media_delete_owner_or_manager on storage.objects
for delete to authenticated
using (
  bucket_id = 'chat-media'
  and not private.is_event_archived(private.storage_event_id(name))
  and (
    owner_id = auth.uid()::text
    or private.can_manage_event(private.storage_event_id(name))
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
      and not private.is_event_archived(((storage.foldername(name))[2])::uuid)
    )
  )
);

drop policy if exists app_media_delete on storage.objects;
create policy app_media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'app-media' and (
    (
      name ~* '^profiles/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|heic|heif)$'
      and (storage.foldername(name))[2] = auth.uid()::text
    ) or (
      name ~* '^events/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/cover/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|heic|heif)$'
      and private.can_manage_event(((storage.foldername(name))[2])::uuid)
      and not private.is_event_archived(((storage.foldername(name))[2])::uuid)
    )
  )
);
