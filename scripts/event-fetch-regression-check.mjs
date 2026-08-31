import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const cloudEvents = read('lib/cloud-events.ts');
const context = read('context/event-context.tsx');

assert.match(
  cloudEvents,
  /author:profiles!messages_author_id_fkey/,
  'message authors must use the explicit FK after chat pins and deletion added more profile relationships',
);
assert.match(
  cloudEvents,
  /if \(fullResult\.error\)[\s\S]*members:event_members\(\*, profile:profiles!event_members_user_id_fkey/,
  'optional relation failures must fall back to core events and memberships',
);
assert.match(
  context,
  /const \[eventResult, groupResult\] = await Promise\.allSettled/,
  'event and group refreshes must settle independently',
);
assert.match(
  context,
  /if \(eventResult\.status === 'fulfilled'\) setEvents\(eventResult\.value\)/,
  'successful event results must be applied even when another resource fails',
);
assert.doesNotMatch(
  context,
  /!settings\.onboardingCompleted \|\| !user\) return;\s*\n\s*let active = true;\s*\n\s*const refresh/,
  'an authenticated account event refresh must not be blocked by device onboarding state',
);

console.log('Event fetch regression checks passed.');
