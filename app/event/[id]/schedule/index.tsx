import { MonthDatePicker } from '@/components/month-date-picker';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { palette } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useEvents } from '@/context/event-context';
import { isEventManager } from '@/lib/event-permissions';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScheduleEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findEvent, deleteScheduleItem, profile } = useEvents();
  const { user } = useAuth();
  const event = findEvent(id);
  const [selectedDate, setSelectedDate] = useState(event?.startDate ?? '');
  const items = useMemo(() => [...(event?.schedule ?? [])].sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`)), [event?.schedule]);
  const selectedItems = items.filter((item) => item.day === selectedDate || formatScheduleDay(item.day) === selectedDate);

  useEffect(() => {
    if (!selectedDate && event?.startDate) setSelectedDate(event.startDate);
  }, [event?.startDate, selectedDate]);

  if (!event) return <SafeAreaView style={styles.empty}><Text>イベントが見つかりません</Text></SafeAreaView>;
  const canManage = isEventManager(event, user?.id, profile.name);

  const confirmDelete = (scheduleId: string, title: string) => Alert.alert('予定を削除しますか？', `「${title}」をタイムフローから削除します。`, [
    { text: 'キャンセル', style: 'cancel' },
    { text: '削除する', style: 'destructive', onPress: async () => { const error = await deleteScheduleItem(id, scheduleId); if (error) Alert.alert('削除できませんでした', error); } },
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>タイムフローを編集</Text>
        <Text style={styles.lead}>日付を選ぶと、その日の予定を確認・編集できます。</Text>
        <MonthDatePicker value={selectedDate} onChange={setSelectedDate} minimumDate={event.startDate} maximumDate={event.endDate} />
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{dateLabel(selectedDate)}</Text><Text style={styles.count}>{selectedItems.length}件</Text></View>
        {selectedItems.length === 0 ? <View style={styles.noItems}><Text style={styles.noItemsText}>この日の予定はありません</Text></View> : selectedItems.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={styles.time}><Text style={styles.timeText}>{item.time}</Text></View>
            <View style={styles.itemCopy}><Text style={styles.itemTitle}>{item.title}</Text>{item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}</View>
            {canManage ? <><TouchableOpacity accessibilityLabel={`${item.title}を編集`} style={styles.iconButton} onPress={() => router.push({ pathname: '/event/[id]/schedule/new', params: { id, scheduleId: item.id } })}><Ionicons name="pencil-outline" size={18} color={palette.primary} /></TouchableOpacity><TouchableOpacity accessibilityLabel={`${item.title}を削除`} style={styles.iconButton} onPress={() => confirmDelete(item.id, item.title)}><Ionicons name="trash-outline" size={18} color={palette.danger} /></TouchableOpacity></> : null}
          </View>
        ))}
        {canManage ? <TouchableOpacity style={styles.addButton} onPress={() => router.push({ pathname: '/event/[id]/schedule/new', params: { id, day: selectedDate } })}><Ionicons name="add" size={20} color={palette.surface} /><Text style={styles.addText}>この日に予定を追加</Text></TouchableOpacity> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const formatScheduleDay = (value: string) => {
  const match = /^(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(value);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : value;
};
const dateLabel = (value: string) => { const [y, m, d] = value.split('-').map(Number); return y && m && d ? `${y}年${m}月${d}日` : '選択した日'; };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, content: { padding: 20, paddingBottom: 40 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.ink, fontSize: 25, fontWeight: '700' }, lead: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 38, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line, marginBottom: 10 }, sectionTitle: { color: palette.ink, fontSize: 16, fontWeight: '700' }, count: { color: palette.muted, fontSize: 12 },
  item: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, time: { width: 54 }, timeText: { color: palette.ink, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }, itemCopy: { flex: 1, paddingVertical: 12 }, itemTitle: { color: palette.ink, fontSize: 14, fontWeight: '700' }, itemNote: { color: palette.muted, fontSize: 12, marginTop: 4 }, iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  noItems: { paddingVertical: 24, alignItems: 'center' }, noItemsText: { color: palette.muted, fontSize: 13 },
  addButton: { height: 50, borderRadius: 14, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18 }, addText: { color: palette.surface, fontSize: 13, fontWeight: '800', marginLeft: 7 },
});
