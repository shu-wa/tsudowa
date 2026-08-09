import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const valuesSource = readFileSync(new URL('../lib/collection-values.ts', import.meta.url), 'utf8')
  .replace("import { CollectionShare, NewCollectionInput } from '@/types/event';", '');
const valuesJs = ts.transpileModule(valuesSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const values = await import(`data:text/javascript;base64,${Buffer.from(valuesJs).toString('base64')}`);

const equalShares = values.buildCollectionShares({
  totalAmount: 1000,
  splitMethod: 'equal',
  participantIds: ['host', 'member-a', 'member-b'],
});
assert.deepEqual(equalShares.map((share) => share.amount), [334, 333, 333], 'equal splitting must preserve the exact total');
assert.equal(values.collectionSharesTotal(equalShares), 1000);

const updatedShares = values.buildCollectionShares({
  totalAmount: 1300,
  splitMethod: 'custom',
  participantIds: ['host', 'member-b', 'member-new'],
  customAmounts: { host: 500, 'member-b': 400, 'member-new': 400 },
}, [
  { participantId: 'host', amount: 300, paid: true, paidAt: '確認済み' },
  { participantId: 'member-a', amount: 300, paid: true },
  { participantId: 'member-b', amount: 400, paid: false },
]);
assert.equal(updatedShares.find((share) => share.participantId === 'host')?.paid, true, 'existing payment status must survive edits');
assert.equal(updatedShares.some((share) => share.participantId === 'member-a'), false, 'removed members must be removed from the collection');
assert.equal(updatedShares.find((share) => share.participantId === 'member-new')?.paid, false, 'new collection members must start unpaid');

const permissionsSource = readFileSync(new URL('../lib/event-permissions.ts', import.meta.url), 'utf8');
assert.match(permissionsSource, /isEventHost[\s\S]*role === '主催者'/, 'collection editing must distinguish the host from cohosts');

const contextSource = readFileSync(new URL('../context/event-context.tsx', import.meta.url), 'utf8');
for (const action of ['addCollection', 'updateCollection', 'deleteCollection', 'toggleCollectionPayment']) {
  const start = contextSource.indexOf(`    ${action}: async`);
  const nextAction = contextSource.indexOf('\n    },', start);
  assert.ok(start >= 0 && nextAction > start, `${action} must exist`);
  assert.match(contextSource.slice(start, nextAction), /isEventHost/, `${action} must require the event host`);
}

const migrationSource = readFileSync(new URL('../supabase/migrations/202608090001_collection_owner_editing.sql', import.meta.url), 'utf8');
assert.match(migrationSource, /create policy collections_owner_update[\s\S]*private\.is_event_owner/, 'database collection updates must be owner-only');
assert.match(migrationSource, /create or replace function public\.update_collection_details[\s\S]*for update;/, 'collection details and shares must update atomically');
assert.match(migrationSource, /create or replace function public\.set_collection_share_paid[\s\S]*private\.is_event_owner/, 'payment confirmation must be owner-only');

console.log('Collection editing regression checks passed.');
