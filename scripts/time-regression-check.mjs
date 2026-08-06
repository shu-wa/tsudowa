import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const timeSource = readFileSync(new URL('../lib/time-values.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(timeSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const timeValues = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const { dateToTimeValue, normalizeTimeValue, timeValueToDate } = timeValues;

assert.equal(normalizeTimeValue('9:05'), '09:05', 'single-digit hours must be normalized');
assert.equal(normalizeTimeValue('23:59'), '23:59', 'valid late times must remain unchanged');
assert.equal(normalizeTimeValue('24:00'), '09:00', 'invalid hours must use the fallback');
assert.equal(normalizeTimeValue('09:60'), '09:00', 'invalid minutes must use the fallback');
assert.equal(dateToTimeValue(timeValueToDate('17:35')), '17:35', 'picker conversion must round-trip local time');

const pickerSource = readFileSync(new URL('../components/native-time-picker-modal.tsx', import.meta.url), 'utf8');
assert.match(pickerSource, /value=\{draftDate\}/, 'the controlled iOS picker must render its live draft value');
assert.match(pickerSource, /setDraftDate\(date\)/, 'every native wheel event must update the controlled value');
assert.doesNotMatch(pickerSource, /value=\{initialDate\}/, 'the picker must not stay fixed to its opening value');

const scheduleSource = readFileSync(new URL('../app/event/[id]/schedule/new.tsx', import.meta.url), 'utf8');
assert.match(scheduleSource, /initializedEditorKey\.current === editorKey/, 'realtime refreshes must not reinitialize an active schedule form');

const appConfig = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
assert.equal(appConfig.expo.ios.newArchEnabled, false, 'iOS must use the stable legacy native picker implementation on SDK 54');

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.match(packageJson.dependencies['react-native-reanimated'], /^~3\.19\./, 'iOS legacy architecture requires the React Native 0.81-compatible Reanimated 3 line');
assert.equal(packageJson.dependencies['react-native-worklets'], undefined, 'unused Worklets cannot be bundled with the iOS legacy architecture');
assert.deepEqual(packageJson.expo?.install?.exclude, ['react-native-reanimated'], 'Expo dependency validation must record the intentional legacy-compatible version');

console.log('Time regression checks passed.');
