import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyCenterScreen() {
  const { consentHistory, exportUserData, deleteLocalAccount } = useEvents();
  const exportData = async () => {
    try { await Share.share({ title: 'Do Eventer データ書き出し', message: await exportUserData() }); }
    catch { Alert.alert('書き出しに失敗しました'); }
  };
  const deleteAccount = () => Alert.alert('アカウントを削除しますか？', 'プロフィール、参加情報、メッセージ、支払状態などが削除されます。あなたが主催するイベントと、そのイベント内の共有データも参加者全員から削除されます。この操作は元に戻せません。', [
    { text: 'キャンセル', style: 'cancel' },
    { text: '削除を続ける', style: 'destructive', onPress: () => Alert.alert('最終確認', '本当にすべて削除しますか？', [
      { text: '戻る', style: 'cancel' },
      { text: '完全に削除', style: 'destructive', onPress: async () => { const error = await deleteLocalAccount(); if (error) Alert.alert('削除できませんでした', error); else router.replace('/onboarding'); } },
    ]) },
  ]);
  return <SafeAreaView style={styles.safe} edges={['bottom']}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}><View style={styles.heroIcon}><Ionicons name="lock-closed" size={27} color={palette.surface} /></View><Text style={styles.heroTitle}>あなたのデータは、あなたが管理</Text><Text style={styles.heroText}>保存されているデータの書き出しと、アカウント削除をいつでも開始できます。</Text></View>
    <View style={styles.dataNotice}><Ionicons name="checkmark-circle-outline" size={21} color={palette.primary} /><Text style={styles.dataNoticeText}>広告SDKと任意の行動分析SDKは使用していません。</Text></View>
    <Text style={styles.sectionTitle}>ポリシーと権利</Text><View style={styles.card}><LinkRow icon="document-text-outline" title="プライバシーポリシー" onPress={() => router.push('/legal/privacy')} /><LinkRow icon="reader-outline" title="利用規約" onPress={() => router.push('/legal/terms')} /><LinkRow icon="people-outline" title="コミュニティガイドライン" onPress={() => router.push('/legal/community')} /><LinkRow icon="download-outline" title="自分のデータを書き出す" onPress={exportData} /></View>
    <Text style={styles.sectionTitle}>同意履歴</Text><View style={styles.card}>{consentHistory.length === 0 ? <Text style={styles.empty}>記録はまだありません</Text> : consentHistory.slice().reverse().slice(0, 8).map((record) => <View key={record.id} style={styles.consent}><View style={[styles.consentDot, { backgroundColor: record.accepted ? palette.primary : palette.muted }]} /><View style={styles.consentCopy}><Text style={styles.consentTitle}>{documentLabel(record.document)} · {record.accepted ? '同意' : '拒否／撤回'}</Text><Text style={styles.consentDate}>{new Date(record.recordedAt).toLocaleString('ja-JP')} · v{record.version}</Text></View></View>)}</View>
    <TouchableOpacity accessibilityRole="button" style={styles.delete} onPress={deleteAccount}><Ionicons name="trash-outline" size={18} color={palette.danger} /><Text style={styles.deleteText}>アカウントとデータを削除</Text></TouchableOpacity><Text style={styles.note}>削除後は復元できません。法令上または安全上の理由で保持が必要な情報は、目的を限定して必要な期間のみ保持します。</Text>
  </ScrollView></SafeAreaView>;
}

function documentLabel(value: 'terms' | 'privacy' | 'community' | 'analytics') { return ({ terms: '利用規約', privacy: 'プライバシー', community: 'ガイドライン', analytics: '利用状況分析' } as const)[value]; }
function LinkRow({ icon, title, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; onPress: () => void }) { return <TouchableOpacity style={styles.row} onPress={onPress}><View style={styles.icon}><Ionicons name={icon} size={19} color={palette.primary} /></View><Text style={[styles.rowTitle, styles.linkTitle]}>{title}</Text><Ionicons name="chevron-forward" size={18} color={palette.muted} /></TouchableOpacity>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, content: { padding: 20, paddingBottom: 40 }, hero: { borderRadius: 24, backgroundColor: palette.primary, padding: 21 }, heroIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }, heroTitle: { color: palette.surface, fontSize: 21, lineHeight: 28, fontWeight: '900', marginTop: 14 }, heroText: { color: '#CEE0D6', fontSize: 13, lineHeight: 20, marginTop: 6 }, dataNotice: { flexDirection: 'row', alignItems: 'center', borderRadius: 17, backgroundColor: palette.primarySoft, padding: 14, marginTop: 12 }, dataNoticeText: { flex: 1, color: palette.primary, fontSize: 13, lineHeight: 19, marginLeft: 9, fontWeight: '700' }, sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: '900', marginTop: 23, marginBottom: 10 }, card: { borderRadius: 21, backgroundColor: palette.surface, overflow: 'hidden' }, row: { minHeight: 65, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, rowTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' }, icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }, linkTitle: { flex: 1, marginLeft: 11 }, consent: { flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, consentDot: { width: 8, height: 8, borderRadius: 4 }, consentCopy: { flex: 1, marginLeft: 10 }, consentTitle: { color: palette.ink, fontSize: 13, fontWeight: '800' }, consentDate: { color: palette.muted, fontSize: 12, marginTop: 3 }, empty: { color: palette.muted, fontSize: 13, textAlign: 'center', padding: 20 }, delete: { minHeight: 55, borderRadius: 17, borderWidth: 1, borderColor: '#E3B8B9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 25 }, deleteText: { color: palette.danger, fontSize: 14, fontWeight: '900', marginLeft: 7 }, note: { color: palette.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 11, paddingHorizontal: 8 },
});
