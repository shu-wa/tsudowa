-- Private event-chat images and message metadata.

alter table public.messages
  add column if not exists image_path text,
  add column if not exists image_mime_type text,
  add column if not exists image_width integer,
  add column if not exists image_height integer;

alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages drop constraint if exists messages_image_metadata_check;

alter table public.messages alter column body set default '';
update public.messages set body = '' where body is null;
alter table public.messages alter column body set not null;

alter table public.messages
  add constraint messages_content_check check (
    char_length(body) <= 2000
    and (char_length(btrim(body)) > 0 or image_path is not null)
  ),
  add constraint messages_image_metadata_check check (
    image_path is null
    or (
      image_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
      and image_width between 1 and 20000
      and image_height between 1 and 20000
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.storage_event_id(object_name text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists messages_create_members on public.messages;
create policy messages_create_members on public.messages
for insert to authenticated
with check (
  private.is_event_member(event_id)
  and author_id = auth.uid()
  and (
    image_path is null
    or image_path like event_id::text || '/' || auth.uid()::text || '/' || id::text || '.%'
  )
);

drop policy if exists chat_media_read_members on storage.objects;
create policy chat_media_read_members on storage.objects
for select to authenticated
using (
  bucket_id = 'chat-media'
  and private.is_event_member(private.storage_event_id(name))
);

drop policy if exists chat_media_upload_members on storage.objects;
create policy chat_media_upload_members on storage.objects
for insert to authenticated
with check (
  bucket_id = 'chat-media'
  and owner_id = auth.uid()::text
  and private.is_event_member(private.storage_event_id(name))
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists chat_media_delete_owner_or_manager on storage.objects;
create policy chat_media_delete_owner_or_manager on storage.objects
for delete to authenticated
using (
  bucket_id = 'chat-media'
  and (
    owner_id = auth.uid()::text
    or private.can_manage_event(private.storage_event_id(name))
  )
);
