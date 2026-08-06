import { palette } from '@/constants/theme';
import { parseLocalDateKey, toDateString } from '@/lib/date-values';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
};

const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

const toDate = (value?: string) => {
  return parseLocalDateKey(value) ?? new Date();
};

export { toDateString } from '@/lib/date-values';

export const formatJapaneseDateRange = (start: string, end: string) => {
  const startValue = toDate(start);
  const endValue = toDate(end || start);
  const startLabel = `${startValue.getFullYear()}年${startValue.getMonth() + 1}月${startValue.getDate()}日`;
  if (!end || start === end) return startLabel;
  const endLabel = startValue.getFullYear() === endValue.getFullYear()
    ? `${endValue.getMonth() + 1}月${endValue.getDate()}日`
    : `${endValue.getFullYear()}年${endValue.getMonth() + 1}月${endValue.getDate()}日`;
  return `${startLabel} – ${endLabel}`;
};

export function DateRangeCalendar({ startDate, endDate, onChange }: Props) {
  const initial = toDate(startDate);
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selectingEnd, setSelectingEnd] = useState(false);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [month]);

  const choose = (date: Date) => {
    const value = toDateString(date);
    if (!startDate || !selectingEnd) {
      onChange(value, value);
      setSelectingEnd(true);
      return;
    }
    if (value < startDate) {
      onChange(value, value);
    } else {
      onChange(startDate, value);
      setSelectingEnd(false);
    }
  };

  const moveMonth = (amount: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.arrow} onPress={() => moveMonth(-1)}><Ionicons name="chevron-back" size={20} color={palette.ink} /></TouchableOpacity>
        <Text style={styles.month}>{month.getFullYear()}年 {month.getMonth() + 1}月</Text>
        <TouchableOpacity style={styles.arrow} onPress={() => moveMonth(1)}><Ionicons name="chevron-forward" size={20} color={palette.ink} /></TouchableOpacity>
      </View>
      <View style={styles.weekRow}>{weekDays.map((day, index) => <Text key={day} style={[styles.week, index >= 5 && styles.weekend]}>{day}</Text>)}</View>
      <View style={styles.grid}>
        {days.map((date) => {
          const value = toDateString(date);
          const outside = date.getMonth() !== month.getMonth();
          const edge = value === startDate || value === endDate;
          const inRange = Boolean(startDate && endDate && value >= startDate && value <= endDate);
          return (
            <TouchableOpacity key={value} style={[styles.dayCell, inRange && styles.range, edge && styles.selected]} onPress={() => choose(date)}>
              <Text style={[styles.dayText, outside && styles.outside, edge && styles.selectedText]}>{date.getDate()}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.guide}><Ionicons name="information-circle-outline" size={16} color={palette.muted} /><Text style={styles.guideText}>{selectingEnd ? '終了日を選んでください' : '開始日をタップすると期間を選べます'}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1, borderColor: palette.line, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  arrow: { width: 38, height: 38, borderRadius: 6, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  month: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginBottom: 5 },
  week: { width: '14.285%', textAlign: 'center', color: palette.muted, fontSize: 13, fontWeight: '700' },
  weekend: { color: palette.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.285%', height: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  range: { backgroundColor: palette.primarySoft, borderRadius: 0 },
  selected: { backgroundColor: palette.primary, borderRadius: 4 },
  dayText: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  outside: { color: '#B8BDB9' },
  selectedText: { color: palette.surface, fontWeight: '900' },
  guide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  guideText: { color: palette.muted, fontSize: 13, marginLeft: 5 },
});
