import { palette } from '@/constants/theme';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { useAuth } from '@/context/auth-context';
import { useEvents } from '@/context/event-context';
import { AvailabilityChoice } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const choices: { value: AvailabilityChoice; mark: string; label: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'yes', mark: '○', label: '参加できる', icon: 'checkmark-circle-outline' },
  { value: 'maybe', mark: '△', label: '未定', icon: 'help-circle-outline' },
  { value: 'no', mark: '×', label: '難しい', icon: 'close-circle-outline' },
];

export default function AvailabilityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { profile, confirmDateCandidate, findEvent, setAvailabilityVote } = useEvents();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const event = findEvent(id);

  if (!event) return <SafeAreaView style={styles.empty}><Text>イベントが見つかりません</Text></SafeAreaView>;
  const currentParticipant = user
    ? event.participants.find((participant) => participant.id === user.id)
    : event.participants.find((participant) => participant.name === profile.name);
  const participantId = currentParticipant?.id ?? 'me';
  const canManage = currentParticipant?.role === '主催者' || currentParticipant?.role === '共同主催者';
  const candidates = event.dateCandidates ?? [];

  const vote = async (candidateId: string, choice: AvailabilityChoice) => {
    setSavingId(candidateId);
    const error = await setAvailabilityVote(event.id, candidateId, choice);
    setSavingId(null);
    if (error) Alert.alert('回答を保存できません', error);
  };

  const confirm = (candidateId: string, label: string) => Alert.alert('この日程に決定しますか？', `${label}をイベントの正式日程へ反映します。`, [
    { text: 'キャンセル', style: 'cancel' },
    { text: 'この日に決定', onPress: async () => {
      setConfirmingId(candidateId);
      const error = await confirmDateCandidate(event.id, candidateId);
      setConfirmingId(null);
      if (error) Alert.alert('日程を確定できません', error);
    } },
  ]);

  return <SafeAreaView style={styles.safe} edges={['bottom']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View><Text style={styles.eyebrow}>AVAILABILITY</Text><Text style={styles.title}>候補日の投票</Text><Text style={styles.intro}>都合のよい日を ○・△・× で回答できます</Text></View>
        <View style={styles.heroIcon}><Ionicons name="calendar-number-outline" size={28} color={palette.surface} /></View>
      </View>

      {candidates.length === 0 ? <View style={styles.emptyCard}>
        <Ionicons name="calendar-clear-outline" size={34} color={palette.muted} />
        <Text style={styles.emptyTitle}>候補日はまだありません</Text>
        <Text style={styles.emptyText}>主催者が候補日を追加すると、参加者全員が回答できます。</Text>
      </View> : candidates.map((candidate) => {
        const date = new Date(`${candidate.date}T${candidate.startTime}:00`);
        const myChoice = candidate.votes.find((item) => item.participantId === participantId)?.choice;
        const confirmed = event.startDate === candidate.date && event.startTime === candidate.startTime;
        const dateLabel = `${date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })} ${candidate.startTime}`;
        const counts = Object.fromEntries(choices.map((choice) => [choice.value, candidate.votes.filter((voteItem) => voteItem.choice === choice.value).length])) as Record<AvailabilityChoice, number>;
        return <View key={candidate.id} style={[styles.card, confirmed && styles.cardConfirmed]}>
          <View style={styles.dateRow}>
            <View style={styles.dateBadge}><Text style={styles.month}>{date.toLocaleDateString('ja-JP', { month: 'short' })}</Text><Text style={styles.day}>{date.getDate()}</Text></View>
            <View style={styles.dateCopy}><View style={styles.dateTitleRow}><Text style={styles.date}>{date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</Text>{confirmed ? <View style={styles.confirmedBadge}><Text style={styles.confirmedText}>決定済み</Text></View> : null}</View><Text style={styles.time}>{candidate.startTime} 開始{candidate.note ? ` · ${candidate.note}` : ''}</Text></View>
          </View>
          <View style={styles.resultRow}>{choices.map((choice) => <View key={choice.value} style={styles.result}><Text style={styles.resultMark}>{choice.mark}</Text><Text style={styles.resultCount}>{counts[choice.value]}人</Text></View>)}</View>
          <View style={styles.choiceRow}>{choices.map((choice) => {
            const active = myChoice === choice.value;
            return <TouchableOpacity key={choice.value} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.choice, active && styles.choiceActive]} onPress={() => vote(candidate.id, choice.value)} disabled={savingId === candidate.id}>
              <Ionicons name={choice.icon} size={18} color={active ? palette.surface : palette.primary} /><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{choice.mark} {choice.label}</Text>
            </TouchableOpacity>;
          })}</View>
          {savingId === candidate.id ? <ActivityIndicator color={palette.primary} style={styles.loader} /> : null}
          {canManage && !confirmed ? <TouchableOpacity style={styles.confirmButton} onPress={() => confirm(candidate.id, dateLabel)} disabled={confirmingId === candidate.id}>{confirmingId === candidate.id ? <ActivityIndicator color={palette.surface} /> : <><Ionicons name="flag-outline" size={17} color={palette.surface} /><Text style={styles.confirmButtonText}>この日程に決定</Text></>}</TouchableOpacity> : null}
        </View>;
      })}

      {canManage ? <TouchableOpacity style={styles.addButton} onPress={() => router.push(`/event/${event.id}/availability/new`)}><Ionicons name="add" size={21} color={palette.surface} /><View style={styles.addCopy}><Text style={styles.addTitle}>候補日を追加</Text><Text style={styles.addText}>端末標準のカレンダーと時刻選択を使用</Text></View><Ionicons name="arrow-forward" size={19} color={palette.surface} /></TouchableOpacity> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, content: { padding: 20, paddingBottom: 42, gap: 12 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas },
  hero: { borderRadius: 24, backgroundColor: palette.primary, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: '#BFD2C7', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 }, title: { color: palette.surface, fontSize: 24, fontWeight: '900', marginTop: 4 }, intro: { color: '#D5E2DB', fontSize: 13, marginTop: 5 }, heroIcon: { width: 55, height: 55, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  emptyCard: { borderRadius: 22, backgroundColor: palette.surface, alignItems: 'center', padding: 30 }, emptyTitle: { color: palette.ink, fontSize: 15, fontWeight: '900', marginTop: 10 }, emptyText: { color: palette.muted, fontSize: 13, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  card: { borderRadius: 22, backgroundColor: palette.surface, padding: 15, borderWidth: 1, borderColor: 'transparent' }, cardConfirmed: { borderColor: palette.accent, backgroundColor: '#FFF8F3' }, dateRow: { flexDirection: 'row', alignItems: 'center' }, dateBadge: { width: 57, height: 61, borderRadius: 16, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }, month: { color: palette.primary, fontSize: 12, fontWeight: '900' }, day: { color: palette.primary, fontSize: 23, fontWeight: '900' }, dateCopy: { flex: 1, marginLeft: 12 }, dateTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }, date: { color: palette.ink, fontSize: 14, fontWeight: '900' }, confirmedBadge: { marginLeft: 7, borderRadius: 8, backgroundColor: palette.accent, paddingHorizontal: 7, paddingVertical: 3 }, confirmedText: { color: palette.surface, fontSize: 11, fontWeight: '900' }, time: { color: palette.muted, fontSize: 12, marginTop: 5 },
  resultRow: { flexDirection: 'row', borderRadius: 14, backgroundColor: palette.canvas, marginTop: 13, paddingVertical: 9 }, result: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }, resultMark: { color: palette.primary, fontSize: 15, fontWeight: '900' }, resultCount: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  choiceRow: { flexDirection: 'row', gap: 5, marginTop: 10 }, choice: { flex: 1, minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' }, choiceActive: { backgroundColor: palette.primary, borderColor: palette.primary }, choiceText: { color: palette.primary, fontSize: 11, fontWeight: '800', marginTop: 2 }, choiceTextActive: { color: palette.surface }, loader: { marginTop: 9 }, confirmButton: { minHeight: 45, borderRadius: 14, backgroundColor: palette.accent, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, confirmButtonText: { color: palette.surface, fontSize: 13, fontWeight: '900' },
  addButton: { minHeight: 70, borderRadius: 20, backgroundColor: palette.accent, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center' }, addCopy: { flex: 1, marginLeft: 11 }, addTitle: { color: palette.surface, fontSize: 14, fontWeight: '900' }, addText: { color: '#F6DED3', fontSize: 11, marginTop: 3 },
});
