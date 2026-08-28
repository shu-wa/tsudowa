begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select extensions.plan(30);

select extensions.has_table('public', 'message_reactions', 'message reactions table exists');
select extensions.has_column('public', 'messages', 'reply_to_id', 'messages supports replies');
select extensions.has_column('public', 'messages', 'deleted_at', 'messages supports soft deletion');
select extensions.has_column('public', 'messages', 'deleted_by', 'message deletion actor is recorded');
select extensions.has_column('public', 'messages', 'pinned_at', 'messages supports pinning');
select extensions.has_column('public', 'messages', 'pinned_by', 'message pin actor is recorded');
select extensions.col_is_fk('public', 'messages', 'reply_to_id', 'reply target is protected by a foreign key');

select extensions.ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.message_reactions'::regclass),
  'message reactions has RLS enabled'
);
select extensions.ok(not has_table_privilege('authenticated', 'public.message_reactions', 'INSERT'), 'authenticated cannot directly insert reactions');
select extensions.ok(has_table_privilege('authenticated', 'public.message_reactions', 'SELECT'), 'authenticated can select reactions through RLS');

select extensions.has_function('public', 'send_event_message_v2', array['uuid','uuid','text','text','text','integer','integer','uuid'], 'v2 message RPC exists');
select extensions.has_function('public', 'edit_event_message', array['uuid','text'], 'edit RPC exists');
select extensions.has_function('public', 'delete_event_message', array['uuid'], 'delete RPC exists');
select extensions.has_function('public', 'toggle_message_reaction', array['uuid','text'], 'reaction RPC exists');
select extensions.has_function('public', 'set_message_pin', array['uuid','boolean'], 'pin RPC exists');

select extensions.ok(has_function_privilege('authenticated', 'public.toggle_message_reaction(uuid,text)', 'EXECUTE'), 'authenticated can execute reaction RPC');
select extensions.ok(not has_table_privilege('authenticated', 'public.messages', 'UPDATE'), 'authenticated cannot directly update messages');
select extensions.ok(exists(select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='message_reactions' and policyname='message_reactions_read_members'), 'reaction member read policy exists');
select extensions.ok(exists(select 1 from pg_catalog.pg_policies where schemaname='realtime' and tablename='messages' and policyname='event_chat_realtime_read'), 'private Realtime read policy exists');
select extensions.ok(exists(select 1 from pg_catalog.pg_policies where schemaname='realtime' and tablename='messages' and policyname='event_chat_realtime_write'), 'private Realtime write policy exists');
select extensions.ok(exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.message_reactions'::regclass and tgname='message_reactions_reject_archived_mutation' and not tgisinternal), 'reaction archive guard exists');
select extensions.ok(exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='message_reactions'), 'reaction changes are published to Realtime');
select extensions.ok(exists(select 1 from pg_catalog.pg_constraint where conrelid='public.messages'::regclass and conname='messages_content_check'), 'message content constraint exists');
select extensions.ok(exists(select 1 from pg_catalog.pg_constraint where conrelid='public.messages'::regclass and conname='messages_deleted_state_check'), 'message deleted state constraint exists');
select extensions.ok(exists(select 1 from pg_catalog.pg_constraint where conrelid='public.messages'::regclass and conname='messages_pinned_state_check'), 'message pinned state constraint exists');

select extensions.ok(not has_function_privilege('anon', 'public.send_event_message_v2(uuid,uuid,text,text,text,integer,integer,uuid)', 'EXECUTE'), 'anon cannot send v2 messages');
select extensions.ok(not has_function_privilege('anon', 'public.edit_event_message(uuid,text)', 'EXECUTE'), 'anon cannot edit messages');
select extensions.ok(not has_function_privilege('anon', 'public.delete_event_message(uuid)', 'EXECUTE'), 'anon cannot delete messages');
select extensions.ok(not has_function_privilege('anon', 'public.toggle_message_reaction(uuid,text)', 'EXECUTE'), 'anon cannot react');
select extensions.ok(not has_function_privilege('anon', 'public.set_message_pin(uuid,boolean)', 'EXECUTE'), 'anon cannot pin messages');

select * from extensions.finish();
rollback;
