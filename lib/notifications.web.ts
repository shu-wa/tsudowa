import { EventItem, NotificationPreferences } from '@/types/event';

export async function requestNotificationPermission() {
  return false;
}

export async function syncLocalReminders(_events: EventItem[], _enabled: boolean, _preferences?: NotificationPreferences) {
  return 0;
}

export async function registerRemoteNotificationDevice() {
  return false;
}

export async function unregisterRemoteNotificationDevice() {
  return;
}
