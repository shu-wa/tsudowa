import { palette } from '@/constants/theme';
import { clampLocalDate, parseLocalDateKey, resolvePickerDate, toDateString, toLocalNoon } from '@/lib/date-values';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent, IOSNativeProps } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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
  iosDisplay = 'spinner',
  pickerDefaultDate,
}: NativeDateFieldProps) {
  const normalizedMinimumDate = minimumDate ? toLocalNoon(minimumDate) : undefined;
  const normalizedMaximumDate = maximumDate ? toLocalNoon(maximumDate) : undefined;
  const selectedDate = resolvePickerDate(value, pickerDefaultDate ?? new Date(), normalizedMinimumDate, normalizedMaximumDate);
  const selectedTimestamp = selectedDate.getTime();
  const [draftDate, setDraftDate] = useState(selectedDate);

  useEffect(() => {
    if (!open) setDraftDate(new Date(selectedTimestamp));
  }, [open, selectedTimestamp]);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') onOpenChange(false);
    if (event.type === 'dismissed' || !date) return;
    const nextDate = clampLocalDate(date, normalizedMinimumDate, normalizedMaximumDate);
    setDraftDate(nextDate);
    onChange(toDateString(nextDate, pickerDefaultDate));
  };

  const togglePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: 'date',
        display: 'calendar',
        minimumDate: normalizedMinimumDate,
        maximumDate: normalizedMaximumDate,
        onChange: handleChange,
      });
      return;
    }
    if (!open) setDraftDate(selectedDate);
    onOpenChange(!open);
  };

  if (Platform.OS === 'ios' && iosDisplay === 'compact') {
    return (
      <View style={styles.wrapper}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {allowClear && value ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}を未設定に戻す`} onPress={() => onChange('')}><Text style={styles.clear}>クリア</Text></TouchableOpacity> : null}
        </View>
        <View style={styles.compactField}>
          <View style={styles.icon}><Ionicons name="calendar-outline" size={19} color={palette.primary} /></View>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="compact"
            minimumDate={normalizedMinimumDate}
            maximumDate={normalizedMaximumDate}
            locale="ja-JP"
            onChange={handleChange}
            style={styles.compactPicker}
          />
          <Text style={styles.compactHint}>タップしてカレンダーを表示</Text>
        </View>
      </View>
    );
  }

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
        onPress={togglePicker}>
        <View style={styles.icon}><Ionicons name="calendar-outline" size={19} color={palette.primary} /></View>
        <View style={styles.copy}><Text style={[styles.value, !value && styles.placeholder]}>{value ? formatJapaneseDate(value) : emptyLabel}</Text><Text style={styles.system}>端末標準のカレンダーで選択</Text></View>
        <Ionicons name={open && Platform.OS === 'ios' ? 'chevron-up' : 'chevron-down'} size={18} color={palette.muted} />
      </TouchableOpacity>
      {open && Platform.OS === 'ios' ? <View style={styles.pickerWrap}>
        <DateTimePicker
          value={draftDate}
          mode="date"
          display={iosDisplay}
          minimumDate={normalizedMinimumDate}
          maximumDate={normalizedMaximumDate}
          locale="ja-JP"
          onChange={handleChange}
        />
        <TouchableOpacity accessibilityRole="button" style={styles.done} onPress={() => onOpenChange(false)}><Text style={styles.doneText}>完了</Text></TouchableOpacity>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  labelRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  label: { color: palette.ink, fontSize: 12, fontWeight: '800' },
  clear: { color: palette.primary, fontSize: 13, fontWeight: '800', paddingVertical: 3 },
  field: { minHeight: 62, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  fieldOpen: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  compactField: { minHeight: 62, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  compactPicker: { flexShrink: 0, marginLeft: 8 },
  compactHint: { flex: 1, color: palette.muted, fontSize: 11, textAlign: 'right' },
  icon: { width: 36, height: 36, borderRadius: 6, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginHorizontal: 10 },
  value: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  placeholder: { color: palette.muted, fontWeight: '700' },
  system: { color: palette.muted, fontSize: 11, marginTop: 3 },
  pickerWrap: { marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, overflow: 'hidden', padding: 8, alignItems: 'center' },
  done: { alignSelf: 'flex-end', minWidth: 72, borderRadius: 6, backgroundColor: palette.primary, paddingHorizontal: 17, paddingVertical: 9, alignItems: 'center' },
  doneText: { color: palette.surface, fontSize: 12, fontWeight: '900' },
});
