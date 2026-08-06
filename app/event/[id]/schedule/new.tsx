import { FormField } from '@/components/form-field';
import { MonthDatePicker } from '@/components/month-date-picker';
import { NativeTimeField } from '@/components/native-time-field';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { isEventManager } from '@/lib/event-permissions';
import { ScheduleItem } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const types: { value: ScheduleItem['type']; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'activity', label: 'アクティビティ', icon: 'flag-outline' },
  { value: 'move', label: '移動', icon: 'navigate-outline' },
  { value: 'food', label: '食事', icon: 'restaurant-outline' },
  { value: 'stay', label: '宿泊', icon: 'bed-outline' },
];

export default function ScheduleItemEditorScreen() {
  const { id, scheduleId, day: requestedDay } = useLocalSearchParams<{ id: string; scheduleId?: string; day?: string }>();
  const { findEvent, addScheduleItem, updateScheduleItem, profile } = useEvents();
  const { user } = useAuth();
  const event = findEvent(id);
  const editingItem = event?.schedule.find((item) => item.id === scheduleId);
  const [day, setDay] = useState(editingItem?.day ?? requestedDay ?? event?.startDate ?? '');
  const [time, setTime] = useState(editingItem?.time ?? event?.startTime ?? '09:00');
  const [timeOpen, setTimeOpen] = useState(false);
  const [title, setTitle] = useState(editingItem?.title ?? '');
  const [note, setNote] = useState(editingItem?.note ?? '');
  const [type, setType] = useState<ScheduleItem['type']>(editingItem?.type ?? 'activity');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingItem) return;
    setDay(editingItem.day);
    setTime(editingItem.time);
    setTitle(editingItem.title);
    setNote(editingItem.note ?? '');
    setType(editingItem.type);
  }, [editingItem]);

  useEffect(() => {
    if (!event || editingItem) return;
    if (!day) setDay(requestedDay ?? event.startDate);
    if (!time) setTime(event.startTime ?? '09:00');
  }, [day, editingItem, event, requestedDay, time]);

  if (!event) return <SafeAreaView style={styles.empty}><Text style={styles.emptyText}>イベントが見つかりません</Text></SafeAreaView>;
  if (!isEventManager(event, user?.id, profile.name)) return <SafeAreaView style={styles.empty}><Text style={styles.emptyText}>主催者・共同主催者のみ編集できます</Text></SafeAreaView>;

  const save = async () => {
    if (!title.trim()) return Alert.alert('予定名を入力してください');
    const input = { day, time, title: title.trim(), note: note.trim() || undefined, type };
    setSaving(true);
    const error = editingItem
      ? await updateScheduleItem(id, editingItem.id, input)
      : await addScheduleItem(id, input);
    setSaving(false);
    if (error) return Alert.alert('保存できませんでした', error);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: editingItem ? '予定を編集' : '予定を追加' }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
          <View style={styles.intro}><Ionicons name="time-outline" size={22} color={palette.primary} /><View style={styles.introCopy}><Text style={styles.introTitle}>{event.title}</Text><Text style={styles.introText}>{editingItem ? '日時や内容を変更できます' : 'タイムフローへ新しい予定を追加します'}</Text></View></View>
          <Text style={styles.sectionLabel}>予定日</Text>
          <MonthDatePicker value={day} onChange={setDay} minimumDate={event.startDate} maximumDate={event.endDate} />
          <NativeTimeField label="開始時間" value={time} onChange={setTime} open={timeOpen} onOpenChange={setTimeOpen} />
          <FormField label="予定名" icon="create-outline" value={title} onChangeText={setTitle} placeholder="例：ホテルにチェックイン" autoFocus={!editingItem} />
          <Text style={styles.sectionLabel}>種類</Text>
          <View style={styles.types}>{types.map((item) => <TouchableOpacity key={item.value} style={[styles.type, type === item.value && styles.typeActive]} onPress={() => setType(item.value)}><Ionicons name={item.icon} size={18} color={type === item.value ? palette.surface : palette.primary} /><Text style={[styles.typeText, type === item.value && styles.typeTextActive]}>{item.label}</Text></TouchableOpacity>)}</View>
          <FormField label="補足" hint="任意" icon="document-text-outline" value={note} onChangeText={setNote} placeholder="集合場所や持ち物など" multiline />
        </ScrollView>
        <View style={styles.bottom}><TouchableOpacity style={[styles.save, saving && styles.saveDisabled]} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color={palette.surface} /> : <Text style={styles.saveText}>{editingItem ? '変更を保存' : '予定を追加'}</Text>}</TouchableOpacity></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 }, content: { padding: 20 },
  empty: { flex: 1, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' }, emptyText: { color: palette.muted, fontSize: 14 },
  intro: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line, backgroundColor: palette.surface, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  introCopy: { flex: 1, marginLeft: 11 }, introTitle: { color: palette.ink, fontSize: 13, fontWeight: '700', marginBottom: 3 }, introText: { color: palette.muted, fontSize: 12 },
  sectionLabel: { color: palette.ink, fontSize: 13, fontWeight: '700', marginBottom: 9 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 19 }, type: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 11, paddingVertical: 10 }, typeActive: { backgroundColor: palette.primary }, typeText: { color: palette.ink, fontSize: 13, fontWeight: '700', marginLeft: 5 }, typeTextActive: { color: palette.surface },
  bottom: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, backgroundColor: palette.surface }, save: { height: 54, borderRadius: 15, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }, saveDisabled: { opacity: 0.55 }, saveText: { color: palette.surface, fontSize: 14, fontWeight: '800' },
});
