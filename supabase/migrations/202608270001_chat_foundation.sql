-- Secure conversation foundation: replies, reactions, editing, unsend, pins,
-- read receipts (from event_members.chat_read_at), and private Realtime presence.

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by uuid references public.profiles(id) on delete set null;

alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages
  add constraint messages_content_check check (
    deleted_at is not null
    or char_length(btrim(body)) > 0
    or image_path is not null
  );

alter table public.messages drop constraint if exists messages_deleted_state_check;
alter table public.messages
  add constraint messages_deleted_state_check check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  );

alter table public.messages drop constraint if exists messages_pinned_state_check;
alter table public.messages
  add constraint messages_pinned_state_check check (
    (pinned_at is null and pinned_by is null)
    or (pinned_at is not null and pinned_by is not null)
  );

create index if not exists messages_reply_to_idx on public.messages(reply_to_id)
  where reply_to_id is not null;
create index if not exists messages_event_pinned_idx on public.messages(event_id, pinned_at desc)
  where pinned_at is not null and deleted_at is null;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists message_reactions_message_idx
  on public.message_reactions(message_id, created_at);
alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from public, anon, authenticated;
grant select on public.message_reactions to authenticated;

drop policy if exists message_reactions_read_members on public.message_reactions;
create policy message_reactions_read_members on public.message_reactions
for select to authenticated using (
  exists (
    select 1 from public.messages message
    where message.id = message_reactions.message_id
      and private.is_event_member(message.event_id)
  )
);

create or replace function public.send_event_message_v2(
  message_id uuid,
  target_event_id uuid,
  message_body text,
  message_image_path text,
  message_image_mime_type text,
  message_image_width integer,
  message_image_height integer,
  reply_to_message_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_prefix text;
  replied_event_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not private.is_event_member(target_event_id) then raise exception 'not_allowed'; end if;
  if private.is_event_archived(target_event_id) then raise exception 'archived_event_is_read_only'; end if;
  if char_length(coalesce(message_body, '')) > 2000
    or (char_length(btrim(coalesce(message_body, ''))) = 0 and message_image_path is null) then
    raise exception 'invalid_message';
  end if;

  if reply_to_message_id is not null then
    select message.event_id into replied_event_id
    from public.messages message
    where message.id = reply_to_message_id and message.deleted_at is null;
    if replied_event_id is null or replied_event_id <> target_event_id then
      raise exception 'invalid_reply_target';
    end if;
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

  if (select count(*) from public.messages message
      where message.author_id = auth.uid() and message.created_at > now() - interval '1 minute') >= 30
    or (select count(*) from public.messages message
      where message.author_id = auth.uid() and message.created_at > now() - interval '1 day') >= 1000 then
    raise exception 'message_rate_limit_exceeded';
  end if;

  insert into public.messages(
    id, event_id, author_id, body, image_path, image_mime_type,
    image_width, image_height, reply_to_id, created_at
  ) values (
    message_id, target_event_id, auth.uid(), coalesce(message_body, ''),
    message_image_path, message_image_mime_type, message_image_width,
    message_image_height, reply_to_message_id, now()
  );
end;
$$;

revoke all on function public.send_event_message_v2(uuid, uuid, text, text, text, integer, integer, uuid) from public, anon;
grant execute on function public.send_event_message_v2(uuid, uuid, text, text, text, integer, integer, uuid) to authenticated;

create or replace function public.edit_event_message(target_message_id uuid, new_body text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.messages%rowtype;
  changed_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into target from public.messages message where message.id = target_message_id for update;
  if target.id is null then raise exception 'message_not_found'; end if;
  if target.author_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if target.deleted_at is not null then raise exception 'message_deleted'; end if;
  if private.is_event_archived(target.event_id) then raise exception 'archived_event_is_read_only'; end if;
  if target.created_at < now() - interval '15 minutes' then raise exception 'edit_window_expired'; end if;
  if char_length(btrim(coalesce(new_body, ''))) = 0 or char_length(new_body) > 2000 then
    raise exception 'invalid_message';
  end if;

  update public.messages set body = btrim(new_body), edited_at = changed_at
  where id = target_message_id;
  return changed_at;
end;
$$;

revoke all on function public.edit_event_message(uuid, text) from public, anon;
grant execute on function public.edit_event_message(uuid, text) to authenticated;

create or replace function public.delete_event_message(target_message_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.messages%rowtype;
  previous_image_path text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into target from public.messages message where message.id = target_message_id for update;
  if target.id is null then raise exception 'message_not_found'; end if;
  if private.is_event_archived(target.event_id) then raise exception 'archived_event_is_read_only'; end if;
  if target.author_id <> auth.uid() and not private.can_manage_event(target.event_id) then
    raise exception 'not_allowed';
  end if;
  if target.author_id = auth.uid() and target.created_at < now() - interval '24 hours'
    and not private.can_manage_event(target.event_id) then
    raise exception 'delete_window_expired';
  end if;
  if target.deleted_at is not null then return null; end if;

  previous_image_path := target.image_path;
  update public.messages set
    body = '', image_path = null, image_mime_type = null,
    image_width = null, image_height = null,
    deleted_at = now(), deleted_by = auth.uid(),
    pinned_at = null, pinned_by = null, edited_at = null
  where id = target_message_id;
  delete from public.message_reactions reaction where reaction.message_id = target_message_id;
  return previous_image_path;
end;
$$;

revoke all on function public.delete_event_message(uuid) from public, anon;
grant execute on function public.delete_event_message(uuid) to authenticated;

create or replace function public.toggle_message_reaction(target_message_id uuid, reaction_emoji text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if reaction_emoji not in ('👍', '❤️', '😂', '😮', '😢', '🙏') then raise exception 'invalid_reaction'; end if;
  select message.event_id into target_event_id from public.messages message
  where message.id = target_message_id and message.deleted_at is null;
  if target_event_id is null then raise exception 'message_not_found'; end if;
  if not private.is_event_member(target_event_id) then raise exception 'not_allowed'; end if;
  if private.is_event_archived(target_event_id) then raise exception 'archived_event_is_read_only'; end if;

  if exists (
    select 1 from public.message_reactions reaction
    where reaction.message_id = target_message_id
      and reaction.user_id = auth.uid()
      and reaction.emoji = reaction_emoji
  ) then
    delete from public.message_reactions reaction
    where reaction.message_id = target_message_id
      and reaction.user_id = auth.uid()
      and reaction.emoji = reaction_emoji;
    return false;
  end if;

  insert into public.message_reactions(message_id, user_id, emoji)
  values (target_message_id, auth.uid(), reaction_emoji);
  return true;
end;
$$;

revoke all on function public.toggle_message_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_message_reaction(uuid, text) to authenticated;

create or replace function public.set_message_pin(target_message_id uuid, should_pin boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
  result timestamptz;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select message.event_id into target_event_id from public.messages message
  where message.id = target_message_id and message.deleted_at is null;
  if target_event_id is null then raise exception 'message_not_found'; end if;
  if not private.can_manage_event(target_event_id) then raise exception 'not_allowed'; end if;
  if private.is_event_archived(target_event_id) then raise exception 'archived_event_is_read_only'; end if;

  update public.messages set
    pinned_at = case when should_pin then now() else null end,
    pinned_by = case when should_pin then auth.uid() else null end
  where id = target_message_id
  returning pinned_at into result;
  return result;
end;
$$;

revoke all on function public.set_message_pin(uuid, boolean) from public, anon;
grant execute on function public.set_message_pin(uuid, boolean) to authenticated;

create or replace function private.reject_archived_message_reaction_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_message_id uuid;
  target_event_id uuid;
begin
  if auth.role() = 'service_role' then return case when tg_op = 'DELETE' then old else new end; end if;
  target_message_id := case when tg_op = 'DELETE' then old.message_id else new.message_id end;
  select message.event_id into target_event_id from public.messages message where message.id = target_message_id;
  if target_event_id is not null and private.is_event_archived(target_event_id) then
    raise exception 'archived_event_is_read_only';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists message_reactions_reject_archived_mutation on public.message_reactions;
create trigger message_reactions_reject_archived_mutation
before insert or update or delete on public.message_reactions
for each row execute function private.reject_archived_message_reaction_mutation();

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end;
$$;

-- Topic format: event:<event UUID>:chat. Invalid topics resolve to NULL instead
-- of throwing, so arbitrary clients cannot turn policy evaluation into errors.
create or replace function private.realtime_chat_event_id(topic text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if topic !~* '^event:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:chat$' then
    return null;
  end if;
  return split_part(topic, ':', 2)::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists event_chat_realtime_read on realtime.messages;
create policy event_chat_realtime_read on realtime.messages
for select to authenticated using (
  realtime.messages.extension in ('broadcast', 'presence')
  and private.is_event_member(private.realtime_chat_event_id((select realtime.topic())))
);

drop policy if exists event_chat_realtime_write on realtime.messages;
create policy event_chat_realtime_write on realtime.messages
for insert to authenticated with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and private.is_event_member(private.realtime_chat_event_id((select realtime.topic())))
);
