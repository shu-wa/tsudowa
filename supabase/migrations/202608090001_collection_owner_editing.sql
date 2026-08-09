-- Collection creation, editing, deletion, and payment confirmation belong to
-- the event owner only. Collection and share updates are applied atomically.

create or replace function private.is_event_owner(
  target_event_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events event
    where event.id = target_event_id
      and event.owner_id = target_user_id
  );
$$;

drop policy if exists collections_manage_insert on public.collections;
drop policy if exists collections_manage_update on public.collections;
drop policy if exists collections_manage_delete on public.collections;

create policy collections_owner_insert on public.collections
for insert to authenticated
with check (private.is_event_owner(event_id) and created_by = auth.uid());

create policy collections_owner_update on public.collections
for update to authenticated
using (private.is_event_owner(event_id))
with check (private.is_event_owner(event_id));

create policy collections_owner_delete on public.collections
for delete to authenticated
using (private.is_event_owner(event_id));

drop policy if exists shares_manage_insert on public.collection_shares;
drop policy if exists shares_manage_update on public.collection_shares;
drop policy if exists shares_manage_delete on public.collection_shares;

create policy shares_owner_insert on public.collection_shares
for insert to authenticated
with check (
  exists (
    select 1 from public.collections collection
    where collection.id = collection_id
      and private.is_event_owner(collection.event_id)
  )
);

create policy shares_owner_update on public.collection_shares
for update to authenticated
using (
  exists (
    select 1 from public.collections collection
    where collection.id = collection_id
      and private.is_event_owner(collection.event_id)
  )
)
with check (
  exists (
    select 1 from public.collections collection
    where collection.id = collection_id
      and private.is_event_owner(collection.event_id)
  )
);

create policy shares_owner_delete on public.collection_shares
for delete to authenticated
using (
  exists (
    select 1 from public.collections collection
    where collection.id = collection_id
      and private.is_event_owner(collection.event_id)
  )
);

create or replace function public.update_collection_details(
  target_collection_id uuid,
  new_title text,
  new_category text,
  new_paid_by_user_id uuid,
  new_split_method public.collection_split_method,
  new_due_date date,
  new_note text,
  new_auto_assign_new_members boolean,
  new_default_share_amount numeric,
  new_shares jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
  share_count integer;
  distinct_user_count integer;
  calculated_total numeric(14,2);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select collection.event_id
  into target_event_id
  from public.collections collection
  where collection.id = target_collection_id
  for update;

  if target_event_id is null then raise exception 'collection_not_found'; end if;
  if not private.is_event_owner(target_event_id) then raise exception 'not_allowed'; end if;
  if private.is_event_archived(target_event_id) then raise exception 'archived_event_is_read_only'; end if;
  if char_length(trim(coalesce(new_title, ''))) not between 1 and 180 then raise exception 'invalid_title'; end if;
  if new_category not in ('entry', 'food', 'stay', 'transport', 'ticket', 'other') then raise exception 'invalid_category'; end if;
  if new_shares is null or jsonb_typeof(new_shares) <> 'array' then raise exception 'invalid_shares'; end if;

  share_count := jsonb_array_length(new_shares);
  if share_count not between 1 and 10000 then raise exception 'invalid_share_count'; end if;

  select count(distinct share.user_id), coalesce(sum(share.amount), 0)
  into distinct_user_count, calculated_total
  from jsonb_to_recordset(new_shares) as share(user_id uuid, amount numeric(14,2));

  if distinct_user_count <> share_count then raise exception 'duplicate_share_member'; end if;
  if exists (
    select 1
    from jsonb_to_recordset(new_shares) as share(user_id uuid, amount numeric(14,2))
    where share.user_id is null or share.amount is null or share.amount < 0
  ) then raise exception 'invalid_share_amount'; end if;
  if exists (
    select 1
    from jsonb_to_recordset(new_shares) as share(user_id uuid, amount numeric(14,2))
    where not exists (
      select 1 from public.event_members member
      where member.event_id = target_event_id
        and member.user_id = share.user_id
        and member.status = 'approved'
    )
  ) then raise exception 'invalid_share_member'; end if;
  if not exists (
    select 1 from public.event_members member
    where member.event_id = target_event_id
      and member.user_id = new_paid_by_user_id
      and member.status = 'approved'
  ) then raise exception 'invalid_payer'; end if;
  if new_auto_assign_new_members and (new_default_share_amount is null or new_default_share_amount < 0) then
    raise exception 'invalid_default_share_amount';
  end if;
  if new_auto_assign_new_members and exists (
    select 1
    from jsonb_to_recordset(new_shares) as share(user_id uuid, amount numeric(14,2))
    where share.amount <> new_default_share_amount
  ) then raise exception 'auto_share_amount_mismatch'; end if;
  if new_auto_assign_new_members and exists (
    select 1
    from public.event_members member
    where member.event_id = target_event_id
      and member.status = 'approved'
      and not exists (
        select 1
        from jsonb_to_recordset(new_shares) as share(user_id uuid, amount numeric(14,2))
        where share.user_id = member.user_id
      )
  ) then raise exception 'auto_share_members_mismatch'; end if;

  update public.collections collection
  set title = trim(new_title),
      category = new_category,
      paid_by_user_id = new_paid_by_user_id,
      total_amount = calculated_total,
      split_method = new_split_method,
      due_date = new_due_date,
      note = nullif(trim(coalesce(new_note, '')), ''),
      auto_assign_new_members = new_auto_assign_new_members,
      default_share_amount = case when new_auto_assign_new_members then new_default_share_amount else null end,
      updated_at = now()
  where collection.id = target_collection_id;

  delete from public.collection_shares existing
  where existing.collection_id = target_collection_id
    and not exists (
      select 1
      from jsonb_to_recordset(new_shares) as share(user_id uuid, amount numeric(14,2))
      where share.user_id = existing.user_id
    );

  insert into public.collection_shares(collection_id, user_id, amount, paid)
  select target_collection_id, share.user_id, share.amount, false
  from jsonb_to_recordset(new_shares) as share(user_id uuid, amount numeric(14,2))
  on conflict (collection_id, user_id) do update
  set amount = excluded.amount,
      updated_at = now();
end;
$$;

create or replace function public.set_collection_share_paid(
  target_collection_id uuid,
  target_user_id uuid,
  is_paid boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
begin
  select collection.event_id
  into target_event_id
  from public.collections collection
  where collection.id = target_collection_id;

  if target_event_id is null then raise exception 'collection_not_found'; end if;
  if not private.is_event_owner(target_event_id) then raise exception 'not_allowed'; end if;
  if private.is_event_archived(target_event_id) then raise exception 'archived_event_is_read_only'; end if;

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

revoke all on function public.update_collection_details(uuid, text, text, uuid, public.collection_split_method, date, text, boolean, numeric, jsonb) from public, anon;
grant execute on function public.update_collection_details(uuid, text, text, uuid, public.collection_split_method, date, text, boolean, numeric, jsonb) to authenticated;

revoke all on function public.set_collection_share_paid(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_collection_share_paid(uuid, uuid, boolean) to authenticated;
