import { EventCard } from '@/components/event-card';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { UserAvatar } from '@/components/user-avatar';
import { palette } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useEvents } from '@/context/event-context';
import { isEventArchived, isEventPast } from '@/lib/event-display';
import { Ionicons } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findGroup, events, profile } = useEvents();
  const { user } = useAuth();
  const group = findGroup(id);

  if (!group) {
    return (
      <SafeAreaView style={styles.missing}>
        <Ionicons name="people-outline" size={34} color={palette.muted} />
        <Text style={styles.missingTitle}>グループが見つかりません</Text>
      </SafeAreaView>
    );
  }

  const me = group.members.find((member) =>
    member.id === user?.id || (!user && (member.id === 'me' || member.name === profile.name)));
  const canManage = me?.role === '主催者' || me?.role === '共同主催者';
  const groupEvents = events.filter((event) => event.groupId === group.id);
  const upcoming = groupEvents
    .filter((event) => !isEventArchived(event) && !isEventPast(event))
    .sort((a, b) => {
      if (a.dateStatus === 'undecided' && b.dateStatus !== 'undecided') return 1;
      if (b.dateStatus === 'undecided' && a.dateStatus !== 'undecided') return -1;
      return `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`);
    });
  const past = groupEvents
    .filter((event) => isEventArchived(event) || isEventPast(event))
    .sort((a, b) => `${b.endDate}${b.endTime ?? '23:59'}`.localeCompare(`${a.endDate}${a.endTime ?? '23:59'}`));

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: group.coverColor }]}>
          <Text style={styles.heroLabel}>GROUP</Text>
          <Text style={styles.heroTitle}>{group.name}</Text>
          <View style={styles.memberRow}>
            <View style={styles.avatars}>
              {group.members.slice(0, 6).map((member, index) => (
                <UserAvatar
                  key={member.id}
                  uri={member.avatarUri}
                  initials={member.initials}
                  color={member.avatarColor}
                  size={32}
                  radius={16}
                  style={{ marginLeft: index ? -7 : 0, borderWidth: 2, borderColor: group.coverColor }}
                />
              ))}
            </View>
            <Text style={styles.memberCount}>{group.members.length}人のメンバー</Text>
          </View>
        </View>

        {canManage ? (
          <TouchableOpacity style={styles.addButton} onPress={() => router.push(`/group/${group.id}/new-event` as Href)}>
            <View style={styles.addIcon}><Ionicons name="add" size={22} color={palette.surface} /></View>
            <View style={styles.addCopy}>
              <Text style={styles.addTitle}>イベントを追加</Text>
              <Text style={styles.addText}>同じメンバーで日時未定の予定を始める</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.surface} />
          </TouchableOpacity>
        ) : null}

        <SectionHeader title="これからのイベント" count={upcoming.length} />
        {upcoming.length
          ? upcoming.map((event) => <EventCard key={event.id} event={event} compact />)
          : <Empty text="これからのイベントはありません" />}

        <SectionHeader title="今までのイベント" count={past.length} />
        {past.length
          ? past.map((event) => <EventCard key={event.id} event={event} compact />)
          : <Empty text="過去のイベントはまだありません" />}

        <SectionHeader title="メンバー" count={group.members.length} unit="人" />
        <View style={styles.memberList}>
          {group.members.map((member) => (
            <View key={member.id} style={styles.memberItem}>
              <UserAvatar uri={member.avatarUri} initials={member.initials} color={member.avatarColor} size={40} radius={14} />
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberRole}>{member.role}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, count, unit = '件' }: { title: string; count: number; unit?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}{unit}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 42 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas },
  missingTitle: { color: palette.ink, fontSize: 15, fontWeight: '800', marginTop: 10 },
  hero: { borderRadius: 9, padding: 20, minHeight: 156, justifyContent: 'flex-end' },
  heroLabel: { color: '#D8DDD9', fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  heroTitle: { color: palette.surface, fontSize: 27, fontWeight: '800', marginTop: 7 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  avatars: { flexDirection: 'row' },
  memberCount: { color: '#D8DDD9', fontSize: 12, fontWeight: '700' },
  addButton: { minHeight: 72, borderRadius: 8, backgroundColor: palette.primary, marginTop: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
  addIcon: { width: 41, height: 41, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  addCopy: { flex: 1, marginHorizontal: 12 },
  addTitle: { color: palette.surface, fontSize: 14, fontWeight: '800' },
  addText: { color: '#CFD9D4', fontSize: 11, marginTop: 4 },
  sectionHeader: { minHeight: 43, marginTop: 26, marginBottom: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '800' },
  sectionCount: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  empty: { borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 20, alignItems: 'center' },
  emptyText: { color: palette.muted, fontSize: 12 },
  memberList: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 8, overflow: 'hidden' },
  memberItem: { minHeight: 64, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  memberCopy: { marginLeft: 11 },
  memberName: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  memberRole: { color: palette.muted, fontSize: 11, marginTop: 3 },
});
