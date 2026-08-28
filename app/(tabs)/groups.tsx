import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { UserAvatar } from '@/components/user-avatar';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { isEventArchived, isEventPast } from '@/lib/event-display';
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroupsScreen() {
  const { groups, events } = useEvents();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>TOGETHER</Text>
        <Text style={styles.title}>グループ</Text>
        <Text style={styles.lead}>
          同じメンバーとのイベントをひとつにまとめ、次の予定と思い出を残せます。
        </Text>

        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={32} color={palette.muted} />
            <Text style={styles.emptyTitle}>グループはまだありません</Text>
            <Text style={styles.emptyText}>
              終了したイベントをグループ化すると、同じメンバーで次のイベントを始められます。
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/past-events')}>
              <Text style={styles.emptyButtonText}>過去の予定を見る</Text>
              <Ionicons name="arrow-forward" size={17} color={palette.surface} />
            </TouchableOpacity>
          </View>
        ) : groups.map((group) => {
          const groupEvents = events.filter((event) => event.groupId === group.id);
          const upcoming = groupEvents.filter((event) => !isEventArchived(event) && !isEventPast(event));
          const memories = groupEvents.filter((event) => isEventArchived(event) || isEventPast(event));
          const nextEvent = upcoming.sort((a, b) => {
            if (a.dateStatus === 'undecided' && b.dateStatus !== 'undecided') return 1;
            if (b.dateStatus === 'undecided' && a.dateStatus !== 'undecided') return -1;
            return `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`);
          })[0];
          return (
            <TouchableOpacity
              key={group.id}
              style={styles.card}
              onPress={() => router.push(`/group/${group.id}` as Href)}
              activeOpacity={0.78}>
              <View style={[styles.cardMark, { backgroundColor: group.coverColor }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{group.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={palette.muted} />
                </View>
                <Text style={styles.cardMeta}>
                  {nextEvent ? `次回：${nextEvent.dateLabel}` : '次のイベントは未登録'}
                </Text>
                <View style={styles.cardBottom}>
                  <View style={styles.avatars}>
                    {group.members.slice(0, 4).map((member, index) => (
                      <UserAvatar
                        key={member.id}
                        uri={member.avatarUri}
                        initials={member.initials}
                        color={member.avatarColor}
                        size={28}
                        radius={14}
                        style={{ marginLeft: index ? -7 : 0, borderWidth: 2, borderColor: palette.surface }}
                      />
                    ))}
                  </View>
                  <Text style={styles.counts}>
                    {group.members.length}人 · 予定{upcoming.length}件 · 思い出{memories.length}件
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 42 },
  eyebrow: { color: palette.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.7, marginBottom: 5 },
  title: { color: palette.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  lead: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 24 },
  empty: { alignItems: 'center', borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, borderRadius: 9, padding: 28 },
  emptyTitle: { color: palette.ink, fontSize: 15, fontWeight: '800', marginTop: 11 },
  emptyText: { color: palette.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  emptyButton: { minHeight: 46, backgroundColor: palette.primary, borderRadius: 7, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 19 },
  emptyButtonText: { color: palette.surface, fontSize: 13, fontWeight: '800' },
  card: { minHeight: 132, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 9, overflow: 'hidden', flexDirection: 'row', marginBottom: 13 },
  cardMark: { width: 7 },
  cardBody: { flex: 1, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { flex: 1, color: palette.ink, fontSize: 18, fontWeight: '800' },
  cardMeta: { color: palette.muted, fontSize: 12, marginTop: 8 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, paddingTop: 13, marginTop: 13 },
  avatars: { flexDirection: 'row' },
  counts: { color: palette.muted, fontSize: 11, fontWeight: '600' },
});
