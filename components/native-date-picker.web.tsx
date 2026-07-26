import { palette } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { ChangeEvent, createElement, FormEvent } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type NativeDateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  emptyLabel?: string;
  allowClear?: boolean;
  iosDisplay?: 'default' | 'compact' | 'inline' | 'spinner';
  pickerDefaultDate?: Date;
};

type NativeDateRangePickerProps = {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
};

export const toDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toLocalNoon = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);

export const toLocalDate = (value?: string, fallback = new Date()) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return toLocalNoon(fallback);
  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
    ? parsed
    : toLocalNoon(fallback);
};

const formatJapaneseDate = (value: string) => {
  if (!value) return '';
  return toLocalDate(value).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
};

export const formatJapaneseDateRange = (start: string, end: string) => {
  if (!start) return '未設定';
  if (!end || start === end) return formatJapaneseDate(start);
  return `${formatJapaneseDate(start)} 〜 ${formatJapaneseDate(end)}`;
};

export function NativeDateField({
  label,
  value,
  onChange,
  open,
  onOpenChange,
  minimumDate,
  maximumDate,
  emptyLabel = '日付を選択',
  allowClear = false,
}: NativeDateFieldProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {allowClear && value ? <TouchableOpacity accessibilityRole="button" onPress={() => onChange('')}><Text style={styles.clear}>クリア</Text></TouchableOpacity> : null}
      </View>
      <View style={[styles.field, open && styles.fieldOpen]}>
        <View style={styles.icon}><Ionicons name="calendar-outline" size={19} color={palette.primary} /></View>
        <View style={styles.inputCopy}>
          {createElement('input', {
            'aria-label': label,
            type: 'date',
            value,
            min: minimumDate ? toDateString(minimumDate) : undefined,
            max: maximumDate ? toDateString(maximumDate) : undefined,
            onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
            onInput: (event: FormEvent<HTMLInputElement>) => onChange(event.currentTarget.value),
            onFocus: () => onOpenChange(true),
            onBlur: () => onOpenChange(false),
            style: webInputStyle,
          })}
          <Text style={styles.system}>{value ? formatJapaneseDate(value) : emptyLabel} · ブラウザ標準のカレンダー</Text>
        </View>
      </View>
    </View>
  );
}

export function NativeDateRangePicker({ startDate, endDate, onChange }: NativeDateRangePickerProps) {
  const setStartDate = (value: string) => onChange(value, !endDate || endDate < value ? value : endDate);
  return (
    <View style={styles.rangeCard}>
      <NativeDateField label="開始日" value={startDate} onChange={setStartDate} open={false} onOpenChange={() => undefined} />
      <NativeDateField label="終了日" value={endDate} onChange={(value) => onChange(startDate, value)} open={false} onOpenChange={() => undefined} minimumDate={toLocalDate(startDate)} />
    </View>
  );
}

const webInputStyle = {
  width: '100%',
  height: 34,
  border: 0,
  outline: 'none',
  background: 'transparent',
  color: palette.ink,
  fontFamily: 'system-ui, sans-serif',
  fontSize: 16,
  fontWeight: 800,
  colorScheme: 'light',
  cursor: 'pointer',
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  labelRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  label: { color: palette.ink, fontSize: 12, fontWeight: '800' },
  clear: { color: palette.primary, fontSize: 13, fontWeight: '800', paddingVertical: 3 },
  field: { minHeight: 68, borderRadius: 17, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  fieldOpen: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  inputCopy: { flex: 1, marginLeft: 10 },
  system: { color: palette.muted, fontSize: 11, marginTop: 1 },
  rangeCard: { borderRadius: 22, backgroundColor: palette.surface, padding: 14, paddingBottom: 1 },
});
