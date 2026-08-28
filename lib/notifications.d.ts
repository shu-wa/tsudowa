import { EventItem, NotificationPreferences } from '@/types/event';

export function requestNotificationPermission(): Promise<boolean>;
export function syncLocalReminders(events: EventItem[], enabled: boolean, preferences?: NotificationPreferences): Promise<number>;
export function registerRemoteNotificationDevice(): Promise<boolean>;
export function unregisterRemoteNotificationDevice(): Promise<void>;
