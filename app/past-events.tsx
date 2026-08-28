import { EventCard } from '@/components/event-card';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { palette } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useEvents } from '@/context/event-context';
import { isEventManager } from '@/lib/event-permissions';
import { isEventPast } from '@/lib/event-display';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PastEventsScreen() {
  const { events, archiveEvent, profile } = useEvents();
  const { user } = useAuth();
  const pastEvents = [...events]
    .filter((event) => isEventPast(event))
    .sort((a, b) => `${b.endDate}${b.endTime ?? '23:59'}`.localeCompare(`${a.endDate}${a.endTime ?? '23:59'}`));

  const confirmArchive = (eventId: string, title: string) => Alert.alert(
    'アーカイブ化しますか？',
    `「${title}」の内容はアーカイブ化され、書き換えられません。`,
    [
      { text: 'いいえ', style: 'cancel' },
      {
        text: 'はい',
        onPress: async () => {
          const error = await archiveEvent(eventId);
          if (error) Alert.alert('アーカイブできませんでした', error);
        },
      },
    ],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>過去の予定</Text>
        <Text style={styles.lead}>終了した予定を確認できます。主催者・共同主催者が確定すると、思い出としてアーカイブに保存されます。</Text>
        {pastEvents.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={29} color={palette.muted} />
            <Text style={styles.emptyTitle}>過去の予定はありません</Text>
          </View>
        ) : pastEvents.map((event) => {
          const canArchive = isEventManager(event, user?.id, profile.name);
          return (
            <View key={event.id} style={styles.eventBlock}>
              <EventCard event={event} compact />
              {canArchive ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.groupButton}
                    onPress={() => event.groupId
                      ? router.push(`/group/${event.groupId}/new-event` as Href)
                      : router.push(`/event/${event.id}/groupify`)}>
                    <Ionicons name="people-outline" size={17} color={palette.primary} />
                    <Text style={styles.groupButtonText}>
                      {event.groupId ? '次回イベントを作る' : 'グループ化して次へ'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.archiveButton} onPress={() => confirmArchive(event.id, event.title)}>
                    <Ionicons name="archive-outline" size={17} color={palette.surface} />
                    <Text style={styles.archiveButtonText}>アーカイブ化する</Text>
                  </TouchableOpacity>
                </View>
              ) : <Text style={styles.waitingText}>主催者がアーカイブするまで、この欄に表示されます</Text>}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  title: { color: palette.ink, fontSize: 27, fontWeight: '700', letterSpacing: -0.5 },
  lead: { color: palette.muted, fontSize: 13, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  empty: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.line, paddingVertical: 38 },
  emptyTitle: { color: palette.ink, fontSize: 14, fontWeight: '700', marginTop: 10 },
  eventBlock: { marginBottom: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  groupButton: { minHeight: 42, borderRadius: 8, paddingHorizontal: 13, borderWidth: 1, borderColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  groupButtonText: { color: palette.primary, fontSize: 12, fontWeight: '700', marginLeft: 6 },
  archiveButton: { alignSelf: 'flex-end', minHeight: 42, borderRadius: 12, paddingHorizontal: 15, backgroundColor: palette.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  archiveButtonText: { color: palette.surface, fontSize: 13, fontWeight: '700', marginLeft: 7 },
  waitingText: { color: palette.muted, fontSize: 11, lineHeight: 17, textAlign: 'right' },
});
