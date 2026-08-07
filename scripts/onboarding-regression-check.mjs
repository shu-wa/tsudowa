import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import ts from 'typescript';

const helperSource = readFileSync(new URL('../lib/onboarding-state.ts', import.meta.url), 'utf8');
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helper = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`);
const registeredProfile = { name: '登録済みユーザー', handle: '@member', city: '', initials: '登', avatarColor: '#000' };
const defaultProfile = { ...registeredProfile, name: '新しいメンバー' };

assert.equal(helper.hasStoredOnboardingEvidence(
  {
    notificationsEnabled: false,
    onboardingCompleted: false,
    dateOfBirth: '2000-01-02',
    acceptedTermsVersion: '1',
    acceptedPrivacyVersion: '1',
    acceptedCommunityVersion: '1',
  },
  registeredProfile,
), true, 'legacy accepted versions must restore a registered user even after a false flag was saved');
assert.equal(helper.hasStoredOnboardingEvidence(
  { notificationsEnabled: false, onboardingCompleted: false, dateOfBirth: '2000-01-02' },
  registeredProfile,
  [
    { id: 't', document: 'terms', version: '1', accepted: true, recordedAt: '' },
    { id: 'p', document: 'privacy', version: '1', accepted: true, recordedAt: '' },
    { id: 'c', document: 'community', version: '1', accepted: true, recordedAt: '' },
  ],
), true, 'accepted local consent records must restore a registered user');
assert.equal(helper.hasStoredOnboardingEvidence(
  { notificationsEnabled: false, onboardingCompleted: false, dateOfBirth: '2000-01-02' },
  registeredProfile,
  [{ id: 't', document: 'terms', version: '1', accepted: true, recordedAt: '' }],
), false, 'partial consent must not bypass onboarding');
assert.equal(helper.hasStoredOnboardingEvidence(
  {
    notificationsEnabled: false,
    onboardingCompleted: false,
    dateOfBirth: '2000-01-02',
    acceptedTermsVersion: '1',
    acceptedPrivacyVersion: '1',
    acceptedCommunityVersion: '1',
  },
  defaultProfile,
), false, 'the default profile must never be treated as registered');

const cloudProfileSource = readFileSync(new URL('../lib/cloud-profile.ts', import.meta.url), 'utf8');
assert.match(cloudProfileSource, /date_of_birth/, 'cloud onboarding recovery must read the protected birth date');
assert.match(cloudProfileSource, /consent_records/, 'cloud onboarding recovery must read legal consent evidence');
assert.match(cloudProfileSource, /acceptedDocuments\.has\('terms'\)/, 'completion requires terms consent');
assert.match(cloudProfileSource, /acceptedDocuments\.has\('privacy'\)/, 'completion requires privacy consent');
assert.match(cloudProfileSource, /acceptedDocuments\.has\('community'\)/, 'completion requires community consent');

const eventContextSource = readFileSync(new URL('../context/event-context.tsx', import.meta.url), 'utf8');
const hydrationStart = eventContextSource.indexOf('dataStorage.getItem(storageKey)');
const hydrationEnd = eventContextSource.indexOf('const persisted = isConfigured', hydrationStart);
assert.ok(hydrationStart >= 0 && hydrationEnd > hydrationStart, 'the onboarding hydration effect must be discoverable');
const hydrationSource = eventContextSource.slice(hydrationStart, hydrationEnd);
assert.match(hydrationSource, /fetchCloudOnboardingState\(authenticatedUserId\)/, 'every authenticated hydration must recover onboarding from the account');
assert.doesNotMatch(hydrationSource, /settings\.onboardingCompleted/, 'cloud recovery must not depend on the missing local completion flag');
assert.match(hydrationSource, /hasStoredOnboardingEvidence/, 'hydration must recognize durable legacy registration evidence');
assert.match(hydrationSource, /cloudState\.completed \|\| hasLocalOnboardingEvidence/, 'an incomplete cloud migration must not erase valid local registration');
assert.doesNotMatch(hydrationSource, /onboardingCompleted: cloudState\.completed\s*[,}]/, 'cloud false must never unconditionally overwrite local registration');
assert.match(hydrationSource, /syncOnboardingToCloud/, 'valid legacy evidence must repair the missing cloud rows');

const completionStart = eventContextSource.indexOf('completeOnboarding: async');
const completionEnd = eventContextSource.indexOf('setNotificationsEnabled:', completionStart);
const completionSource = eventContextSource.slice(completionStart, completionEnd);
assert.match(completionSource, /await dataStorage\.setItem\(storageKey/, 'onboarding must persist before navigating away');
assert.ok(
  completionSource.indexOf('await dataStorage.setItem(storageKey') < completionSource.indexOf('setSettings(nextSettings)'),
  'the durable write must finish before the completed state can redirect the user',
);

const storageSource = readFileSync(new URL('../lib/auth-storage.ts', import.meta.url), 'utf8');
assert.match(storageSource, /enqueueMutation\(key/, 'encrypted writes for one account must be serialized');
assert.match(storageSource, /await afterPendingMutation\(key\)/, 'reads must wait for an in-flight encrypted write');

console.log('Onboarding regression checks passed.');
