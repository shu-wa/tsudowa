import { FormField } from '@/components/form-field';
import { KeyboardDismissBar } from '@/components/keyboard-dismiss-bar';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NewGroupEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findGroup, addEventToGroup } = useEvents();
  const group = findGroup(id);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return Alert.alert('イベント名を入力してください');
    setSaving(true);
    const result = await addEventToGroup(id, title);
    setSaving(false);
    if (result.error) return Alert.alert('イベントを追加できませんでした', result.error);
    if (result.eventId) router.replace(`/event/${result.eventId}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.icon}><Ionicons name="calendar-outline" size={26} color={palette.primary} /></View>
          <Text style={styles.title}>次のイベントを始める</Text>
          <Text style={styles.lead}>
            {group?.name ?? 'このグループ'}のメンバーが参加した、日時未定のイベントを作成します。
          </Text>
          <FormField
            label="イベント名"
            icon="calendar-outline"
            value={title}
            onChangeText={setTitle}
            placeholder="例：秋のキャンプ"
            maxLength={140}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={18} color={palette.primary} />
            <Text style={styles.noteText}>作成後に、月間カレンダーから日時を設定できます。</Text>
          </View>
        </View>
        <KeyboardDismissBar />
        <View style={styles.bottom}>
          <TouchableOpacity style={[styles.submit, saving && styles.disabled]} onPress={submit} disabled={saving}>
            <Text style={styles.submitText}>{saving ? '作成中…' : 'イベントを作成'}</Text>
            {!saving ? <Ionicons name="arrow-forward" size={18} color={palette.surface} /> : null}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  icon: { width: 52, height: 52, borderRadius: 8, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.ink, fontSize: 24, fontWeight: '800', marginTop: 18 },
  lead: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 25 },
  note: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: palette.primary, padding: 13, marginTop: 20 },
  noteText: { flex: 1, color: palette.muted, fontSize: 12, lineHeight: 18, marginLeft: 8 },
  bottom: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, backgroundColor: palette.surface },
  submit: { minHeight: 53, borderRadius: 8, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  submitText: { color: palette.surface, fontSize: 15, fontWeight: '800', marginRight: 8 },
});
