import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error('Supabase public environment variables are required.');
}

const supabase = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const nilUuid = '00000000-0000-0000-0000-000000000000';
const deniedCalls = [
  ['send_event_message_v2', {
    target_event_id: nilUuid,
    message_id: nilUuid,
    message_body: 'security-smoke-test',
    message_image_path: null,
    message_image_mime_type: null,
    message_image_width: null,
    message_image_height: null,
    reply_to_message_id: null,
  }],
  ['edit_event_message', { target_message_id: nilUuid, new_body: 'security-smoke-test' }],
  ['delete_event_message', { target_message_id: nilUuid }],
  ['toggle_message_reaction', { target_message_id: nilUuid, reaction_emoji: '👍' }],
  ['set_message_pin', { target_message_id: nilUuid, should_pin: true }],
];

for (const [name, parameters] of deniedCalls) {
  const { error } = await supabase.rpc(name, parameters);
  if (!error) {
    throw new Error(`Anonymous RPC unexpectedly succeeded: ${name}`);
  }
}

const { data: anonymousReactions, error: reactionReadError } = await supabase
  .from('message_reactions')
  .select('message_id')
  .limit(1);

if (reactionReadError && reactionReadError.code !== '42501') {
  throw reactionReadError;
}
if (!reactionReadError && (anonymousReactions ?? []).length !== 0) {
  throw new Error('Anonymous user could read message reactions.');
}

const { data: authSettings, error: authSettingsError } = await supabase.auth.getSession();
if (authSettingsError) {
  throw authSettingsError;
}
if (authSettings.session !== null) {
  throw new Error('Smoke-test client unexpectedly has a user session.');
}

console.log('Remote anonymous security smoke checks passed.');
