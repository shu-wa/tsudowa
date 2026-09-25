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
const cloudSource = cloud.slice(cloud.indexOf('export async function syncCloudDateTime('), cloud.indexOf('export async function syncCloudSchedule(')).replaceAll('export async', 'async');
const functions = compile(cloudSource + '\nreturn { syncCloudDateTime, syncCloudEventDescription, syncCloudLocation };', { supabase: fakeSupabase, isCloudId: () => true });
const input = { startDate: '2026-10-01', endDate: '2026-10-02', startTime: '23:00', endTime: '01:15', timeMode: 'range' };
const locationInput = { location: '京都駅', address: '京都府京都市', latitude: 34.9858, longitude: 135.7588 };
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
await functions.syncCloudLocation('event', locationInput);
assert.equal(persisted.location_name, locationInput.location);
assert.equal(persisted.address, locationInput.address);
assert.equal(persisted.latitude, locationInput.latitude);
assert.equal(persisted.longitude, locationInput.longitude);
await functions.syncCloudLocation('event', { location: '手入力', address: '' });
assert.equal(persisted.latitude, null, 'no coordinates must clear the old pin');
assert.equal(persisted.longitude, null);
for (const code of ['42501', 'PGRST116', 'PGRST204', 'NETWORK_ERROR']) {
  failure = { code };
  await assert.rejects(functions.syncCloudDateTime('event', input), (error) => error === failure);
  await assert.rejects(functions.syncCloudEventDescription('event', 'failure'), (error) => error === failure);
  await assert.rejects(functions.syncCloudLocation('event', locationInput), (error) => error === failure);
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
  syncCloudLocation: (...args) => saveImplementation(...args),
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
const locationOperation = operation('updateEventLocation', 'addScheduleItem');
for (const [operation, value] of [[dateOperation, input], [descriptionOperation, 'new'], [locationOperation, locationInput]]) {
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
assert.equal(typeof await locationOperation('missing', locationInput), 'string');
for (const invalid of [
  { ...locationInput, location: '  ' },
  { ...locationInput, latitude: Number.NaN },
  { ...locationInput, longitude: Infinity },
  { ...locationInput, latitude: 91 },
  { ...locationInput, longitude: -181 },
  { ...locationInput, latitude: undefined },
  { ...locationInput, longitude: undefined },
]) assert.equal(typeof await locationOperation('event', invalid), 'string');
saveImplementation = async () => {};
assert.equal(await locationOperation('event', { location: '  会場  ', address: '  住所  ' }), null);
assert.equal(state[0].location, '会場');
assert.equal(state[0].address, '住所');
assert.equal(state[0].latitude, undefined, 'viewport default must not become a saved coordinate');
assert.equal(await locationOperation('event', { ...locationInput, latitude: 0, longitude: 0 }), null);
assert.equal(state[0].latitude, 0);
assert.equal(await locationOperation('event', { ...locationInput, latitude: -90, longitude: 180 }), null);
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
const locationScreen = read('app/event/[id]/edit-location.tsx');
assert.match(locationScreen, /<LocationForm key=\{event.id\} event=\{event\}/);
assert.match(locationScreen, /await updateEventLocation/);
assert.match(locationScreen, /if \(error\) return Alert.alert/);
assert.match(locationScreen, /if \(!canEdit \|\| savingRef.current \|\| loading\) return/);
assert.match(locationScreen, /version !== lookupVersion.current/);
assert.match(locationScreen, /useState\(event.latitude\)/);
assert.match(locationScreen, /useState\(event.longitude\)/);
// Execute actual screen handlers; structural assertions alone cannot prove
// that out-of-order geocoding and double-tap saving are handled correctly.
function screenHandler(name, dependencies, source = locationScreen) {
  const locationAst = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(locationAst) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(locationAst);
  assert.ok(initializer, `${name} exists`);
  return compile('return (' + initializer.getText(locationAst) + ');', dependencies);
}
const lookupVersion = { current: 1 };
const lookupState = {};
const lookupReplies = [];
const resolvePosition = screenHandler('resolvePosition', {
  lookupVersion,
  setLatitude: (value) => { lookupState.latitude = value; },
  setLongitude: (value) => { lookupState.longitude = value; },
  setName: (value) => { lookupState.name = value; },
  setAddress: (value) => { lookupState.address = value; },
  setQuery: (value) => { lookupState.query = value; },
  addressLabel: (address) => address?.city ?? '',
  Location: { reverseGeocodeAsync: () => new Promise((resolve) => lookupReplies.push(resolve)) },
});
const firstLookup = resolvePosition(1, 35, 139, 'old');
lookupVersion.current = 2;
const secondLookup = resolvePosition(2, 34, 135, 'new');
lookupReplies[1]([{ city: 'new address', name: 'new place' }]);
await secondLookup;
lookupReplies[0]([{ city: 'old address', name: 'old place' }]);
await firstLookup;
assert.deepEqual(lookupState, { latitude: 34, longitude: 135, name: 'new place', address: 'new address', query: 'new address' });
lookupVersion.current = 3;
const cancelledLookup = resolvePosition(3, 33, 134);
assert.equal(lookupState.address, '', 'moving a pin must clear the previous address');
lookupVersion.current = 4; // User typing, unmount, or a newer lookup invalidates it.
lookupState.name = 'user typed';
lookupReplies[2]([{ city: 'late address', name: 'late place' }]);
await cancelledLookup;
assert.equal(lookupState.name, 'user typed');
assert.equal(lookupState.address, '');

let goBackCount = 0;
let alertCount = 0;
let screenSaveCount = 0;
let finishScreenSave;
const savingRef = { current: false };
const savingStates = [];
const saveDependencies = {
  canEdit: true, savingRef, loading: false,
  invalidateLookup: () => { lookupVersion.current += 1; },
  setSaving: (value) => savingStates.push(value),
  name: '会場', query: '', address: '', latitude: undefined, longitude: undefined,
  event: { id: 'event' },
  updateEventLocation: () => { screenSaveCount += 1; return new Promise((resolve) => { finishScreenSave = resolve; }); },
  Alert: { alert: () => { alertCount += 1; } },
  router: { back: () => { goBackCount += 1; } },
};
const saveScreen = screenHandler('save', saveDependencies);
const pendingScreenSave = saveScreen();
await saveScreen();
assert.equal(screenSaveCount, 1, 'double tap must not submit twice');
assert.equal(goBackCount, 0, 'screen must remain open until save completes');
finishScreenSave('offline');
await pendingScreenSave;
assert.equal(alertCount, 1);
assert.equal(goBackCount, 0, 'failed save must keep input on screen');
assert.equal(savingRef.current, false);
const retryScreenSave = saveScreen();
finishScreenSave(null);
await retryScreenSave;
assert.equal(goBackCount, 1);
assert.deepEqual(savingStates, [true, false, true, false]);
for (const guard of [{ canEdit: false }, { loading: true }]) {
  await screenHandler('save', { ...saveDependencies, ...guard, updateEventLocation: () => assert.fail('disabled save') })();
}
const createScreen = read('app/create.tsx');
lookupVersion.current = 1;
lookupReplies.length = 0;
const selectLocation = screenHandler('selectLocation', {
  submittingRef: { current: false }, lookupVersion,
  setLatitude: (value) => { lookupState.latitude = value; },
  setLongitude: (value) => { lookupState.longitude = value; },
  setLocation: (value) => { lookupState.name = value; },
  setAddress: (value) => { lookupState.address = value; },
  setLocationQuery: (value) => { lookupState.query = value; },
  setHasSelectedCoordinates: () => {}, setLocationLoading: () => {},
  addressLabel: (address) => address?.city ?? '',
  Location: { reverseGeocodeAsync: () => new Promise((resolve) => lookupReplies.push(resolve)) },
}, createScreen);
const oldCreateLookup = selectLocation(35, 139);
const newCreateLookup = selectLocation(34, 135);
lookupReplies[1]([{ city: 'new address', name: 'new place' }]);
await newCreateLookup;
lookupReplies[0]([{ city: 'old address', name: 'old place' }]);
await oldCreateLookup;
assert.equal(lookupState.name, 'new place');
assert.equal(lookupState.address, 'new address');
assert.equal(lookupState.latitude, 34);

const submittingRef = { current: false };
let createCount = 0;
let finishCreate;
const submit = screenHandler('submit', {
  submittingRef, locationLoading: false, title: 'イベント', timeMode: 'start',
  startDate: '2026-10-01', endDate: '2026-10-01', startTime: '09:00', endTime: undefined,
  location: '会場', address: '', latitude: 35, longitude: 139, hasSelectedCoordinates: false,
  description: '', initialFee: '0', coverImage: undefined,
  invalidateLookup: () => {}, setSubmitting: () => {},
  addEvent: async (payload) => {
    createCount += 1;
    assert.equal(payload.latitude, undefined, 'unselected coordinates cannot leak into a new event');
    return new Promise((resolve) => { finishCreate = resolve; });
  },
  Alert: { alert: () => {} }, router: { dismiss: () => {}, push: () => {} }, setTimeout: (fn) => fn(),
}, createScreen);
const pendingCreate = submit();
await submit();
assert.equal(createCount, 1);
finishCreate({ error: 'offline' });
await pendingCreate;
assert.equal(submittingRef.current, false);
const retryCreate = submit();
finishCreate({ event: { id: 'created' } });
await retryCreate;
assert.equal(createCount, 2);
assert.equal(submittingRef.current, false);
console.log('Event edit regression checks passed (persistence, failures, zero rows, roles, archives).');
