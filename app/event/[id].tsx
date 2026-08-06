import { palette, shadow } from '@/constants/theme';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { getCollectionCategory } from '@/constants/collections';
import { formatEventMonth, getEventDisplayStatus, isEventArchived } from '@/lib/event-display';
import { useEvents } from '@/context/event-context';
import { useAuth } from '@/context/auth-context';
import { isEventManager } from '@/lib/event-permissions';
import { ScheduleItem } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import { router, useLocalSearchParams } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

type Tab = '概要' | 'タイムフロー' | '集金';

const scheduleIcon: Record<ScheduleItem['type'], ComponentProps<typeof Ionicons>['name']> = {
  move: 'navigate-outline', activity: 'flag-outline', food: 'restaurant-outline', stay: 'bed-outline',
};

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findEvent, createInviteCode, getUnreadMessageCount, profile, updateEventCover, deleteEvent, requestEventLeave, cancelEventLeave } = useEvents();
  const { user } = useAuth();
  const event = findEvent(id);
  const [tab, setTab] = useState<Tab>('概要');
  const archived = event ? isEventArchived(event) : false;
  const canManageCollections = !archived && isEventManager(event, user?.id, profile.name);

  if (!event) {
    return <SafeAreaView style={styles.empty}><Ionicons name="calendar-outline" size={40} color={palette.muted} /><Text style={styles.emptyTitle}>イベントが見つかりません</Text><TouchableOpacity onPress={() => router.replace('/')}><Text style={styles.emptyLink}>ホームへ戻る</Text></TouchableOpacity></SafeAreaView>;
  }

  const invite = async () => {
    const code = event.inviteCode || await createInviteCode(event.id);
    if (!code) return Alert.alert('招待コードを発行できませんでした', '通信状態や主催者権限を確認してください。');
    await Share.share({ message: `${event.title}に招待されました。\n${event.dateLabel} / ${event.location}\n参加コード：${code}\ntsudowa://join?code=${code}` });
  };
  const addToCalendar = async () => {
    if (Platform.OS === 'web') return Alert.alert('スマートフォンで利用できます', 'iOSまたはAndroidで端末カレンダーへ追加できます。');
    const startDate = new Date(`${event.startDate}T${event.startTime || '09:00'}:00`);
    const endDate = new Date(`${event.endDate || event.startDate}T${event.timeMode === 'range' && event.endTime ? event.endTime : event.startTime || '09:00'}:00`);
    if (event.timeMode === 'start') endDate.setHours(endDate.getHours() + 1);
    try {
      await Calendar.createEventInCalendarAsync({ title: event.title, startDate, endDate, location: event.address, notes: event.description });
    } catch {
      Alert.alert('カレンダーを開けませんでした', '端末のカレンダー設定を確認してください。');
    }
  };
  const total = event.collections.reduce((sum, collection) => sum + collection.totalAmount, 0);
  const paid = event.collections.reduce((sum, collection) => sum + collection.shares.filter((share) => share.paid).reduce((shareSum, share) => shareSum + share.amount, 0), 0);
  const unreadCount = getUnreadMessageCount(event.id);
  const displayStatus = getEventDisplayStatus(event);
  const myParticipant = event.participants.find((participant) => participant.id === user?.id || (!user && participant.name === profile.name));
  const hostParticipant = event.participants.find((participant) => participant.role === '主催者');
  const isHost = myParticipant?.role === '主催者';
  const myLeaveRequest = event.leaveRequests?.find((request) => request.userId === myParticipant?.id || request.mine);

  const changeCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('写真へのアクセスを許可してください');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.85 });
    const asset = result.assets?.[0];
    if (!asset) return;
    const error = await updateEventCover(event.id, {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
      fileName: asset.fileName ?? undefined,
    });
    if (error) Alert.alert('写真を変更できませんでした', error);
  };

  const confirmDelete = () => Alert.alert(
    'イベントを削除しますか？',
    'チャット、集金、写真を含むイベント情報がすべて削除され、元に戻せません。',
    [{ text: 'キャンセル', style: 'cancel' }, {
      text: '削除する',
      style: 'destructive',
      onPress: async () => {
        const error = await deleteEvent(event.id);
        if (error) return Alert.alert('削除できませんでした', error);
        router.replace('/');
      },
    }],
  );

  const confirmLeave = () => Alert.alert(
    myLeaveRequest ? '脱退申請を取り消しますか？' : 'イベントからの脱退を申請しますか？',
    myLeaveRequest ? '主催者に届いている申請を取り消します。' : '主催者または共同主催者が承認すると、イベントから脱退します。',
    [{ text: 'キャンセル', style: 'cancel' }, {
      text: myLeaveRequest ? '取り消す' : '申請する',
      onPress: async () => {
        const error = myLeaveRequest ? await cancelEventLeave(event.id) : await requestEventLeave(event.id);
        if (error) Alert.alert('更新できませんでした', error);
      },
    }],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.hero, event.coverImageUri ? { backgroundColor: event.coverColor } : styles.heroFallback]}>
          {event.coverImageUri ? <Image source={{ uri: event.coverImageUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} /> : null}
          {event.coverImageUri ? <View style={styles.heroShade} /> : null}
          <View style={styles.category}><Text style={styles.categoryText}>{event.category}</Text></View>
          {!event.coverImageUri ? <View style={styles.heroDate}><Text style={styles.heroMonth}>{formatEventMonth(event.startDate)}</Text><Text style={styles.heroDay}>{event.startDate.slice(-2)}</Text></View> : null}
          {canManageCollections ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="イベント写真を変更" style={styles.coverEdit} onPress={changeCover}><Ionicons name="camera" size={19} color={palette.surface} /><Text style={styles.coverEditText}>写真を変更</Text></TouchableOpacity> : null}
        </View>
        <View style={styles.titleBlock}>
          <View style={styles.statusRow}><View style={styles.statusDot} /><Text style={styles.statusText}>{displayStatus}</Text><Text style={styles.host}> · {event.host}さんが主催</Text></View>
          <Text style={styles.title}>{event.title}</Text>
          {event.tagline ? <Text style={styles.tagline}>{event.tagline}</Text> : null}
        </View>

        {archived ? <View style={styles.archiveNotice}><Ionicons name="lock-closed-outline" size={18} color={palette.primary} /><Text style={styles.archiveNoticeText}>このイベントはアーカイブ済みです。内容は閲覧できますが、書き換えられません。</Text></View> : null}

        <View style={styles.quickActions}>
          {!archived ? <TouchableOpacity style={styles.quickAction} onPress={() => router.push(`/event/${event.id}/chat`)}><View style={[styles.quickIcon, { backgroundColor: palette.primarySoft }]}><Ionicons name="chatbubbles-outline" size={23} color={palette.primary} /></View><Text style={styles.quickLabel}>チャット</Text>{unreadCount > 0 && <View style={styles.unread}><Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>}</TouchableOpacity> : null}
          {!archived ? <TouchableOpacity style={styles.quickAction} onPress={invite}><View style={[styles.quickIcon, { backgroundColor: palette.accentSoft }]}><Ionicons name="share-social-outline" size={23} color={palette.accent} /></View><Text style={styles.quickLabel}>招待する</Text></TouchableOpacity> : null}
          <TouchableOpacity style={styles.quickAction} onPress={addToCalendar}><View style={styles.quickIcon}><Ionicons name="calendar-outline" size={23} color={palette.primary} /></View><Text style={styles.quickLabel}>カレンダー</Text></TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {(['概要', 'タイムフロー', '集金'] as Tab[]).map((item) => <TouchableOpacity key={item} style={[styles.tab, tab === item && styles.tabActive]} onPress={() => setTab(item)}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text></TouchableOpacity>)}
        </ScrollView>

        {tab === '概要' && <>
          <View style={styles.infoCard}>
            <InfoRow icon="calendar-outline" label="日時" value={event.dateLabel} subvalue={event.timeLabel} color={event.accentColor} onPress={archived ? undefined : () => router.push(`/event/${event.id}/edit-date`)} />
            <View style={styles.separator} />
            {!archived ? <><InfoRow icon="calendar-number-outline" label="候補日の投票" value={(event.dateCandidates?.length ?? 0) > 0 ? `${event.dateCandidates!.length}件の候補日` : '候補日を追加して調整'} subvalue={(event.dateCandidates?.length ?? 0) > 0 ? '○・△・× で参加可否を回答' : '参加者全員の日程をまとめて確認'} color={event.accentColor} onPress={() => router.push(`/event/${event.id}/availability`)} /><View style={styles.separator} /></> : null}
            <InfoRow icon="location-outline" label="場所" value={event.location} subvalue={event.address} color={event.accentColor} onPress={archived ? undefined : () => router.push(`/event/${event.id}/edit-location`)} />
            <View style={styles.separator} />
            <InfoRow icon="people-outline" label="参加者" value={`${event.participants.length}人が参加`} subvalue={(event.leaveRequests?.length ?? 0) > 0 && canManageCollections ? `脱退承認待ち ${event.leaveRequests!.length}人` : (event.joinRequests?.length ?? 0) > 0 ? `承認待ち ${event.joinRequests!.length}人` : '参加者一覧を表示'} color={event.accentColor} onPress={() => router.push(`/event/${event.id}/participants`)} />
          </View>
          <SectionTitle title="イベントについて" />
          <View style={styles.textCard}><Text style={styles.description}>{event.description || '説明はありません'}</Text></View>
          {!archived ? <><SectionTitle title="招待コード" /><TouchableOpacity style={styles.inviteCard} onPress={invite} activeOpacity={0.85}>
            <View style={styles.inviteCopy}><Text style={styles.inviteLabel}>タップして共有</Text><Text style={styles.inviteCode} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>{event.inviteCode || 'タップして発行'}</Text></View>
            <View style={styles.shareCircle}><Ionicons name="share-outline" size={21} color={palette.surface} /></View>
          </TouchableOpacity></> : null}
        </>}

        {tab === 'タイムフロー' && <>
          <SectionTitle title="当日の流れ" />
          <View style={styles.timelineCard}>
            {event.schedule.map((item, index) => {
              const showDay = index === 0 || event.schedule[index - 1].day !== item.day;
              return <View key={item.id}>{showDay && <Text style={styles.dayLabel}>{item.day}</Text>}<View style={styles.scheduleRow}><View style={styles.timeColumn}><Text style={styles.time}>{item.time}</Text></View><View style={styles.timelineLine}>{index < event.schedule.length - 1 && <View style={styles.line} />}<View style={[styles.timelineDot, { backgroundColor: event.accentColor }]}><Ionicons name={scheduleIcon[item.type]} size={13} color={palette.surface} /></View></View><View style={styles.scheduleCopy}><Text style={styles.scheduleTitle}>{item.title}</Text>{item.note && <Text style={styles.scheduleNote}>{item.note}</Text>}</View></View></View>;
            })}
          </View>
          {canManageCollections ? <TouchableOpacity style={styles.outlineButton} onPress={() => router.push(`/event/${event.id}/schedule`)}><Ionicons name="create-outline" size={19} color={palette.primary} /><Text style={styles.outlineText}>タイムフローを編集する</Text></TouchableOpacity> : null}
        </>}

        {tab === '集金' && <>
          <SectionTitle title="イベントの集金" />
          <View style={styles.paymentSummary}>
            <View><Text style={styles.paymentLabel}>集金済み</Text><Text style={styles.paymentAmount}>¥{paid.toLocaleString()}</Text></View>
            <View style={styles.paymentRight}><Text style={styles.paymentSub}>{event.collections.length}項目 · 合計 ¥{total.toLocaleString()}</Text><View style={styles.progress}><View style={[styles.progressDone, { width: `${total ? (paid / total) * 100 : 0}%` }]} /></View></View>
          </View>
          <View style={styles.collectionList}>
            {event.collections.length === 0 && <View style={styles.collectionEmpty}><Ionicons name="receipt-outline" size={28} color={palette.muted} /><Text style={styles.collectionEmptyTitle}>集金はまだありません</Text><Text style={styles.collectionEmptyText}>参加費や立替えた費用を登録できます</Text></View>}
            {event.collections.map((collection) => {
              const category = getCollectionCategory(collection.category);
              const collectionPaid = collection.shares.filter((share) => share.paid).reduce((sum, share) => sum + share.amount, 0);
              const payer = event.participants.find((person) => person.id === collection.paidByParticipantId);
              const paidCount = collection.shares.filter((share) => share.paid).length;
              return <TouchableOpacity key={collection.id} style={styles.collectionCard} activeOpacity={0.82} onPress={() => router.push(`/event/${event.id}/collection/${collection.id}`)}>
                <View style={[styles.collectionIcon, { backgroundColor: category.background }]}><Ionicons name={category.icon} size={22} color={category.color} /></View>
                <View style={styles.collectionCopy}>
                  <View style={styles.collectionTop}><Text style={styles.collectionTitle} numberOfLines={1}>{collection.title}</Text><Text style={styles.collectionAmount}>¥{collection.totalAmount.toLocaleString()}</Text></View>
                  <Text style={styles.collectionPayer} numberOfLines={1}>{collection.autoAssignNewMembers ? `1人 ¥${(collection.defaultShareAmount ?? 0).toLocaleString()} · 全参加者へ自動追加` : `${payer?.name ?? '未設定'}さんが支払い · ${category.label}`}</Text>
                  <View style={styles.collectionProgress}><View style={[styles.collectionProgressDone, { width: `${collection.totalAmount ? (collectionPaid / collection.totalAmount) * 100 : 0}%`, backgroundColor: category.color }]} /></View>
                  <View style={styles.collectionBottom}><Text style={styles.collectionStatus}>¥{collectionPaid.toLocaleString()} 回収済み</Text><Text style={styles.collectionStatus}>{paidCount}/{collection.shares.length}人</Text></View>
                </View>
                <Ionicons name="chevron-forward" size={17} color={palette.muted} />
              </TouchableOpacity>;
            })}
          </View>
          {canManageCollections
            ? <TouchableOpacity style={styles.addCollectionButton} onPress={() => router.push(`/event/${event.id}/collection/new`)}><View style={styles.addCollectionIcon}><Ionicons name="add" size={21} color={palette.surface} /></View><View style={styles.addCollectionCopy}><Text style={styles.addCollectionTitle}>集金項目を追加</Text><Text style={styles.addCollectionText}>参加費、食事代、立替えなど</Text></View><Ionicons name="arrow-forward" size={19} color={palette.surface} /></TouchableOpacity>
            : <View style={styles.collectionReadonly}><Ionicons name="lock-closed-outline" size={17} color={palette.muted} /><Text style={styles.collectionReadonlyText}>集金の追加と支払状態の変更は主催者・共同主催者が行います</Text></View>}
        </>}
        <View style={styles.eventActions}>
          {!isHost && hostParticipant ? <TouchableOpacity style={styles.reportEventButton} onPress={() => router.push({ pathname: '/safety/report', params: { eventId: event.id, targetUserId: hostParticipant.id, targetName: hostParticipant.name, targetContentLabel: `イベント「${event.title}」` } })}><Ionicons name="flag-outline" size={18} color={palette.muted} /><Text style={styles.reportEventText}>このイベントの内容を通報</Text></TouchableOpacity> : null}
          {!archived && !isHost && myParticipant ? <TouchableOpacity style={styles.leaveButton} onPress={confirmLeave}><Ionicons name={myLeaveRequest ? 'close-circle-outline' : 'exit-outline'} size={18} color={palette.danger} /><Text style={styles.leaveText}>{myLeaveRequest ? '脱退申請を取り消す' : '主催者へ脱退を申請'}</Text></TouchableOpacity> : null}
          {!archived && isHost ? <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete}><Ionicons name="trash-outline" size={18} color={palette.danger} /><Text style={styles.deleteText}>イベントを削除</Text></TouchableOpacity> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, subvalue, color, onPress }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; value: string; subvalue: string; color: string; onPress?: () => void }) {
  return <TouchableOpacity style={styles.infoRow} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress} onPress={onPress}><View style={styles.infoIcon}><Ionicons name={icon} size={22} color={color} /></View><View style={styles.infoCopy}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text><Text style={styles.infoSub}>{subvalue}</Text></View>{onPress ? <Ionicons name="chevron-forward" size={18} color={palette.muted} /> : null}</TouchableOpacity>;
}

function SectionTitle({ title }: { title: string }) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionHeading}>{title}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, empty: { flex: 1, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center', gap: 12 }, emptyTitle: { color: palette.ink, fontSize: 17, fontWeight: '800' }, emptyLink: { color: palette.primary, fontWeight: '700' },
  content: { paddingBottom: 38 },
  hero: { height: 185, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', padding: 16 },
  heroFallback: { backgroundColor: '#242A26' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  coverEdit: { position: 'absolute', right: 13, bottom: 13, height: 38, borderRadius: 13, paddingHorizontal: 12, backgroundColor: 'rgba(25,43,34,0.82)', flexDirection: 'row', alignItems: 'center' },
  coverEditText: { color: palette.surface, fontSize: 12, fontWeight: '800', marginLeft: 6 },
  category: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 4, zIndex: 2, backgroundColor: palette.accent },
  categoryText: { color: palette.surface, fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  heroDate: { position: 'absolute', left: 18, bottom: 15, flexDirection: 'row', alignItems: 'baseline' },
  heroMonth: { color: '#D5D7D3', fontSize: 18, fontWeight: '700', marginRight: 8 },
  heroDay: { color: palette.surface, fontSize: 58, lineHeight: 61, fontWeight: '300', fontVariant: ['tabular-nums'] },
  titleBlock: { paddingHorizontal: 20, paddingTop: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 }, statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6, backgroundColor: palette.accent }, statusText: { color: palette.accent, fontSize: 13, fontWeight: '800' }, host: { color: palette.muted, fontSize: 13 },
  title: { color: palette.ink, fontSize: 27, lineHeight: 34, fontWeight: '900', marginBottom: 5 }, tagline: { color: palette.muted, fontSize: 13 },
  archiveNotice: { marginHorizontal: 20, marginTop: 18, padding: 14, borderLeftWidth: 3, borderLeftColor: palette.primary, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center' },
  archiveNoticeText: { flex: 1, marginLeft: 9, color: palette.ink, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  quickActions: { flexDirection: 'row', gap: 9, paddingHorizontal: 20, paddingTop: 20 },
  quickAction: { flex: 1, minHeight: 88, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  quickIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 7 }, quickLabel: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  unread: { position: 'absolute', top: 8, right: 12, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' }, unreadText: { color: palette.surface, fontSize: 12, fontWeight: '800' },
  tabs: { paddingHorizontal: 20, paddingVertical: 24, gap: 6 }, tab: { minWidth: 104, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 6, backgroundColor: '#E5E6E2' }, tabActive: { backgroundColor: palette.primary }, tabText: { color: palette.muted, fontSize: 14, fontWeight: '800' }, tabTextActive: { color: palette.surface },
  infoCard: { marginHorizontal: 20, backgroundColor: palette.surface, borderRadius: 10, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 }, infoIcon: { width: 42, height: 42, borderRadius: 8, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }, infoCopy: { flex: 1, marginLeft: 12 }, infoLabel: { color: palette.muted, fontSize: 13, fontWeight: '700', marginBottom: 3 }, infoValue: { color: palette.ink, fontSize: 14, fontWeight: '800', marginBottom: 2 }, infoSub: { color: palette.muted, fontSize: 13 }, separator: { height: StyleSheet.hairlineWidth, backgroundColor: palette.line, marginLeft: 56 },
  sectionTitle: { marginHorizontal: 20, marginTop: 28, marginBottom: 13 }, eyebrow: { color: palette.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1.6, marginBottom: 4 }, sectionHeading: { color: palette.ink, fontSize: 22, fontWeight: '900' },
  eventActions: { marginHorizontal: 20, marginTop: 30, gap: 10 },
  reportEventButton: { height: 50, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  reportEventText: { color: palette.muted, fontSize: 13, fontWeight: '800', marginLeft: 7 },
  leaveButton: { height: 50, borderRadius: 8, borderWidth: 1, borderColor: palette.danger, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  leaveText: { color: palette.danger, fontSize: 13, fontWeight: '800', marginLeft: 7 },
  deleteButton: { height: 50, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: palette.danger, fontSize: 13, fontWeight: '800', marginLeft: 7 },
  textCard: { marginHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: palette.line, padding: 17, backgroundColor: palette.surface }, description: { color: palette.ink, fontSize: 13, lineHeight: 22 },
  inviteCard: { marginHorizontal: 20, borderRadius: 8, padding: 18, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center' }, inviteCopy: { flex: 1, minWidth: 0, paddingRight: 12 }, inviteLabel: { color: '#BFD2C7', fontSize: 12, fontWeight: '800', marginBottom: 5 }, inviteCode: { width: '100%', color: palette.surface, fontSize: 22, letterSpacing: 1.5, fontWeight: '900' }, shareCircle: { width: 44, height: 44, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineCard: { marginHorizontal: 20, backgroundColor: palette.surface, borderRadius: 8, borderWidth: 1, borderColor: palette.line, padding: 17 }, dayLabel: { color: palette.accent, fontSize: 13, fontWeight: '900', letterSpacing: 1.2, marginVertical: 8 }, scheduleRow: { flexDirection: 'row', minHeight: 76 }, timeColumn: { width: 48, paddingTop: 5 }, time: { color: palette.ink, fontSize: 12, fontWeight: '800' }, timelineLine: { width: 34, alignItems: 'center' }, line: { position: 'absolute', top: 30, bottom: -5, width: 1.5, backgroundColor: palette.line }, timelineDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, scheduleCopy: { flex: 1, paddingTop: 4, paddingLeft: 3 }, scheduleTitle: { color: palette.ink, fontSize: 14, fontWeight: '800', marginBottom: 4 }, scheduleNote: { color: palette.muted, fontSize: 13, lineHeight: 15 },
  outlineButton: { marginHorizontal: 20, marginTop: 13, height: 52, borderRadius: 8, borderWidth: 1, borderColor: '#AABBB1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, outlineText: { color: palette.primary, fontSize: 13, fontWeight: '800', marginLeft: 7 },
  paymentSummary: { marginHorizontal: 20, borderRadius: 8, padding: 18, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, paymentLabel: { color: '#C8D9D0', fontSize: 13, marginBottom: 5 }, paymentAmount: { color: palette.surface, fontSize: 24, fontWeight: '900' }, paymentRight: { width: '45%' }, paymentSub: { color: '#D7E4DD', fontSize: 13, textAlign: 'right', marginBottom: 8 }, progress: { height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.18)' }, progressDone: { height: '100%', backgroundColor: palette.yellow, borderRadius: 4 },
  collectionList: { marginHorizontal: 20, marginTop: 12, gap: 10 },
  collectionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 14 },
  collectionIcon: { width: 46, height: 46, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  collectionCopy: { flex: 1, marginHorizontal: 12 }, collectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  collectionTitle: { flex: 1, color: palette.ink, fontSize: 14, fontWeight: '800', marginRight: 8 }, collectionAmount: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  collectionPayer: { color: palette.muted, fontSize: 12, marginBottom: 9 }, collectionProgress: { height: 5, borderRadius: 3, backgroundColor: '#E8E9E4', overflow: 'hidden' }, collectionProgressDone: { height: '100%', borderRadius: 3 },
  collectionBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }, collectionStatus: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  collectionEmpty: { alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 28 }, collectionEmptyTitle: { color: palette.ink, fontSize: 14, fontWeight: '800', marginTop: 10 }, collectionEmptyText: { color: palette.muted, fontSize: 13, marginTop: 4 },
  collectionReadonly: { marginHorizontal: 20, marginTop: 14, borderLeftWidth: 3, borderLeftColor: palette.primary, backgroundColor: palette.surface, padding: 13, flexDirection: 'row', alignItems: 'center' },
  collectionReadonlyText: { flex: 1, marginLeft: 8, color: palette.muted, fontSize: 12, lineHeight: 18 },
  addCollectionButton: { marginHorizontal: 20, marginTop: 12, minHeight: 66, borderRadius: 8, backgroundColor: palette.primary, padding: 12, flexDirection: 'row', alignItems: 'center' }, addCollectionIcon: { width: 42, height: 42, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' }, addCollectionCopy: { flex: 1, marginLeft: 11 }, addCollectionTitle: { color: palette.surface, fontSize: 13, fontWeight: '800', marginBottom: 3 }, addCollectionText: { color: '#C9D9D0', fontSize: 12 },
});
