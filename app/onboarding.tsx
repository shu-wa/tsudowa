import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { useAuth } from '@/context/auth-context';
import { NativeDateField } from '@/components/native-date-picker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const isAtLeast16 = (dateOfBirth: string) => {
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const birth = new Date(year, month - 1, day);
  if (!year || !month || !day || Number.isNaN(birth.getTime()) || birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) return false;
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age -= 1;
  return age >= 16;
};

export default function OnboardingScreen() {
  const { completeOnboarding } = useEvents();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [birthDateOpen, setBirthDateOpen] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [community, setCommunity] = useState(false);

  const nextFromProfile = () => {
    if (!name.trim()) return Alert.alert('表示名を入力してください');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return Alert.alert('メールアドレスを確認してください');
    if (!dateOfBirth || !isAtLeast16(dateOfBirth)) return Alert.alert('年齢を確認できません', 'Do Eventerは現在16歳以上の方を対象としています。生年月日を選択してください。');
    setStep(2);
  };
  const finish = () => {
    if (!terms || !privacy || !community) return Alert.alert('必須項目への同意が必要です', '各文書を確認し、3つの項目へ同意してください。');
    completeOnboarding({ name, email, dateOfBirth });
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.progress}>{[0, 1, 2].map((item) => <View key={item} style={[styles.progressBar, item <= step && styles.progressActive]} />)}</View>
        <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsVerticalScrollIndicator={false}>
          {step === 0 && <Welcome onNext={() => setStep(1)} />}
          {step === 1 && <>
            <View style={styles.stepIcon}><Ionicons name="person-add-outline" size={28} color={palette.primary} /></View><Text style={styles.eyebrow}>YOUR ACCOUNT</Text><Text style={styles.title}>最初の登録</Text><Text style={styles.lead}>イベント内で使う表示名と、本人確認に使う情報を登録します。</Text>
            <Input label="表示名" value={name} onChangeText={setName} placeholder="例：佐藤 美咲" autoFocus />
            <Input label="メールアドレス" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
            <NativeDateField label="生年月日" value={dateOfBirth} onChange={setDateOfBirth} open={birthDateOpen} onOpenChange={setBirthDateOpen} minimumDate={new Date(1900, 0, 1)} maximumDate={getMaximumBirthDate()} emptyLabel="生年月日を選択" iosDisplay="spinner" />
            <View style={styles.notice}><Ionicons name="lock-closed-outline" size={17} color={palette.primary} /><Text style={styles.noticeText}>生年月日は年齢確認のために使用し、プロフィールには公開されません。</Text></View>
            <PrimaryButton label="同意内容を確認" onPress={nextFromProfile} />
            <BackButton onPress={() => setStep(0)} />
          </>}
          {step === 2 && <>
            <View style={styles.stepIcon}><Ionicons name="shield-checkmark-outline" size={29} color={palette.primary} /></View><Text style={styles.eyebrow}>PRIVACY & SAFETY</Text><Text style={styles.title}>同意内容の確認</Text><Text style={styles.lead}>3つの文書をそれぞれ確認し、同意内容を選択してください。</Text>
            <ConsentRow checked={terms} onPress={() => setTerms(!terms)} title="利用規約に同意する" required document="terms" />
            <ConsentRow checked={privacy} onPress={() => setPrivacy(!privacy)} title="プライバシーポリシーに同意する" required document="privacy" />
            <ConsentRow checked={community} onPress={() => setCommunity(!community)} title="コミュニティガイドラインに同意する" required document="community" />
            <View style={styles.notice}><Ionicons name="checkmark-circle-outline" size={18} color={palette.primary} /><Text style={styles.noticeText}>広告SDKと任意の行動分析SDKは使用していません。</Text></View>
            <PrimaryButton label="登録してはじめる" onPress={finish} />
            <BackButton onPress={() => setStep(1)} />
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  const features = [
    { icon: 'calendar-outline' as const, title: '予定をひとつに', text: '日時、場所、タイムフローをまとめて共有' },
    { icon: 'people-outline' as const, title: '友達追加は不要', text: '招待コードからイベント単位でつながる' },
    { icon: 'shield-checkmark-outline' as const, title: '安全にコントロール', text: '公開範囲、通報、ブロック、データ削除' },
  ];
  return <><Image source={require('../assets/images/brand-icon.png')} style={styles.logo} accessibilityLabel="Do Eventer" /><Text style={styles.brand}>DO EVENTER</Text><Text style={styles.welcomeTitle}>イベントの連絡を、{`\n`}もっとシンプルに。</Text><Text style={styles.welcomeLead}>必要な人と、必要な期間だけつながるイベントコミュニケーション。</Text><View style={styles.features}>{features.map((feature) => <View key={feature.title} style={styles.feature}><View style={styles.featureIcon}><Ionicons name={feature.icon} size={22} color={palette.primary} /></View><View style={styles.featureCopy}><Text style={styles.featureTitle}>{feature.title}</Text><Text style={styles.featureText}>{feature.text}</Text></View></View>)}</View><PrimaryButton label="はじめる" onPress={onNext} /><Text style={styles.ageNote}>現在は16歳以上の方が利用できます</Text></>;
}

function Input({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) { return <View style={styles.inputGroup}><Text style={styles.inputLabel}>{label}</Text><TextInput {...props} style={styles.input} placeholderTextColor="#9AA39E" selectionColor={palette.primary} /></View>; }
function getMaximumBirthDate() { const date = new Date(); date.setFullYear(date.getFullYear() - 16); return date; }
function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) { return <TouchableOpacity accessibilityRole="button" style={styles.primaryButton} onPress={onPress}><Text style={styles.primaryText}>{label}</Text><Ionicons name="arrow-forward" size={19} color={palette.surface} /></TouchableOpacity>; }
function BackButton({ onPress }: { onPress: () => void }) { return <TouchableOpacity accessibilityRole="button" style={styles.back} onPress={onPress}><Ionicons name="arrow-back" size={16} color={palette.muted} /><Text style={styles.backText}>戻る</Text></TouchableOpacity>; }
function ConsentRow({ checked, onPress, title, required, document }: { checked: boolean; onPress: () => void; title: string; required?: boolean; document: 'terms' | 'privacy' | 'community' }) { return <View style={styles.consentRow}><TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={title} accessibilityState={{ checked }} style={[styles.checkbox, checked && styles.checkboxChecked]} onPress={onPress}>{checked && <Ionicons name="checkmark" size={18} color={palette.surface} />}</TouchableOpacity><View style={styles.consentCopy}><TouchableOpacity accessibilityRole="button" accessibilityLabel={title} onPress={onPress}><Text style={styles.consentTitle}>{title} {required && <Text style={styles.required}>必須</Text>}</Text></TouchableOpacity><TouchableOpacity accessibilityRole="link" onPress={() => router.push(`/legal/${document}`)}><Text style={styles.read}>全文を読む →</Text></TouchableOpacity></View></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 }, progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 8 }, progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#DADCD7' }, progressActive: { backgroundColor: palette.primary }, content: { flexGrow: 1, padding: 24, paddingTop: 35, paddingBottom: 35 },
  logo: { width: 78, height: 78, borderRadius: 24, marginTop: 25, marginBottom: 17 }, brand: { color: palette.accent, fontSize: 12, fontWeight: '900', letterSpacing: 2 }, welcomeTitle: { color: palette.ink, fontSize: 31, lineHeight: 41, fontWeight: '900', marginTop: 8 }, welcomeLead: { color: palette.muted, fontSize: 14, lineHeight: 22, marginTop: 10 }, features: { marginVertical: 30, gap: 11 }, feature: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, backgroundColor: palette.surface, padding: 13 }, featureIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }, featureCopy: { flex: 1, marginLeft: 12 }, featureTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' }, featureText: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }, ageNote: { color: palette.muted, fontSize: 12, textAlign: 'center', marginTop: 12 },
  stepIcon: { width: 57, height: 57, borderRadius: 19, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, eyebrow: { color: palette.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1.6 }, title: { color: palette.ink, fontSize: 28, fontWeight: '900', marginTop: 5 }, lead: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 8, marginBottom: 24 }, inputGroup: { marginBottom: 15 }, inputLabel: { color: palette.ink, fontSize: 13, fontWeight: '800', marginBottom: 7 }, input: { height: 54, borderRadius: 17, backgroundColor: palette.surface, paddingHorizontal: 15, color: palette.ink, fontSize: 14, borderWidth: 1, borderColor: palette.line }, notice: { flexDirection: 'row', borderRadius: 16, backgroundColor: palette.primarySoft, padding: 13, marginBottom: 22 }, noticeText: { flex: 1, color: palette.primary, fontSize: 12, lineHeight: 15, marginLeft: 8 },
  primaryButton: { minHeight: 57, borderRadius: 18, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 }, primaryText: { color: palette.surface, fontSize: 14, fontWeight: '900', marginRight: 9 }, back: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 17 }, backText: { color: palette.muted, fontSize: 13, fontWeight: '700', marginLeft: 5 },
  consentRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, backgroundColor: palette.surface, padding: 14, marginBottom: 10 }, checkbox: { width: 32, height: 32, borderRadius: 10, borderWidth: 2, borderColor: '#ABB4AF', alignItems: 'center', justifyContent: 'center' }, checkboxChecked: { backgroundColor: palette.primary, borderColor: palette.primary }, consentCopy: { flex: 1, marginLeft: 12 }, consentTitle: { color: palette.ink, fontSize: 14, lineHeight: 20, fontWeight: '800' }, required: { color: palette.accent, fontSize: 13 }, read: { color: palette.primary, fontSize: 12, fontWeight: '700', marginTop: 4 },
});
