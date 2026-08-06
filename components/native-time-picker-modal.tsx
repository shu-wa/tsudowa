import { palette } from '@/constants/theme';
import { timeValueToDate } from '@/lib/time-values';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  label: string;
  value: string;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
};

export function NativeTimePickerModal({ label, value, onConfirm, onCancel }: Props) {
  const initialDate = useRef(timeValueToDate(value)).current;
  // Keep wheel movement outside React state. Re-rendering a controlled iOS spinner
  // during deceleration can restore the original value before the wheel settles.
  const selectedDate = useRef(initialDate);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="時刻選択をキャンセル" style={StyleSheet.absoluteFill} onPress={onCancel} />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.toolbar}>
            <TouchableOpacity accessibilityRole="button" style={styles.toolbarButton} onPress={onCancel}>
              <Text style={styles.cancelText}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{label}</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.toolbarButton} onPress={() => onConfirm(selectedDate.current)}>
              <Text style={styles.doneText}>完了</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={initialDate}
            mode="time"
            display="spinner"
            minuteInterval={5}
            locale="ja-JP"
            style={styles.picker}
            onChange={(event, date) => {
              if (event.type !== 'dismissed' && date) selectedDate.current = date;
            }}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 18, 16, 0.42)' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' },
  toolbar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  toolbarButton: { minWidth: 88, height: 52, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  cancelText: { color: palette.muted, fontSize: 14, fontWeight: '600' },
  doneText: { color: palette.primary, fontSize: 14, fontWeight: '800' },
  picker: { width: '100%', height: 216 },
});
