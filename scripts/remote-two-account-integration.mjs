import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const requiredEnvironment = [
  'TEST_SUPABASE_URL',
  'TEST_SUPABASE_PUBLISHABLE_KEY',
  'TEST_SUPABASE_SERVICE_ROLE_KEY',
  'TEST_ACCOUNT_A_EMAIL',
  'TEST_ACCOUNT_A_NAME',
  'TEST_ACCOUNT_A_HANDLE',
  'TEST_ACCOUNT_B_EMAIL',
  'TEST_ACCOUNT_B_NAME',
  'TEST_ACCOUNT_B_HANDLE',
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const url = process.env.TEST_SUPABASE_URL;
const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const expectedA = {
  email: process.env.TEST_ACCOUNT_A_EMAIL.trim().toLowerCase(),
  name: process.env.TEST_ACCOUNT_A_NAME,
  handle: process.env.TEST_ACCOUNT_A_HANDLE,
};
const expectedB = {
  email: process.env.TEST_ACCOUNT_B_EMAIL.trim().toLowerCase(),
  name: process.env.TEST_ACCOUNT_B_NAME,
  handle: process.env.TEST_ACCOUNT_B_HANDLE,
};

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const admin = createClient(url, serviceRoleKey, clientOptions);

const pass = (message) => console.log(`PASS: ${message}`);
const normalizedErrorText = (error) => [error?.code, error?.message, error?.details, error?.hint]
  .filter((value) => typeof value === 'string')
  .join(' ');

async function authenticateWithoutSharingPassword(expected) {
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: expected.email,
  });
  if (linkError) throw linkError;

  const tokenHash = linkData?.properties?.hashed_token;
  assert.ok(tokenHash, 'Supabase did not return an ephemeral token hash');

  const client = createClient(url, publishableKey, clientOptions);
  const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (error) throw error;
  assert.equal(data.user?.email?.toLowerCase(), expected.email);
  assert.ok(data.session, 'Authenticated test session was not created');
  return { client, user: data.user };
}

async function ownProfile(client, userId) {
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, handle')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

function assertProfileOwner(profile, user) {
  assert.equal(profile.id, user.id);
}

let accountA;
let accountB;
let temporaryEventId;
const identityMismatches = [];

try {
  accountA = await authenticateWithoutSharingPassword(expectedA);
  accountB = await authenticateWithoutSharingPassword(expectedB);
  pass('both registered accounts can create authenticated Supabase sessions');

  const profileA = await ownProfile(accountA.client, accountA.user.id);
  const profileB = await ownProfile(accountB.client, accountB.user.id);
  assertProfileOwner(profileA, accountA.user);
  assertProfileOwner(profileB, accountB.user);
  for (const [label, profile, expected] of [['A', profileA, expectedA], ['B', profileB, expectedB]]) {
    if (profile.display_name !== expected.name) {
      identityMismatches.push(`account ${label} display name: expected ${expected.name}, stored ${profile.display_name}`);
    }
    if (profile.handle !== expected.handle) {
      identityMismatches.push(`account ${label} display ID: expected ${expected.handle}, stored ${profile.handle}`);
    }
  }
  if (identityMismatches.length === 0) pass('display names and display IDs match the two registered accounts');
  else console.log(`FAIL: ${identityMismatches.join('; ')}`);

  const { error: duplicateError } = await accountB.client
    .from('profiles')
    .update({ handle: profileA.handle })
    .eq('id', accountB.user.id);
  assert.ok(duplicateError, 'A duplicate display ID was unexpectedly accepted');
  assert.match(normalizedErrorText(duplicateError), /23505|profiles_handle_key|duplicate key/i);
  assert.deepEqual(await ownProfile(accountB.client, accountB.user.id), profileB);
  pass('duplicate display ID is rejected and the original profile is preserved');

  temporaryEventId = randomUUID();
  const temporaryCollectionId = randomUUID();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { error: eventError } = await accountA.client.from('events').insert({
    id: temporaryEventId,
    owner_id: accountA.user.id,
    title: 'TSUDOWA 自動結合試験（削除予定）',
    category: 'TEST',
    tagline: '自動試験終了時に削除されます',
    description: '2アカウントのプロフィール・参加・権限同期を確認する一時イベントです。',
    start_date: tomorrow,
    end_date: tomorrow,
    start_time: '09:00',
    end_time: null,
    time_mode: 'start',
    location_name: '自動試験',
    address: '自動試験',
    capacity: 5,
    status: 'scheduled',
    join_policy: 'auto',
    cover_color: '#F3F3F0',
    accent_color: '#173E33',
  });
  if (eventError) throw eventError;

  const { error: collectionError } = await accountA.client.from('collections').insert({
    id: temporaryCollectionId,
    event_id: temporaryEventId,
    title: '自動試験参加費',
    category: 'entry',
    paid_by_user_id: accountA.user.id,
    total_amount: 1000,
    currency: 'JPY',
    split_method: 'equal',
    auto_assign_new_members: true,
    default_share_amount: 1000,
    note: '自動試験終了時に削除されます',
    created_by: accountA.user.id,
  });
  if (collectionError) throw collectionError;
  pass('account A can create a temporary event and default participation fee');

  const { data: inviteCode, error: inviteError } = await accountA.client.rpc('create_event_invite', {
    target_event_id: temporaryEventId,
    valid_for: '1 hour',
    allowed_uses: 2,
  });
  if (inviteError) throw inviteError;
  assert.equal(typeof inviteCode, 'string');

  const { data: previewRows, error: previewError } = await accountB.client.rpc('preview_event_invite', {
    raw_token: inviteCode,
  });
  if (previewError) throw previewError;
  const preview = Array.isArray(previewRows) ? previewRows[0] : previewRows;
  assert.equal(preview?.event_id, temporaryEventId);
  assert.equal(preview?.event_title, 'TSUDOWA 自動結合試験（削除予定）');
  pass('account B can preview the invite before joining');

  const { data: joinRows, error: joinError } = await accountB.client.rpc('join_event_by_invite', {
    raw_token: inviteCode,
  });
  if (joinError) throw joinError;
  const joined = Array.isArray(joinRows) ? joinRows[0] : joinRows;
  assert.equal(joined?.event_id, temporaryEventId);
  assert.equal(joined?.membership_status, 'approved');

  const { data: memberB, error: memberError } = await accountB.client
    .from('event_members')
    .select('user_id, role, status, attendance_label')
    .eq('event_id', temporaryEventId)
    .eq('user_id', accountB.user.id)
    .single();
  if (memberError) throw memberError;
  assert.equal(memberB.role, 'member');
  assert.equal(memberB.status, 'approved');
  assert.equal(memberB.attendance_label, '参加');
  pass('invite joins immediately with attendance set to 参加');

  const { data: visibleProfiles, error: visibleProfilesError } = await accountA.client
    .from('profiles')
    .select('id, display_name, handle')
    .in('id', [accountA.user.id, accountB.user.id]);
  if (visibleProfilesError) throw visibleProfilesError;
  assert.equal(visibleProfiles.length, 2);
  assert.deepEqual(visibleProfiles.find((profile) => profile.id === accountA.user.id), profileA);
  assert.deepEqual(visibleProfiles.find((profile) => profile.id === accountB.user.id), profileB);

  const { data: nestedMembers, error: nestedMembersError } = await accountA.client
    .from('event_members')
    .select('user_id, role, status, attendance_label, profile:profiles!event_members_user_id_fkey(display_name, handle)')
    .eq('event_id', temporaryEventId)
    .order('role');
  if (nestedMembersError) throw nestedMembersError;
  assert.equal(nestedMembers.length, 2);
  assert.equal(nestedMembers.find((member) => member.user_id === accountA.user.id)?.profile?.display_name, profileA.display_name);
  assert.equal(nestedMembers.find((member) => member.user_id === accountB.user.id)?.profile?.display_name, profileB.display_name);
  assert.equal(nestedMembers.find((member) => member.user_id === accountB.user.id)?.profile?.handle, profileB.handle);
  pass(`the host sees account B as ${profileB.display_name}/${profileB.handle} instead of 新しいメンバー`);

  const { data: shares, error: sharesError } = await accountA.client
    .from('collection_shares')
    .select('user_id, amount, paid')
    .eq('collection_id', temporaryCollectionId);
  if (sharesError) throw sharesError;
  assert.equal(shares.length, 2);
  assert.ok(shares.every((share) => Number(share.amount) === 1000 && share.paid === false));
  pass('the default participation fee is assigned unpaid to both participants');

  const { error: memberPaymentError } = await accountB.client.rpc('set_collection_share_paid', {
    target_collection_id: temporaryCollectionId,
    target_user_id: accountB.user.id,
    is_paid: true,
  });
  assert.ok(memberPaymentError, 'A member unexpectedly changed payment status');
  assert.match(normalizedErrorText(memberPaymentError), /not_allowed/i);

  const { error: ownerPaymentError } = await accountA.client.rpc('set_collection_share_paid', {
    target_collection_id: temporaryCollectionId,
    target_user_id: accountB.user.id,
    is_paid: true,
  });
  if (ownerPaymentError) throw ownerPaymentError;
  const { data: paidShare, error: paidShareError } = await accountB.client
    .from('collection_shares')
    .select('paid, paid_at')
    .eq('collection_id', temporaryCollectionId)
    .eq('user_id', accountB.user.id)
    .single();
  if (paidShareError) throw paidShareError;
  assert.equal(paidShare.paid, true);
  assert.ok(paidShare.paid_at);
  pass('only the host can change payment status and account B receives the change');

  const { data: unauthorizedUpdate, error: unauthorizedUpdateError } = await accountB.client
    .from('events')
    .update({ title: '権限外の変更' })
    .eq('id', temporaryEventId)
    .select('id');
  if (unauthorizedUpdateError) throw unauthorizedUpdateError;
  assert.equal(unauthorizedUpdate.length, 0);
  const { data: unchangedEvent, error: unchangedEventError } = await accountA.client
    .from('events')
    .select('title')
    .eq('id', temporaryEventId)
    .single();
  if (unchangedEventError) throw unchangedEventError;
  assert.equal(unchangedEvent.title, 'TSUDOWA 自動結合試験（削除予定）');
  pass('account B cannot edit the host-owned event');

  const messageId = randomUUID();
  const { error: messageError } = await accountB.client.rpc('send_event_message_v2', {
    target_event_id: temporaryEventId,
    message_id: messageId,
    message_body: 'test2からの自動試験メッセージ',
    message_image_path: null,
    message_image_mime_type: null,
    message_image_width: null,
    message_image_height: null,
    reply_to_message_id: null,
  });
  if (messageError) throw messageError;

  const { data: message, error: messageReadError } = await accountA.client
    .from('messages')
    .select('id, author_id, body, author:profiles!messages_author_id_fkey(display_name, handle)')
    .eq('id', messageId)
    .single();
  if (messageReadError) throw messageReadError;
  assert.equal(message.author_id, accountB.user.id);
  assert.equal(message.author?.display_name, profileB.display_name);
  assert.equal(message.author?.handle, profileB.handle);
  pass(`chat messages resolve account B to ${profileB.display_name}/${profileB.handle} for account A`);

  const { error: reactionError } = await accountA.client.rpc('toggle_message_reaction', {
    target_message_id: messageId,
    reaction_emoji: '👍',
  });
  if (reactionError) throw reactionError;
  const { data: reactions, error: reactionReadError } = await accountB.client
    .from('message_reactions')
    .select('user_id, emoji')
    .eq('message_id', messageId);
  if (reactionReadError) throw reactionReadError;
  assert.deepEqual(reactions, [{ user_id: accountA.user.id, emoji: '👍' }]);
  pass('chat reaction synchronizes between the two accounts');

  const { error: readError } = await accountA.client.rpc('mark_event_chat_read', {
    target_event_id: temporaryEventId,
  });
  if (readError) throw readError;
  const { data: readMember, error: readMemberError } = await accountB.client
    .from('event_members')
    .select('chat_read_at')
    .eq('event_id', temporaryEventId)
    .eq('user_id', accountA.user.id)
    .single();
  if (readMemberError) throw readMemberError;
  assert.ok(readMember.chat_read_at);
  pass('chat read state synchronizes between the two accounts');
} finally {
  if (temporaryEventId) {
    const cleanupClient = accountA?.client ?? admin;
    const { data: deletedEvents, error: cleanupError } = await cleanupClient
      .from('events')
      .delete()
      .eq('id', temporaryEventId)
      .select('id');
    if (cleanupError) {
      const { error: adminCleanupError } = await admin.from('events').delete().eq('id', temporaryEventId);
      if (adminCleanupError) throw adminCleanupError;
    } else {
      assert.equal(deletedEvents.length, 1, 'Temporary event was not deleted by its owner');
    }
    const { data: remainingEvent, error: remainingError } = await cleanupClient
      .from('events')
      .select('id')
      .eq('id', temporaryEventId)
      .maybeSingle();
    if (remainingError) throw remainingError;
    assert.equal(remainingEvent, null, 'Temporary event cleanup did not complete');
    pass('temporary event, invite, collection, message, and memberships were deleted');
  }
  await accountA?.client.auth.signOut({ scope: 'local' });
  await accountB?.client.auth.signOut({ scope: 'local' });
}

if (identityMismatches.length > 0) {
  throw new Error(`Registered profile mismatch: ${identityMismatches.join('; ')}`);
}
console.log('Remote two-account integration checks passed.');
