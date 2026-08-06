const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const toLocalNoon = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);

export const isValidDate = (date: Date) => Number.isFinite(date.getTime());

export const parseLocalDateKey = (value?: string): Date | null => {
  const match = DATE_KEY_PATTERN.exec(value ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
    ? parsed
    : null;
};

export const toDateString = (date: Date, fallback = new Date()): string => {
  const safeDate = isValidDate(date) ? toLocalNoon(date) : toLocalNoon(fallback);
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const clampLocalDate = (date: Date, minimumDate?: Date, maximumDate?: Date) => {
  const minimum = minimumDate && isValidDate(minimumDate) ? toLocalNoon(minimumDate) : undefined;
  const maximum = maximumDate && isValidDate(maximumDate) ? toLocalNoon(maximumDate) : undefined;
  const selected = isValidDate(date) ? toLocalNoon(date) : minimum ?? maximum ?? toLocalNoon(new Date());
  if (minimum && selected < minimum) return minimum;
  if (maximum && selected > maximum) return maximum;
  return selected;
};

export const resolvePickerDate = (
  value: string | undefined,
  fallback: Date,
  minimumDate?: Date,
  maximumDate?: Date,
) => clampLocalDate(parseLocalDateKey(value) ?? fallback, minimumDate, maximumDate);

export const sanitizeDateKey = (
  value: string | undefined,
  fallback: Date,
  minimumDate?: Date,
  maximumDate?: Date,
) => toDateString(resolvePickerDate(value, fallback, minimumDate, maximumDate), fallback);

export const getLocalDateKey = (date: Date) => toDateString(date);

export const EVENT_EARLIEST_DATE = new Date(2000, 0, 1, 12, 0, 0, 0);

export const normalizeEventDateRange = (startDate?: string, endDate?: string, fallback = new Date()) => {
  const fallbackStart = clampLocalDate(fallback, EVENT_EARLIEST_DATE);
  const parsedStart = parseLocalDateKey(startDate);
  const safeStartDate = parsedStart && parsedStart >= EVENT_EARLIEST_DATE ? parsedStart : fallbackStart;
  const parsedEnd = parseLocalDateKey(endDate);
  const safeEndDate = parsedEnd && parsedEnd >= safeStartDate ? parsedEnd : safeStartDate;
  return { startDate: toDateString(safeStartDate), endDate: toDateString(safeEndDate) };
};

export const parseLocalDateTime = (dateKey: string, time = '00:00'): Date | null => {
  const date = parseLocalDateKey(dateKey);
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!date || !match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  date.setHours(hours, minutes, 0, 0);
  return date;
};
