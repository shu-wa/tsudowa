import { palette } from '@/constants/theme';
import { dateToTimeValue, timeValueToDate } from '@/lib/time-values';
import { EventTimeMode } from '@/types/event';
import { NativeTimePickerModal } from '@/components/native-time-picker-modal';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  startTime: string;
  endTime?: string;
  timeMode: EventTimeMode;
  onChange: (value: { startTime: string; endTime?: string; timeMode: EventTimeMode }) => void;
};

export function TimeRangePicker({ startTime, endTime, timeMode, onChange }: Props) {
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);
  const setMode = (mode: EventTimeMode) => onChange({ startTime, endTime: mode === 'range' ? endTime || '10:00' : undefined, timeMode: mode });
  const commitTime = (target: 'start' | 'end', date: Date) => {
    const value = dateToTimeValue(date);
    onChange(target === 'start'
      ? { startTime: value, endTime, timeMode }
      : { startTime, endTime: value, timeMode });
  };
  const openPicker = (target: 'start' | 'end') => {
    Keyboard.dismiss();
    const initialTime = timeValueToDate(target === 'start' ? startTime : endTime);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialTime,
        mode: 'time',
        display: 'clock',
        is24Hour: true,
        minuteInterval: 5,
        onChange: (event, date) => {
          if (event.type === 'set' && date) commitTime(target, date);
        },
      });
      return;
    }
    setEditing(target);
  };

  return (
    <View style={styles.card}>
      <View style={styles.segment}>
        <TouchableOpacity style={[styles.segmentButton, timeMode === 'start' && styles.segmentActive]} onPress={() => setMode('start')}><Text style={[styles.segmentText, timeMode === 'start' && styles.segmentTextActive]}>開始時刻のみ</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.segmentButton, timeMode === 'range' && styles.segmentActive]} onPress={() => setMode('range')}><Text style={[styles.segmentText, timeMode === 'range' && styles.segmentTextActive]}>終了時刻あり</Text></TouchableOpacity>
      </View>
      <View style={styles.times}>
        <TimeButton label="開始" value={startTime} active={editing === 'start'} onPress={() => openPicker('start')} />
        {timeMode === 'range' && <><Ionicons name="arrow-forward" size={18} color={palette.muted} /><TimeButton label="終了" value={endTime || '10:00'} active={editing === 'end'} onPress={() => openPicker('end')} /></>}
      </View>
      {editing && Platform.OS === 'ios' ? (
        <NativeTimePickerModal
          key={editing}
          label={`${editing === 'start' ? '開始' : '終了'}時刻`}
          value={editing === 'start' ? startTime : endTime || '10:00'}
          onCancel={() => setEditing(null)}
          onConfirm={(date) => {
            commitTime(editing, date);
            setEditing(null);
          }}
        />
      ) : null}
    </View>
  );
}

function TimeButton({ label, value, active, onPress }: { label: string; value: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}時刻、${value}`} accessibilityHint="端末の時刻選択を開きます" style={[styles.timeButton, active && styles.timeButtonActive]} onPress={onPress}><Text style={styles.timeLabel}>{label}</Text><Text style={styles.timeValue}>{value}</Text><Ionicons name="time-outline" size={18} color={palette.primary} /></TouchableOpacity>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1, borderColor: palette.line, padding: 14 },
  segment: { flexDirection: 'row', backgroundColor: palette.canvas, borderRadius: 6, padding: 3, marginBottom: 14 },
  segmentButton: { flex: 1, minHeight: 38, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: palette.primary },
  segmentText: { color: palette.muted, fontSize: 13, fontWeight: '800' },
  segmentTextActive: { color: palette.surface },
  times: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeButton: { flex: 1, minHeight: 64, borderRadius: 8, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  timeButtonActive: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  timeLabel: { color: palette.muted, fontSize: 12, fontWeight: '700', position: 'absolute', top: 7, left: 12 },
  timeValue: { flex: 1, color: palette.ink, fontSize: 18, fontWeight: '900', marginTop: 9 },
});
