import { getCollectionCategory } from '@/constants/collections';
import { palette } from '@/constants/theme';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { useEvents } from '@/context/event-context';
import { useAuth } from '@/context/auth-context';
import { isEventManager } from '@/lib/event-permissions';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CollectionDetailScreen() {
  const { id, collectionId } = useLocalSearchParams<{ id: string; collectionId: string }>();
  const { findEvent, profile, toggleCollectionPayment } = useEvents();
  const { user } = useAuth();
  const event = findEvent(id);
  const collection = event?.collections.find((item) => item.id === collectionId);
  const canManagePayments = isEventManager(event, user?.id, profile.name);

  if (!event || !collection) {
    return <SafeAreaView style={styles.empty}><Ionicons name="receipt-outline" size={35} color={palette.muted} /><Text style={styles.emptyTitle}>集金項目が見つかりません</Text><TouchableOpacity onPress={() => router.back()}><Text style={styles.backText}>戻る</Text></TouchableOpacity></SafeAreaView>;
  }

  const category = getCollectionCategory(collection.category);
  const payer = event.participants.find((person) => person.id === collection.paidByParticipantId);
  const paidAmount = collection.shares.filter((share) => share.paid).reduce((sum, share) => sum + share.amount, 0);
  const paidCount = collection.shares.filter((share) => share.paid).length;
  const progress = collection.totalAmount ? (paidAmount / collection.totalAmount) * 100 : 0;
  const togglePayment = async (participantId: string) => {
    const error = await toggleCollectionPayment(event.id, collection.id, participantId);
    if (error) Alert.alert('支払状態を変更できません', error);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: category.background }]}>
          <View style={[styles.heroIcon, { backgroundColor: category.color }]}><Ionicons name={category.icon} size={28} color={palette.surface} /></View>
          <View style={styles.heroCopy}><Text style={[styles.category, { color: category.color }]}>{category.label}</Text><Text style={styles.title}>{collection.title}</Text><Text style={styles.split}>{collection.autoAssignNewMembers ? `1人あたり ¥${(collection.defaultShareAmount ?? 0).toLocaleString()}` : collection.splitMethod === 'equal' ? '均等割り' : '個別金額'} · {collection.shares.length}人が対象</Text></View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryTop}><View><Text style={styles.summaryLabel}>回収済み</Text><Text style={styles.summaryAmount}>¥{paidAmount.toLocaleString()}</Text></View><View style={styles.summaryRight}><Text style={styles.totalLabel}>合計</Text><Text style={styles.total}>¥{collection.totalAmount.toLocaleString()}</Text></View></View>
          <View style={styles.progress}><View style={[styles.progressDone, { width: `${progress}%`, backgroundColor: category.color }]} /></View>
          <View style={styles.progressMeta}><Text style={styles.progressText}>{Math.round(progress)}% 完了</Text><Text style={styles.progressText}>{paidCount}/{collection.shares.length}人が支払済み</Text></View>
        </View>

        <Text style={styles.sectionTitle}>支払い情報</Text>
        <View style={styles.infoCard}>
          <InfoRow icon="person-outline" label="立替・支払った人" value={payer?.name ?? '未設定'} />
          <View style={styles.separator} />
          <InfoRow icon="calendar-outline" label="支払期限" value={collection.dueDate || '期限なし'} />
          <View style={styles.separator} />
          <InfoRow icon="git-compare-outline" label="分け方" value={collection.autoAssignNewMembers ? '参加者全員へ1人分ずつ自動追加' : collection.splitMethod === 'equal' ? '対象者で均等割り' : '参加者ごとに個別指定'} />
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitleInline}>対象メンバー</Text><Text style={styles.tapHint}>{canManagePayments ? 'タップで支払状態を変更' : '主催者・共同主催者のみ変更可能'}</Text></View>
        <View style={styles.members}>
          {collection.shares.map((share, index) => {
            const person = event.participants.find((participant) => participant.id === share.participantId);
            if (!person) return null;
            return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !canManagePayments }} key={share.participantId} style={[styles.memberRow, index === collection.shares.length - 1 && styles.memberRowLast]} onPress={() => togglePayment(share.participantId)} activeOpacity={canManagePayments ? 0.7 : 1} disabled={!canManagePayments}>
              <View style={[styles.avatar, { backgroundColor: person.avatarColor }]}><Text style={styles.initials}>{person.initials}</Text></View>
              <View style={styles.memberCopy}><View style={styles.memberNameRow}><Text style={styles.memberName}>{person.name}</Text>{person.id === collection.paidByParticipantId && <View style={styles.payerBadge}><Text style={styles.payerBadgeText}>立替者</Text></View>}</View><Text style={styles.memberSub}>{share.paidAt || (share.paid ? '確認済み' : '支払い待ち')}</Text></View>
              <View style={styles.memberRight}><Text style={styles.memberAmount}>¥{share.amount.toLocaleString()}</Text><View style={[styles.status, share.paid ? styles.statusPaid : styles.statusUnpaid]}><Ionicons name={share.paid ? 'checkmark' : 'time-outline'} size={11} color={share.paid ? palette.primary : palette.danger} /><Text style={[styles.statusText, !share.paid && styles.statusTextUnpaid]}>{share.paid ? '支払済み' : '未払い'}</Text></View></View>
            </TouchableOpacity>;
          })}
        </View>

        {collection.note && <><Text style={styles.sectionTitle}>メモ</Text><View style={styles.noteCard}><Ionicons name="document-text-outline" size={20} color={category.color} /><Text style={styles.note}>{collection.note}</Text></View></>}
        <View style={styles.notice}><Ionicons name="information-circle-outline" size={18} color={palette.muted} /><Text style={styles.noticeText}>支払い方法は現金や各種送金サービスから自由に選べます。支払状態は主催者・共同主催者が確認して更新し、参加者全員へ共有されます。</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.infoRow}><View style={styles.infoIcon}><Ionicons name={icon} size={19} color={palette.primary} /></View><View><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, content: { padding: 20, paddingBottom: 36 }, empty: { flex: 1, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center', gap: 10 }, emptyTitle: { color: palette.ink, fontWeight: '800' }, backText: { color: palette.primary, fontWeight: '700' },
  hero: { borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, heroIcon: { width: 55, height: 55, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, heroCopy: { flex: 1, marginLeft: 14 }, category: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginBottom: 4 }, title: { color: palette.ink, fontSize: 21, fontWeight: '900', marginBottom: 5 }, split: { color: palette.muted, fontSize: 13 },
  summary: { borderRadius: 23, backgroundColor: palette.surface, padding: 18, marginBottom: 24 }, summaryTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 15 }, summaryLabel: { color: palette.muted, fontSize: 13, marginBottom: 4 }, summaryAmount: { color: palette.ink, fontSize: 26, fontWeight: '900' }, summaryRight: { alignItems: 'flex-end' }, totalLabel: { color: palette.muted, fontSize: 12, marginBottom: 3 }, total: { color: palette.ink, fontSize: 14, fontWeight: '800' }, progress: { height: 8, borderRadius: 4, backgroundColor: '#E9EAE5', overflow: 'hidden' }, progressDone: { height: '100%', borderRadius: 4 }, progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }, progressText: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: '800', marginBottom: 10 }, infoCard: { borderRadius: 21, backgroundColor: palette.surface, paddingHorizontal: 14, marginBottom: 24 }, infoRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center' }, infoIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, infoLabel: { color: palette.muted, fontSize: 12, marginBottom: 3 }, infoValue: { color: palette.ink, fontSize: 12, fontWeight: '800' }, separator: { height: StyleSheet.hairlineWidth, backgroundColor: palette.line, marginLeft: 48 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, sectionTitleInline: { color: palette.ink, fontSize: 17, fontWeight: '800' }, tapHint: { color: palette.muted, fontSize: 12 }, members: { borderRadius: 21, backgroundColor: palette.surface, overflow: 'hidden', marginBottom: 24 }, memberRow: { minHeight: 69, flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, memberRowLast: { borderBottomWidth: 0 }, avatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, initials: { color: palette.surface, fontSize: 13, fontWeight: '800' }, memberCopy: { flex: 1, marginLeft: 10 }, memberNameRow: { flexDirection: 'row', alignItems: 'center' }, memberName: { color: palette.ink, fontSize: 12, fontWeight: '800' }, payerBadge: { backgroundColor: palette.primarySoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginLeft: 6 }, payerBadgeText: { color: palette.primary, fontSize: 7, fontWeight: '800' }, memberSub: { color: palette.muted, fontSize: 11, marginTop: 4 }, memberRight: { alignItems: 'flex-end' }, memberAmount: { color: palette.ink, fontSize: 12, fontWeight: '900', marginBottom: 5 }, status: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' }, statusPaid: { backgroundColor: palette.primarySoft }, statusUnpaid: { backgroundColor: palette.accentSoft }, statusText: { color: palette.primary, fontSize: 11, fontWeight: '800', marginLeft: 3 }, statusTextUnpaid: { color: palette.danger },
  noteCard: { borderRadius: 19, backgroundColor: palette.surface, padding: 15, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 }, note: { flex: 1, color: palette.ink, fontSize: 12, lineHeight: 19, marginLeft: 10 }, notice: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 15, backgroundColor: '#E9EAE5', padding: 12 }, noticeText: { flex: 1, color: palette.muted, fontSize: 12, lineHeight: 15, marginLeft: 7 },
});
