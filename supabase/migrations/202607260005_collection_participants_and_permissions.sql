-- Automatically charge every approved participant for the event's initial
-- per-person fee, restrict payment confirmation to managers, and broadcast
-- collection updates to all event members.

alter table public.collections
  add column if not exists auto_assign_new_members boolean not null default false,
  add column if not exists default_share_amount numeric(14,2)
    check (default_share_amount is null or default_share_amount >= 0);

-- Initial fees created by released app versions have a stable title, category,
-- and note. Treat their stored total as the original per-person fee.
update public.collections collection
set auto_assign_new_members = true,
    default_share_amount = collection.total_amount
where collection.category = 'entry'
  and collection.title = '参加費'
  and collection.note = 'イベント作成時に登録した参加費です。'
  and collection.default_share_amount is null;

insert into public.collection_shares(collection_id, user_id, amount, paid)
select collection.id, member.user_id, collection.default_share_amount, false
from public.collections collection
join public.event_members member
  on member.event_id = collection.event_id
 and member.status = 'approved'
where collection.auto_assign_new_members
  and collection.default_share_amount is not null
on conflict (collection_id, user_id) do nothing;

update public.collections collection
set total_amount = totals.total_amount
from (
  select share.collection_id, coalesce(sum(share.amount), 0) as total_amount
  from public.collection_shares share
  group by share.collection_id
) totals
where collection.id = totals.collection_id
  and collection.auto_assign_new_members;

create or replace function private.assign_auto_collection_shares_to_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'approved' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'approved' then
    return new;
  end if;

  insert into public.collection_shares(collection_id, user_id, amount, paid)
  select collection.id, new.user_id, collection.default_share_amount, false
  from public.collections collection
  where collection.event_id = new.event_id
    and collection.auto_assign_new_members
    and collection.default_share_amount is not null
  on conflict (collection_id, user_id) do nothing;

  update public.collections collection
  set total_amount = totals.total_amount
  from (
    select share.collection_id, coalesce(sum(share.amount), 0) as total_amount
    from public.collection_shares share
    join public.collections target on target.id = share.collection_id
    where target.event_id = new.event_id
      and target.auto_assign_new_members
    group by share.collection_id
  ) totals
  where collection.id = totals.collection_id;
  return new;
end;
$$;

drop trigger if exists event_members_assign_auto_collection_shares on public.event_members;
create trigger event_members_assign_auto_collection_shares
after insert or update of status on public.event_members
for each row execute function private.assign_auto_collection_shares_to_member();

create or replace function private.assign_existing_members_to_auto_collection()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.auto_assign_new_members and new.default_share_amount is not null then
    insert into public.collection_shares(collection_id, user_id, amount, paid)
    select new.id, member.user_id, new.default_share_amount, false
    from public.event_members member
    where member.event_id = new.event_id
      and member.status = 'approved'
    on conflict (collection_id, user_id) do nothing;

    update public.collections collection
    set total_amount = (
      select coalesce(sum(share.amount), 0)
      from public.collection_shares share
      where share.collection_id = new.id
    )
    where collection.id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists collections_assign_existing_members on public.collections;
create trigger collections_assign_existing_members
after insert on public.collections
for each row execute function private.assign_existing_members_to_auto_collection();

create or replace function public.set_collection_share_paid(
  target_collection_id uuid,
  target_user_id uuid,
  is_paid boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_event_id uuid;
begin
  select collection.event_id
  into target_event_id
  from public.collections collection
  where collection.id = target_collection_id;

  if target_event_id is null then raise exception 'collection_not_found'; end if;
  if not private.can_manage_event(target_event_id) then raise exception 'not_allowed'; end if;

  update public.collection_shares share
  set paid = is_paid,
      paid_at = case when is_paid then now() else null end,
      confirmed_by = case when is_paid then auth.uid() else null end,
      updated_at = now()
  where share.collection_id = target_collection_id
    and share.user_id = target_user_id;

  if not found then raise exception 'share_not_found'; end if;
end;
$$;

revoke all on function public.set_collection_share_paid(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_collection_share_paid(uuid, uuid, boolean) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'collections'
  ) then
    alter publication supabase_realtime add table public.collections;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'collection_shares'
  ) then
    alter publication supabase_realtime add table public.collection_shares;
  end if;
end;
$$;
