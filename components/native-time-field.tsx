import { palette } from '@/constants/theme';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const toTimeDate = (value?: string) => {
  const [hours, minutes] = (value || '09:00').split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
};

export const toTimeString = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

export function NativeTimeField({ label, value, onChange, open, onOpenChange }: Props) {
  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') onOpenChange(false);
    if (event.type === 'dismissed' || !date) return;
    onChange(toTimeString(date));
  };

  return <View style={styles.wrapper}>
    <Text style={styles.label}>{label}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}、${value}`} accessibilityHint="端末の時刻選択を開きます" style={[styles.field, open && styles.fieldOpen]} onPress={() => onOpenChange(!open)}>
      <View style={styles.icon}><Ionicons name="time-outline" size={20} color={palette.primary} /></View>
      <View style={styles.copy}><Text style={styles.value}>{value}</Text><Text style={styles.system}>端末標準の時刻選択を使用</Text></View>
      <Ionicons name={open && Platform.OS === 'ios' ? 'chevron-up' : 'chevron-down'} size={18} color={palette.muted} />
    </TouchableOpacity>
    {open ? <View style={styles.pickerWrap}>
      <DateTimePicker value={toTimeDate(value)} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'clock'} is24Hour minuteInterval={5} locale="ja-JP" onChange={handleChange} />
      {Platform.OS === 'ios' ? <TouchableOpacity accessibilityRole="button" style={styles.done} onPress={() => onOpenChange(false)}><Text style={styles.doneText}>完了</Text></TouchableOpacity> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 18 },
  label: { color: palette.ink, fontSize: 12, fontWeight: '800', marginBottom: 7 },
  field: { minHeight: 62, borderRadius: 17, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  fieldOpen: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginHorizontal: 10 },
  value: { color: palette.ink, fontSize: 18, fontWeight: '900' },
  system: { color: palette.muted, fontSize: 11, marginTop: 2 },
  pickerWrap: { marginTop: 8, borderRadius: 18, backgroundColor: palette.surface, padding: 8, alignItems: 'center' },
  done: { alignSelf: 'flex-end', minWidth: 72, borderRadius: 11, backgroundColor: palette.primary, paddingHorizontal: 17, paddingVertical: 9, alignItems: 'center' },
  doneText: { color: palette.surface, fontSize: 12, fontWeight: '900' },
});
