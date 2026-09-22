import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const cloud = read('lib/cloud-events.ts');
const context = read('context/event-context.tsx');
const compile = (source, dependencies) => new Function(...Object.keys(dependencies),
  ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
)(...Object.values(dependencies));

let persisted = {};
let failure = null;
const fakeSupabase = {
  from(table) {
    assert.equal(table, 'events');
    return {
      update(payload) {
        return { eq(column, id) {
          assert.equal(column, 'id');
          assert.equal(id, 'event');
          return { select(columns) {
            assert.equal(columns, 'id');
            return { async single() {
              if (failure) return { data: null, error: failure };
              persisted = { ...persisted, ...payload };
              return { data: { id }, error: null };
            } };
          } };
        } };
      },
    };
  },
};
const cloudSource = cloud.slice(cloud.indexOf('export async function syncCloudDateTime('), cloud.indexOf('export async function syncCloudLocation(')).replaceAll('export async', 'async');
const functions = compile(cloudSource + '\nreturn { syncCloudDateTime, syncCloudEventDescription };', { supabase: fakeSupabase, isCloudId: () => true });
const input = { startDate: '2026-10-01', endDate: '2026-10-02', startTime: '23:00', endTime: '01:15', timeMode: 'range' };
await functions.syncCloudDateTime('event', input);
assert.equal(persisted.end_date, '2026-10-02');
assert.equal(persisted.end_time, '01:15');
assert.equal(persisted.date_status, 'scheduled');
await functions.syncCloudDateTime('event', { ...input, timeMode: 'start' });
assert.equal(persisted.end_time, null, 'start-only must clear a previously saved end time');
await functions.syncCloudEventDescription('event', '変更した説明');
assert.equal(persisted.description, '変更した説明');
await functions.syncCloudEventDescription('event', '');
assert.equal(persisted.description, '');
for (const code of ['42501', 'PGRST116', 'PGRST204', 'NETWORK_ERROR']) {
  failure = { code };
  await assert.rejects(functions.syncCloudDateTime('event', input), (error) => error === failure);
  await assert.rejects(functions.syncCloudEventDescription('event', 'failure'), (error) => error === failure);
}

// Execute the actual context methods against an in-memory state and deferred
// storage: no optimistic success, mutation on failure, or permissions bypass.
const base = { id: 'event', description: 'old', startDate: '2026-09-01', endDate: '2026-09-01' };
let state = [base];
let manager = true;
let archived = false;
let saveImplementation = async () => {};
const dependencies = {
  events: state, user: { id: 'host' }, profile: { name: 'Host' },
  isEventManager: () => manager, isEventArchived: () => archived,
  normalizeEventDateRange: (startDate, endDate) => ({ startDate, endDate }),
  formatDateLabel: () => 'date', formatEventTimeLabel: () => 'time',
  syncCloudDateTime: (...args) => saveImplementation(...args),
  syncCloudEventDescription: (...args) => saveImplementation(...args),
  setEvents: (updater) => { state = updater(state); },
};
function operation(name, nextName) {
  const marker = '    ' + name + ': ';
  const start = context.indexOf(marker + 'async');
  assert.ok(start >= 0);
  const value = context.slice(start + marker.length, context.indexOf('    ' + nextName + ':', start)).trim().replace(/,$/, '');
  return compile('const operation = ' + value + ';\nreturn operation;', dependencies);
}
const dateOperation = operation('updateEventDateTime', 'updateEventDescription');
const descriptionOperation = operation('updateEventDescription', 'updateEventLocation');
for (const [operation, value] of [[dateOperation, input], [descriptionOperation, 'new']]) {
  state = [base];
  let complete;
  saveImplementation = () => new Promise((resolve) => { complete = resolve; });
  const pending = operation('event', value);
  assert.deepEqual(state, [base], 'UI must not change before storage confirms success');
  complete();
  assert.equal(await pending, null);
  assert.notDeepEqual(state, [base]);
  state = [base];
  saveImplementation = async () => { throw new Error('offline'); };
  assert.equal(typeof await operation('event', value), 'string');
  assert.deepEqual(state, [base]);
  saveImplementation = async () => { assert.fail('unauthorized save'); };
  manager = false;
  assert.equal(typeof await operation('event', value), 'string');
  manager = true;
  archived = true;
  assert.equal(typeof await operation('event', value), 'string');
  archived = false;
}
// Invalid input must never reach storage. Count Unicode characters like Postgres,
// not UTF-16 units, so emoji descriptions have the same limit as the database.
saveImplementation = async () => { assert.fail('invalid input reached storage'); };
for (const invalid of [
  { ...input, startTime: '25:00' },
  { ...input, endTime: undefined },
  { ...input, endTime: '09:99' },
  { ...input, endDate: input.startDate, endTime: input.startTime },
]) {
  assert.equal(typeof await dateOperation('event', invalid), 'string');
}
assert.equal(typeof await descriptionOperation('event', 'a'.repeat(5001)), 'string');
assert.equal(typeof await descriptionOperation('event', '😀'.repeat(5001)), 'string');
assert.equal(typeof await descriptionOperation('missing', 'text'), 'string');
saveImplementation = async () => {};
assert.equal(await descriptionOperation('event', '😀'.repeat(5000)), null);
assert.equal(Array.from(state[0].description).length, 5000);
assert.equal(await descriptionOperation('event', '  '), null);
assert.equal(state[0].description, '');
assert.equal(await dateOperation('event', { ...input, timeMode: 'start' }), null);
assert.equal(state[0].endTime, undefined);
assert.equal(state[0].status, '予定');
assert.match(read('supabase/migrations/202609200001_event_date_update_permission.sql'), /grant update \(date_status\) on public\.events to authenticated/);
assert.match(read('app/event/[id]/edit-date.tsx'), /await updateEventDateTime/);
assert.match(read('app/event/[id]/edit-description.tsx'), /await updateEventDescription/);
assert.match(read('app/event/[id]/edit-date.tsx'), /<DateForm key=\{event.id\} event=\{event\}/);
assert.match(read('app/event/[id]/edit-description.tsx'), /<DescriptionForm key=\{event.id\} event=\{event\}/);
console.log('Event edit regression checks passed (persistence, failures, zero rows, roles, archives).');
