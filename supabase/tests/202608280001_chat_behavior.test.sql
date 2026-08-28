begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select extensions.plan(24);

insert into auth.users(id, email, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'tsudowa-test-host@example.invalid', '{"display_name":"Test Host"}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'tsudowa-test-member@example.invalid', '{"display_name":"Test Member"}', now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'tsudowa-test-outsider@example.invalid', '{"display_name":"Test Outsider"}', now(), now());

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',
  true
);

insert into public.events(
  id, owner_id, title, start_date, end_date, start_time, time_mode, status, join_policy
)
values (
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  'Rollback-only chat behavior test',
  '2020-01-01', '2020-01-01', '09:00', 'start', 'completed', 'auto'
);

insert into public.event_members(event_id, user_id, role, status, attendance_label)
values (
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  'member', 'approved', '参加'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',
  true
);

select extensions.lives_ok(
  $$select public.send_event_message_v2(
    '55555555-5555-4555-8555-555555555555',
    '44444444-4444-4444-8444-444444444444',
    'host message', null, null, null, null, null
  )$$,
  'host can send a message'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222"}',
  true
);

select extensions.lives_ok(
  $$select public.send_event_message_v2(
    '66666666-6666-4666-8666-666666666666',
    '44444444-4444-4444-8444-444444444444',
    'member reply', null, null, null, null,
    '55555555-5555-4555-8555-555555555555'
  )$$,
  'member can reply to an event message'
);

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"33333333-3333-4333-8333-333333333333"}',
  true
);

select extensions.throws_ok(
  $$select public.send_event_message_v2(
    '77777777-7777-4777-8777-777777777777',
    '44444444-4444-4444-8444-444444444444',
    'outsider message', null, null, null, null, null
  )$$,
  'P0001', 'not_allowed',
  'outsider cannot send an event message'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222"}',
  true
);
select set_config(
  'tsudowa_test.member_message_count',
  (select count(*)::text from public.messages where event_id = '44444444-4444-4444-8444-444444444444'),
  true
);
reset role;
set local role postgres;
select extensions.is(
  current_setting('tsudowa_test.member_message_count')::integer,
  2,
  'member can read event messages through RLS'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"33333333-3333-4333-8333-333333333333"}',
  true
);
select set_config(
  'tsudowa_test.outsider_message_count',
  (select count(*)::text from public.messages where event_id = '44444444-4444-4444-8444-444444444444'),
  true
);
reset role;
set local role postgres;
select extensions.is(
  current_setting('tsudowa_test.outsider_message_count')::integer,
  0,
  'outsider cannot read event messages through RLS'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222"}',
  true
);
select extensions.results_eq(
  $$select public.toggle_message_reaction('55555555-5555-4555-8555-555555555555', '👍')$$,
  array[true],
  'member can add an allowed reaction'
);
select extensions.is(
  (select count(*)::integer from public.message_reactions
    where message_id = '55555555-5555-4555-8555-555555555555'),
  1,
  'reaction is persisted'
);
select extensions.results_eq(
  $$select public.toggle_message_reaction('55555555-5555-4555-8555-555555555555', '👍')$$,
  array[false],
  'same reaction toggles off'
);
select extensions.throws_ok(
  $$select public.toggle_message_reaction('55555555-5555-4555-8555-555555555555', '🔥')$$,
  'P0001', 'invalid_reaction',
  'reaction allowlist is enforced'
);

select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"33333333-3333-4333-8333-333333333333"}',
  true
);
select extensions.throws_ok(
  $$select public.toggle_message_reaction('55555555-5555-4555-8555-555555555555', '👍')$$,
  'P0001', 'not_allowed',
  'outsider cannot react'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222"}',
  true
);
select extensions.throws_ok(
  $$select public.set_message_pin('55555555-5555-4555-8555-555555555555', true)$$,
  'P0001', 'not_allowed',
  'member cannot pin a message'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',
  true
);
select extensions.lives_ok(
  $$select public.set_message_pin('55555555-5555-4555-8555-555555555555', true)$$,
  'host can pin a message'
);
select extensions.is(
  (select pinned_by from public.messages where id = '55555555-5555-4555-8555-555555555555'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'pin actor is recorded'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222"}',
  true
);
select extensions.throws_ok(
  $$select public.edit_event_message('55555555-5555-4555-8555-555555555555', 'hijacked')$$,
  'P0001', 'not_allowed',
  'member cannot edit another author message'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',
  true
);
select extensions.lives_ok(
  $$select public.edit_event_message('55555555-5555-4555-8555-555555555555', 'host message edited')$$,
  'author can edit within the window'
);
select extensions.is(
  (select body from public.messages where id = '55555555-5555-4555-8555-555555555555'),
  'host message edited',
  'edited body is persisted'
);
select extensions.lives_ok(
  $$select public.delete_event_message('66666666-6666-4666-8666-666666666666')$$,
  'host can moderate-delete a member message'
);
select extensions.ok(
  (select deleted_at is not null and deleted_by = '11111111-1111-4111-8111-111111111111'::uuid and body = ''
     from public.messages where id = '66666666-6666-4666-8666-666666666666'),
  'moderation deletion is a complete soft delete'
);
select extensions.throws_ok(
  $$select public.send_event_message_v2(
    '88888888-8888-4888-8888-888888888888',
    '44444444-4444-4444-8444-444444444444',
    'reply to deleted', null, null, null, null,
    '66666666-6666-4666-8666-666666666666'
  )$$,
  'P0001', 'invalid_reply_target',
  'deleted messages cannot be reply targets'
);

select extensions.lives_ok(
  $$select public.archive_event('44444444-4444-4444-8444-444444444444')$$,
  'host can archive a finished event'
);
select extensions.throws_ok(
  $$select public.send_event_message_v2(
    '99999999-9999-4999-8999-999999999999',
    '44444444-4444-4444-8444-444444444444',
    'archived send', null, null, null, null, null
  )$$,
  'P0001', 'archived_event_is_read_only',
  'archived event rejects new messages'
);
select extensions.throws_ok(
  $$select public.toggle_message_reaction('55555555-5555-4555-8555-555555555555', '❤️')$$,
  'P0001', 'archived_event_is_read_only',
  'archived event rejects reactions'
);
select extensions.throws_ok(
  $$select public.edit_event_message('55555555-5555-4555-8555-555555555555', 'archived edit')$$,
  'P0001', 'archived_event_is_read_only',
  'archived event rejects edits'
);
select extensions.throws_ok(
  $$select public.set_message_pin('55555555-5555-4555-8555-555555555555', false)$$,
  'P0001', 'archived_event_is_read_only',
  'archived event rejects pin changes'
);

select * from extensions.finish();
rollback;
