import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const helperSource = readFileSync(new URL('../lib/profile-handle.ts', import.meta.url), 'utf8');
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helper = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`);

assert.equal(helper.defaultProfileHandleBody('tamasyu0202@docomo.ne.jp'), 'tamasyu0202');
assert.equal(helper.defaultProfileHandleBody('shu.wa-test@example.com'), 'shu_wa_test');
assert.equal(helper.normalizeProfileHandle('@@member_01'), '@member_01');
assert.equal(helper.validateProfileHandle('member_01'), null);
assert.match(helper.validateProfileHandle('a'), /2〜30文字/);
assert.match(helper.validateProfileHandle('日本語ID'), /英数字とアンダーバー/);

const plainPostgrestConflict = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "profiles_handle_key"',
  details: 'Key (handle)=(@member_01) already exists.',
};
assert.equal(helper.isProfileHandleConflict(plainPostgrestConflict), true, 'plain PostgREST errors must be recognized without instanceof Error');
assert.equal(helper.profileSaveErrorMessage(plainPostgrestConflict), helper.PROFILE_HANDLE_TAKEN_MESSAGE);
assert.equal(helper.profileSaveErrorMessage({ code: '42501', message: 'permission denied' }), null);

const profileScreenSource = readFileSync(new URL('../app/profile-edit.tsx', import.meta.url), 'utf8');
assert.match(profileScreenSource, /PROFILE_HANDLE_TAKEN_MESSAGE/, 'profile editing must use the explicit duplicate-ID warning');

console.log('Profile handle regression checks passed.');
