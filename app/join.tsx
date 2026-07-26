import { palette, shadow } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { EventInvitePreview } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function JoinScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { joinEventByCode, previewEventByCode } = useEvents();
  const [code, setCode] = useState(params.code?.trim().toUpperCase() ?? '');
  const [preview, setPreview] = useState<EventInvitePreview | null>(null);
  const [loading, setLoading] = useState(false);

  const updateCode = (value: string) => {
    setCode(value.toUpperCase());
    setPreview(null);
  };

  const confirmCode = async () => {
    setLoading(true);
    const result = await previewEventByCode(code);
    setLoading(false);
    if (result.error || !result.preview) return Alert.alert('イベントが見つかりません', result.error ?? '招待コードを確認してください。');
    setPreview(result.preview);
  };

  const join = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const result = await joinEventByCode(code);
      if (result.error) return Alert.alert('参加できませんでした', result.error);
      if (result.pending) return Alert.alert('参加申請を送りました', '主催者が承認するとイベントが表示されます。', [{ text: '閉じる', onPress: () => router.replace('/') }]);
      if (!result.eventId) return Alert.alert('参加できませんでした', '通信状態を確認して、もう一度お試しください。');
      if (result.refreshPending) return Alert.alert('イベントに参加しました', '参加は完了しています。一覧の更新に時間がかかっているため、ホームで再読み込みしてください。', [{ text: 'ホームへ', onPress: () => router.replace('/') }]);
      setTimeout(() => router.replace(`/event/${result.eventId}`), 0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.illustration}>
            <View style={styles.ring}><View style={styles.ticket}><Ionicons name={preview ? 'checkmark' : 'ticket'} size={37} color={palette.surface} /></View></View>
          </View>

          {!preview ? <>
            <Text style={styles.title}>招待コードで参加</Text>
            <Text style={styles.description}>コードを確認してから、イベント名と日時を見て参加を決められます。</Text>
            <View style={styles.codeWrap}>
              <TextInput accessibilityLabel="招待コード" value={code} onChangeText={updateCode} placeholder="招待コードを入力" placeholderTextColor="#A4AAA6" autoCapitalize="characters" autoCorrect={false} maxLength={64} style={styles.codeInput} selectionColor={palette.primary} returnKeyType="done" onSubmitEditing={confirmCode} />
              {code.length > 0 && <TouchableOpacity accessibilityRole="button" onPress={() => updateCode('')} accessibilityLabel="招待コードを消去"><Ionicons name="close-circle" size={22} color={palette.muted} /></TouchableOpacity>}
            </View>
            <TouchableOpacity accessibilityRole="button" style={[styles.primaryButton, (!code.trim() || loading) && styles.buttonDisabled]} onPress={confirmCode} disabled={!code.trim() || loading} activeOpacity={0.85}>
              <Text style={styles.primaryText}>{loading ? '確認中…' : 'イベントを確認'}</Text><Ionicons name="arrow-forward" size={19} color={palette.surface} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.scan} onPress={() => router.push('/scan')}><Ionicons name="qr-code-outline" size={18} color={palette.primary} /><Text style={styles.scanText}>QRコードを読み取る</Text></TouchableOpacity>
          </> : <>
            <Text style={styles.title}>このイベントに参加しますか？</Text>
            <Text style={styles.description}>表示された内容を確認して、参加する場合だけボタンを押してください。</Text>
            <View style={styles.previewCard}>
              <View style={styles.previewRow}><Ionicons name="sparkles-outline" size={21} color={palette.primary} /><View style={styles.previewCopy}><Text style={styles.previewLabel}>イベント名</Text><Text style={styles.previewValue}>{preview.title}</Text></View></View>
              <View style={styles.separator} />
              <View style={styles.previewRow}><Ionicons name="calendar-outline" size={21} color={palette.primary} /><View style={styles.previewCopy}><Text style={styles.previewLabel}>日時</Text><Text style={styles.previewValue}>{preview.dateLabel}</Text><Text style={styles.previewTime}>{preview.timeLabel}</Text></View></View>
            </View>
            <TouchableOpacity accessibilityRole="button" style={[styles.primaryButton, loading && styles.buttonDisabled]} onPress={join} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.primaryText}>{loading ? '参加処理中…' : '参加する'}</Text><Ionicons name="checkmark-circle-outline" size={20} color={palette.surface} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.backButton} onPress={() => setPreview(null)} disabled={loading}><Ionicons name="arrow-back" size={17} color={palette.primary} /><Text style={styles.backText}>コードを修正する</Text></TouchableOpacity>
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', paddingTop: 28, paddingBottom: 40 },
  illustration: { alignItems: 'center', marginBottom: 24 },
  ring: { width: 120, height: 120, borderRadius: 60, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  ticket: { width: 72, height: 72, borderRadius: 23, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  title: { textAlign: 'center', fontSize: 25, color: palette.ink, fontWeight: '800', marginBottom: 11 },
  description: { textAlign: 'center', fontSize: 13, lineHeight: 21, color: palette.muted, marginBottom: 26 },
  codeWrap: { minHeight: 64, borderRadius: 19, backgroundColor: palette.surface, borderWidth: 1.5, borderColor: palette.primary, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  codeInput: { flex: 1, fontSize: 18, color: palette.ink, textAlign: 'center', fontWeight: '800', letterSpacing: 2, paddingVertical: 16 },
  primaryButton: { minHeight: 57, borderRadius: 18, backgroundColor: palette.primary, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.4 }, primaryText: { color: palette.surface, fontSize: 15, fontWeight: '800' },
  scan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 19 }, scanText: { color: palette.primary, fontSize: 13, fontWeight: '700', marginLeft: 7 },
  previewCard: { backgroundColor: palette.surface, borderRadius: 22, paddingHorizontal: 18, marginBottom: 16, ...shadow },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 18 }, previewCopy: { flex: 1, marginLeft: 13 },
  previewLabel: { color: palette.muted, fontSize: 13, fontWeight: '700', marginBottom: 4 }, previewValue: { color: palette.ink, fontSize: 16, lineHeight: 23, fontWeight: '800' }, previewTime: { color: palette.primary, fontSize: 13, fontWeight: '700', marginTop: 4 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: palette.line },
  backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 }, backText: { color: palette.primary, fontSize: 13, fontWeight: '700', marginLeft: 6 },
});
