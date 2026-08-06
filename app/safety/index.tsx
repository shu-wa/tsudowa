import { palette } from '@/constants/theme';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { useEvents } from '@/context/event-context';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SafetyCenterScreen() {
  const { reports, blockedUsers, toggleBlockUser } = useEvents();
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}><View style={styles.heroIcon}><Ionicons name="shield-checkmark" size={30} color={palette.surface} /></View><Text style={styles.heroTitle}>安心して使うために</Text><Text style={styles.heroText}>通報したことやブロックしたことは相手に通知されません。</Text></View>
        <TouchableOpacity style={styles.reportButton} onPress={() => router.push('/safety/report')}><View style={styles.reportIcon}><Ionicons name="flag-outline" size={23} color={palette.accent} /></View><View style={styles.copy}><Text style={styles.rowTitle}>問題を通報する</Text><Text style={styles.rowText}>利用者、メッセージ、安全上の問題を運営へ報告</Text></View><Ionicons name="chevron-forward" size={18} color={palette.muted} /></TouchableOpacity>
        <Text style={styles.sectionTitle}>安全に関する情報</Text>
        <View style={styles.card}>
          <Row icon="people-outline" title="コミュニティガイドライン" sub="禁止される行為と対応方針" onPress={() => router.push('/legal/community')} />
          <Row icon="document-text-outline" title="利用規約" sub="サービス利用のルール" onPress={() => router.push('/legal/terms')} />
          <Row icon="mail-outline" title="安全・児童保護の連絡先" sub="専用窓口から運営へ連絡" onPress={() => router.push('/support' as Href)} />
        </View>
        <Text style={styles.sectionTitle}>ブロック中の利用者</Text>
        <View style={styles.card}>
          {blockedUsers.length === 0 && <View style={styles.empty}><Ionicons name="person-remove-outline" size={24} color={palette.muted} /><Text style={styles.emptyText}>ブロック中の利用者はいません</Text></View>}
          {blockedUsers.map((user) => <View key={user.key} style={styles.blocked}><View style={styles.blockAvatar}><Text style={styles.blockAvatarText}>{user.name.slice(0, 1)}</Text></View><View style={styles.copy}><Text style={styles.rowTitle}>{user.name}</Text><Text style={styles.rowText}>{new Date(user.blockedAt).toLocaleDateString('ja-JP')}から非表示</Text></View><TouchableOpacity style={styles.unblock} onPress={() => toggleBlockUser(user.name, user.userId)}><Text style={styles.unblockText}>解除</Text></TouchableOpacity></View>)}
        </View>
        <View style={styles.status}><Ionicons name="checkmark-circle-outline" size={20} color={palette.primary} /><Text style={styles.statusText}>この端末で送信済み: {reports.length}件</Text></View>
        <Text style={styles.emergency}>命や身体に差し迫った危険がある場合は、アプリへの通報ではなく地域の警察・緊急窓口へ連絡してください。</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, title, sub, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string; onPress: () => void }) { return <TouchableOpacity style={styles.row} onPress={onPress}><View style={styles.rowIcon}><Ionicons name={icon} size={20} color={palette.primary} /></View><View style={styles.copy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowText}>{sub}</Text></View><Ionicons name="chevron-forward" size={18} color={palette.muted} /></TouchableOpacity>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, content: { padding: 20, paddingBottom: 40 }, hero: { borderRadius: 25, backgroundColor: palette.primary, padding: 21 }, heroIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }, heroTitle: { color: palette.surface, fontSize: 22, fontWeight: '900', marginTop: 15 }, heroText: { color: '#D1E1D8', fontSize: 13, lineHeight: 17, marginTop: 6 },
  reportButton: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, backgroundColor: palette.surface, padding: 15, marginTop: 12 }, reportIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: palette.accentSoft, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, marginLeft: 12 }, rowTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' }, rowText: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 3 }, sectionTitle: { color: palette.ink, fontSize: 16, fontWeight: '900', marginTop: 24, marginBottom: 10 }, card: { borderRadius: 21, backgroundColor: palette.surface, overflow: 'hidden' }, row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 24 }, emptyText: { color: palette.muted, fontSize: 13, marginTop: 7 }, blocked: { flexDirection: 'row', alignItems: 'center', minHeight: 70, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, blockAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: palette.muted, alignItems: 'center', justifyContent: 'center' }, blockAvatarText: { color: palette.surface, fontWeight: '900' }, unblock: { backgroundColor: palette.canvas, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 }, unblockText: { color: palette.primary, fontSize: 12, fontWeight: '900' }, status: { flexDirection: 'row', justifyContent: 'center', marginTop: 17 }, statusText: { color: palette.primary, fontSize: 13, fontWeight: '800', marginLeft: 6 }, emergency: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18, paddingHorizontal: 8 },
});
