import { supabase } from '@/lib/supabase';
import { NotificationPreferences } from '@/types/event';

export const defaultNotificationPreferences: NotificationPreferences = {
  eventReminders: true,
  collectionReminders: true,
  chatMessages: true,
  mentionsAndReplies: true,
  eventUpdates: true,
  membershipUpdates: true,
  collectionUpdates: true,
  groupUpdates: true,
  announcements: true,
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '08:00',
};

type CloudPreferences = {
  master_enabled: boolean;
  event_reminders: boolean;
  collection_reminders: boolean;
  chat_messages: boolean;
  mentions_and_replies: boolean;
  event_updates: boolean;
  membership_updates: boolean;
  collection_updates: boolean;
  group_updates: boolean;
  announcements: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
};

const toLocalPreferences = (row: CloudPreferences): NotificationPreferences => ({
  eventReminders: row.event_reminders,
  collectionReminders: row.collection_reminders,
  chatMessages: row.chat_messages,
  mentionsAndReplies: row.mentions_and_replies,
  eventUpdates: row.event_updates,
  membershipUpdates: row.membership_updates,
  collectionUpdates: row.collection_updates,
  groupUpdates: row.group_updates,
  announcements: row.announcements,
  quietHoursEnabled: row.quiet_hours_enabled,
  quietStart: row.quiet_start.slice(0, 5),
  quietEnd: row.quiet_end.slice(0, 5),
});

export async function fetchCloudNotificationSettings(userId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as CloudPreferences;
  return {
    enabled: row.master_enabled,
    preferences: toLocalPreferences(row),
  };
}

export async function syncCloudNotificationSettings(
  userId: string,
  enabled: boolean,
  preferences: NotificationPreferences,
) {
  if (!supabase) return;
  const { error } = await supabase.from('notification_preferences').upsert({
    user_id: userId,
    master_enabled: enabled,
    event_reminders: preferences.eventReminders,
    collection_reminders: preferences.collectionReminders,
    chat_messages: preferences.chatMessages,
    mentions_and_replies: preferences.mentionsAndReplies,
    event_updates: preferences.eventUpdates,
    membership_updates: preferences.membershipUpdates,
    collection_updates: preferences.collectionUpdates,
    group_updates: preferences.groupUpdates,
    announcements: preferences.announcements,
    quiet_hours_enabled: preferences.quietHoursEnabled,
    quiet_start: preferences.quietStart,
    quiet_end: preferences.quietEnd,
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo',
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function syncCloudEventNotificationMuted(eventId: string, userId: string, muted: boolean) {
  if (!supabase) return;
  const { error } = await supabase.from('event_notification_preferences').upsert({
    event_id: eventId,
    user_id: userId,
    muted,
  }, { onConflict: 'event_id,user_id' });
  if (error) throw error;
}
