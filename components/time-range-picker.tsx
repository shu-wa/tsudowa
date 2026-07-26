import { palette } from '@/constants/theme';
import { EventTimeMode } from '@/types/event';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  startTime: string;
  endTime?: string;
  timeMode: EventTimeMode;
  onChange: (value: { startTime: string; endTime?: string; timeMode: EventTimeMode }) => void;
};

const toTimeDate = (value?: string) => {
  const [hours, minutes] = (value || '09:00').split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
};

const formatTime = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

export const formatTimeLabel = (startTime: string, endTime: string | undefined, mode: EventTimeMode) =>
  mode === 'range' && endTime ? `${startTime}–${endTime}` : `${startTime} 開始`;

export function TimeRangePicker({ startTime, endTime, timeMode, onChange }: Props) {
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);
  const setMode = (mode: EventTimeMode) => onChange({ startTime, endTime: mode === 'range' ? endTime || '10:00' : undefined, timeMode: mode });
  const changeTime = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setEditing(null);
    if (event.type === 'dismissed' || !date || !editing) return;
    const value = formatTime(date);
    onChange(editing === 'start'
      ? { startTime: value, endTime, timeMode }
      : { startTime, endTime: value, timeMode });
  };

  return (
    <View style={styles.card}>
      <View style={styles.segment}>
        <TouchableOpacity style={[styles.segmentButton, timeMode === 'start' && styles.segmentActive]} onPress={() => setMode('start')}><Text style={[styles.segmentText, timeMode === 'start' && styles.segmentTextActive]}>開始時刻のみ</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.segmentButton, timeMode === 'range' && styles.segmentActive]} onPress={() => setMode('range')}><Text style={[styles.segmentText, timeMode === 'range' && styles.segmentTextActive]}>終了時刻あり</Text></TouchableOpacity>
      </View>
      <View style={styles.times}>
        <TimeButton label="開始" value={startTime} active={editing === 'start'} onPress={() => setEditing('start')} />
        {timeMode === 'range' && <><Ionicons name="arrow-forward" size={18} color={palette.muted} /><TimeButton label="終了" value={endTime || '10:00'} active={editing === 'end'} onPress={() => setEditing('end')} /></>}
      </View>
      {editing && <View style={styles.pickerWrap}>
        <DateTimePicker value={toTimeDate(editing === 'start' ? startTime : endTime)} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'clock'} is24Hour minuteInterval={5} locale="ja-JP" onChange={changeTime} />
        {Platform.OS === 'ios' && <TouchableOpacity style={styles.done} onPress={() => setEditing(null)}><Text style={styles.doneText}>完了</Text></TouchableOpacity>}
      </View>}
    </View>
  );
}

function TimeButton({ label, value, active, onPress }: { label: string; value: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}時刻、${value}`} accessibilityHint="端末の時刻選択を開きます" style={[styles.timeButton, active && styles.timeButtonActive]} onPress={onPress}><Text style={styles.timeLabel}>{label}</Text><Text style={styles.timeValue}>{value}</Text><Ionicons name="time-outline" size={18} color={palette.primary} /></TouchableOpacity>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 22, padding: 14 },
  segment: { flexDirection: 'row', backgroundColor: palette.canvas, borderRadius: 14, padding: 4, marginBottom: 14 },
  segmentButton: { flex: 1, minHeight: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: palette.primary },
  segmentText: { color: palette.muted, fontSize: 13, fontWeight: '800' },
  segmentTextActive: { color: palette.surface },
  times: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeButton: { flex: 1, minHeight: 64, borderRadius: 15, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  timeButtonActive: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  timeLabel: { color: palette.muted, fontSize: 12, fontWeight: '700', position: 'absolute', top: 7, left: 12 },
  timeValue: { flex: 1, color: palette.ink, fontSize: 18, fontWeight: '900', marginTop: 9 },
  pickerWrap: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, alignItems: 'center' },
  done: { alignSelf: 'flex-end', backgroundColor: palette.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 11 },
  doneText: { color: palette.surface, fontWeight: '800', fontSize: 12 },
});
