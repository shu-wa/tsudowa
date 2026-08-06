import { EventCard } from '@/components/event-card';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { UserAvatar } from '@/components/user-avatar';
import { palette, typography } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { isEventArchived, isEventPast } from '@/lib/event-display';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { events, profile, getUnreadMessageCount } = useEvents();
  const now = new Date();
  const upcomingEvents = [...events]
    .filter((event) => !isEventArchived(event) && !isEventPast(event, now))
    .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`));
  const pastEvents = [...events]
    .filter((event) => isEventPast(event, now))
    .sort((a, b) => `${b.endDate}${b.endTime ?? '23:59'}`.localeCompare(`${a.endDate}${a.endTime ?? '23:59'}`));
  const nextEvent = upcomingEvents[0];
  const laterEvents = upcomingEvents.slice(1);
  const latestMessage = nextEvent?.messages[nextEvent.messages.length - 1];
  const unreadCount = nextEvent ? getUnreadMessageCount(nextEvent.id) : 0;
  const todayLabel = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' }).format(now);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.today}>{todayLabel}</Text>
            <Text style={styles.greeting}>{profile.name.split(' ')[0]}さん、こんにちは</Text>
          </View>
          <UserAvatar uri={profile.avatarUri} initials={profile.initials} color={profile.avatarColor} size={44} radius={22} />
        </View>

        <View style={styles.actionPanel}>
          <TouchableOpacity style={styles.action} onPress={() => router.push('/create')} activeOpacity={0.78}>
            <View style={styles.actionIcon}><Ionicons name="add" size={23} color={palette.ink} /></View>
            <View style={styles.actionCopy}><Text style={styles.actionTitle}>イベントを作る</Text><Text style={styles.actionText}>日時や場所、集金をひとつに</Text></View>
            <Ionicons name="chevron-forward" size={18} color={palette.muted} />
          </TouchableOpacity>
          <View style={styles.actionDivider} />
          <TouchableOpacity style={styles.action} onPress={() => router.push('/join')} activeOpacity={0.78}>
            <View style={styles.actionIcon}><Ionicons name="enter-outline" size={21} color={palette.ink} /></View>
            <View style={styles.actionCopy}><Text style={styles.actionTitle}>招待から参加</Text><Text style={styles.actionText}>コードを入力して確認</Text></View>
            <Ionicons name="chevron-forward" size={18} color={palette.muted} />
          </TouchableOpacity>
        </View>

        <SectionHeader title="次のイベント" action="カレンダー" onPress={() => router.push('/(tabs)/calendar')} />
        {nextEvent ? <EventCard event={nextEvent} featured /> : (
          <View style={styles.empty}>
            <Ionicons name="calendar-clear-outline" size={28} color={palette.muted} />
            <Text style={styles.emptyTitle}>これからの予定はありません</Text>
            <TouchableOpacity onPress={() => router.push('/create')}><Text style={styles.emptyLink}>イベントを作成する</Text></TouchableOpacity>
          </View>
        )}

        {nextEvent && latestMessage ? (
          <TouchableOpacity style={styles.notice} onPress={() => router.push(`/event/${nextEvent.id}/chat`)} activeOpacity={0.78}>
            <Ionicons name="chatbubble-outline" size={19} color={palette.primary} />
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>{nextEvent.title}</Text>
              <Text style={styles.noticeText} numberOfLines={1}>{latestMessage.author.split(' ')[0]}：{latestMessage.text || (latestMessage.imagePath || latestMessage.imageUri ? '写真' : 'メッセージ')}</Text>
            </View>
            {unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View> : null}
          </TouchableOpacity>
        ) : null}

        <SectionHeader title="この先の予定" />
        {laterEvents.length ? laterEvents.map((event) => <EventCard key={event.id} event={event} compact />) : <Text style={styles.sectionEmpty}>ほかの予定はありません</Text>}

        <SectionHeader title="過去の予定" action="すべて見る" onPress={() => router.push('/past-events')} />
        {pastEvents.length ? pastEvents.slice(0, 3).map((event) => <EventCard key={event.id} event={event} compact />) : <Text style={styles.sectionEmpty}>終了した予定はありません</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onPress ? <TouchableOpacity onPress={onPress}><Text style={styles.link}>{action}</Text></TouchableOpacity> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingHorizontal: 20, paddingBottom: 44 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, marginBottom: 24 },
  today: { fontSize: 12, color: palette.muted, fontWeight: '600', marginBottom: 6 },
  greeting: { fontSize: 24, lineHeight: 31, color: palette.ink, fontFamily: typography.regular, fontWeight: '700', letterSpacing: -0.5 },
  actionPanel: { backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1, borderColor: palette.line, marginBottom: 34 },
  action: { minHeight: 72, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  actionIcon: { width: 40, height: 40, borderRadius: 6, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, paddingLeft: 13 },
  actionTitle: { color: palette.ink, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  actionText: { color: palette.muted, fontSize: 12 },
  actionDivider: { height: StyleSheet.hairlineWidth, marginLeft: 67, backgroundColor: palette.line },
  sectionHeader: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line, marginBottom: 14, marginTop: 28 },
  sectionTitle: { fontSize: 19, color: palette.ink, fontWeight: '700', letterSpacing: -0.3 },
  link: { color: palette.primary, fontSize: 12, fontWeight: '700', paddingVertical: 7 },
  notice: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line, marginTop: 14 },
  noticeCopy: { flex: 1, marginLeft: 11 },
  noticeTitle: { fontSize: 12, color: palette.ink, fontWeight: '700', marginBottom: 3 },
  noticeText: { fontSize: 12, color: palette.muted },
  badge: { minWidth: 23, height: 23, paddingHorizontal: 5, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: palette.surface, fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 27 },
  emptyTitle: { color: palette.ink, fontSize: 13, fontWeight: '700', marginTop: 10 },
  emptyLink: { color: palette.primary, fontSize: 13, fontWeight: '700', marginTop: 8 },
  sectionEmpty: { color: palette.muted, fontSize: 12, paddingVertical: 8 },
});
