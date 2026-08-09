import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const helperSource = readFileSync(new URL('../lib/auth-redirect.ts', import.meta.url), 'utf8');
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helper = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`);

assert.equal(helper.NATIVE_ONBOARDING_REDIRECT, 'tsudowa://onboarding');
assert.deepEqual(
  helper.parseAuthCallbackUrl('tsudowa://onboarding?code=confirmation-code'),
  { route: 'onboarding', code: 'confirmation-code', tokenHash: undefined, type: undefined, accessToken: undefined, refreshToken: undefined, errorDescription: undefined },
  'PKCE confirmation links must return to onboarding',
);
assert.equal(
  helper.parseAuthCallbackUrl('tsudowa://onboarding?token_hash=hash&type=email')?.tokenHash,
  'hash',
  'token hash confirmation templates must be supported',
);
assert.deepEqual(
  helper.parseAuthCallbackUrl('tsudowa://onboarding/auth/confirm?token_hash=template-hash&type=email'),
  { route: 'onboarding', code: undefined, tokenHash: 'template-hash', type: 'email', accessToken: undefined, refreshToken: undefined, errorDescription: undefined },
  'Supabase custom confirmation template paths must preserve the app route',
);
assert.equal(
  helper.parseAuthCallbackUrl('tsudowa://onboarding#access_token=access&refresh_token=refresh')?.refreshToken,
  'refresh',
  'legacy fragment sessions must be supported',
);
assert.equal(helper.parseAuthCallbackUrl('https://attacker.example/onboarding?code=stolen'), null, 'foreign web origins must be rejected');
assert.equal(helper.parseAuthCallbackUrl('tsudowa://untrusted?code=stolen'), null, 'unknown app routes must be rejected');

const eventContextSource = readFileSync(new URL('../context/event-context.tsx', import.meta.url), 'utf8');
const defaultProfileStart = eventContextSource.indexOf('const defaultProfile: UserProfile');
const defaultProfileEnd = eventContextSource.indexOf('const defaultSettings:', defaultProfileStart);
const defaultProfileSource = eventContextSource.slice(defaultProfileStart, defaultProfileEnd);
assert.match(defaultProfileSource, /name: ''/, 'the default display name must be blank');
assert.match(defaultProfileSource, /handle: ''/, 'the default handle must be blank');
assert.doesNotMatch(defaultProfileSource, /Test|tamasyu0202/, 'test identity must never be a new-user default');

const authContextSource = readFileSync(new URL('../context/auth-context.tsx', import.meta.url), 'utf8');
assert.match(authContextSource, /emailRedirectTo = Platform\.OS === 'web' \? .* : NATIVE_ONBOARDING_REDIRECT/, 'native signup must use the stable app scheme');
assert.match(authContextSource, /exchangeCodeForSession/, 'PKCE codes must establish a session');
assert.match(authContextSource, /verifyOtp/, 'token hash confirmations must establish a session');
assert.match(authContextSource, /setSession/, 'fragment tokens must establish a session');

console.log('Auth redirect regression checks passed.');
