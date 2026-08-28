begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select extensions.plan(19);

insert into auth.users(id, email, raw_user_meta_data, created_at, updated_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'group-host@example.invalid', '{"display_name":"Group Host"}', now(), now()),
  ('a2000000-0000-4000-8000-000000000002', 'group-member@example.invalid', '{"display_name":"Group Member"}', now(), now()),
  ('a3000000-0000-4000-8000-000000000003', 'group-outsider@example.invalid', '{"display_name":"Group Outsider"}', now(), now());

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"a1000000-0000-4000-8000-000000000001"}', true);

insert into public.events(
  id, owner_id, title, start_date, end_date, start_time, time_mode, status, join_policy
) values (
  'a4000000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000001',
  'Finished source event', '2020-01-01', '2020-01-01', '09:00', 'start', 'completed', 'auto'
);
insert into public.event_members(event_id, user_id, role, status, attendance_label)
values (
  'a4000000-0000-4000-8000-000000000004',
  'a2000000-0000-4000-8000-000000000002',
  'member', 'approved', '参加'
);

select extensions.lives_ok(
  $$select * from public.create_group_from_event(
    'a4000000-0000-4000-8000-000000000004', 'Recurring Friends', 'Next event'
  )$$,
  'host can group a finished unarchived event'
);
select extensions.is(
  (select count(*)::integer from public.event_groups where name = 'Recurring Friends'),
  1,
  'one recurring group is created'
);
select extensions.ok(
  (select group_id is not null from public.events where id = 'a4000000-0000-4000-8000-000000000004'),
  'source event is linked to the group'
);
select extensions.is(
  (select count(*)::integer from public.event_group_members member
    join public.event_groups group_row on group_row.id = member.group_id
    where group_row.name = 'Recurring Friends'),
  2,
  'approved source members are copied to the group'
);
select extensions.ok(
  (select date_status = 'undecided' and status = 'draft'
    from public.events where title = 'Next event'),
  'follow-up event is explicitly undated'
);
select extensions.is(
  (select count(*)::integer from public.event_members member
    join public.events event on event.id = member.event_id
    where event.title = 'Next event' and member.status = 'approved'),
  2,
  'follow-up event includes the same members'
);
select extensions.is(
  (select count(*)::integer from public.schedule_items item
    join public.events event on event.id = item.event_id where event.title = 'Next event')
  + (select count(*)::integer from public.collections collection
    join public.events event on event.id = collection.event_id where event.title = 'Next event')
  + (select count(*)::integer from public.messages message
    join public.events event on event.id = message.event_id where event.title = 'Next event'),
  0,
  'mutable event content is not copied'
);

select extensions.lives_ok(
  $$select public.create_group_event(
    (select id from public.event_groups where name = 'Recurring Friends'), 'Third event'
  )$$,
  'group manager can add another undated event'
);
select extensions.is(
  (select count(*)::integer from public.events event
    join public.event_groups group_row on group_row.id = event.group_id
    where group_row.name = 'Recurring Friends'),
  3,
  'group lists source and both follow-up events'
);
select extensions.is(
  (select count(*)::integer from public.notification_outbox
    where recipient_id = 'a2000000-0000-4000-8000-000000000002'
      and kind = 'group_update'),
  2,
  'each follow-up event queues one group notification for the member'
);

select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"a3000000-0000-4000-8000-000000000003"}', true);
select extensions.throws_ok(
  $$select public.create_group_event(
    (select id from public.event_groups where name = 'Recurring Friends'), 'Unauthorized event'
  )$$,
  'P0001', 'not_allowed',
  'outsider cannot add a group event'
);

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"a2000000-0000-4000-8000-000000000002"}', true);
set local role authenticated;
select set_config(
  'tsudowa_test.group_count',
  (select count(*)::text from public.event_groups where name = 'Recurring Friends'),
  true
);
reset role;
set local role postgres;
select extensions.is(
  current_setting('tsudowa_test.group_count')::integer,
  1,
  'group member can read the group through RLS'
);
select extensions.lives_ok(
  $$select public.register_push_device(
    'ExponentPushToken[test_member_token_123456789]',
    'a5000000-0000-4000-8000-000000000005', 'ios'
  )$$,
  'member can register its own Expo push token'
);

select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"a3000000-0000-4000-8000-000000000003"}', true);
select extensions.throws_ok(
  $$select public.register_push_device(
    'ExponentPushToken[test_member_token_123456789]',
    'a6000000-0000-4000-8000-000000000006', 'ios'
  )$$,
  'P0001', 'push_token_in_use',
  'another account cannot claim an active push token'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"a1000000-0000-4000-8000-000000000001"}', true);
select extensions.lives_ok(
  $$select public.send_event_message_v2(
    'a7000000-0000-4000-8000-000000000007',
    'a4000000-0000-4000-8000-000000000004',
    'notification test', null, null, null, null, null
  )$$,
  'host can send a notification-producing message'
);
select extensions.is(
  (select count(*)::integer from public.notification_outbox
    where recipient_id = 'a2000000-0000-4000-8000-000000000002'
      and kind = 'chat_message'),
  1,
  'message trigger queues one member notification'
);

insert into public.blocked_users(blocker_id, blocked_id)
values (
  'a2000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001'
);
select extensions.lives_ok(
  $$select public.send_event_message_v2(
    'a8000000-0000-4000-8000-000000000008',
    'a4000000-0000-4000-8000-000000000004',
    'blocked notification test', null, null, null, null, null
  )$$,
  'blocked actor can still post inside the shared event'
);
select extensions.is(
  (select count(*)::integer from public.notification_outbox
    where recipient_id = 'a2000000-0000-4000-8000-000000000002'
      and kind = 'chat_message'),
  1,
  'blocked actor does not queue another notification'
);

select extensions.is(
  (select count(*)::integer from public.notification_outbox
    where kind = 'membership_update'
      and event_id in (select id from public.events where title in ('Next event', 'Third event'))),
  0,
  'bulk group member copying does not create a notification storm'
);

select * from extensions.finish();
rollback;
