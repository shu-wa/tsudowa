import { palette } from '@/constants/theme';
import DateTimePicker, { DateTimePickerEvent, IOSNativeProps } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  iosDisplay?: IOSNativeProps['display'];
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

const clampDate = (date: Date, minimumDate?: Date, maximumDate?: Date) => {
  const minimum = minimumDate ? toLocalNoon(minimumDate) : undefined;
  const maximum = maximumDate ? toLocalNoon(maximumDate) : undefined;
  if (minimum && date < minimum) return minimum;
  if (maximum && date > maximum) return maximum;
  return date;
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
  iosDisplay = 'inline',
  pickerDefaultDate,
}: NativeDateFieldProps) {
  const normalizedMinimumDate = minimumDate ? toLocalNoon(minimumDate) : undefined;
  const normalizedMaximumDate = maximumDate ? toLocalNoon(maximumDate) : undefined;
  const selectedDate = clampDate(toLocalDate(value, pickerDefaultDate ?? new Date()), normalizedMinimumDate, normalizedMaximumDate);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') onOpenChange(false);
    if (event.type === 'dismissed' || !date) return;
    onChange(toDateString(clampDate(toLocalNoon(date), normalizedMinimumDate, normalizedMaximumDate)));
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {allowClear && value ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}を未設定に戻す`} onPress={() => { onChange(''); onOpenChange(false); }}><Text style={styles.clear}>クリア</Text></TouchableOpacity> : null}
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${label}、${value ? formatJapaneseDate(value) : '未設定'}`}
        accessibilityHint="端末の日付選択を開きます"
        activeOpacity={0.8}
        style={[styles.field, open && styles.fieldOpen]}
        onPress={() => onOpenChange(!open)}>
        <View style={styles.icon}><Ionicons name="calendar-outline" size={19} color={palette.primary} /></View>
        <View style={styles.copy}><Text style={[styles.value, !value && styles.placeholder]}>{value ? formatJapaneseDate(value) : emptyLabel}</Text><Text style={styles.system}>端末標準のカレンダーで選択</Text></View>
        <Ionicons name={open && Platform.OS === 'ios' ? 'chevron-up' : 'chevron-down'} size={18} color={palette.muted} />
      </TouchableOpacity>
      {open ? <View style={styles.pickerWrap}>
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? iosDisplay : 'calendar'}
          minimumDate={normalizedMinimumDate}
          maximumDate={normalizedMaximumDate}
          locale="ja-JP"
          onChange={handleChange}
        />
        {Platform.OS === 'ios' ? <TouchableOpacity accessibilityRole="button" style={styles.done} onPress={() => onOpenChange(false)}><Text style={styles.doneText}>完了</Text></TouchableOpacity> : null}
      </View> : null}
    </View>
  );
}

export function NativeDateRangePicker({ startDate, endDate, onChange }: NativeDateRangePickerProps) {
  const [openField, setOpenField] = useState<'start' | 'end' | null>(null);
  const setStartDate = (value: string) => onChange(value, !endDate || endDate < value ? value : endDate);

  return (
    <View style={styles.rangeCard}>
      <NativeDateField label="開始日" value={startDate} onChange={setStartDate} open={openField === 'start'} onOpenChange={(open) => setOpenField(open ? 'start' : null)} />
      <NativeDateField label="終了日" value={endDate} onChange={(value) => onChange(startDate, value)} open={openField === 'end'} onOpenChange={(open) => setOpenField(open ? 'end' : null)} minimumDate={toLocalDate(startDate)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  labelRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  label: { color: palette.ink, fontSize: 12, fontWeight: '800' },
  clear: { color: palette.primary, fontSize: 13, fontWeight: '800', paddingVertical: 3 },
  field: { minHeight: 62, borderRadius: 17, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  fieldOpen: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginHorizontal: 10 },
  value: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  placeholder: { color: palette.muted, fontWeight: '700' },
  system: { color: palette.muted, fontSize: 11, marginTop: 3 },
  pickerWrap: { marginTop: 8, borderRadius: 18, backgroundColor: palette.surface, overflow: 'hidden', padding: 8, alignItems: 'center' },
  done: { alignSelf: 'flex-end', minWidth: 72, borderRadius: 11, backgroundColor: palette.primary, paddingHorizontal: 17, paddingVertical: 9, alignItems: 'center' },
  doneText: { color: palette.surface, fontSize: 12, fontWeight: '900' },
  rangeCard: { borderRadius: 22, backgroundColor: palette.surface, padding: 14, paddingBottom: 1 },
});
