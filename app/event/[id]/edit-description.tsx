import { RefreshableScrollView } from '@/components/refreshable-scroll-view';
import { palette } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useEvents } from '@/context/event-context';
import { isEventArchived } from '@/lib/event-display';
import { isEventManager } from '@/lib/event-permissions';
import { EventItem } from '@/types/event';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditEventDescriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findEvent } = useEvents();
  const event = findEvent(id);
  if (!event) return <SafeAreaView style={styles.safe}><Text>イベントが見つかりません</Text></SafeAreaView>;
  return <DescriptionForm key={event.id} event={event} />;
}

function DescriptionForm({ event }: { event: EventItem }) {
  const { updateEventDescription, profile } = useEvents();
  const { user } = useAuth();
  const [description, setDescription] = useState(event.description ?? '');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const canEdit = isEventManager(event, user?.id, profile.name) && !isEventArchived(event);
  const save = async () => {
    if (!canEdit || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const error = await updateEventDescription(event.id, description);
      if (error) return Alert.alert('保存できませんでした', error);
      router.back();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <RefreshableScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={styles.label}>イベントについて</Text>
          <TextInput accessibilityLabel="イベントの説明" style={styles.input} value={description} onChangeText={setDescription} multiline textAlignVertical="top" editable={canEdit && !saving} placeholder="持ち物や連絡事項を書きましょう" placeholderTextColor={palette.muted} />
          <Text style={styles.hint}>{Array.from(description).length.toLocaleString()} / 5,000文字</Text>
        </RefreshableScrollView>
        <View style={styles.bottom}><TouchableOpacity accessibilityRole="button" disabled={!canEdit || saving} style={[styles.save, (!canEdit || saving) && { opacity: 0.5 }]} onPress={save}><Text style={styles.saveText}>{saving ? '保存中…' : canEdit ? '変更を保存' : '閲覧のみ'}</Text></TouchableOpacity></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: 20 },
  label: { color: palette.ink, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  input: { minHeight: 220, backgroundColor: palette.surface, color: palette.ink, borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 14, fontSize: 16, lineHeight: 24 },
  hint: { color: palette.muted, fontSize: 13, marginTop: 8, textAlign: 'right' },
  bottom: { padding: 14, backgroundColor: palette.surface },
  save: { minHeight: 54, borderRadius: 17, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: palette.surface, fontSize: 14, fontWeight: '900' },
});
