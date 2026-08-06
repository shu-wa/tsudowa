import type { EventTimeMode } from '@/types/event';

const DEFAULT_TIME = '09:00';
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

export function normalizeTimeValue(value?: string, fallback = DEFAULT_TIME) {
  const match = value?.match(TIME_PATTERN);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function timeValueToDate(value?: string) {
  const [hours, minutes] = normalizeTimeValue(value).split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes, 0, 0);
}

export function dateToTimeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatEventTimeLabel(startTime: string, endTime: string | undefined, mode: EventTimeMode) {
  return mode === 'range' && endTime ? `${startTime}–${endTime}` : `${startTime} 開始`;
}
