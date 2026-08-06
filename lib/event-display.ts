import { getLocalDateKey, parseLocalDateKey, parseLocalDateTime } from '@/lib/date-values';
import { EventItem } from '@/types/event';

export const getEventEndAt = (event: EventItem): Date | null => {
  const endTime = event.timeMode === 'range' && event.endTime ? event.endTime : '23:59';
  return parseLocalDateTime(event.endDate, endTime);
};

export const getEventDisplayStatus = (event: EventItem, now = new Date()): EventItem['status'] => {
  if (event.status === '終了' || isEventArchived(event) || isEventPast(event, now)) return '終了';
  const today = getLocalDateKey(now);
  if (event.startDate <= today) return '開催中';
  return '予定';
};

export const getEventArchiveAt = (event: EventItem): Date | null => {
  if (!event.archivedAt) return null;
  const archivedAt = new Date(event.archivedAt);
  return Number.isFinite(archivedAt.getTime()) ? archivedAt : null;
};

export const isEventArchived = (event: EventItem) => getEventArchiveAt(event) !== null;

export const isEventPast = (event: EventItem, now = new Date()) => {
  if (isEventArchived(event)) return false;
  const endAt = getEventEndAt(event);
  return endAt ? endAt.getTime() < now.getTime() : false;
};

export const formatEventMonth = (startDate: string) => {
  const date = parseLocalDateKey(startDate);
  return date ? `${date.getMonth() + 1}月` : '';
};

export const getEventDateKeys = (event: EventItem) => {
  const start = parseLocalDateKey(event.startDate);
  const end = parseLocalDateKey(event.endDate);
  if (!start || !end || end < start) return [];
  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && keys.length < 370) {
    keys.push(getLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
};

export { getLocalDateKey } from '@/lib/date-values';
