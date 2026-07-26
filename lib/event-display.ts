import { EventItem } from '@/types/event';

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getEventDisplayStatus = (event: EventItem, now = new Date()): EventItem['status'] => {
  if (event.status === '終了') return '終了';
  const today = localDateKey(now);
  if (event.endDate < today) return '終了';
  if (event.startDate <= today) return '開催中';
  return '予定';
};

export const getEventArchiveAt = (event: EventItem) => {
  const eventEndTime = event.timeMode === 'range' && event.endTime ? event.endTime : event.startTime || '00:00';
  const eventEnd = new Date(`${event.endDate}T${eventEndTime}:00`);
  return new Date(eventEnd.getTime() + 24 * 60 * 60 * 1000);
};

export const isEventArchived = (event: EventItem, now = new Date()) =>
  getEventArchiveAt(event).getTime() <= now.getTime();

export const formatEventMonth = (startDate: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  return match ? `${Number(match[2])}月` : '';
};

export const getLocalDateKey = localDateKey;
