begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select extensions.plan(15);

select extensions.ok(has_column_privilege('authenticated', 'public.events', 'date_status', 'UPDATE'), 'date status can be updated subject to RLS');
select extensions.ok(not has_column_privilege('authenticated', 'public.events', 'owner_id', 'UPDATE'), 'ownership remains immutable');

insert into auth.users(id, email, raw_user_meta_data, created_at, updated_at) values
('b1000000-0000-4000-8000-000000000001', 'edit-host@example.invalid', '{"display_name":"Edit Host"}', now(), now()),
('b2000000-0000-4000-8000-000000000002', 'edit-cohost@example.invalid', '{"display_name":"Edit Cohost"}', now(), now()),
('b3000000-0000-4000-8000-000000000003', 'edit-member@example.invalid', '{"display_name":"Edit Member"}', now(), now());
-- The creation-rate trigger validates auth.uid(), even for fixture inserts.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"b1000000-0000-4000-8000-000000000001"}', true);
insert into public.events(id, owner_id, title, start_date, end_date, start_time, time_mode, date_status)
values ('b4000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'Edit fixture', '2026-01-01', '2026-01-01', '09:00', 'start', 'undecided');
insert into public.event_members(event_id, user_id, role, status) values
('b4000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000002', 'cohost', 'approved'),
('b4000000-0000-4000-8000-000000000004', 'b3000000-0000-4000-8000-000000000003', 'member', 'approved');

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.lives_ok($$update public.events set start_date='2026-10-01', end_date='2026-10-02', start_time='23:00', end_time='01:15', time_mode='range', date_status='scheduled', status='scheduled' where id='b4000000-0000-4000-8000-000000000004'$$, 'host can save full date payload');
select extensions.ok((select start_date='2026-10-01' and end_date='2026-10-02' and end_time='01:15' and date_status='scheduled' from public.events where id='b4000000-0000-4000-8000-000000000004'), 'date values persist on re-read');
select extensions.lives_ok($$update public.events set location_name='Station', address='Kyoto', latitude=34.9858, longitude=135.7588 where id='b4000000-0000-4000-8000-000000000004'$$, 'host can save location');
select extensions.ok((select location_name='Station' and address='Kyoto' and latitude=34.9858 and longitude=135.7588 from public.events where id='b4000000-0000-4000-8000-000000000004'), 'location persists on re-read');
select set_config('request.jwt.claim.sub', 'b2000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"b2000000-0000-4000-8000-000000000002"}', true);
select extensions.lives_ok($$update public.events set description='Updated description' where id='b4000000-0000-4000-8000-000000000004'$$, 'cohost can edit description');
select extensions.is((select description from public.events where id='b4000000-0000-4000-8000-000000000004'), 'Updated description', 'description persists on re-read');
select extensions.lives_ok($$update public.events set location_name='Manual place', address='', latitude=null, longitude=null where id='b4000000-0000-4000-8000-000000000004'$$, 'cohost can save a location without coordinates');
select extensions.ok((select location_name='Manual place' and latitude is null and longitude is null from public.events where id='b4000000-0000-4000-8000-000000000004'), 'cohost location persists and clears the previous pin');
select set_config('request.jwt.claim.sub', 'b3000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"b3000000-0000-4000-8000-000000000003"}', true);
with changed as (update public.events set description='Forbidden' where id='b4000000-0000-4000-8000-000000000004' returning id)
select extensions.is((select count(*)::integer from changed), 0, 'member cannot edit description');
with changed as (update public.events set start_date='2026-10-02', date_status='undecided' where id='b4000000-0000-4000-8000-000000000004' returning id)
select extensions.is((select count(*)::integer from changed), 0, 'member cannot edit dates');
with changed as (update public.events set location_name='Forbidden', latitude=0, longitude=0 where id='b4000000-0000-4000-8000-000000000004' returning id)
select extensions.is((select count(*)::integer from changed), 0, 'member cannot edit location');
reset role;
update public.events set archived_at=now() where id='b4000000-0000-4000-8000-000000000004';
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"b1000000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select extensions.throws_ok($$update public.events set description='Cannot change archive' where id='b4000000-0000-4000-8000-000000000004'$$, 'P0001', 'archived_event_is_read_only', 'archived event rejects host edits');
select extensions.throws_ok($$update public.events set location_name='Cannot change archive' where id='b4000000-0000-4000-8000-000000000004'$$, 'P0001', 'archived_event_is_read_only', 'archived event rejects location edits');
select * from extensions.finish();
rollback;
