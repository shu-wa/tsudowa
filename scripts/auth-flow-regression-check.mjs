import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const helperSource = readFileSync(new URL('../lib/auth-errors.ts', import.meta.url), 'utf8');
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { describeAuthError } = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`);

assert.deepEqual(
  describeAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
  { reason: 'invalid_credentials', message: 'メールアドレスまたはパスワードが正しくありません。' },
  'missing accounts and wrong passwords must share a neutral response',
);
assert.equal(describeAuthError({ code: 'email_not_confirmed', message: 'Email not confirmed' }).reason, 'email_not_confirmed');
assert.equal(describeAuthError({ code: 'over_email_send_rate_limit', message: 'rate limit' }).reason, 'rate_limited');

const authScreenSource = readFileSync(new URL('../app/auth.tsx', import.meta.url), 'utf8');
const invalidLoginStart = authScreenSource.indexOf("mode === 'login' && result.reason === 'invalid_credentials'");
assert.ok(invalidLoginStart >= 0, 'invalid password-login attempts must have an explicit recovery flow');
const invalidLoginSource = authScreenSource.slice(invalidLoginStart, authScreenSource.indexOf('return Alert.alert', invalidLoginStart + 100));
assert.match(invalidLoginSource, /setMode\('signup'\)/, 'failed login must move to the sign-up screen');
assert.match(invalidLoginSource, /setPassword\(''\)/, 'password must be cleared before sign-up to require deliberate re-entry');
assert.doesNotMatch(invalidLoginSource, /未登録です|登録されていません/, 'the UI must not claim that an address is unregistered');

console.log('Auth flow regression checks passed.');
