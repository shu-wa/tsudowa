import { legalConfig } from '@/constants/legal';
import { palette } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AccountDeletionScreen() {
  const { session } = useAuth();
  const requestByEmail = async () => {
    if (!legalConfig.supportEmail) {
      Alert.alert('連絡先を確認できません', 'アプリ内のプライバシーセンターから削除を開始してください。');
      return;
    }
    const subject = encodeURIComponent('TSUDOWA アカウント削除依頼');
    const body = encodeURIComponent('登録メールアドレス：\n\nアカウント削除を依頼します。本人確認に必要な案内を送ってください。');
    await Linking.openURL(`mailto:${legalConfig.supportEmail}?subject=${subject}&body=${body}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="person-remove-outline" size={28} color={palette.surface} /></View>
          <Text style={styles.title}>アカウントとデータの削除</Text>
          <Text style={styles.lead}>削除方法、対象データ、保持される可能性がある情報を説明します。</Text>
        </View>

        <InfoCard number="1" title="アプリから削除">
          ログイン後、「マイページ」→「プライバシーセンター」→「アカウントとデータを削除」から開始します。最終確認後にアカウントが削除され、元に戻せません。
        </InfoCard>
        <InfoCard number="2" title="アプリを利用できない場合">
          下の「メールで削除を依頼」から、登録メールアドレスを記載してご連絡ください。第三者による不正な削除を防ぐため、本人確認をお願いすることがあります。
        </InfoCard>
        <InfoCard number="3" title="削除されるデータ">
          アカウント、プロフィール、参加情報、作成したメッセージ、支払状態、同意履歴、ブロック情報、提出した通報などが削除対象です。あなたが主催するイベントと、そのイベント内の予定・チャット・集金情報も参加者全員から削除されます。
        </InfoCard>
        <InfoCard number="4" title="保持される可能性があるデータ">
          法令上の義務、セキュリティ、不正利用防止、未解決の安全調査に必要な最小限の情報は、目的を限定して必要な期間だけ保持する場合があります。バックアップは通常の更新サイクルで上書きされます。
        </InfoCard>

        {session ? (
          <TouchableOpacity accessibilityRole="button" style={styles.primary} onPress={() => router.push('/privacy-center')}>
            <Ionicons name="trash-outline" size={20} color={palette.surface} />
            <Text style={styles.primaryText}>アプリ内で削除を開始</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity accessibilityRole="link" style={styles.secondary} onPress={requestByEmail}>
          <Ionicons name="mail-outline" size={20} color={palette.primary} />
          <Text style={styles.secondaryText}>メールで削除を依頼</Text>
        </TouchableOpacity>
        <Text style={styles.note}>通常の問い合わせ先: {legalConfig.supportEmail || 'アプリ内のプライバシーセンター'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({ number, title, children }: { number: string; title: string; children: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.number}><Text style={styles.numberText}>{number}</Text></View>
      <View style={styles.cardCopy}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardBody}>{children}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: 20, paddingBottom: 44 },
  hero: { borderRadius: 24, backgroundColor: palette.primary, padding: 22, marginBottom: 10 },
  heroIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.surface, fontSize: 24, lineHeight: 31, fontWeight: '900', marginTop: 14 },
  lead: { color: '#D4E4DB', fontSize: 14, lineHeight: 21, marginTop: 7 },
  card: { flexDirection: 'row', borderRadius: 20, backgroundColor: palette.surface, padding: 16, marginTop: 10 },
  number: { width: 32, height: 32, borderRadius: 11, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: palette.primary, fontSize: 14, fontWeight: '900' },
  cardCopy: { flex: 1, marginLeft: 12 },
  cardTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  cardBody: { color: palette.muted, fontSize: 14, lineHeight: 22, marginTop: 6 },
  primary: { minHeight: 56, borderRadius: 18, backgroundColor: palette.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryText: { color: palette.surface, fontSize: 15, fontWeight: '900', marginLeft: 8 },
  secondary: { minHeight: 56, borderRadius: 18, borderWidth: 1, borderColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { color: palette.primary, fontSize: 15, fontWeight: '900', marginLeft: 8 },
  note: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
});
