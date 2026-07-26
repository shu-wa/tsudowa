import { collectionCategories } from '@/constants/collections';
import { KeyboardDismissBar } from '@/components/keyboard-dismiss-bar';
import { NativeDateField } from '@/components/native-date-picker';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { useAuth } from '@/context/auth-context';
import { isEventManager } from '@/lib/event-permissions';
import { CollectionCategory, SplitMethod } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NewCollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findEvent, addCollection, profile } = useEvents();
  const { user } = useAuth();
  const event = findEvent(id);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CollectionCategory>('entry');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState(event?.participants[0]?.id ?? '');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [includedIds, setIncludedIds] = useState<string[]>(event?.participants.map((person) => person.id) ?? []);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [dueDate, setDueDate] = useState('');
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [note, setNote] = useState('');

  const numericAmount = Number(amount.replace(/,/g, '')) || 0;
  const equalAmount = includedIds.length ? Math.floor(numericAmount / includedIds.length) : 0;
  const equalRemainder = numericAmount - equalAmount * includedIds.length;
  const customTotal = useMemo(() => includedIds.reduce((sum, participantId) => sum + (Number(customAmounts[participantId]) || 0), 0), [customAmounts, includedIds]);

  if (!event) return <SafeAreaView style={styles.empty}><Text>イベントが見つかりません</Text></SafeAreaView>;
  if (!isEventManager(event, user?.id, profile.name)) return <SafeAreaView style={styles.empty}><Ionicons name="lock-closed-outline" size={32} color={palette.muted} /><Text style={styles.permissionTitle}>集金を追加できません</Text><Text style={styles.permissionText}>集金を追加できるのは主催者・共同主催者だけです。</Text><TouchableOpacity onPress={() => router.back()}><Text style={styles.permissionBack}>戻る</Text></TouchableOpacity></SafeAreaView>;

  const toggleParticipant = (participantId: string) => {
    setIncludedIds((current) => current.includes(participantId) ? current.filter((item) => item !== participantId) : [...current, participantId]);
  };

  const submit = () => {
    if (!title.trim()) return Alert.alert('集金名を入力してください');
    if (numericAmount <= 0) return Alert.alert('合計金額を入力してください');
    if (!payerId) return Alert.alert('立替・支払った人を選択してください');
    if (includedIds.length === 0) return Alert.alert('集金対象者を1人以上選択してください');
    if (splitMethod === 'custom' && customTotal !== numericAmount) {
      return Alert.alert('個別金額を確認してください', `個別金額の合計は ¥${customTotal.toLocaleString()} です。集金総額 ¥${numericAmount.toLocaleString()} と一致させてください。`);
    }
    addCollection(event.id, {
      title: title.trim(), category, paidByParticipantId: payerId, totalAmount: numericAmount, splitMethod,
      participantIds: includedIds, dueDate: dueDate.trim() || undefined, note: note.trim() || undefined,
      customAmounts: Object.fromEntries(Object.entries(customAmounts).map(([key, value]) => [key, Number(value) || 0])),
    });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} onScrollBeginDrag={Keyboard.dismiss} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}><View style={styles.introIcon}><Ionicons name="receipt" size={22} color={palette.primary} /></View><View style={styles.introCopy}><Text style={styles.introTitle}>費用ごとに分けて管理</Text><Text style={styles.introText}>参加費、食事代、立替えなどを何件でも追加できます</Text></View></View>

          <FieldLabel label="集金名" required />
          <View style={styles.inputWrap}><Ionicons name="create-outline" size={19} color={palette.primary} /><TextInput value={title} onChangeText={setTitle} placeholder="例：初日の夕食代" placeholderTextColor="#9AA29D" style={styles.input} autoFocus /></View>

          <FieldLabel label="種類" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {collectionCategories.map((item) => <TouchableOpacity key={item.value} style={[styles.categoryChip, category === item.value && { backgroundColor: item.color, borderColor: item.color }]} onPress={() => setCategory(item.value)}><Ionicons name={item.icon} size={16} color={category === item.value ? palette.surface : item.color} /><Text style={[styles.categoryText, category === item.value && styles.categoryTextActive]}>{item.label}</Text></TouchableOpacity>)}
          </ScrollView>

          <FieldLabel label="集金総額" required />
          <View style={styles.amountWrap}><Text style={styles.yen}>¥</Text><TextInput value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor="#9AA29D" style={styles.amountInput} keyboardType="number-pad" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} blurOnSubmit /><Text style={styles.taxText}>税込</Text></View>

          <FieldLabel label="誰がまとめて払いましたか？" hint="立替者・支払者" />
          <View style={styles.peopleGrid}>{event.participants.map((person) => <TouchableOpacity key={person.id} style={[styles.personChip, payerId === person.id && styles.personChipActive]} onPress={() => setPayerId(person.id)}><View style={[styles.personAvatar, { backgroundColor: person.avatarColor }]}><Text style={styles.personInitials}>{person.initials}</Text></View><Text style={[styles.personName, payerId === person.id && styles.personNameActive]} numberOfLines={1}>{person.name.split(' ')[0]}</Text>{payerId === person.id && <Ionicons name="checkmark-circle" size={17} color={palette.primary} />}</TouchableOpacity>)}</View>

          <FieldLabel label="分け方" />
          <View style={styles.splitRow}>
            <TouchableOpacity style={[styles.splitButton, splitMethod === 'equal' && styles.splitButtonActive]} onPress={() => setSplitMethod('equal')}><Ionicons name="git-compare-outline" size={19} color={splitMethod === 'equal' ? palette.surface : palette.primary} /><View><Text style={[styles.splitTitle, splitMethod === 'equal' && styles.splitTitleActive]}>均等割り</Text><Text style={[styles.splitText, splitMethod === 'equal' && styles.splitTextActive]}>対象者で自動計算</Text></View></TouchableOpacity>
            <TouchableOpacity style={[styles.splitButton, splitMethod === 'custom' && styles.splitButtonActive]} onPress={() => setSplitMethod('custom')}><Ionicons name="options-outline" size={19} color={splitMethod === 'custom' ? palette.surface : palette.primary} /><View><Text style={[styles.splitTitle, splitMethod === 'custom' && styles.splitTitleActive]}>個別指定</Text><Text style={[styles.splitText, splitMethod === 'custom' && styles.splitTextActive]}>人ごとに金額を変更</Text></View></TouchableOpacity>
          </View>

          <FieldLabel label="集金対象者" hint={`${includedIds.length}/${event.participants.length}人を選択`} />
          <View style={styles.memberList}>
            {event.participants.map((person, index) => {
              const selected = includedIds.includes(person.id);
              return <View key={person.id} style={[styles.memberRow, index === event.participants.length - 1 && styles.memberRowLast]}>
                <TouchableOpacity style={styles.memberSelect} onPress={() => toggleParticipant(person.id)}><View style={[styles.check, selected && styles.checkSelected]}>{selected && <Ionicons name="checkmark" size={15} color={palette.surface} />}</View><View style={[styles.memberAvatar, { backgroundColor: person.avatarColor }]}><Text style={styles.memberInitials}>{person.initials}</Text></View><View style={styles.memberCopy}><Text style={styles.memberName}>{person.name}</Text><Text style={styles.memberAttendance}>{person.attendance}</Text></View></TouchableOpacity>
                {selected && <View style={styles.shareAmount}>{splitMethod === 'equal' ? <Text style={styles.shareText}>¥{(equalAmount + (includedIds[0] === person.id ? equalRemainder : 0)).toLocaleString()}</Text> : <><Text style={styles.shareYen}>¥</Text><TextInput value={customAmounts[person.id] ?? ''} onChangeText={(value) => setCustomAmounts((current) => ({ ...current, [person.id]: value }))} placeholder="0" placeholderTextColor="#9AA29D" style={styles.shareInput} keyboardType="number-pad" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} blurOnSubmit /></>}</View>}
              </View>;
            })}
          </View>
          {splitMethod === 'custom' && <View style={[styles.sumNotice, customTotal === numericAmount && numericAmount > 0 && styles.sumNoticeOk]}><Text style={styles.sumNoticeText}>個別金額の合計</Text><Text style={styles.sumNoticeAmount}>¥{customTotal.toLocaleString()} / ¥{numericAmount.toLocaleString()}</Text></View>}

          <NativeDateField label="支払期限（任意）" value={dueDate} onChange={setDueDate} open={dueDateOpen} onOpenChange={setDueDateOpen} minimumDate={new Date()} emptyLabel="期限を設定しない" allowClear />
          <FieldLabel label="メモ" hint="任意" />
          <View style={[styles.inputWrap, styles.noteWrap]}><Ionicons name="document-text-outline" size={19} color={palette.primary} style={styles.noteIcon} /><TextInput value={note} onChangeText={setNote} placeholder="予約内容や立替えの経緯など" placeholderTextColor="#9AA29D" style={[styles.input, styles.noteInput]} multiline /></View>
        </ScrollView>
        <View style={styles.bottom}><KeyboardDismissBar /><TouchableOpacity style={styles.submit} onPress={submit}><Text style={styles.submitText}>集金項目を追加する</Text><Ionicons name="arrow-forward" size={19} color={palette.surface} /></TouchableOpacity></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ label, hint, required }: { label: string; hint?: string; required?: boolean }) {
  return <View style={styles.labelRow}><View style={styles.labelLeft}><Text style={styles.label}>{label}</Text>{required && <Text style={styles.required}>必須</Text>}</View>{hint && <Text style={styles.hint}>{hint}</Text>}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, permissionTitle: { color: palette.ink, fontSize: 17, fontWeight: '800', marginTop: 12 }, permissionText: { color: palette.muted, fontSize: 13, textAlign: 'center', marginTop: 6 }, permissionBack: { color: palette.primary, fontSize: 14, fontWeight: '800', marginTop: 18 }, content: { padding: 20, paddingBottom: 28 },
  intro: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.primarySoft, borderRadius: 19, padding: 14, marginBottom: 24 }, introIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }, introCopy: { flex: 1, marginLeft: 11 }, introTitle: { color: palette.ink, fontSize: 14, fontWeight: '800', marginBottom: 3 }, introText: { color: palette.muted, fontSize: 13, lineHeight: 15 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 8 }, labelLeft: { flexDirection: 'row', alignItems: 'center' }, label: { color: palette.ink, fontSize: 13, fontWeight: '800' }, required: { color: palette.accent, fontSize: 11, fontWeight: '800', backgroundColor: palette.accentSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginLeft: 6 }, hint: { color: palette.muted, fontSize: 12 },
  inputWrap: { minHeight: 54, borderRadius: 17, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 19 }, input: { flex: 1, color: palette.ink, fontSize: 14, marginLeft: 10, paddingVertical: 0 },
  categoryRow: { gap: 7, paddingBottom: 19 }, categoryChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 11, paddingVertical: 9 }, categoryText: { color: palette.ink, fontSize: 13, fontWeight: '700', marginLeft: 5 }, categoryTextActive: { color: palette.surface },
  amountWrap: { height: 66, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1.5, borderColor: palette.primary, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', marginBottom: 19 }, yen: { color: palette.primary, fontSize: 22, fontWeight: '800' }, amountInput: { flex: 1, color: palette.ink, fontSize: 27, fontWeight: '800', marginLeft: 9 }, taxText: { color: palette.muted, fontSize: 12 },
  peopleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 19 }, personChip: { minWidth: 103, flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 8 }, personChipActive: { borderColor: palette.primary, backgroundColor: palette.primarySoft }, personAvatar: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, personInitials: { color: palette.surface, fontSize: 11, fontWeight: '800' }, personName: { flex: 1, color: palette.ink, fontSize: 13, fontWeight: '700', marginHorizontal: 7 }, personNameActive: { color: palette.primary },
  splitRow: { flexDirection: 'row', gap: 8, marginBottom: 19 }, splitButton: { flex: 1, minHeight: 64, borderRadius: 17, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8 }, splitButtonActive: { backgroundColor: palette.primary, borderColor: palette.primary }, splitTitle: { color: palette.ink, fontSize: 13, fontWeight: '800', marginBottom: 3 }, splitTitleActive: { color: palette.surface }, splitText: { color: palette.muted, fontSize: 11 }, splitTextActive: { color: '#C8D8CF' },
  memberList: { borderRadius: 20, backgroundColor: palette.surface, overflow: 'hidden', marginBottom: 10 }, memberRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line, paddingHorizontal: 12 }, memberRowLast: { borderBottomWidth: 0 }, memberSelect: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }, check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: '#B8BFBA', alignItems: 'center', justifyContent: 'center', marginRight: 9 }, checkSelected: { backgroundColor: palette.primary, borderColor: palette.primary }, memberAvatar: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, memberInitials: { color: palette.surface, fontSize: 12, fontWeight: '800' }, memberCopy: { flex: 1, marginLeft: 9 }, memberName: { color: palette.ink, fontSize: 13, fontWeight: '800', marginBottom: 3 }, memberAttendance: { color: palette.muted, fontSize: 11 }, shareAmount: { minWidth: 72, minHeight: 38, borderRadius: 12, backgroundColor: '#F0F1ED', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 9 }, shareText: { color: palette.ink, fontSize: 13, fontWeight: '800' }, shareYen: { color: palette.muted, fontSize: 13 }, shareInput: { minWidth: 45, color: palette.ink, fontSize: 13, fontWeight: '800', textAlign: 'right', paddingVertical: 0 },
  sumNotice: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 13, backgroundColor: palette.accentSoft, padding: 11, marginBottom: 18 }, sumNoticeOk: { backgroundColor: palette.primarySoft }, sumNoticeText: { color: palette.muted, fontSize: 13 }, sumNoticeAmount: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  noteWrap: { minHeight: 100, alignItems: 'flex-start', paddingTop: 15 }, noteIcon: { marginTop: 1 }, noteInput: { minHeight: 72, textAlignVertical: 'top' },
  bottom: { padding: 14, backgroundColor: palette.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line }, submit: { height: 55, borderRadius: 18, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, submitText: { color: palette.surface, fontSize: 14, fontWeight: '800', marginRight: 8 },
});
