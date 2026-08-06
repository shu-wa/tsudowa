import { palette } from '@/constants/theme';
import { parseLocalDateKey, resolvePickerDate, toDateString, toLocalNoon } from '@/lib/date-values';
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

export const toLocalDate = (value?: string, fallback = new Date()) => {
  return parseLocalDateKey(value) ?? toLocalNoon(fallback);
};

export { toDateString } from '@/lib/date-values';

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
  pickerDefaultDate,
}: NativeDateFieldProps) {
  const safeValue = value ? toDateString(resolvePickerDate(value, pickerDefaultDate ?? new Date(), minimumDate, maximumDate), pickerDefaultDate) : '';
  const acceptValue = (nextValue: string) => {
    if (!nextValue && allowClear) return onChange('');
    const parsed = parseLocalDateKey(nextValue);
    if (!parsed) return;
    onChange(toDateString(resolvePickerDate(nextValue, pickerDefaultDate ?? new Date(), minimumDate, maximumDate), pickerDefaultDate));
  };
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
            value: safeValue,
            min: minimumDate ? toDateString(minimumDate) : undefined,
            max: maximumDate ? toDateString(maximumDate) : undefined,
            onChange: (event: ChangeEvent<HTMLInputElement>) => acceptValue(event.target.value),
            onInput: (event: FormEvent<HTMLInputElement>) => acceptValue(event.currentTarget.value),
            onFocus: () => {
              if (!value) onChange(toDateString(resolvePickerDate('', pickerDefaultDate ?? new Date(), minimumDate, maximumDate), pickerDefaultDate));
              onOpenChange(true);
            },
            onBlur: () => onOpenChange(false),
            style: webInputStyle,
          })}
          <Text style={styles.system}>{value ? formatJapaneseDate(value) : emptyLabel} · ブラウザ標準のカレンダー</Text>
        </View>
      </View>
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
  field: { minHeight: 68, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  fieldOpen: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  icon: { width: 36, height: 36, borderRadius: 6, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  inputCopy: { flex: 1, marginLeft: 10 },
  system: { color: palette.muted, fontSize: 11, marginTop: 1 },
});
