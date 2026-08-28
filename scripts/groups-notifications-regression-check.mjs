import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const types = read('types/event.ts');
const context = read('context/event-context.tsx');
const display = read('lib/event-display.ts');
const calendar = read('app/(tabs)/calendar.tsx');
const eventCard = read('components/event-card.tsx');
const notifications = read('lib/notifications.native.ts');
const observer = read('components/notification-observer.native.tsx');
const groupMigration = read('supabase/migrations/202608280001_recurring_event_groups.sql');
const notificationMigration = read('supabase/migrations/202608280002_push_notification_foundation.sql');
const notificationScheduleMigration = read('supabase/migrations/202608280003_notification_dispatch_schedule.sql');
const dispatcher = read('supabase/functions/dispatch-notifications/index.ts');

assert(types.includes("dateStatus?: 'undecided' | 'scheduled'"), 'EventItem must model undecided dates explicitly.');
assert(types.includes('export type EventGroup'), 'Recurring group type is missing.');
assert(context.includes('buildUndatedGroupEvent'), 'Undated group event builder is missing.');
assert(context.includes('participants: members.map'), 'Group events must copy the same approved members.');
assert(context.includes('schedule: []') && context.includes('collections: []') && context.includes('messages: []'), 'New group events must not copy mutable event content.');
assert(context.includes('createCloudGroupFromEvent') && context.includes('createCloudGroupEvent'), 'Group RPCs are not connected to the app context.');
assert(display.includes("if (event.dateStatus === 'undecided') return null"), 'Undated events must never be considered ended.');
assert(calendar.includes("event.dateStatus !== 'undecided'"), 'Undated events must be excluded from calendar date cells.');
assert(eventCard.includes('日時未定') && eventCard.includes('dateUndecided'), 'Event cards must render an explicit undecided state.');
assert(notifications.includes("if (event.dateStatus === 'undecided') return null"), 'Undated events must not schedule a placeholder reminder.');

assert(groupMigration.includes('private.can_manage_group'), 'Group manager authorization helper is missing.');
assert(groupMigration.includes('private.shares_event') && groupMigration.includes('event_group_members theirs'), 'Profile visibility must include shared groups.');
assert(groupMigration.includes("if source_event.archived_at is not null then raise exception 'event_already_archived'"), 'Archived events must not be groupified.');
assert(groupMigration.includes("if source_end >= now() then raise exception 'event_not_finished'"), 'Active events must not be groupified.');
assert(groupMigration.includes("date_status = 'scheduled'"), 'Confirming a date candidate must clear the undecided state.');
assert(groupMigration.includes("set_config('tsudowa.suppress_notifications', 'on'"), 'Bulk member copying must suppress notification storms.');

for (const notificationKind of [
  'chat_message',
  'mention_or_reply',
  'event_update',
  'membership_update',
  'collection_update',
  'group_update',
  'announcement',
]) {
  assert(notificationMigration.includes(`'${notificationKind}'`), `Missing notification kind: ${notificationKind}`);
}
assert(notificationMigration.includes('event_notification_preferences'), 'Per-event mute table is missing.');
assert(notificationMigration.includes('push_token_in_use'), 'Active push tokens must not be claimable by another account.');
assert(notificationMigration.includes('claim_notification_outbox') && notificationMigration.includes('for update skip locked'), 'Concurrent dispatchers must claim distinct outbox rows.');
assert(notificationMigration.includes('blocked_users block'), 'Blocked actors must not generate notifications.');
assert(notificationMigration.includes('notify_group_event_created'), 'New group events must notify the existing members once.');
assert(dispatcher.includes('NOTIFICATION_DISPATCH_SECRET'), 'Dispatcher must require a server-only secret.');
assert(dispatcher.includes("admin.rpc('claim_notification_outbox'"), 'Dispatcher must use the atomic outbox claim RPC.');
assert(dispatcher.includes('isQuietTime') && dispatcher.includes('quiet_hours_enabled'), 'Quiet hours are not enforced server-side.');
assert(dispatcher.includes('DeviceNotRegistered'), 'Invalid Expo tokens must be deactivated.');
assert(observer.includes('chat|participants|collection'), 'Push routes must accept every notification destination.');
assert(notificationScheduleMigration.includes('vault.decrypted_secrets'), 'Dispatcher secret must be read from Supabase Vault.');
assert(notificationScheduleMigration.includes('notification_outbox_request_dispatch'), 'Outbox inserts must request an immediate dispatch.');
assert(notificationScheduleMigration.includes("'* * * * *'"), 'A one-minute recovery schedule is required.');

console.log('Group and notification regression checks passed.');
