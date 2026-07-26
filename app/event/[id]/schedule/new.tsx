import { FormField } from '@/components/form-field';
import { NativeDateField } from '@/components/native-date-picker';
import { NativeTimeField } from '@/components/native-time-field';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { ScheduleItem } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const types: { value: ScheduleItem['type']; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'activity', label: 'アクティビティ', icon: 'sparkles-outline' },
  { value: 'move', label: '移動', icon: 'navigate-outline' },
  { value: 'food', label: '食事', icon: 'restaurant-outline' },
  { value: 'stay', label: '宿泊', icon: 'bed-outline' },
];

export default function NewScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findEvent, addScheduleItem } = useEvents();
  const event = findEvent(id);
  const [day, setDay] = useState(event?.startDate ?? '');
  const [time, setTime] = useState(event?.startTime ?? '09:00');
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState<ScheduleItem['type']>('activity');

  const save = () => {
    if (!title.trim()) return Alert.alert('予定名を入力してください');
    addScheduleItem(id, { day, time, title: title.trim(), note: note.trim() || undefined, type });
    router.back();
  };

  return <SafeAreaView style={styles.safe} edges={['bottom']}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
    <View style={styles.intro}><Ionicons name="time" size={23} color={palette.primary} /><View><Text style={styles.introTitle}>{event?.title}</Text><Text style={styles.introText}>当日の流れへ新しい予定を追加します</Text></View></View>
    <NativeDateField label="予定日" value={day} onChange={setDay} open={dateOpen} onOpenChange={(open) => { setDateOpen(open); if (open) setTimeOpen(false); }} minimumDate={event ? new Date(`${event.startDate}T00:00:00`) : undefined} maximumDate={event ? new Date(`${event.endDate}T23:59:59`) : undefined} />
    <NativeTimeField label="開始時間" value={time} onChange={setTime} open={timeOpen} onOpenChange={(open) => { setTimeOpen(open); if (open) setDateOpen(false); }} />
    <FormField label="予定名" icon="create-outline" value={title} onChangeText={setTitle} placeholder="例：ホテルにチェックイン" autoFocus />
    <Text style={styles.label}>種類</Text><View style={styles.types}>{types.map((item) => <TouchableOpacity key={item.value} style={[styles.type, type === item.value && styles.typeActive]} onPress={() => setType(item.value)}><Ionicons name={item.icon} size={18} color={type === item.value ? palette.surface : palette.primary} /><Text style={[styles.typeText, type === item.value && styles.typeTextActive]}>{item.label}</Text></TouchableOpacity>)}</View>
    <FormField label="補足" hint="任意" icon="document-text-outline" value={note} onChangeText={setNote} placeholder="集合場所や持ち物など" multiline />
  </ScrollView><View style={styles.bottom}><TouchableOpacity style={styles.save} onPress={save}><Text style={styles.saveText}>予定を追加する</Text><Ionicons name="arrow-forward" size={18} color={palette.surface} /></TouchableOpacity></View></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 }, content: { padding: 20 }, intro: { borderRadius: 18, backgroundColor: palette.primarySoft, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 23 }, introTitle: { color: palette.ink, fontSize: 13, fontWeight: '800', marginBottom: 3 }, introText: { color: palette.muted, fontSize: 12 }, label: { color: palette.ink, fontSize: 13, fontWeight: '700', marginBottom: 9 }, types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 19 }, type: { flexDirection: 'row', alignItems: 'center', borderRadius: 13, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 11, paddingVertical: 10 }, typeActive: { backgroundColor: palette.primary }, typeText: { color: palette.ink, fontSize: 13, fontWeight: '700', marginLeft: 5 }, typeTextActive: { color: palette.surface }, bottom: { padding: 14, backgroundColor: palette.surface }, save: { height: 54, borderRadius: 18, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, saveText: { color: palette.surface, fontSize: 14, fontWeight: '800', marginRight: 8 } });
