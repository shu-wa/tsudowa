import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const valuesSource = readFileSync(new URL('../lib/chat-values.ts', import.meta.url), 'utf8')
  .replace("import { ChatMessage, Participant } from '@/types/event';", '');
const valuesJs = ts.transpileModule(valuesSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const values = await import(`data:text/javascript;base64,${Buffer.from(valuesJs).toString('base64')}`);

const sentAt = new Date('2026-08-27T10:00:00.000Z').getTime();
const mine = { id: 'm1', authorId: 'u1', author: '本人', initials: '本', text: '集合は駅です', time: '19:00', createdAt: new Date(sentAt).toISOString(), mine: true, color: '#000' };
assert.equal(values.canEditChatMessage(mine, sentAt + 14 * 60 * 1000), true, 'own message must be editable during the 15 minute window');
assert.equal(values.canEditChatMessage(mine, sentAt + 16 * 60 * 1000), false, 'edit window must expire');
assert.equal(values.canDeleteChatMessage(mine, false, sentAt + 23 * 60 * 60 * 1000), true, 'own message must be retractable during the 24 hour window');
assert.equal(values.canDeleteChatMessage({ ...mine, mine: false }, true, sentAt + 48 * 60 * 60 * 1000), true, 'event managers must be able to moderate a message');
assert.equal(values.getMessageReadCount(mine, [
  { id: 'u1', chatReadAt: new Date(sentAt + 1000).toISOString() },
  { id: 'u2', chatReadAt: new Date(sentAt + 1000).toISOString() },
  { id: 'u3', chatReadAt: new Date(sentAt - 1000).toISOString() },
]), 1, 'read count must exclude the sender and members who have not read the message');
assert.deepEqual(values.filterChatMessages([mine, { ...mine, id: 'm2', author: '田中', text: '了解' }], '田中').map((message) => message.id), ['m2']);
assert.equal(values.getMentionQuery('確認お願いします @田'), '田');
assert.equal(values.insertMention('確認お願いします @田', '田中 太郎'), '確認お願いします @田中 太郎 ');

const migration = readFileSync(new URL('../supabase/migrations/202608270001_chat_foundation.sql', import.meta.url), 'utf8');
for (const required of [
  'send_event_message_v2', 'edit_event_message', 'delete_event_message',
  'toggle_message_reaction', 'set_message_pin', 'message_reactions',
  'event_chat_realtime_read', 'event_chat_realtime_write',
]) assert.match(migration, new RegExp(required), `chat migration must contain ${required}`);
assert.match(migration, /private\.is_event_member\(private\.realtime_chat_event_id/, 'Realtime Presence must be limited to event members');
assert.match(migration, /reaction_emoji not in \('👍', '❤️', '😂', '😮', '😢', '🙏'\)/, 'the database must allowlist reactions');
assert.match(migration, /target\.created_at < now\(\) - interval '15 minutes'/, 'the database must enforce the edit window');
assert.match(migration, /target\.created_at < now\(\) - interval '24 hours'/, 'the database must enforce the retract window');

const cloudSource = readFileSync(new URL('../lib/cloud-events.ts', import.meta.url), 'utf8');
assert.match(cloudSource, /messages\(\*, author:profiles[\s\S]*reactions:message_reactions/, 'cloud refresh must load reactions');
assert.match(cloudSource, /supabase\.rpc\('send_event_message_v2'/, 'the client must use the backwards-compatible v2 send RPC');

const remoteSmokeSource = readFileSync(new URL('./remote-security-smoke.mjs', import.meta.url), 'utf8');
for (const parameter of [
  'target_event_id', 'message_id', 'message_body', 'message_image_path',
  'message_image_mime_type', 'message_image_width', 'message_image_height',
  'reply_to_message_id', 'target_message_id', 'new_body', 'reaction_emoji', 'should_pin',
]) assert.match(remoteSmokeSource, new RegExp(`\\b${parameter}\\b`), `remote security smoke must use the current RPC parameter ${parameter}`);
assert.doesNotMatch(remoteSmokeSource, /\bp_(?:event_id|message_id|content|image_[a-z_]+|reply_to_id|emoji|pinned)\b/, 'remote security smoke must not use removed RPC parameter names');

const chatScreen = readFileSync(new URL('../app/event/[id]/chat.tsx', import.meta.url), 'utf8');
for (const feature of ['返信', 'リアクション', 'ピン留め', '送信を取り消す', 'メッセージ・送信者を検索', '既読']) {
  assert.match(chatScreen, new RegExp(feature), `chat UI must expose ${feature}`);
}

console.log('Chat regression checks passed.');
