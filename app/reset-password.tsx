import { palette } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const { session, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!session) return Alert.alert('再設定リンクを確認できません', 'メール内のリンクをもう一度開いてください。');
    if (password.length < 8) return Alert.alert('8文字以上のパスワードを入力してください');
    if (password !== confirm) return Alert.alert('確認用パスワードが一致しません');
    setLoading(true); const result = await updatePassword(password); setLoading(false);
    if (!result.ok) return Alert.alert('変更できませんでした', result.message);
    Alert.alert('パスワードを変更しました', '新しいパスワードを利用できます。', [{ text: 'アプリへ戻る', onPress: () => router.replace('/') }]);
  };
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={styles.icon}><Ionicons name="key-outline" size={31} color={palette.primary} /></View><Text style={styles.title}>新しいパスワード</Text><Text style={styles.lead}>他のサービスで使っていない、8文字以上のパスワードを設定してください。</Text><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="新しいパスワード" placeholderTextColor="#9AA39E" /><TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="もう一度入力" placeholderTextColor="#9AA39E" /><TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={submit} disabled={loading}><Text style={styles.buttonText}>{loading ? '変更中…' : 'パスワードを変更'}</Text></TouchableOpacity></KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: palette.canvas }, content: { flex: 1, justifyContent: 'center', padding: 25 }, icon: { width: 61, height: 61, borderRadius: 21, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 17 }, title: { color: palette.ink, fontSize: 26, fontWeight: '900' }, lead: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 7, marginBottom: 24 }, input: { height: 55, borderRadius: 17, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, color: palette.ink, paddingHorizontal: 15, marginBottom: 12 }, button: { height: 55, borderRadius: 18, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginTop: 7 }, disabled: { opacity: 0.55 }, buttonText: { color: palette.surface, fontSize: 14, fontWeight: '900' } });
