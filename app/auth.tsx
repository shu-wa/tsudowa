import { palette } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Mode = 'login' | 'signup';

export default function AuthScreen() {
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return Alert.alert('メールアドレスを確認してください');
    if (password.length < 8) return Alert.alert('パスワードを確認してください', '8文字以上で設定してください。');
    setLoading(true);
    const result = mode === 'signup' ? await signUp(email, password) : await signIn(email, password);
    setLoading(false);
    if (!result.ok) return Alert.alert('ログインできませんでした', result.message);
    if (result.needsEmailConfirmation) Alert.alert('確認メールを送りました', 'メール内のリンクを開いた後、この画面からログインしてください。', [{ text: 'ログインへ', onPress: () => setMode('login') }]);
  };

  const resetPassword = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return Alert.alert('先にメールアドレスを入力してください');
    setLoading(true); const result = await sendPasswordReset(email); setLoading(false);
    Alert.alert(result.ok ? '再設定メールを送りました' : '送信できませんでした', result.ok ? 'メールを確認してください。' : result.message);
  };

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
    <View style={styles.logo}><Ionicons name="sparkles" size={30} color={palette.surface} /></View><Text style={styles.brand}>DO EVENTER</Text><Text style={styles.title}>{mode === 'signup' ? 'アカウントを作成' : 'おかえりなさい'}</Text><Text style={styles.lead}>{mode === 'signup' ? 'メールアドレスで安全にイベントへ参加できます。' : '登録したメールアドレスでログインしてください。'}</Text>
    <View style={styles.segment}><TouchableOpacity style={[styles.segmentButton, mode === 'signup' && styles.segmentActive]} onPress={() => setMode('signup')}><Text style={[styles.segmentText, mode === 'signup' && styles.segmentTextActive]}>新規登録</Text></TouchableOpacity><TouchableOpacity style={[styles.segmentButton, mode === 'login' && styles.segmentActive]} onPress={() => setMode('login')}><Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>ログイン</Text></TouchableOpacity></View>
    <Text style={styles.label}>メールアドレス</Text><View style={styles.inputWrap}><Ionicons name="mail-outline" size={19} color={palette.muted} /><TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="you@example.com" placeholderTextColor="#9AA39E" /></View>
    <Text style={styles.label}>パスワード</Text><View style={styles.inputWrap}><Ionicons name="lock-closed-outline" size={19} color={palette.muted} /><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="8文字以上" placeholderTextColor="#9AA39E" /></View>
    {mode === 'login' && <TouchableOpacity style={styles.forgot} onPress={resetPassword}><Text style={styles.forgotText}>パスワードを忘れた場合</Text></TouchableOpacity>}
    <TouchableOpacity style={[styles.submit, loading && styles.disabled]} onPress={submit} disabled={loading}><Text style={styles.submitText}>{loading ? '処理中…' : mode === 'signup' ? '登録する' : 'ログイン'}</Text><Ionicons name="arrow-forward" size={18} color={palette.surface} /></TouchableOpacity>
    <View style={styles.security}><Ionicons name="shield-checkmark-outline" size={17} color={palette.primary} /><Text style={styles.securityText}>ログイン情報は安全に取り扱います。</Text></View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'center', padding: 25, paddingBottom: 40 }, logo: { width: 62, height: 62, borderRadius: 22, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 15 }, brand: { color: palette.accent, fontSize: 12, fontWeight: '900', letterSpacing: 2 }, title: { color: palette.ink, fontSize: 28, fontWeight: '900', marginTop: 7 }, lead: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 7, marginBottom: 24 }, segment: { flexDirection: 'row', backgroundColor: '#E7E8E2', borderRadius: 15, padding: 4, marginBottom: 23 }, segmentButton: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, segmentActive: { backgroundColor: palette.surface }, segmentText: { color: palette.muted, fontSize: 12, fontWeight: '800' }, segmentTextActive: { color: palette.primary }, label: { color: palette.ink, fontSize: 13, fontWeight: '800', marginBottom: 7 }, inputWrap: { height: 55, borderRadius: 17, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 16 }, input: { flex: 1, color: palette.ink, fontSize: 14, marginLeft: 9 }, forgot: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 14 }, forgotText: { color: palette.primary, fontSize: 13, fontWeight: '800' }, submit: { minHeight: 56, borderRadius: 18, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 5 }, disabled: { opacity: 0.55 }, submitText: { color: palette.surface, fontSize: 14, fontWeight: '900', marginRight: 8 }, security: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 17 }, securityText: { color: palette.muted, fontSize: 11, marginLeft: 6 },
});
