import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
