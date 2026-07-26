import { legalConfig } from '@/constants/legal';
import { palette } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SupportScreen() {
  const contact = async (subject: string, body = '') => {
    if (!legalConfig.supportEmail) {
      Alert.alert('連絡先を確認できません', 'ログイン後、安全センターまたはプライバシーセンターをご利用ください。');
      return;
    }
    await Linking.openURL(`mailto:${legalConfig.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}><View style={styles.heroIcon}><Ionicons name="help-buoy-outline" size={28} color={palette.surface} /></View><Text style={styles.title}>サポート</Text><Text style={styles.lead}>使い方、プライバシー、安全上の問題について連絡できます。</Text></View>
        <Text style={styles.sectionTitle}>お問い合わせ</Text>
        <View style={styles.card}>
          <Action icon="mail-outline" title="一般的な問い合わせ" text="操作方法、不具合、改善提案" onPress={() => contact('TSUDOWA お問い合わせ')} />
          <Action icon="shield-checkmark-outline" title="安全・児童保護の連絡" text="危険な行為、児童の搾取、緊急性の高い問題" onPress={() => contact('TSUDOWA 安全・児童保護に関する連絡')} />
          <Action icon="lock-closed-outline" title="プライバシーの問い合わせ" text="データの確認、訂正、削除" onPress={() => contact('TSUDOWA プライバシーに関する問い合わせ')} />
          <Action icon="flag-outline" title="違法コンテンツを通知" text="対象、理由、確認できる情報を運営へ通知" onPress={() => contact('TSUDOWA 違法コンテンツの通知', '対象のイベント・利用者・メッセージ:\n違法と考える理由:\n確認に必要な補足情報:\n通知結果を受け取る連絡先:')} />
          <Action icon="refresh-outline" title="モデレーション判断へ異議申立て" text="削除、制限、停止の理由確認と再審査" onPress={() => contact('TSUDOWA モデレーション判断への異議申立て', '対象のアカウント・イベント・メッセージ:\n通知された判断:\n再審査を求める理由:')} />
        </View>
        <Text style={styles.contact}>運営者: {legalConfig.operatorName || 'TSUDOWA'}{'\n'}連絡先: {legalConfig.supportEmail || 'アプリ内サポート'}</Text>
        <Text style={styles.sectionTitle}>公開文書</Text>
        <View style={styles.card}>
          <Action icon="reader-outline" title="利用規約" text="サービスの利用条件" onPress={() => router.push('/terms' as Href)} />
          <Action icon="document-text-outline" title="プライバシーポリシー" text="データの取扱い" onPress={() => router.push('/privacy' as Href)} />
          <Action icon="people-outline" title="コミュニティガイドライン" text="禁止行為と安全基準" onPress={() => router.push('/community-guidelines' as Href)} />
          <Action icon="person-remove-outline" title="アカウント削除" text="削除手順と対象データ" onPress={() => router.push('/account-deletion' as Href)} />
          <Action icon="code-slash-outline" title="第三者ソフトウェア" text="ライセンスと地図サービス" onPress={() => router.push('/acknowledgements' as Href)} />
        </View>
        <Text style={styles.emergency}>生命や身体への差し迫った危険がある場合は、この窓口だけに頼らず、地域の警察・緊急機関へ連絡してください。</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ icon, title, text, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; text: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={21} color={palette.primary} /></View>
      <View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowText}>{text}</Text></View>
      <Ionicons name="chevron-forward" size={18} color={palette.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: 20, paddingBottom: 44 },
  hero: { borderRadius: 24, backgroundColor: palette.primary, padding: 22 },
  heroIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.surface, fontSize: 25, fontWeight: '900', marginTop: 14 },
  lead: { color: '#D4E4DB', fontSize: 14, lineHeight: 21, marginTop: 7 },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '900', marginTop: 24, marginBottom: 10 },
  card: { borderRadius: 21, backgroundColor: palette.surface, overflow: 'hidden' },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  rowIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, marginHorizontal: 12 },
  rowTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  rowText: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  contact: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 12, paddingHorizontal: 4 },
  emergency: { color: palette.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 20, paddingHorizontal: 8 },
});
