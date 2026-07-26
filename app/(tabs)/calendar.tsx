import { EventCard } from '@/components/event-card';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { getLocalDateKey, isEventArchived } from '@/lib/event-display';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useArchiveNow } from '@/lib/use-archive-now';

const todayKey = getLocalDateKey(new Date());

export default function CalendarScreen() {
  const { events } = useEvents();
  const now = useArchiveNow();
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstOffset + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  const monthEvents = useMemo(() => {
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    return events.filter((event) => !isEventArchived(event, now) && event.startDate <= monthEnd && event.endDate >= monthStart);
  }, [daysInMonth, events, month, now, year]);

  const moveMonth = (offset: number) => setVisibleMonth(new Date(year, month + offset, 1));
  const dayHasEvent = (day: number) => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.some((event) => !isEventArchived(event, now) && event.startDate <= key && event.endDate >= key);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>MY CALENDAR</Text><Text style={styles.title}>イベント予定</Text></View><TouchableOpacity style={styles.addButton} onPress={() => router.push('/create')}><Ionicons name="add" size={25} color={palette.surface} /></TouchableOpacity></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.monthCard}>
          <View style={styles.monthTop}><TouchableOpacity style={styles.arrow} onPress={() => moveMonth(-1)}><Ionicons name="chevron-back" size={20} color={palette.muted} /></TouchableOpacity><TouchableOpacity onPress={() => setVisibleMonth(new Date())}><Text style={styles.monthTitle}>{year}年 {month + 1}月</Text><Text style={styles.todayLink}>今月へ戻る</Text></TouchableOpacity><TouchableOpacity style={styles.arrow} onPress={() => moveMonth(1)}><Ionicons name="chevron-forward" size={20} color={palette.muted} /></TouchableOpacity></View>
          <View style={styles.weekRow}>{['月','火','水','木','金','土','日'].map((day) => <Text key={day} style={styles.week}>{day}</Text>)}</View>
          <View style={styles.days}>{cells.map((day, index) => {
            if (!day) return <View key={index} style={styles.dayCell} />;
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const active = key === todayKey;
            const hasEvent = dayHasEvent(day);
            return <View key={index} style={styles.dayCell}><View style={[styles.dayCircle, active && styles.dayCircleActive]}><Text style={[styles.dayText, active && styles.dayTextActive]}>{day}</Text></View>{hasEvent && <View style={styles.dot} />}</View>;
          })}</View>
        </View>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{month + 1}月のイベント</Text><Text style={styles.count}>{monthEvents.length}件</Text></View>
        {monthEvents.length === 0 ? <View style={styles.empty}><Ionicons name="calendar-clear-outline" size={30} color={palette.muted} /><Text style={styles.emptyTitle}>この月のイベントはありません</Text><TouchableOpacity onPress={() => router.push('/create')}><Text style={styles.emptyLink}>イベントを作成する</Text></TouchableOpacity></View> : monthEvents.map((event) => <EventCard key={event.id} event={event} compact />)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: palette.canvas }, header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { fontSize: 13, letterSpacing: 1.8, color: palette.accent, fontWeight: '800', marginBottom: 4 }, title: { fontSize: 26, color: palette.ink, fontWeight: '800' }, addButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }, content: { paddingHorizontal: 20, paddingBottom: 32 }, monthCard: { backgroundColor: palette.surface, borderRadius: 24, padding: 17, marginBottom: 27 }, monthTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5, marginBottom: 18 }, arrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, monthTitle: { fontSize: 16, color: palette.ink, fontWeight: '800', textAlign: 'center' }, todayLink: { color: palette.primary, fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 3 }, weekRow: { flexDirection: 'row', marginBottom: 7 }, week: { width: '14.285%', textAlign: 'center', color: palette.muted, fontSize: 13, fontWeight: '700' }, days: { flexDirection: 'row', flexWrap: 'wrap' }, dayCell: { width: '14.285%', height: 39, alignItems: 'center', justifyContent: 'center' }, dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, dayCircleActive: { backgroundColor: palette.primary }, dayText: { color: palette.ink, fontSize: 12, fontWeight: '600' }, dayTextActive: { color: palette.surface, fontWeight: '800' }, dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.accent, position: 'absolute', bottom: 1 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }, sectionTitle: { color: palette.ink, fontSize: 20, fontWeight: '800' }, count: { color: palette.muted, fontSize: 12, fontWeight: '700' }, empty: { alignItems: 'center', backgroundColor: palette.surface, borderRadius: 22, padding: 30 }, emptyTitle: { color: palette.ink, fontSize: 13, fontWeight: '800', marginTop: 10 }, emptyLink: { color: palette.primary, fontSize: 13, fontWeight: '700', marginTop: 8 } });
