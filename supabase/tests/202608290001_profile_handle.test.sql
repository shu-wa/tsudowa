begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select extensions.plan(4);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_index index_record
    join pg_catalog.pg_class table_record on table_record.oid = index_record.indrelid
    join pg_catalog.pg_namespace schema_record on schema_record.oid = table_record.relnamespace
    where schema_record.nspname = 'public'
      and table_record.relname = 'profiles'
      and index_record.indisunique
      and pg_catalog.pg_get_indexdef(index_record.indexrelid) like '%(handle)%'
  ),
  'profiles.handle is protected by a unique database index'
);

insert into auth.users(id, email, raw_user_meta_data, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'profile-one@example.invalid', '{}', now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'profile-two@example.invalid', '{}', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}', true);
select extensions.lives_ok(
  $$update public.profiles set handle = '@shared_id' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'the first user can select an unused display ID'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}', true);
select extensions.throws_ok(
  $$update public.profiles set handle = '@shared_id' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  '23505', 'duplicate key value violates unique constraint "profiles_handle_key"',
  'a second user cannot claim the same display ID'
);

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::integer from public.profiles where handle = '@shared_id'),
  1,
  'a rejected duplicate does not overwrite the existing display ID'
);

select * from extensions.finish();
rollback;
