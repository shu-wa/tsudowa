import { EventItem } from '@/types/event';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'event-reminders';
const IDENTIFIER_PREFIX = 'tsudowa-';
const LEGACY_IDENTIFIER_PREFIX = ['do', 'eventer-'].join('-');
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function prepareAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'イベントのリマインダー',
    description: 'イベント開始と集金期限をお知らせします',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#285943',
  });
}

export async function requestNotificationPermission() {
  await prepareAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === Notifications.PermissionStatus.GRANTED) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === Notifications.PermissionStatus.GRANTED;
}

function eventStart(event: EventItem) {
  const value = new Date(`${event.startDate}T${event.startTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function reminderBefore(start: Date, now: number) {
  const dayBefore = start.getTime() - DAY;
  if (dayBefore > now) return { date: new Date(dayBefore), label: '明日は' };
  const hourBefore = start.getTime() - HOUR;
  if (hourBefore > now) return { date: new Date(hourBefore), label: 'まもなく' };
  return null;
}

async function scheduleEventReminder(event: EventItem, now: number) {
  const start = eventStart(event);
  if (!start) return false;
  const reminder = reminderBefore(start, now);
  if (!reminder) return false;
  await Notifications.scheduleNotificationAsync({
    identifier: `${IDENTIFIER_PREFIX}event-${event.id}`,
    content: {
      title: `${reminder.label}「${event.title}」`,
      body: `${event.startTime} · ${event.location}`,
      data: { url: `/event/${event.id}` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminder.date,
      channelId: CHANNEL_ID,
    },
  });
  return true;
}

async function scheduleCollectionReminder(event: EventItem, now: number) {
  let count = 0;
  for (const collection of event.collections) {
    if (!collection.dueDate || collection.shares.every((share) => share.paid)) continue;
    const due = new Date(`${collection.dueDate}T09:00:00`);
    if (Number.isNaN(due.getTime())) continue;
    const reminderAt = due.getTime() - DAY;
    if (reminderAt <= now) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${IDENTIFIER_PREFIX}due-${event.id}-${collection.id}`,
      content: {
        title: `明日は「${collection.title}」の支払期限`,
        body: `${event.title} · ¥${collection.totalAmount.toLocaleString('ja-JP')}`,
        data: { url: `/event/${event.id}/collection/${collection.id}` },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminderAt),
        channelId: CHANNEL_ID,
      },
    });
    count += 1;
  }
  return count;
}

export async function syncLocalReminders(events: EventItem[], enabled: boolean) {
  await prepareAndroidChannel();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((notification) =>
      notification.identifier.startsWith(IDENTIFIER_PREFIX)
      || notification.identifier.startsWith(LEGACY_IDENTIFIER_PREFIX))
    .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));

  if (!enabled) return 0;
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== Notifications.PermissionStatus.GRANTED) return 0;

  const now = Date.now();
  let count = 0;
  for (const event of events) {
    if (await scheduleEventReminder(event, now)) count += 1;
    count += await scheduleCollectionReminder(event, now);
  }
  return count;
}
