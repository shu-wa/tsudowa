import { palette } from '@/constants/theme';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { useAuth } from '@/context/auth-context';
import { useEvents } from '@/context/event-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyCenterScreen() {
  const { reauthenticate } = useAuth();
  const { consentHistory, exportUserData, deleteLocalAccount } = useEvents();
  const [pendingAction, setPendingAction] = useState<'export' | 'delete' | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const requestReauthentication = (action: 'export' | 'delete') => {
    setPassword('');
    setError('');
    setPendingAction(action);
  };

  const runSecureAction = async () => {
    if (!pendingAction || busy) return;
    if (!password) { setError('現在のパスワードを入力してください。'); return; }
    setBusy(true);
    setError('');
    const result = await reauthenticate(password);
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    try {
      if (pendingAction === 'export') {
        const message = await exportUserData();
        setPendingAction(null);
        setPassword('');
        await Share.share({ title: 'TSUDOWA データ書き出し', message });
      } else {
        const deletionError = await deleteLocalAccount();
        if (deletionError) setError(deletionError);
        else {
          setPendingAction(null);
          setPassword('');
          router.replace('/onboarding');
        }
      }
    } catch {
      setError(pendingAction === 'export' ? '書き出しに失敗しました。もう一度お試しください。' : '削除に失敗しました。もう一度お試しください。');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = () => Alert.alert('アカウントを削除しますか？', 'プロフィール、参加情報、メッセージ、支払状態などが削除されます。あなたが主催するイベントと、そのイベント内の共有データも参加者全員から削除されます。この操作は元に戻せません。', [
    { text: 'キャンセル', style: 'cancel' },
    { text: '削除を続ける', style: 'destructive', onPress: () => requestReauthentication('delete') },
  ]);
  return <SafeAreaView style={styles.safe} edges={['bottom']}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}><View style={styles.heroIcon}><Ionicons name="lock-closed" size={27} color={palette.surface} /></View><Text style={styles.heroTitle}>あなたのデータは、あなたが管理</Text><Text style={styles.heroText}>保存されているデータの書き出しと、アカウント削除をいつでも開始できます。</Text></View>
    <View style={styles.dataNotice}><Ionicons name="checkmark-circle-outline" size={21} color={palette.primary} /><Text style={styles.dataNoticeText}>広告SDKと任意の行動分析SDKは使用していません。</Text></View>
    <Text style={styles.sectionTitle}>ポリシーと権利</Text><View style={styles.card}><LinkRow icon="document-text-outline" title="プライバシーポリシー" onPress={() => router.push('/legal/privacy')} /><LinkRow icon="reader-outline" title="利用規約" onPress={() => router.push('/legal/terms')} /><LinkRow icon="people-outline" title="コミュニティガイドライン" onPress={() => router.push('/legal/community')} /><LinkRow icon="download-outline" title="自分のデータを書き出す" onPress={() => requestReauthentication('export')} /></View>
    <Text style={styles.sectionTitle}>同意履歴</Text><View style={styles.card}>{consentHistory.length === 0 ? <Text style={styles.empty}>記録はまだありません</Text> : consentHistory.slice().reverse().slice(0, 8).map((record) => <View key={record.id} style={styles.consent}><View style={[styles.consentDot, { backgroundColor: record.accepted ? palette.primary : palette.muted }]} /><View style={styles.consentCopy}><Text style={styles.consentTitle}>{documentLabel(record.document)} · {record.accepted ? '同意' : '拒否／撤回'}</Text><Text style={styles.consentDate}>{new Date(record.recordedAt).toLocaleString('ja-JP')} · v{record.version}</Text></View></View>)}</View>
    <TouchableOpacity accessibilityRole="button" style={styles.delete} onPress={deleteAccount}><Ionicons name="trash-outline" size={18} color={palette.danger} /><Text style={styles.deleteText}>アカウントとデータを削除</Text></TouchableOpacity><Text style={styles.note}>削除後は復元できません。法令上または安全上の理由で保持が必要な情報は、目的を限定して必要な期間のみ保持します。</Text>
  </ScrollView><Modal visible={pendingAction !== null} transparent animationType="fade" onRequestClose={() => !busy && setPendingAction(null)}><KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.modalCard}><View style={[styles.modalIcon, pendingAction === 'delete' && styles.modalIconDanger]}><Ionicons name={pendingAction === 'delete' ? 'trash-outline' : 'shield-checkmark-outline'} size={24} color={pendingAction === 'delete' ? palette.danger : palette.primary} /></View><Text style={styles.modalTitle}>{pendingAction === 'delete' ? '本人確認して完全に削除' : '本人確認して書き出す'}</Text><Text style={styles.modalText}>安全のため、現在のパスワードをもう一度入力してください。パスワードは保存されません。</Text><TextInput accessibilityLabel="現在のパスワード" style={[styles.passwordInput, error && styles.passwordInputError]} value={password} onChangeText={(value) => { setPassword(value); setError(''); }} placeholder="現在のパスワード" placeholderTextColor="#9AA39E" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" editable={!busy} onSubmitEditing={runSecureAction} /><Text style={styles.modalError}>{error}</Text><TouchableOpacity accessibilityRole="button" style={[styles.confirmButton, pendingAction === 'delete' && styles.confirmButtonDanger, busy && styles.confirmButtonDisabled]} onPress={runSecureAction} disabled={busy}>{busy ? <ActivityIndicator color={palette.surface} /> : <Text style={styles.confirmButtonText}>{pendingAction === 'delete' ? '確認して完全に削除' : '確認して書き出す'}</Text>}</TouchableOpacity><TouchableOpacity accessibilityRole="button" style={styles.cancelButton} onPress={() => setPendingAction(null)} disabled={busy}><Text style={styles.cancelButtonText}>キャンセル</Text></TouchableOpacity></View></KeyboardAvoidingView></Modal></SafeAreaView>;
}

function documentLabel(value: 'terms' | 'privacy' | 'community' | 'analytics') { return ({ terms: '利用規約', privacy: 'プライバシー', community: 'ガイドライン', analytics: '利用状況分析' } as const)[value]; }
function LinkRow({ icon, title, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; onPress: () => void }) { return <TouchableOpacity style={styles.row} onPress={onPress}><View style={styles.icon}><Ionicons name={icon} size={19} color={palette.primary} /></View><Text style={[styles.rowTitle, styles.linkTitle]}>{title}</Text><Ionicons name="chevron-forward" size={18} color={palette.muted} /></TouchableOpacity>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, content: { padding: 20, paddingBottom: 40 }, hero: { borderRadius: 24, backgroundColor: palette.primary, padding: 21 }, heroIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }, heroTitle: { color: palette.surface, fontSize: 21, lineHeight: 28, fontWeight: '900', marginTop: 14 }, heroText: { color: '#CEE0D6', fontSize: 13, lineHeight: 20, marginTop: 6 }, dataNotice: { flexDirection: 'row', alignItems: 'center', borderRadius: 17, backgroundColor: palette.primarySoft, padding: 14, marginTop: 12 }, dataNoticeText: { flex: 1, color: palette.primary, fontSize: 13, lineHeight: 19, marginLeft: 9, fontWeight: '700' }, sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: '900', marginTop: 23, marginBottom: 10 }, card: { borderRadius: 21, backgroundColor: palette.surface, overflow: 'hidden' }, row: { minHeight: 65, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, rowTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' }, icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }, linkTitle: { flex: 1, marginLeft: 11 }, consent: { flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, consentDot: { width: 8, height: 8, borderRadius: 4 }, consentCopy: { flex: 1, marginLeft: 10 }, consentTitle: { color: palette.ink, fontSize: 13, fontWeight: '800' }, consentDate: { color: palette.muted, fontSize: 12, marginTop: 3 }, empty: { color: palette.muted, fontSize: 13, textAlign: 'center', padding: 20 }, delete: { minHeight: 55, borderRadius: 17, borderWidth: 1, borderColor: '#E3B8B9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 25 }, deleteText: { color: palette.danger, fontSize: 14, fontWeight: '900', marginLeft: 7 }, note: { color: palette.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 11, paddingHorizontal: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(12, 20, 16, 0.48)', justifyContent: 'center', padding: 22 }, modalCard: { borderRadius: 24, backgroundColor: palette.surface, padding: 21 }, modalIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }, modalIconDanger: { backgroundColor: '#F8E4E4' }, modalTitle: { color: palette.ink, fontSize: 19, fontWeight: '900', marginTop: 14 }, modalText: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 7 }, passwordInput: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.canvas, color: palette.ink, fontSize: 16, paddingHorizontal: 15, marginTop: 17 }, passwordInputError: { borderColor: palette.danger }, modalError: { minHeight: 20, color: palette.danger, fontSize: 12, marginTop: 6 }, confirmButton: { minHeight: 52, borderRadius: 16, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, confirmButtonDanger: { backgroundColor: palette.danger }, confirmButtonDisabled: { opacity: 0.6 }, confirmButtonText: { color: palette.surface, fontSize: 14, fontWeight: '900' }, cancelButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 5 }, cancelButtonText: { color: palette.muted, fontSize: 14, fontWeight: '800' },
});
