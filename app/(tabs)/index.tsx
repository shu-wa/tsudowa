import { EventCard } from '@/components/event-card';
import { palette, shadow, typography } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { getLocalDateKey } from '@/lib/event-display';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { events, profile, getUnreadMessageCount } = useEvents();
  const today = getLocalDateKey(new Date());
  const upcomingEvents = [...events].filter((event) => event.endDate >= today).sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`));
  const nextEvent = upcomingEvents[0];
  const laterEvents = upcomingEvents.slice(1);
  const latestMessage = nextEvent?.messages[nextEvent.messages.length - 1];
  const unreadCount = nextEvent ? getUnreadMessageCount(nextEvent.id) : 0;
  const todayLabel = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{todayLabel}</Text>
            <Text style={styles.greeting}>こんにちは、{profile.name.split(' ')[0]}さん</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: profile.avatarColor }]}><Text style={styles.avatarText}>{profile.initials}</Text></View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.action, styles.actionPrimary]} onPress={() => router.push('/create')} activeOpacity={0.85}>
            <View style={styles.actionIconPrimary}><Ionicons name="add" size={24} color={palette.surface} /></View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitlePrimary}>イベントを作る</Text>
              <Text style={styles.actionTextPrimary}>予定をひとつにまとめる</Text>
            </View>
            <Ionicons name="arrow-forward" size={19} color={palette.surface} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => router.push('/join')} activeOpacity={0.85}>
            <View style={styles.actionIcon}><Ionicons name="enter-outline" size={22} color={palette.primary} /></View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>招待から参加</Text>
              <Text style={styles.actionText}>コードを入力</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionLabel}>NEXT UP</Text>
            <Text style={styles.sectionTitle}>次のイベント</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/calendar')}><Text style={styles.link}>すべて見る</Text></TouchableOpacity>
        </View>

        {nextEvent ? <EventCard event={nextEvent} featured /> : <View style={styles.empty}><Ionicons name="calendar-clear-outline" size={30} color={palette.muted} /><Text style={styles.emptyTitle}>予定されているイベントはありません</Text><TouchableOpacity onPress={() => router.push('/create')}><Text style={styles.emptyLink}>イベントを作成する</Text></TouchableOpacity></View>}

        {nextEvent && latestMessage && <TouchableOpacity style={styles.notice} onPress={() => router.push(`/event/${nextEvent.id}/chat`)} activeOpacity={0.8}>
          <View style={styles.noticeIcon}><Ionicons name="chatbubble-ellipses" size={20} color={palette.primary} /></View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>{nextEvent.title}のメッセージ</Text>
            <Text style={styles.noticeText}>{latestMessage.author.split(' ')[0]}：{latestMessage.text}</Text>
          </View>
          {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>}
        </TouchableOpacity>}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionLabel}>UPCOMING</Text>
            <Text style={styles.sectionTitle}>この先の予定</Text>
          </View>
        </View>
        {laterEvents.map((event) => <EventCard key={event.id} event={event} compact />)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, marginBottom: 24 },
  eyebrow: { fontSize: 13, letterSpacing: 1.8, color: palette.muted, fontWeight: '700', marginBottom: 6 },
  greeting: { fontSize: 24, lineHeight: 31, color: palette.ink, fontFamily: typography.rounded, fontWeight: '700' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: palette.surface, fontSize: 13, fontWeight: '800' },
  actionRow: { gap: 10, marginBottom: 34 },
  action: { minHeight: 76, borderRadius: 22, backgroundColor: palette.surface, padding: 14, flexDirection: 'row', alignItems: 'center', ...shadow },
  actionPrimary: { backgroundColor: palette.primary },
  actionIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  actionIconPrimary: { width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, paddingLeft: 13 },
  actionTitle: { color: palette.ink, fontSize: 16, fontWeight: '700', marginBottom: 3 },
  actionTitlePrimary: { color: palette.surface, fontSize: 16, fontWeight: '700', marginBottom: 3 },
  actionText: { color: palette.muted, fontSize: 12 },
  actionTextPrimary: { color: '#D6E3DC', fontSize: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 13, marginTop: 2 },
  sectionLabel: { fontSize: 13, color: palette.accent, fontWeight: '800', letterSpacing: 1.8, marginBottom: 3 },
  sectionTitle: { fontSize: 21, color: palette.ink, fontWeight: '800' },
  link: { color: palette.primary, fontSize: 13, fontWeight: '700', paddingVertical: 6 },
  notice: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 19, backgroundColor: palette.primarySoft, marginVertical: 22 },
  noticeIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4FAF6' },
  noticeCopy: { flex: 1, marginLeft: 11 },
  noticeTitle: { fontSize: 13, color: palette.ink, fontWeight: '700', marginBottom: 3 },
  noticeText: { fontSize: 12, color: palette.muted },
  badge: { width: 24, height: 24, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: palette.surface, fontSize: 13, fontWeight: '800' },
  empty: { alignItems: 'center', backgroundColor: palette.surface, borderRadius: 22, padding: 28, marginBottom: 22 },
  emptyTitle: { color: palette.ink, fontSize: 13, fontWeight: '800', marginTop: 10 },
  emptyLink: { color: palette.primary, fontSize: 13, fontWeight: '700', marginTop: 8 },
});
