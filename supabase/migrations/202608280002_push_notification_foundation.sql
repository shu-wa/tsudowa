-- Per-type notification preferences, device tokens, and a server-only outbox.

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  master_enabled boolean not null default false,
  event_reminders boolean not null default true,
  collection_reminders boolean not null default true,
  chat_messages boolean not null default true,
  mentions_and_replies boolean not null default true,
  event_updates boolean not null default true,
  membership_updates boolean not null default true,
  collection_updates boolean not null default true,
  group_updates boolean not null default true,
  announcements boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_start time not null default '22:00',
  quiet_end time not null default '08:00',
  time_zone text not null default 'Asia/Tokyo',
  updated_at timestamptz not null default now()
);

create table public.push_devices (
  expo_push_token text primary key
    check (expo_push_token ~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  installation_id uuid not null,
  platform text not null check (platform in ('ios', 'android')),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, installation_id)
);

create table public.event_notification_preferences (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  muted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_id uuid references public.events(id) on delete cascade,
  kind text not null check (kind in (
    'chat_message', 'mention_or_reply', 'event_update',
    'membership_update', 'collection_update', 'group_update', 'announcement'
  )),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  route text not null check (char_length(route) between 1 and 500),
  dedupe_key text unique,
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  claimed_at timestamptz,
  claim_token uuid,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index notification_outbox_pending_idx
on public.notification_outbox(available_at, created_at)
where processed_at is null;
create index push_devices_user_idx on public.push_devices(user_id) where active;

alter table public.notification_preferences enable row level security;
alter table public.push_devices enable row level security;
alter table public.event_notification_preferences enable row level security;
alter table public.notification_outbox enable row level security;

revoke all on public.notification_preferences from public, anon, authenticated;
revoke all on public.push_devices from public, anon, authenticated;
revoke all on public.event_notification_preferences from public, anon, authenticated;
revoke all on public.notification_outbox from public, anon, authenticated;

grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.event_notification_preferences to authenticated;

create policy notification_preferences_own on public.notification_preferences
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy event_notification_preferences_own on public.event_notification_preferences
for all to authenticated using (user_id = auth.uid())
with check (user_id = auth.uid() and private.is_event_member(event_id));

create trigger notification_preferences_updated_at before update on public.notification_preferences
for each row execute function private.set_updated_at();
create trigger event_notification_preferences_updated_at before update on public.event_notification_preferences
for each row execute function private.set_updated_at();

create or replace function public.register_push_device(
  push_token text,
  device_installation_id uuid,
  device_platform text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if push_token !~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'invalid_push_token';
  end if;
  if device_platform not in ('ios', 'android') then raise exception 'invalid_platform'; end if;
  if exists (
    select 1 from public.push_devices device
    where device.expo_push_token = push_token
      and device.user_id <> auth.uid() and device.active
      and device.installation_id <> device_installation_id
  ) then raise exception 'push_token_in_use'; end if;

  delete from public.push_devices
  where user_id = auth.uid()
    and installation_id = device_installation_id
    and expo_push_token <> push_token;
  update public.push_devices set active = false, last_seen_at = now()
  where user_id <> auth.uid() and installation_id = device_installation_id;
  insert into public.push_devices(
    expo_push_token, user_id, installation_id, platform, active, last_seen_at
  ) values (
    push_token, auth.uid(), device_installation_id, device_platform, true, now()
  )
  on conflict (expo_push_token) do update
  set user_id = auth.uid(), installation_id = excluded.installation_id,
      platform = excluded.platform, active = true, last_seen_at = now();
end;
$$;

create or replace function public.unregister_push_device(device_installation_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.push_devices set active = false, last_seen_at = now()
  where user_id = auth.uid() and installation_id = device_installation_id;
$$;

revoke all on function public.register_push_device(text, uuid, text) from public, anon;
revoke all on function public.unregister_push_device(uuid) from public, anon;
grant execute on function public.register_push_device(text, uuid, text) to authenticated;
grant execute on function public.unregister_push_device(uuid) to authenticated;

create or replace function public.claim_notification_outbox(
  worker_token uuid,
  batch_size integer default 100
)
returns setof public.notification_outbox
language sql security definer set search_path = '' as $$
  with candidates as (
    select queued.id
    from public.notification_outbox queued
    where queued.processed_at is null
      and queued.available_at <= now()
      and (queued.claimed_at is null or queued.claimed_at < now() - interval '5 minutes')
    order by queued.created_at
    for update skip locked
    limit least(greatest(batch_size, 1), 100)
  ), claimed as (
    update public.notification_outbox queued
    set claimed_at = now(), claim_token = worker_token
    from candidates
    where queued.id = candidates.id
    returning queued.*
  )
  select * from claimed;
$$;
revoke all on function public.claim_notification_outbox(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(uuid, integer) to service_role;

create or replace function private.enqueue_event_notification(
  target_recipient_id uuid,
  target_actor_id uuid,
  target_event_id uuid,
  notification_kind text,
  notification_title text,
  notification_body text,
  notification_route text,
  notification_dedupe_key text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_recipient_id is null or target_recipient_id = target_actor_id then return; end if;
  if exists (
    select 1 from public.blocked_users block
    where (block.blocker_id = target_recipient_id and block.blocked_id = target_actor_id)
       or (block.blocker_id = target_actor_id and block.blocked_id = target_recipient_id)
  ) then return; end if;
  if target_event_id is not null and exists (
    select 1 from public.event_notification_preferences preference
    where preference.event_id = target_event_id
      and preference.user_id = target_recipient_id and preference.muted
  ) then return; end if;

  insert into public.notification_outbox(
    recipient_id, actor_id, event_id, kind, title, body, route, dedupe_key
  ) values (
    target_recipient_id, target_actor_id, target_event_id, notification_kind,
    left(notification_title, 120), left(notification_body, 500),
    left(notification_route, 500), notification_dedupe_key
  ) on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function private.notify_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  recipient record;
  author_name text;
  replied_author uuid;
  selected_kind text;
begin
  if current_setting('tsudowa.suppress_notifications', true) = 'on' then return new; end if;
  select profile.display_name into author_name
  from public.profiles profile where profile.id = new.author_id;
  if new.reply_to_id is not null then
    select message.author_id into replied_author
    from public.messages message where message.id = new.reply_to_id;
  end if;

  for recipient in
    select member.user_id, profile.handle
    from public.event_members member
    join public.profiles profile on profile.id = member.user_id
    where member.event_id = new.event_id
      and member.status = 'approved' and member.user_id <> new.author_id
  loop
    selected_kind := case
      when recipient.user_id = replied_author
        or (recipient.handle is not null and new.body ilike '%' || recipient.handle || '%')
      then 'mention_or_reply' else 'chat_message' end;
    perform private.enqueue_event_notification(
      recipient.user_id, new.author_id, new.event_id, selected_kind,
      coalesce(author_name, 'メンバー') || 'さんからメッセージ',
      coalesce(nullif(new.body, ''), '写真が届きました'),
      '/event/' || new.event_id::text || '/chat',
      'message:' || new.id::text || ':' || recipient.user_id::text
    );
  end loop;
  return new;
end;
$$;

create trigger messages_enqueue_notification
after insert on public.messages
for each row execute function private.notify_new_message();

create or replace function private.notify_pinned_announcement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient record; event_title text;
begin
  if old.pinned_at is not null or new.pinned_at is null then return new; end if;
  select event.title into event_title from public.events event where event.id = new.event_id;
  for recipient in
    select member.user_id from public.event_members member
    where member.event_id = new.event_id
      and member.status = 'approved' and member.user_id <> auth.uid()
  loop
    perform private.enqueue_event_notification(
      recipient.user_id, auth.uid(), new.event_id, 'announcement',
      '「' || coalesce(event_title, 'イベント') || '」からのお知らせ',
      coalesce(nullif(new.body, ''), '主催者がお知らせを固定しました'),
      '/event/' || new.event_id::text || '/chat',
      'announcement:' || new.id::text || ':' || recipient.user_id::text
    );
  end loop;
  return new;
end;
$$;

create trigger messages_enqueue_pinned_announcement
after update of pinned_at on public.messages
for each row execute function private.notify_pinned_announcement();

create or replace function private.notify_event_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient record; change_summary text;
begin
  if current_setting('tsudowa.suppress_notifications', true) = 'on' then return new; end if;
  if not (
    old.title is distinct from new.title
    or old.start_date is distinct from new.start_date
    or old.end_date is distinct from new.end_date
    or old.start_time is distinct from new.start_time
    or old.end_time is distinct from new.end_time
    or old.date_status is distinct from new.date_status
    or old.location_name is distinct from new.location_name
    or old.address is distinct from new.address
  ) then return new; end if;
  change_summary := case
    when old.date_status is distinct from new.date_status
      or old.start_date is distinct from new.start_date
      or old.end_date is distinct from new.end_date
      or old.start_time is distinct from new.start_time
      or old.end_time is distinct from new.end_time
      then '日時が更新されました'
    when old.location_name is distinct from new.location_name
      or old.address is distinct from new.address
      then '場所が更新されました'
    else 'イベント情報が更新されました' end;
  for recipient in
    select member.user_id from public.event_members member
    where member.event_id = new.id
      and member.status = 'approved' and member.user_id <> auth.uid()
  loop
    perform private.enqueue_event_notification(
      recipient.user_id, auth.uid(), new.id, 'event_update',
      '「' || new.title || '」の更新', change_summary,
      '/event/' || new.id::text,
      'event-update:' || new.id::text || ':' || new.updated_at::text || ':' || recipient.user_id::text
    );
  end loop;
  return new;
end;
$$;

create trigger events_enqueue_change_notification
after update on public.events
for each row execute function private.notify_event_change();

create or replace function private.notify_group_event_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient record; group_name text; actor uuid := auth.uid();
begin
  if new.group_id is null then return new; end if;
  select event_group.name into group_name
  from public.event_groups event_group where event_group.id = new.group_id;
  for recipient in
    select member.user_id from public.event_group_members member
    where member.group_id = new.group_id and member.user_id <> actor
  loop
    perform private.enqueue_event_notification(
      recipient.user_id, actor, new.id, 'group_update',
      '「' || coalesce(group_name, 'グループ') || '」の新しいイベント',
      '「' || new.title || '」が追加されました',
      '/event/' || new.id::text,
      'group-event:' || new.id::text || ':' || recipient.user_id::text
    );
  end loop;
  return new;
end;
$$;

create trigger events_enqueue_group_event_notification
after insert on public.events
for each row execute function private.notify_group_event_created();

create or replace function private.notify_membership_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient record; member_name text; event_title text; summary text;
begin
  if current_setting('tsudowa.suppress_notifications', true) = 'on' then return new; end if;
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  select profile.display_name into member_name
  from public.profiles profile where profile.id = new.user_id;
  select event.title into event_title from public.events event where event.id = new.event_id;
  summary := case new.status
    when 'pending' then coalesce(member_name, 'メンバー') || 'さんから参加申請が届きました'
    when 'approved' then coalesce(member_name, 'メンバー') || 'さんが参加しました'
    when 'removed' then coalesce(member_name, 'メンバー') || 'さんが脱退しました'
    else coalesce(member_name, 'メンバー') || 'さんの参加状態が更新されました' end;
  for recipient in
    select member.user_id from public.event_members member
    where member.event_id = new.event_id
      and member.status = 'approved' and member.user_id <> new.user_id
      and (new.status <> 'pending' or member.role in ('host', 'cohost'))
  loop
    perform private.enqueue_event_notification(
      recipient.user_id, new.user_id, new.event_id, 'membership_update',
      coalesce(event_title, 'イベント') || 'の参加者更新', summary,
      '/event/' || new.event_id::text || '/participants',
      'member:' || new.event_id::text || ':' || new.user_id::text || ':' ||
        new.status::text || ':' || recipient.user_id::text
    );
  end loop;
  return new;
end;
$$;

create trigger event_members_enqueue_notification
after insert or update of status on public.event_members
for each row execute function private.notify_membership_change();

create or replace function private.notify_leave_request_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient record; member_name text; event_title text; summary text;
begin
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  select profile.display_name into member_name
  from public.profiles profile where profile.id = new.user_id;
  select event.title into event_title from public.events event where event.id = new.event_id;
  summary := case new.status
    when 'pending' then coalesce(member_name, 'メンバー') || 'さんから脱退申請が届きました'
    when 'approved' then '脱退申請が承認されました'
    when 'declined' then '脱退申請は承認されませんでした'
    else '脱退申請が取り消されました' end;
  if new.status = 'pending' then
    for recipient in
      select member.user_id from public.event_members member
      where member.event_id = new.event_id and member.status = 'approved'
        and member.role in ('host', 'cohost') and member.user_id <> new.user_id
    loop
      perform private.enqueue_event_notification(
        recipient.user_id, new.user_id, new.event_id, 'membership_update',
        coalesce(event_title, 'イベント') || 'の脱退申請', summary,
        '/event/' || new.event_id::text || '/participants',
        'leave:' || new.event_id::text || ':' || new.user_id::text ||
          ':pending:' || recipient.user_id::text
      );
    end loop;
  elsif new.status in ('approved', 'declined') then
    perform private.enqueue_event_notification(
      new.user_id, new.reviewed_by, new.event_id, 'membership_update',
      coalesce(event_title, 'イベント') || 'の脱退申請', summary,
      '/event/' || new.event_id::text,
      'leave:' || new.event_id::text || ':' || new.user_id::text || ':' || new.status
    );
  end if;
  return new;
end;
$$;

create trigger event_leave_requests_enqueue_notification
after insert or update of status on public.event_leave_requests
for each row execute function private.notify_leave_request_change();

create or replace function private.notify_collection_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient record; event_title text; actor uuid := auth.uid();
begin
  if current_setting('tsudowa.suppress_notifications', true) = 'on' then return new; end if;
  select event.title into event_title from public.events event where event.id = new.event_id;
  for recipient in
    select member.user_id from public.event_members member
    where member.event_id = new.event_id
      and member.status = 'approved' and member.user_id <> actor
  loop
    perform private.enqueue_event_notification(
      recipient.user_id, actor, new.event_id, 'collection_update',
      '「' || coalesce(event_title, 'イベント') || '」の集金',
      '「' || new.title || '」が更新されました',
      '/event/' || new.event_id::text || '/collection/' || new.id::text,
      'collection:' || new.id::text || ':' || new.updated_at::text || ':' || recipient.user_id::text
    );
  end loop;
  return new;
end;
$$;

create trigger collections_enqueue_notification
after insert or update on public.collections
for each row execute function private.notify_collection_change();

create or replace function private.notify_payment_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_event_id uuid; collection_title text; event_title text;
begin
  if old.paid = new.paid then return new; end if;
  select collection.event_id, collection.title, event.title
  into target_event_id, collection_title, event_title
  from public.collections collection
  join public.events event on event.id = collection.event_id
  where collection.id = new.collection_id;
  perform private.enqueue_event_notification(
    new.user_id, auth.uid(), target_event_id, 'collection_update',
    '「' || coalesce(event_title, 'イベント') || '」の支払状態',
    '「' || coalesce(collection_title, '集金') || '」が' ||
      case when new.paid then '支払済み' else '未払い' end || 'になりました',
    '/event/' || target_event_id::text || '/collection/' || new.collection_id::text,
    'payment:' || new.collection_id::text || ':' || new.user_id::text || ':' || new.updated_at::text
  );
  return new;
end;
$$;

create trigger collection_shares_enqueue_notification
after update of paid on public.collection_shares
for each row execute function private.notify_payment_change();
