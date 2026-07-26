import { EventCard } from '@/components/event-card';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { getEventArchiveAt, isEventArchived } from '@/lib/event-display';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useArchiveNow } from '@/lib/use-archive-now';

export default function ArchiveScreen() {
  const { events } = useEvents();
  const now = useArchiveNow();
  const archivedEvents = [...events]
    .filter((event) => isEventArchived(event, now))
    .sort((a, b) => getEventArchiveAt(b).getTime() - getEventArchiveAt(a).getTime());

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>MEMORIES</Text>
        <Text style={styles.title}>アーカイブ</Text>
        <Text style={styles.lead}>開催終了から24時間経ったイベントを、写真やチャットと一緒に思い出として残します。</Text>
        {archivedEvents.length === 0
          ? <View style={styles.empty}><Ionicons name="archive-outline" size={34} color={palette.muted} /><Text style={styles.emptyTitle}>アーカイブはまだありません</Text><Text style={styles.emptyText}>終了したイベントは24時間後にここへ移動します。</Text></View>
          : archivedEvents.map((event) => <EventCard key={event.id} event={event} compact />)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 34 },
  eyebrow: { fontSize: 13, letterSpacing: 1.8, color: palette.accent, fontWeight: '800', marginBottom: 4 },
  title: { fontSize: 26, color: palette.ink, fontWeight: '800' },
  lead: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 24 },
  empty: { alignItems: 'center', backgroundColor: palette.surface, borderRadius: 22, padding: 32 },
  emptyTitle: { color: palette.ink, fontSize: 14, fontWeight: '800', marginTop: 11 },
  emptyText: { color: palette.muted, fontSize: 12, marginTop: 6, textAlign: 'center' },
});
