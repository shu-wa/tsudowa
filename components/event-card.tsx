import { UserAvatar } from '@/components/user-avatar';
import { palette } from '@/constants/theme';
import { formatEventMonth, getEventDisplayStatus } from '@/lib/event-display';
import { EventItem } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = { event: EventItem; featured?: boolean; compact?: boolean };

export function EventCard({ event, featured = false, compact = false }: Props) {
  const displayStatus = getEventDisplayStatus(event);
  if (compact) {
    return (
      <TouchableOpacity style={styles.compact} onPress={() => router.push(`/event/${event.id}`)} activeOpacity={0.76}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateMonth}>{formatEventMonth(event.startDate)}</Text>
          <Text style={styles.dateDay}>{event.startDate.slice(-2)}</Text>
        </View>
        <View style={styles.compactCopy}>
          <Text style={styles.compactTitle} numberOfLines={1}>{event.title}</Text>
          <Text style={styles.compactMeta} numberOfLines={1}>{event.timeLabel} · {event.location}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={palette.muted} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[styles.card, featured && styles.featured]} onPress={() => router.push(`/event/${event.id}`)} activeOpacity={0.82}>
      <View style={[styles.cover, event.coverImageUri ? { backgroundColor: event.coverColor } : styles.coverFallback]}>
        {event.coverImageUri ? <Image source={{ uri: event.coverImageUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} /> : null}
        {event.coverImageUri ? <View style={styles.coverShade} /> : null}
        <View style={styles.coverTop}>
          <Text style={styles.categoryText}>{event.category}</Text>
          <Text style={styles.statusText}>{displayStatus}</Text>
        </View>
        {!event.coverImageUri ? (
          <View style={styles.coverDate}>
            <Text style={styles.coverMonth}>{formatEventMonth(event.startDate)}</Text>
            <Text style={styles.coverDay}>{event.startDate.slice(-2)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{event.title}</Text>
        {event.tagline ? <Text style={styles.tagline} numberOfLines={2}>{event.tagline}</Text> : null}
        <View style={styles.metaRow}><Ionicons name="calendar-outline" size={15} color={palette.muted} /><Text style={styles.meta}>{event.dateLabel} · {event.timeLabel}</Text></View>
        <View style={styles.metaRow}><Ionicons name="location-outline" size={15} color={palette.muted} /><Text style={styles.meta} numberOfLines={1}>{event.location}</Text></View>
        <View style={styles.footer}>
          <View style={styles.avatars}>
            {event.participants.slice(0, 4).map((person, index) => (
              <UserAvatar key={person.id} uri={person.avatarUri} initials={person.initials} color={person.avatarColor} size={27} radius={14} style={{ marginLeft: index === 0 ? 0 : -7, borderWidth: 2, borderColor: palette.surface }} />
            ))}
          </View>
          <Text style={styles.memberCount}>{event.participants.length}人参加</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 10, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: palette.line },
  featured: { marginBottom: 0 },
  cover: { height: 140, padding: 15, overflow: 'hidden' },
  coverFallback: { backgroundColor: '#242A26' },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,12,11,0.38)' },
  coverTop: { flexDirection: 'row', justifyContent: 'space-between', zIndex: 2 },
  categoryText: { color: palette.surface, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  statusText: { color: palette.surface, fontSize: 12, fontWeight: '700' },
  coverDate: { position: 'absolute', left: 17, bottom: 12, flexDirection: 'row', alignItems: 'baseline' },
  coverMonth: { color: '#D5D7D3', fontSize: 15, fontWeight: '700', marginRight: 7 },
  coverDay: { color: palette.surface, fontSize: 50, lineHeight: 53, fontWeight: '300', fontVariant: ['tabular-nums'] },
  body: { padding: 18 },
  title: { fontSize: 21, lineHeight: 27, color: palette.ink, fontWeight: '700', letterSpacing: -0.4, marginBottom: 5 },
  tagline: { color: palette.muted, fontSize: 12, lineHeight: 18, marginBottom: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  meta: { marginLeft: 8, color: palette.ink, fontSize: 12, fontWeight: '500', flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
  avatars: { flexDirection: 'row' },
  memberCount: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  compact: { minHeight: 74, flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, paddingHorizontal: 12, marginBottom: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  dateBlock: { width: 50, height: 49, borderLeftWidth: 2, borderLeftColor: palette.accent, paddingLeft: 10, justifyContent: 'center' },
  dateMonth: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  dateDay: { color: palette.ink, fontSize: 21, lineHeight: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  compactCopy: { flex: 1, paddingHorizontal: 13 },
  compactTitle: { color: palette.ink, fontSize: 14, fontWeight: '700', marginBottom: 5 },
  compactMeta: { color: palette.muted, fontSize: 12 },
});
