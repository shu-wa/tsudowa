-- TSUDOWA production foundation
-- Run with `supabase db push` after linking a Supabase project.

create extension if not exists pgcrypto;
create schema if not exists private;

create type public.event_member_role as enum ('host', 'cohost', 'member');
create type public.membership_status as enum ('pending', 'approved', 'declined', 'removed');
create type public.event_time_mode as enum ('start', 'range');
create type public.collection_split_method as enum ('equal', 'custom');
create type public.report_status as enum ('received', 'reviewing', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  handle text not null unique check (handle ~ '^@[A-Za-z0-9_]{2,30}$'),
  city text check (char_length(city) <= 120),
  date_of_birth date,
  age_verified_at timestamptz,
  avatar_color text not null default '#285943' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  locale text not null default 'ja-JP',
  time_zone text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document text not null check (document in ('terms', 'privacy', 'community', 'analytics', 'crash_reports')),
  version text not null check (char_length(version) between 1 and 40),
  accepted boolean not null,
  recorded_at timestamptz not null default now(),
  source text not null default 'mobile'
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 140),
  category text not null default 'EVENT' check (char_length(category) <= 40),
  tagline text check (char_length(tagline) <= 240),
  description text check (char_length(description) <= 5000),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  start_time time not null,
  end_time time,
  time_mode public.event_time_mode not null default 'start',
  time_zone text not null default 'Asia/Tokyo',
  location_name text,
  address text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  capacity integer not null default 20 check (capacity between 1 and 10000),
  status text not null default 'scheduled' check (status in ('draft', 'scheduled', 'active', 'completed', 'cancelled')),
  join_policy text not null default 'approval' check (join_policy in ('approval', 'auto')),
  cover_color text not null default '#E2E9D5',
  accent_color text not null default '#52683F',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((time_mode = 'start' and end_time is null) or (time_mode = 'range' and end_time is not null))
);

create table public.event_members (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.event_member_role not null default 'member',
  status public.membership_status not null default 'pending',
  attendance_label text check (char_length(attendance_label) <= 100),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  title text not null check (char_length(title) between 1 and 180),
  note text check (char_length(note) <= 2000),
  item_type text not null check (item_type in ('move', 'activity', 'food', 'stay')),
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  category text not null check (category in ('entry', 'food', 'stay', 'transport', 'ticket', 'other')),
  paid_by_user_id uuid not null references public.profiles(id) on delete restrict,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  currency char(3) not null default 'JPY' check (currency ~ '^[A-Z]{3}$'),
  split_method public.collection_split_method not null default 'equal',
  due_date date,
  note text check (char_length(note) <= 2000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collection_shares (
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  confirmed_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  moderation_state text not null default 'visible' check (moderation_state in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  target_user_name text,
  reason text not null check (reason in ('harassment', 'hate', 'sexual', 'violence', 'spam', 'privacy', 'other')),
  details text check (char_length(details) <= 4000),
  status public.report_status not null default 'received',
  resolution_note text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index event_members_user_idx on public.event_members(user_id, status);
create index schedule_items_event_idx on public.schedule_items(event_id, starts_at);
create index collections_event_idx on public.collections(event_id, created_at);
create index messages_event_idx on public.messages(event_id, created_at);
create index reports_status_idx on public.safety_reports(status, created_at);

create or replace function private.is_event_member(target_event_id uuid, target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_members
    where event_id = target_event_id and user_id = target_user_id and status = 'approved'
  );
$$;

create or replace function private.can_manage_event(target_event_id uuid, target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_members
    where event_id = target_event_id and user_id = target_user_id
      and status = 'approved' and role in ('host', 'cohost')
  );
$$;

create or replace function private.shares_event(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_members mine
    join public.event_members theirs on theirs.event_id = mine.event_id
    where mine.user_id = auth.uid() and mine.status = 'approved'
      and theirs.user_id = target_user_id and theirs.status = 'approved'
  );
$$;

create or replace function private.is_moderator()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('moderator', 'admin');
$$;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger events_updated_at before update on public.events for each row execute function private.set_updated_at();
create trigger event_members_updated_at before update on public.event_members for each row execute function private.set_updated_at();
create trigger schedule_items_updated_at before update on public.schedule_items for each row execute function private.set_updated_at();
create trigger collections_updated_at before update on public.collections for each row execute function private.set_updated_at();
create trigger collection_shares_updated_at before update on public.collection_shares for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare generated_handle text;
begin
  generated_handle := '@' || left(regexp_replace(split_part(coalesce(new.email, 'member'), '@', 1), '[^A-Za-z0-9_]', '', 'g'), 20) || '_' || left(new.id::text, 5);
  insert into public.profiles(id, display_name, handle)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), '新しいメンバー'), generated_handle);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.handle_new_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.event_members(event_id, user_id, role, status, attendance_label)
  values (new.id, new.owner_id, 'host', 'approved', '参加');
  return new;
end;
$$;
create trigger on_event_created after insert on public.events for each row execute function private.handle_new_event();

alter table public.profiles enable row level security;
alter table public.consent_records enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.schedule_items enable row level security;
alter table public.collections enable row level security;
alter table public.collection_shares enable row level security;
alter table public.messages enable row level security;
alter table public.event_invites enable row level security;
alter table public.blocked_users enable row level security;
alter table public.safety_reports enable row level security;

create policy profiles_read on public.profiles for select to authenticated
using (id = auth.uid() or private.shares_event(id));
create policy profiles_update_own on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy consent_own_all on public.consent_records for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy events_read_members on public.events for select to authenticated
using (owner_id = auth.uid() or private.is_event_member(id));
create policy events_create_own on public.events for insert to authenticated
with check (owner_id = auth.uid());
create policy events_update_managers on public.events for update to authenticated
using (private.can_manage_event(id)) with check (private.can_manage_event(id));
create policy events_delete_host on public.events for delete to authenticated
using (owner_id = auth.uid());

create policy members_read_event on public.event_members for select to authenticated
using (private.is_event_member(event_id) or user_id = auth.uid() or private.can_manage_event(event_id));
create policy members_manage_insert on public.event_members for insert to authenticated
with check (private.can_manage_event(event_id));
create policy members_manage_update on public.event_members for update to authenticated
using (private.can_manage_event(event_id)) with check (private.can_manage_event(event_id));
create policy members_manage_delete on public.event_members for delete to authenticated
using (private.can_manage_event(event_id) and role <> 'host');

create policy schedule_read_members on public.schedule_items for select to authenticated using (private.is_event_member(event_id));
create policy schedule_manage_insert on public.schedule_items for insert to authenticated with check (private.can_manage_event(event_id) and created_by = auth.uid());
create policy schedule_manage_update on public.schedule_items for update to authenticated using (private.can_manage_event(event_id));
create policy schedule_manage_delete on public.schedule_items for delete to authenticated using (private.can_manage_event(event_id));

create policy collections_read_members on public.collections for select to authenticated using (private.is_event_member(event_id));
create policy collections_manage_insert on public.collections for insert to authenticated with check (private.can_manage_event(event_id) and created_by = auth.uid());
create policy collections_manage_update on public.collections for update to authenticated using (private.can_manage_event(event_id));
create policy collections_manage_delete on public.collections for delete to authenticated using (private.can_manage_event(event_id));

create policy shares_read_members on public.collection_shares for select to authenticated
using (exists (select 1 from public.collections c where c.id = collection_id and private.is_event_member(c.event_id)));
create policy shares_manage_insert on public.collection_shares for insert to authenticated
with check (exists (select 1 from public.collections c where c.id = collection_id and private.can_manage_event(c.event_id)));
create policy shares_manage_update on public.collection_shares for update to authenticated
using (exists (select 1 from public.collections c where c.id = collection_id and private.can_manage_event(c.event_id)));
create policy shares_manage_delete on public.collection_shares for delete to authenticated
using (exists (select 1 from public.collections c where c.id = collection_id and private.can_manage_event(c.event_id)));

create policy messages_read_members on public.messages for select to authenticated using (private.is_event_member(event_id));
create policy messages_create_members on public.messages for insert to authenticated with check (private.is_event_member(event_id) and author_id = auth.uid());
create policy messages_update_own on public.messages for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy messages_delete_own_or_manager on public.messages for delete to authenticated using (author_id = auth.uid() or private.can_manage_event(event_id));

create policy invites_manage on public.event_invites for all to authenticated
using (private.can_manage_event(event_id)) with check (private.can_manage_event(event_id) and created_by = auth.uid());
create policy blocks_own_all on public.blocked_users for all to authenticated
using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy reports_create_own on public.safety_reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_read_own_or_moderator on public.safety_reports for select to authenticated using (reporter_id = auth.uid() or private.is_moderator());
create policy reports_update_moderator on public.safety_reports for update to authenticated using (private.is_moderator()) with check (private.is_moderator());

create or replace function public.create_event_invite(target_event_id uuid, valid_for interval default interval '7 days', allowed_uses integer default 50)
returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text;
begin
  if not private.can_manage_event(target_event_id) then raise exception 'not_allowed'; end if;
  raw_token := upper(encode(gen_random_bytes(10), 'hex'));
  insert into public.event_invites(event_id, token_hash, created_by, expires_at, max_uses)
  values (target_event_id, encode(digest(raw_token, 'sha256'), 'hex'), auth.uid(), now() + valid_for, allowed_uses);
  return raw_token;
end;
$$;

create or replace function public.join_event_by_invite(raw_token text)
returns table(event_id uuid, membership_status public.membership_status)
language plpgsql security definer set search_path = '' as $$
declare selected_invite public.event_invites%rowtype;
declare selected_event public.events%rowtype;
begin
  select * into selected_invite from public.event_invites
  where token_hash = encode(digest(upper(trim(raw_token)), 'sha256'), 'hex')
    and revoked_at is null and (expires_at is null or expires_at > now())
    and (max_uses is null or use_count < max_uses)
  for update;
  if selected_invite.id is null then raise exception 'invalid_invite'; end if;
  select * into selected_event from public.events where id = selected_invite.event_id;
  insert into public.event_members(event_id, user_id, role, status)
  values (selected_invite.event_id, auth.uid(), 'member', case when selected_event.join_policy = 'auto' then 'approved' else 'pending' end)
  on conflict (event_id, user_id) do update set status = excluded.status, updated_at = now();
  update public.event_invites set use_count = use_count + 1 where id = selected_invite.id;
  return query select selected_invite.event_id, case when selected_event.join_policy = 'auto' then 'approved'::public.membership_status else 'pending'::public.membership_status end;
end;
$$;

create or replace function public.set_my_attendance(target_event_id uuid, attendance text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.event_members set attendance_label = left(attendance, 100), updated_at = now()
  where event_id = target_event_id and user_id = auth.uid() and status = 'approved';
  if not found then raise exception 'membership_not_found'; end if;
end;
$$;

create or replace function public.set_collection_share_paid(target_collection_id uuid, target_user_id uuid, is_paid boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare target_event_id uuid;
begin
  select event_id into target_event_id from public.collections where id = target_collection_id;
  if target_event_id is null then raise exception 'collection_not_found'; end if;
  if target_user_id <> auth.uid() and not private.can_manage_event(target_event_id) then raise exception 'not_allowed'; end if;
  update public.collection_shares
  set paid = is_paid,
      paid_at = case when is_paid then now() else null end,
      confirmed_by = case when is_paid then auth.uid() else null end,
      updated_at = now()
  where collection_id = target_collection_id and user_id = target_user_id;
  if not found then raise exception 'share_not_found'; end if;
end;
$$;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.create_event_invite(uuid, interval, integer) to authenticated;
grant execute on function public.join_event_by_invite(text) to authenticated;
grant execute on function public.set_my_attendance(uuid, text) to authenticated;
grant execute on function public.set_collection_share_paid(uuid, uuid, boolean) to authenticated;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.event_members;
