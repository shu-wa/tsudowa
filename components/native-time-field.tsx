import { palette } from '@/constants/theme';
import { dateToTimeValue, timeValueToDate } from '@/lib/time-values';
import { NativeTimePickerModal } from '@/components/native-time-picker-modal';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NativeTimeField({ label, value, onChange, open, onOpenChange }: Props) {
  const selectedTime = timeValueToDate(value);

  const openPicker = () => {
    Keyboard.dismiss();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedTime,
        mode: 'time',
        display: 'clock',
        is24Hour: true,
        minuteInterval: 5,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(dateToTimeValue(date));
        },
      });
      return;
    }
    onOpenChange(true);
  };

  return <View style={styles.wrapper}>
    <Text style={styles.label}>{label}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}、${value}`} accessibilityHint="端末の時刻選択を開きます" style={[styles.field, open && styles.fieldOpen]} onPress={openPicker}>
      <View style={styles.icon}><Ionicons name="time-outline" size={20} color={palette.primary} /></View>
      <View style={styles.copy}><Text style={styles.value}>{value}</Text></View>
      <Ionicons name={open && Platform.OS === 'ios' ? 'chevron-up' : 'chevron-down'} size={18} color={palette.muted} />
    </TouchableOpacity>
    {open && Platform.OS === 'ios' ? (
      <NativeTimePickerModal
        label={label}
        value={value}
        onCancel={() => onOpenChange(false)}
        onConfirm={(date) => {
          onChange(dateToTimeValue(date));
          onOpenChange(false);
        }}
      />
    ) : null}
  </View>;
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 18 },
  label: { color: palette.ink, fontSize: 12, fontWeight: '800', marginBottom: 7 },
  field: { minHeight: 62, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  fieldOpen: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  icon: { width: 36, height: 36, borderRadius: 6, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, marginHorizontal: 10 },
  value: { color: palette.ink, fontSize: 18, fontWeight: '900' },
});
