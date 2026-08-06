import { KeyboardDismissBar } from '@/components/keyboard-dismiss-bar';
import { NativeDateField, toLocalDate, toDateString } from '@/components/native-date-picker';
import { NativeTimeField } from '@/components/native-time-field';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NewAvailabilityCandidateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findEvent, addDateCandidate } = useEvents();
  const event = findEvent(id);
  const [date, setDate] = useState(event?.startDate ?? toDateString(new Date()));
  const [startTime, setStartTime] = useState(event?.startTime ?? '09:00');
  const [note, setNote] = useState('');
  const [openField, setOpenField] = useState<'date' | 'time' | null>(null);
  const [saving, setSaving] = useState(false);

  if (!event) return <SafeAreaView style={styles.empty}><Text>イベントが見つかりません</Text></SafeAreaView>;

  const save = async () => {
    setSaving(true);
    const error = await addDateCandidate(event.id, { date, startTime, note: note.trim() || undefined });
    setSaving(false);
    if (error) return Alert.alert('候補日を追加できません', error);
    router.back();
  };

  return <SafeAreaView style={styles.safe} edges={['bottom']}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <View style={styles.guide}><Ionicons name="people-outline" size={21} color={palette.primary} /><View style={styles.guideCopy}><Text style={styles.guideTitle}>参加者へ候補日を提示</Text><Text style={styles.guideText}>追加後、参加者は ○・△・× で都合を回答できます。</Text></View></View>
      <View style={styles.form}>
        <NativeDateField label="候補日" value={date} onChange={setDate} open={openField === 'date'} onOpenChange={(open) => setOpenField(open ? 'date' : null)} minimumDate={toLocalDate(toDateString(new Date()))} />
        <NativeTimeField label="開始予定時刻" value={startTime} onChange={setStartTime} open={openField === 'time'} onOpenChange={(open) => setOpenField(open ? 'time' : null)} />
        <Text style={styles.label}>メモ（任意）</Text>
        <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="例：雨天の場合は翌週へ延期" placeholderTextColor="#9AA39E" maxLength={240} />
      </View>
      <KeyboardDismissBar />
      <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color={palette.surface} /> : <><Ionicons name="add-circle-outline" size={20} color={palette.surface} /><Text style={styles.buttonText}>候補日を追加する</Text></>}</TouchableOpacity>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 }, content: { padding: 20, paddingBottom: 38 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas },
  guide: { borderRadius: 19, backgroundColor: palette.primarySoft, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, guideCopy: { flex: 1, marginLeft: 11 }, guideTitle: { color: palette.ink, fontSize: 13, fontWeight: '900' }, guideText: { color: palette.muted, fontSize: 12, lineHeight: 15, marginTop: 3 },
  form: { borderRadius: 22, backgroundColor: palette.surface, padding: 15 }, label: { color: palette.ink, fontSize: 12, fontWeight: '800', marginBottom: 7 }, input: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 13, color: palette.ink, fontSize: 13 },
  button: { minHeight: 56, borderRadius: 18, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, buttonDisabled: { opacity: 0.65 }, buttonText: { color: palette.surface, fontSize: 14, fontWeight: '900' },
});
