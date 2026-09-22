import { DateRangeCalendar, formatJapaneseDateRange, toDateString } from '@/components/date-range-calendar';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { TimeRangePicker } from '@/components/time-range-picker';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { useAuth } from '@/context/auth-context';
import { isEventManager } from '@/lib/event-permissions';
import { isEventArchived } from '@/lib/event-display';
import { formatEventTimeLabel } from '@/lib/time-values';
import { EventItem, EventTimeMode } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditEventDateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findEvent } = useEvents();
  const event = findEvent(id);
  if (!event) return <SafeAreaView style={styles.empty}><Text>イベントが見つかりません</Text></SafeAreaView>;
  return <DateForm key={event.id} event={event} />;
}

function DateForm({ event }: { event: EventItem }) {
  const { updateEventDateTime, profile } = useEvents();
  const { user } = useAuth();
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const today = toDateString(new Date());
  const [startDate, setStartDate] = useState(event?.startDate || today);
  const [endDate, setEndDate] = useState(event?.endDate || event?.startDate || today);
  const [startTime, setStartTime] = useState(event?.startTime || '09:00');
  const [endTime, setEndTime] = useState<string | undefined>(event?.endTime);
  const [timeMode, setTimeMode] = useState<EventTimeMode>(event?.timeMode || 'start');

  const canEdit = isEventManager(event, user?.id, profile.name) && !isEventArchived(event);
  const save = async () => {
    if (savingRef.current || !canEdit) return;
    if (timeMode === 'range' && endTime && endDate === startDate && endTime <= startTime) return Alert.alert('終了時刻を確認してください', '同じ日の場合、終了時刻は開始時刻より後にしてください。');
    savingRef.current = true;
    setSaving(true);
    try {
      const error = await updateEventDateTime(event.id, { startDate, endDate, startTime, endTime, timeMode });
      if (error) return Alert.alert('保存できませんでした', error);
      router.back();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}><View style={styles.summaryIcon}><Ionicons name="calendar" size={22} color={palette.surface} /></View><View><Text style={styles.summaryDate}>{formatJapaneseDateRange(startDate, endDate)}</Text><Text style={styles.summaryTime}>{formatEventTimeLabel(startTime, endTime, timeMode)}</Text></View></View>
        <Label title="開催日" hint="カレンダーから開始日と終了日を選択" />
        <DateRangeCalendar startDate={startDate} endDate={endDate} onChange={(start, end) => { setStartDate(start); setEndDate(end); }} />
        <Label title="開催時間" hint="開始時刻だけでも登録できます" />
        <TimeRangePicker startTime={startTime} endTime={endTime} timeMode={timeMode} onChange={(value) => { setStartTime(value.startTime); setEndTime(value.endTime); setTimeMode(value.timeMode); }} />
      </ScrollView>
      <View style={styles.bottom}><TouchableOpacity accessibilityRole="button" disabled={saving || !canEdit} style={[styles.save, (saving || !canEdit) && { opacity: 0.5 }]} onPress={save}><Text style={styles.saveText}>{saving ? '保存中…' : canEdit ? '変更を保存' : '閲覧のみ'}</Text></TouchableOpacity></View>
    </SafeAreaView>
  );
}

function Label({ title, hint }: { title: string; hint: string }) { return <View style={styles.label}><Text style={styles.labelTitle}>{title}</Text><Text style={styles.labelHint}>{hint}</Text></View>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 30 },
  summary: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, backgroundColor: palette.primary, padding: 16, marginBottom: 22 }, summaryIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, summaryDate: { color: palette.surface, fontSize: 14, fontWeight: '900', marginBottom: 4 }, summaryTime: { color: '#CDE0D6', fontSize: 13 },
  label: { marginTop: 5, marginBottom: 10 }, labelTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' }, labelHint: { color: palette.muted, fontSize: 13, marginTop: 3 },
  bottom: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, backgroundColor: palette.surface }, save: { minHeight: 54, borderRadius: 17, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }, saveText: { color: palette.surface, fontSize: 14, fontWeight: '900' },
});
