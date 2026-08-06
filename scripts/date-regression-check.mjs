import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/date-values.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dateValues = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
const { normalizeEventDateRange, parseLocalDateKey, resolvePickerDate, toDateString } = dateValues;

const fallback = new Date(2026, 7, 3, 12);

assert.equal(parseLocalDateKey('2026-02-29'), null, 'invalid calendar days must be rejected');
assert.equal(toDateString(resolvePickerDate('', fallback)), '2026-08-03', 'empty picker values must use the explicit fallback');
assert.equal(toDateString(resolvePickerDate('not-a-date', fallback)), '2026-08-03', 'malformed values must not become the Unix epoch');
assert.deepEqual(
  normalizeEventDateRange('1970-01-01', '1970-01-01', fallback),
  { startDate: '2026-08-03', endDate: '2026-08-03' },
  'legacy epoch event dates must be repaired at the data boundary',
);
assert.equal(
  toDateString(resolvePickerDate('1890-01-01', fallback, new Date(1900, 0, 1, 12))),
  '1900-01-01',
  'picker values must respect their minimum date',
);
assert.equal(toDateString(parseLocalDateKey('2024-02-29')), '2024-02-29', 'valid leap days must remain unchanged');

console.log('Date regression checks passed.');
