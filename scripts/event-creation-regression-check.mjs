import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const helperSource = read('lib/event-creation-errors.ts');
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { eventCreationErrorMessage } = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`);

assert.match(eventCreationErrorMessage(new Error('not_authenticated')), /ログインし直して/);
assert.match(eventCreationErrorMessage({ code: '42501', message: 'row-level security' }), /権限/);
assert.match(eventCreationErrorMessage(new Error('network request failed')), /通信状態/);
assert.match(eventCreationErrorMessage({ code: '23505', message: 'duplicate key' }), /すでに保存/);

const context = read('context/event-context.tsx');
const createScreen = read('app/create.tsx');
const cloudEvents = read('lib/cloud-events.ts');

assert.match(context, /addEvent: async \(input\)/, 'event creation must be asynchronous');
assert.match(context, /await createCloudEvent\(event\)/, 'navigation must wait for the cloud event insert');
assert.doesNotMatch(context, /void createCloudEvent\(event\)/, 'cloud event errors must not be detached and swallowed');
assert.match(context, /Promise\.allSettled\(relatedWrites\)/, 'non-core event details must report partial failures');
assert.match(context, /return \{ error: eventCreationErrorMessage\(error\) \}/, 'core persistence failures must reach the screen');
assert.match(createScreen, /const result = await addEvent/, 'the create screen must wait for persistence');
assert.match(createScreen, /disabled=\{submitting\}/, 'duplicate event submissions must be blocked');
assert.match(createScreen, /finally \{\s*setSubmitting\(false\)/, 'the submitting state must recover from unexpected failures');
assert.match(createScreen, /イベントを作成できませんでした/, 'users must receive a visible persistence error');
assert.match(cloudEvents, /if \(authError \|\| !userId\) throw new Error\('not_authenticated'\)/, 'missing sessions must fail explicitly');

console.log('Event creation regression checks passed.');
