import { palette } from '@/constants/theme';
import { EventTimeMode } from '@/types/event';
import { ChangeEvent, createElement, FormEvent } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  startTime: string;
  endTime?: string;
  timeMode: EventTimeMode;
  onChange: (value: { startTime: string; endTime?: string; timeMode: EventTimeMode }) => void;
};

export function TimeRangePicker({ startTime, endTime, timeMode, onChange }: Props) {
  const setMode = (mode: EventTimeMode) => onChange({ startTime, endTime: mode === 'range' ? endTime || '10:00' : undefined, timeMode: mode });
  return (
    <View style={styles.card}>
      <View style={styles.segment}>
        <TouchableOpacity style={[styles.segmentButton, timeMode === 'start' && styles.segmentActive]} onPress={() => setMode('start')}><Text style={[styles.segmentText, timeMode === 'start' && styles.segmentTextActive]}>開始時刻のみ</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.segmentButton, timeMode === 'range' && styles.segmentActive]} onPress={() => setMode('range')}><Text style={[styles.segmentText, timeMode === 'range' && styles.segmentTextActive]}>終了時刻あり</Text></TouchableOpacity>
      </View>
      <View style={styles.times}>
        <WebTimeInput label="開始" value={startTime} onChange={(value) => onChange({ startTime: value, endTime, timeMode })} />
        {timeMode === 'range' ? <WebTimeInput label="終了" value={endTime || '10:00'} onChange={(value) => onChange({ startTime, endTime: value, timeMode })} /> : null}
      </View>
    </View>
  );
}

function WebTimeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.timeField}>
      <Text style={styles.timeLabel}>{label}</Text>
      {createElement('input', {
        'aria-label': `${label}時刻`,
        type: 'time',
        value,
        step: 300,
        onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
        onInput: (event: FormEvent<HTMLInputElement>) => onChange(event.currentTarget.value),
        style: webInputStyle,
      })}
    </View>
  );
}

const webInputStyle = {
  width: '100%',
  height: 38,
  border: 0,
  outline: 'none',
  background: 'transparent',
  color: palette.ink,
  fontFamily: 'system-ui, sans-serif',
  fontSize: 18,
  fontWeight: 800,
  colorScheme: 'light',
  cursor: 'pointer',
};

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1, borderColor: palette.line, padding: 14 },
  segment: { flexDirection: 'row', backgroundColor: palette.canvas, borderRadius: 6, padding: 3, marginBottom: 14 },
  segmentButton: { flex: 1, minHeight: 38, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: palette.primary },
  segmentText: { color: palette.muted, fontSize: 13, fontWeight: '800' },
  segmentTextActive: { color: palette.surface },
  times: { flexDirection: 'row', gap: 10 },
  timeField: { flex: 1, minHeight: 70, borderRadius: 8, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, paddingTop: 7 },
  timeLabel: { color: palette.muted, fontSize: 11, fontWeight: '800' },
});
