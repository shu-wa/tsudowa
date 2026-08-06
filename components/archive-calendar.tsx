import { palette } from '@/constants/theme';
import { getLocalDateKey, parseLocalDateKey } from '@/lib/date-values';
import { getEventDateKeys } from '@/lib/event-display';
import { EventItem } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  events: EventItem[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function ArchiveCalendar({ events, selectedDate, onSelectDate }: Props) {
  const initialDate = parseLocalDateKey(selectedDate) ?? new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1, 12));
  const markedDates = useMemo(() => new Set(events.flatMap(getEventDateKeys)), [events]);
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1, 12).getDay();
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  const moveMonth = (offset: number) => setVisibleMonth(new Date(year, month + offset, 1, 12));

  return (
    <View style={styles.card}>
      <View style={styles.monthHeader}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="前の月" style={styles.monthButton} onPress={() => moveMonth(-1)}>
          <Ionicons name="chevron-back" size={20} color={palette.ink} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{year}年 {month + 1}月</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="次の月" style={styles.monthButton} onPress={() => moveMonth(1)}>
          <Ionicons name="chevron-forward" size={20} color={palette.ink} />
        </TouchableOpacity>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((weekday, index) => <Text key={weekday} style={[styles.weekday, index === 0 && styles.sunday, index === 6 && styles.saturday]}>{weekday}</Text>)}
      </View>
      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
          const date = new Date(year, month, day, 12);
          const key = getLocalDateKey(date);
          const selected = key === selectedDate;
          const marked = markedDates.has(key);
          return (
            <TouchableOpacity
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${month + 1}月${day}日${marked ? '、イベントあり' : ''}`}
              style={styles.dayCell}
              onPress={() => onSelectDate(key)}>
              <View style={[styles.dayNumberWrap, selected && styles.dayNumberSelected]}>
                <Text style={[styles.dayNumber, selected && styles.dayNumberSelectedText]}>{day}</Text>
              </View>
              {marked ? <View style={[styles.marker, selected && styles.markerSelected]} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1, borderColor: palette.line, padding: 16 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  monthButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { color: palette.ink, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', color: palette.muted, fontSize: 11, fontWeight: '600' },
  sunday: { color: palette.danger },
  saturday: { color: '#416A8A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: 48, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  dayNumberWrap: { width: 31, height: 31, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  dayNumberSelected: { backgroundColor: palette.ink },
  dayNumber: { color: palette.ink, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dayNumberSelectedText: { color: palette.surface },
  marker: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.accent, marginTop: 3 },
  markerSelected: { backgroundColor: palette.ink },
});
