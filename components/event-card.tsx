import { palette, shadow } from '@/constants/theme';
import { formatEventMonth, getEventDisplayStatus } from '@/lib/event-display';
import { EventItem } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = { event: EventItem; featured?: boolean; compact?: boolean };

export function EventCard({ event, featured = false, compact = false }: Props) {
  const displayStatus = getEventDisplayStatus(event);
  if (compact) {
    return (
      <TouchableOpacity style={styles.compact} onPress={() => router.push(`/event/${event.id}`)} activeOpacity={0.82}>
        <View style={[styles.dateBlock, { backgroundColor: event.coverColor }]}>
          <Text style={[styles.dateMonth, { color: event.accentColor }]}>{formatEventMonth(event.startDate)}</Text>
          <Text style={[styles.dateDay, { color: event.accentColor }]}>{event.startDate.slice(-2)}</Text>
        </View>
        <View style={styles.compactCopy}>
          <Text style={styles.compactTitle} numberOfLines={1}>{event.title}</Text>
          <Text style={styles.compactMeta} numberOfLines={1}>{event.timeLabel} · {event.location}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.muted} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[styles.card, featured && styles.featured]} onPress={() => router.push(`/event/${event.id}`)} activeOpacity={0.88}>
      <View style={[styles.cover, { backgroundColor: event.coverColor }]}>
        <View style={styles.coverTop}>
          <View style={[styles.category, { backgroundColor: event.accentColor }]}><Text style={styles.categoryText}>{event.category}</Text></View>
          <View style={styles.status}><View style={[styles.statusDot, { backgroundColor: event.accentColor }]} /><Text style={styles.statusText}>{displayStatus}</Text></View>
        </View>
        <View style={styles.coverArt}>
          <View style={[styles.sun, { backgroundColor: event.accentColor }]} />
          <View style={[styles.hillBack, { borderBottomColor: `${event.accentColor}55` }]} />
          <View style={[styles.hillFront, { borderBottomColor: event.accentColor }]} />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{event.title}</Text>
        {event.tagline ? <Text style={styles.tagline}>{event.tagline}</Text> : null}
        <View style={styles.metaRow}><Ionicons name="calendar-outline" size={16} color={event.accentColor} /><Text style={styles.meta}>{event.dateLabel} · {event.timeLabel}</Text></View>
        <View style={styles.metaRow}><Ionicons name="location-outline" size={16} color={event.accentColor} /><Text style={styles.meta}>{event.location}</Text></View>
        <View style={styles.footer}>
          <View style={styles.avatars}>
            {event.participants.slice(0, 4).map((person, index) => (
              <View key={person.id} style={[styles.miniAvatar, { backgroundColor: person.avatarColor, marginLeft: index === 0 ? 0 : -8 }]}><Text style={styles.miniAvatarText}>{person.initials}</Text></View>
            ))}
          </View>
          <Text style={styles.memberCount}>{event.participants.length}人参加</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 26, overflow: 'hidden', marginBottom: 14, ...shadow },
  featured: { marginBottom: 0 },
  cover: { height: 142, padding: 16, overflow: 'hidden' },
  coverTop: { flexDirection: 'row', justifyContent: 'space-between', zIndex: 2 },
  category: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  categoryText: { color: palette.surface, fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  status: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  coverArt: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 110 },
  sun: { position: 'absolute', width: 38, height: 38, borderRadius: 19, right: 36, top: 5, opacity: 0.78 },
  hillBack: { position: 'absolute', bottom: -5, left: 58, width: 0, height: 0, borderLeftWidth: 110, borderRightWidth: 110, borderBottomWidth: 92, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  hillFront: { position: 'absolute', bottom: -20, left: -35, width: 0, height: 0, borderLeftWidth: 135, borderRightWidth: 135, borderBottomWidth: 112, borderLeftColor: 'transparent', borderRightColor: 'transparent', opacity: 0.88 },
  body: { padding: 19 },
  title: { fontSize: 21, color: palette.ink, fontWeight: '800', marginBottom: 5 },
  tagline: { color: palette.muted, fontSize: 13, marginBottom: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  meta: { marginLeft: 8, color: palette.ink, fontSize: 12, fontWeight: '600', flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
  avatars: { flexDirection: 'row' },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: palette.surface, justifyContent: 'center', alignItems: 'center' },
  miniAvatarText: { color: palette.surface, fontSize: 11, fontWeight: '800' },
  memberCount: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  compact: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 20, padding: 12, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line },
  dateBlock: { width: 52, height: 58, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dateMonth: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  dateDay: { fontSize: 22, lineHeight: 25, fontWeight: '800' },
  compactCopy: { flex: 1, paddingHorizontal: 13 },
  compactTitle: { color: palette.ink, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  compactMeta: { color: palette.muted, fontSize: 13 },
});
