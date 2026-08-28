import { FormField } from '@/components/form-field';
import { KeyboardDismissBar } from '@/components/keyboard-dismiss-bar';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { Ionicons } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroupifyEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findEvent, createGroupFromEvent } = useEvents();
  const event = findEvent(id);
  const [groupName, setGroupName] = useState('');
  const [nextTitle, setNextTitle] = useState(event?.title ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!groupName.trim()) return Alert.alert('グループ名を入力してください');
    setSaving(true);
    const result = await createGroupFromEvent(id, groupName, nextTitle);
    setSaving(false);
    if (result.error) return Alert.alert('グループ化できませんでした', result.error);
    if (result.groupId) router.replace(`/group/${result.groupId}` as Href);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.icon}><Ionicons name="people-outline" size={27} color={palette.primary} /></View>
          <Text style={styles.title}>同じメンバーで続ける</Text>
          <Text style={styles.lead}>
            「{event?.title ?? 'イベント'}」をグループにまとめ、同じメンバーで次のイベントを日時未定として始めます。
          </Text>
          <FormField
            label="グループ名"
            icon="people-outline"
            value={groupName}
            onChangeText={setGroupName}
            placeholder="例：いつものキャンプ仲間"
            maxLength={80}
          />
          <View style={styles.gap} />
          <FormField
            label="次回イベント名"
            icon="calendar-outline"
            value={nextTitle}
            onChangeText={setNextTitle}
            placeholder="例：次回キャンプ"
            maxLength={140}
          />
          <View style={styles.note}>
            <Ionicons name="albums-outline" size={18} color={palette.primary} />
            <Text style={styles.noteText}>
              元のイベントはそのまま残ります。次回イベントには参加メンバーだけを引き継ぎ、チャット・集金・タイムフローは新しく始まります。
            </Text>
          </View>
        </View>
        <KeyboardDismissBar />
        <View style={styles.bottom}>
          <TouchableOpacity style={[styles.submit, saving && styles.disabled]} onPress={submit} disabled={saving}>
            <Text style={styles.submitText}>{saving ? '作成中…' : 'グループ化して次へ'}</Text>
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
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 23 },
  icon: { width: 52, height: 52, borderRadius: 8, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.ink, fontSize: 24, fontWeight: '800', marginTop: 18 },
  lead: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 24 },
  gap: { height: 18 },
  note: { flexDirection: 'row', alignItems: 'flex-start', borderLeftWidth: 3, borderLeftColor: palette.primary, padding: 13, marginTop: 22 },
  noteText: { flex: 1, color: palette.muted, fontSize: 12, lineHeight: 18, marginLeft: 8 },
  bottom: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, backgroundColor: palette.surface },
  submit: { minHeight: 53, borderRadius: 8, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  submitText: { color: palette.surface, fontSize: 15, fontWeight: '800', marginRight: 8 },
});
