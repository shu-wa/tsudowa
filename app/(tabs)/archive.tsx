import { ArchiveCalendar } from '@/components/archive-calendar';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { EventCard } from '@/components/event-card';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { getEventArchiveAt, getEventDateKeys, isEventArchived } from '@/lib/event-display';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ArchiveScreen() {
  const { events } = useEvents();
  const archivedEvents = useMemo(() => [...events]
    .filter(isEventArchived)
    .sort((a, b) => (getEventArchiveAt(b)?.getTime() ?? 0) - (getEventArchiveAt(a)?.getTime() ?? 0)), [events]);
  const [selectedDate, setSelectedDate] = useState(() => archivedEvents[0]?.startDate ?? '');
  const effectiveSelectedDate = selectedDate || archivedEvents[0]?.startDate || '';
  const selectedEvents = effectiveSelectedDate
    ? archivedEvents.filter((event) => getEventDateKeys(event).includes(effectiveSelectedDate))
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>アーカイブ</Text>
        <Text style={styles.lead}>確定したイベントを、変更されない思い出として振り返れます。</Text>

        {archivedEvents.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="archive-outline" size={32} color={palette.muted} />
            <Text style={styles.emptyTitle}>アーカイブはまだありません</Text>
            <Text style={styles.emptyText}>過去の予定から、残したいイベントをアーカイブ化できます。</Text>
          </View>
        ) : (
          <>
            <ArchiveCalendar events={archivedEvents} selectedDate={effectiveSelectedDate} onSelectDate={setSelectedDate} />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{formatSelectedDate(effectiveSelectedDate)}</Text>
              <Text style={styles.sectionCount}>{selectedEvents.length ? `${selectedEvents.length}件` : '予定なし'}</Text>
            </View>
            {selectedEvents.map((event) => <EventCard key={`selected-${event.id}`} event={event} compact />)}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>最近アーカイブした予定</Text>
              <Text style={styles.sectionCount}>最新3件</Text>
            </View>
            {archivedEvents.slice(0, 3).map((event) => <EventCard key={`recent-${event.id}`} event={event} compact />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatSelectedDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? `${year}年${month}月${day}日` : '選択した日';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  title: { fontSize: 27, color: palette.ink, fontWeight: '700', letterSpacing: -0.5 },
  lead: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 22 },
  sectionHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line, marginTop: 28, marginBottom: 13 },
  sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: '700' },
  sectionCount: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  empty: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.line, paddingVertical: 38 },
  emptyTitle: { color: palette.ink, fontSize: 14, fontWeight: '700', marginTop: 11 },
  emptyText: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: 'center' },
});
