import { palette } from '@/constants/theme';
import { getLocalDateKey, parseLocalDateKey } from '@/lib/date-values';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  value: string;
  onChange: (value: string) => void;
  minimumDate?: string;
  maximumDate?: string;
};

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

export function MonthDatePicker({ value, onChange, minimumDate, maximumDate }: Props) {
  const selected = parseLocalDateKey(value) ?? parseLocalDateKey(minimumDate) ?? new Date();
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [month]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="前の月" style={styles.arrow} onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1, 12))}><Ionicons name="chevron-back" size={20} color={palette.ink} /></TouchableOpacity>
        <Text style={styles.month}>{month.getFullYear()}年 {month.getMonth() + 1}月</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="次の月" style={styles.arrow} onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1, 12))}><Ionicons name="chevron-forward" size={20} color={palette.ink} /></TouchableOpacity>
      </View>
      <View style={styles.weekRow}>{WEEKDAYS.map((day, index) => <Text key={day} style={[styles.week, index >= 5 && styles.weekend]}>{day}</Text>)}</View>
      <View style={styles.grid}>
        {days.map((date) => {
          const key = getLocalDateKey(date);
          const outside = date.getMonth() !== month.getMonth();
          const disabled = Boolean((minimumDate && key < minimumDate) || (maximumDate && key > maximumDate));
          const active = key === value;
          return (
            <TouchableOpacity key={key} accessibilityRole="button" accessibilityState={{ selected: active, disabled }} disabled={disabled} style={styles.dayCell} onPress={() => onChange(key)}>
              <View style={[styles.dayCircle, active && styles.dayCircleActive]}><Text style={[styles.dayText, outside && styles.outside, disabled && styles.disabled, active && styles.activeText]}>{date.getDate()}</Text></View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1, borderColor: palette.line, padding: 14, marginBottom: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  arrow: { width: 38, height: 38, borderRadius: 6, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  month: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginBottom: 5 },
  week: { width: '14.285%', textAlign: 'center', color: palette.muted, fontSize: 12, fontWeight: '600' },
  weekend: { color: palette.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.285%', height: 40, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 34, height: 34, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  dayCircleActive: { backgroundColor: palette.primary },
  dayText: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  outside: { color: '#B8BDB9' },
  disabled: { color: '#D5D8D6' },
  activeText: { color: palette.surface, fontWeight: '800' },
});
