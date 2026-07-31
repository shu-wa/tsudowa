-- Enforce user-generated text filtering at the database boundary and provide
-- moderator-only tools for hiding or removing reported chat content.

create or replace function private.contains_objectionable_content(input_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(
    pg_catalog.translate(coalesce(input_text, ''), E' \t\n\r　', '')
  ) ~ '(死ね|殺す|消えろ|レイプ|児童ポルノ|child(porn|sexual)|nudes?.*(送れ|send)|裸の写真.*送れ)';
$$;

create or replace function private.enforce_message_content_safety()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.contains_objectionable_content(new.body) then
    raise exception using errcode = '22023', message = 'objectionable_content';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_content_safety on public.messages;
create trigger messages_content_safety
before insert or update of body on public.messages
for each row execute function private.enforce_message_content_safety();

-- Removed content is no longer returned to event members. Moderators can still
-- inspect it while resolving a report and preserving evidence where necessary.
drop policy if exists messages_read_members on public.messages;
create policy messages_read_members on public.messages
for select to authenticated
using (
  (private.is_event_member(event_id) and moderation_state = 'visible')
  or private.is_moderator()
);

create or replace function public.moderate_message(
  target_message_id uuid,
  target_state text,
  moderator_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not private.is_moderator() then raise exception 'not_allowed'; end if;
  if target_state not in ('visible', 'hidden', 'removed') then
    raise exception 'invalid_moderation_state';
  end if;
  if moderator_note is not null and char_length(moderator_note) > 2000 then
    raise exception 'moderator_note_too_long';
  end if;

  update public.messages
  set moderation_state = target_state,
      edited_at = now()
  where id = target_message_id;

  if not found then raise exception 'message_not_found'; end if;

  if target_state in ('hidden', 'removed') then
    update public.safety_reports
    set status = 'resolved',
        resolution_note = nullif(btrim(coalesce(moderator_note, '')), ''),
        assigned_to = auth.uid(),
        resolved_at = now()
    where message_id = target_message_id
      and status in ('received', 'reviewing');
  end if;
end;
$$;

revoke all on function public.moderate_message(uuid, text, text) from public, anon;
grant execute on function public.moderate_message(uuid, text, text) to authenticated;

