import { palette } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useEvents } from '@/context/event-context';
import { AttendanceChoice } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserAvatar } from '@/components/user-avatar';

const attendanceOptions: { value: AttendanceChoice; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: '参加', icon: 'checkmark-circle-outline' },
  { value: '未定', icon: 'help-circle-outline' },
  { value: '不参加', icon: 'close-circle-outline' },
];

export default function ParticipantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { findEvent, profile, blockedUsers, setMemberRole, setMyAttendance, reviewJoinRequest, reviewEventLeave } = useEvents();
  const event = findEvent(id);
  const [query, setQuery] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [reviewingUserId, setReviewingUserId] = useState<string | null>(null);
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState<string | null>(null);
  const [reviewingLeaveUserId, setReviewingLeaveUserId] = useState<string | null>(null);
  const participants = useMemo(() => event?.participants.filter((person) => person.name.toLowerCase().includes(query.trim().toLowerCase())) ?? [], [event, query]);

  if (!event) return <SafeAreaView style={styles.empty}><Text>イベントが見つかりません</Text></SafeAreaView>;
  const currentParticipant = user
    ? event.participants.find((person) => person.id === user.id)
    : event.participants.find((person) => person.name === profile.name);
  const canManage = currentParticipant?.role === '主催者' || currentParticipant?.role === '共同主催者';
  const canManageRoles = currentParticipant?.role === '主催者';
  const joinRequests = event.joinRequests ?? [];
  const leaveRequests = event.leaveRequests ?? [];
  const attendingCount = event.participants.filter((person) => !['未定', '不参加'].includes(person.attendance)).length;

  const chooseAttendance = async (attendance: AttendanceChoice) => {
    if (attendanceLoading || currentParticipant?.attendance === attendance) return;
    setAttendanceLoading(true);
    const error = await setMyAttendance(event.id, attendance);
    setAttendanceLoading(false);
    if (error) Alert.alert('参加可否を更新できません', error);
  };

  const review = async (userId: string, decision: 'approved' | 'declined') => {
    setReviewingUserId(userId);
    const error = await reviewJoinRequest(event.id, userId, decision);
    setReviewingUserId(null);
    if (error) Alert.alert('参加申請を更新できません', error);
  };

  const reviewLeave = async (userId: string, decision: 'approved' | 'declined') => {
    setReviewingLeaveUserId(userId);
    const error = await reviewEventLeave(event.id, userId, decision);
    setReviewingLeaveUserId(null);
    if (error) Alert.alert('脱退申請を更新できません', error);
  };

  const changeRole = (participantId: string, name: string, currentRole: '主催者' | '共同主催者' | '参加者') => {
    if (currentRole === '主催者') return;
    const promote = currentRole === '参加者';
    Alert.alert(promote ? '共同主催者にしますか？' : '共同主催者を解除しますか？', `${name}さんのイベント管理権限を${promote ? '有効' : '無効'}にします。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: promote ? '任命する' : '解除する', style: promote ? 'default' : 'destructive', onPress: async () => {
        setRoleUpdatingUserId(participantId);
        const error = await setMemberRole(event.id, participantId, promote ? 'cohost' : 'member');
        setRoleUpdatingUserId(null);
        if (error) Alert.alert('権限を変更できません', error);
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.summary}><View><Text style={styles.count}>{event.participants.length}<Text style={styles.unit}> 人</Text></Text><Text style={styles.summaryText}>参加回答 {attendingCount}人</Text></View><View style={styles.peopleIcon}><Ionicons name="people" size={28} color={palette.surface} /></View></View>

        {currentParticipant ? <View style={styles.attendanceCard}>
          <View style={styles.sectionCopy}><Text style={styles.sectionTitle}>あなたの参加可否</Text><Text style={styles.sectionText}>変更すると参加者一覧へすぐ反映されます</Text></View>
          <View style={styles.attendanceOptions}>{attendanceOptions.map((option) => {
            const active = currentParticipant.attendance === option.value;
            return <TouchableOpacity key={option.value} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.attendanceButton, active && styles.attendanceButtonActive]} onPress={() => chooseAttendance(option.value)} disabled={attendanceLoading}>
              <Ionicons name={option.icon} size={18} color={active ? palette.surface : palette.primary} /><Text style={[styles.attendanceButtonText, active && styles.attendanceButtonTextActive]}>{option.value}</Text>
            </TouchableOpacity>;
          })}</View>
          {attendanceLoading ? <ActivityIndicator color={palette.primary} style={styles.attendanceLoader} /> : null}
        </View> : null}

        {canManage && joinRequests.length > 0 ? <View style={styles.requestsCard}>
          <View style={styles.requestsHeader}><View><Text style={styles.sectionTitle}>参加申請</Text><Text style={styles.sectionText}>承認するとイベント情報が共有されます</Text></View><View style={styles.requestCount}><Text style={styles.requestCountText}>{joinRequests.length}</Text></View></View>
          {joinRequests.map((request, index) => <View key={request.userId} style={[styles.requestRow, index > 0 && styles.requestBorder]}>
            <UserAvatar uri={request.avatarUri} initials={request.initials} color={request.avatarColor} size={49} radius={17} />
            <View style={styles.requestCopy}><Text style={styles.name}>{request.name}</Text><Text style={styles.attendance}>{new Date(request.requestedAt).toLocaleDateString('ja-JP')}に申請</Text></View>
            {reviewingUserId === request.userId ? <ActivityIndicator color={palette.primary} /> : <View style={styles.reviewActions}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${request.name}さんの参加申請を拒否`} style={styles.decline} onPress={() => review(request.userId, 'declined')}><Ionicons name="close" size={17} color={palette.danger} /></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${request.name}さんの参加申請を承認`} style={styles.approve} onPress={() => review(request.userId, 'approved')}><Ionicons name="checkmark" size={18} color={palette.surface} /></TouchableOpacity>
            </View>}
          </View>)}
        </View> : null}

        {canManage && leaveRequests.length > 0 ? <View style={styles.leaveRequestsCard}>
          <View style={styles.requestsHeader}><View><Text style={styles.sectionTitle}>脱退申請</Text><Text style={styles.sectionText}>承認すると参加者一覧から外れます</Text></View><View style={[styles.requestCount, styles.leaveRequestCount]}><Text style={styles.requestCountText}>{leaveRequests.length}</Text></View></View>
          {leaveRequests.map((request, index) => <View key={request.userId} style={[styles.requestRow, index > 0 && styles.requestBorder]}>
            <UserAvatar uri={request.avatarUri} initials={request.initials} color={request.avatarColor} size={49} radius={17} />
            <View style={styles.requestCopy}><Text style={styles.name}>{request.name}</Text><Text style={styles.attendance}>{new Date(request.requestedAt).toLocaleDateString('ja-JP')}に申請</Text></View>
            {request.userId === currentParticipant?.id ? <Text style={styles.selfReviewText}>主催者の承認待ち</Text> : reviewingLeaveUserId === request.userId ? <ActivityIndicator color={palette.primary} /> : <View style={styles.reviewActions}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${request.name}さんの脱退申請を却下`} style={styles.decline} onPress={() => reviewLeave(request.userId, 'declined')}><Ionicons name="close" size={17} color={palette.danger} /></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${request.name}さんの脱退申請を承認`} style={styles.approve} onPress={() => reviewLeave(request.userId, 'approved')}><Ionicons name="checkmark" size={18} color={palette.surface} /></TouchableOpacity>
            </View>}
          </View>)}
        </View> : null}

        <View style={styles.search}><Ionicons name="search" size={18} color={palette.muted} /><TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="参加者を検索" placeholderTextColor="#9AA39E" /></View>
        <View style={styles.list}>
          {participants.map((item, index) => <View key={item.id} style={[styles.person, index > 0 && styles.personBorder]}>
            <UserAvatar uri={item.avatarUri} initials={item.initials} color={item.avatarColor} size={49} radius={17} />
            <View style={styles.copy}><View style={styles.nameRow}><Text style={styles.name}>{item.name}</Text>{item.role !== '参加者' && <View style={[styles.hostBadge, item.role === '共同主催者' && styles.cohostBadge]}><Text style={[styles.hostText, item.role === '共同主催者' && styles.cohostText]}>{item.role}</Text></View>}{blockedUsers.some((blocked) => blocked.userId ? blocked.userId === item.id : blocked.name === item.name) && <View style={styles.blockBadge}><Text style={styles.blockText}>ブロック中</Text></View>}</View><Text style={[styles.attendance, item.attendance === '不参加' && styles.notAttending]}>{item.attendance}</Text></View>
            {item.id === currentParticipant?.id ? <View style={styles.actionSpacer} /> : roleUpdatingUserId === item.id ? <ActivityIndicator color={palette.primary} /> : <View style={styles.personActions}>{canManageRoles && item.role !== '主催者' ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${item.name}さんの管理権限を変更`} style={styles.manageRole} onPress={() => changeRole(item.id, item.name, item.role)}><Ionicons name={item.role === '共同主催者' ? 'shield-checkmark' : 'shield-outline'} size={18} color={item.role === '共同主催者' ? palette.accent : palette.primary} /></TouchableOpacity> : null}<TouchableOpacity accessibilityRole="button" accessibilityLabel={`${item.name}さんを通報またはブロック`} style={styles.more} onPress={() => router.push({ pathname: '/safety/report', params: { eventId: id, targetUserId: item.id, targetName: item.name } })}><Ionicons name="ellipsis-horizontal" size={19} color={palette.muted} /></TouchableOpacity></View>}
          </View>)}
          {participants.length === 0 ? <View style={styles.noResult}><Ionicons name="person-outline" size={32} color={palette.muted} /><Text style={styles.noResultText}>該当する参加者はいません</Text></View> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 40 },
  summary: { borderRadius: 23, backgroundColor: palette.primary, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, count: { color: palette.surface, fontSize: 29, fontWeight: '900' }, unit: { fontSize: 14 }, summaryText: { color: '#C7DBD0', fontSize: 13, marginTop: 3 }, peopleIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  attendanceCard: { borderRadius: 21, backgroundColor: palette.surface, padding: 15, marginBottom: 12 }, sectionCopy: { marginBottom: 12 }, sectionTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' }, sectionText: { color: palette.muted, fontSize: 12, marginTop: 3 }, attendanceOptions: { flexDirection: 'row', gap: 7 }, attendanceButton: { flex: 1, minHeight: 43, borderRadius: 13, borderWidth: 1, borderColor: palette.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, attendanceButtonActive: { backgroundColor: palette.primary, borderColor: palette.primary }, attendanceButtonText: { color: palette.primary, fontSize: 13, fontWeight: '800' }, attendanceButtonTextActive: { color: palette.surface }, attendanceLoader: { marginTop: 9 },
  requestsCard: { borderRadius: 21, backgroundColor: palette.accentSoft, padding: 15, marginBottom: 12 }, requestsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, requestCount: { minWidth: 27, height: 27, borderRadius: 14, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' }, requestCountText: { color: palette.surface, fontSize: 13, fontWeight: '900' }, requestRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center' }, requestBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5CBBE' }, requestCopy: { flex: 1, marginLeft: 11 }, reviewActions: { flexDirection: 'row', gap: 7 }, decline: { width: 38, height: 38, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: '#E7C6C7', alignItems: 'center', justifyContent: 'center' }, approve: { width: 38, height: 38, borderRadius: 12, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  leaveRequestsCard: { borderRadius: 21, backgroundColor: '#FFF4F2', padding: 15, marginBottom: 12 }, leaveRequestCount: { backgroundColor: palette.danger },
  selfReviewText: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  search: { marginBottom: 12, height: 48, borderRadius: 16, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }, searchInput: { flex: 1, marginLeft: 9, color: palette.ink, fontSize: 13 },
  list: { padding: 15, borderRadius: 22, backgroundColor: palette.surface }, person: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }, personBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line }, avatar: { width: 49, height: 49, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, initials: { color: palette.surface, fontSize: 13, fontWeight: '900' }, copy: { flex: 1, marginLeft: 12 }, nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }, name: { color: palette.ink, fontSize: 14, fontWeight: '900' }, hostBadge: { marginLeft: 7, borderRadius: 8, backgroundColor: palette.accentSoft, paddingHorizontal: 7, paddingVertical: 3 }, hostText: { color: palette.accent, fontSize: 11, fontWeight: '900' }, cohostBadge: { backgroundColor: palette.primarySoft }, cohostText: { color: palette.primary }, blockBadge: { marginLeft: 6, borderRadius: 8, backgroundColor: '#E5E6E2', paddingHorizontal: 6, paddingVertical: 3 }, blockText: { color: palette.muted, fontSize: 7, fontWeight: '800' }, attendance: { color: palette.muted, fontSize: 13, marginTop: 4 }, notAttending: { color: palette.danger }, actionSpacer: { width: 38 }, personActions: { flexDirection: 'row', gap: 6 }, more: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas }, manageRole: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft }, noResult: { alignItems: 'center', padding: 32 }, noResultText: { color: palette.muted, marginTop: 8, fontSize: 13 },
});
