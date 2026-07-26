import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const messageDateKey = (createdAt: string) => {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const messageDateLabel = (createdAt: string) => {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '日時不明';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = messageDateKey(createdAt);
  if (key === messageDateKey(today.toISOString())) return '今日';
  if (key === messageDateKey(yesterday.toISOString())) return '昨日';
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
};

const messageTimeLabel = (createdAt: string, fallback: string) => {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findEvent, addMessage, blockedUsers, markChatRead } = useEvents();
  const event = findEvent(id);
  const [text, setText] = useState('');

  useEffect(() => {
    markChatRead(id);
  }, [event?.messages.length, id, markChatRead]);

  const send = () => {
    if (!text.trim()) return;
    const error = addMessage(id, text.trim());
    if (error) return Alert.alert('このメッセージは送信できません', error);
    setText('');
  };
  const visibleMessages = (event?.messages ?? []).filter((message) => !blockedUsers.some((blocked) => message.authorId ? blocked.userId === message.authorId : blocked.name === message.author));
  const hiddenCount = (event?.messages ?? []).length - visibleMessages.length;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={88}>
        <View style={styles.eventBar}>
          <View style={[styles.eventIcon, { backgroundColor: event?.coverColor || palette.primarySoft }]}><Ionicons name="calendar" size={19} color={event?.accentColor || palette.primary} /></View>
          <View style={styles.eventCopy}><Text style={styles.eventTitle} numberOfLines={1}>{event?.title || 'イベント'}</Text><Text style={styles.memberText}>{event?.participants.length || 0}人のメンバー</Text></View>
        </View>
        <ScrollView style={styles.flex} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {hiddenCount > 0 && <View style={styles.hidden}><Ionicons name="eye-off-outline" size={14} color={palette.muted} /><Text style={styles.hiddenText}>ブロック中の利用者のメッセージ {hiddenCount}件を非表示</Text></View>}
          {visibleMessages.length === 0 && <View style={styles.emptyMessages}><Ionicons name="chatbubbles-outline" size={30} color={palette.muted} /><Text style={styles.emptyTitle}>最初のメッセージを送りましょう</Text></View>}
          {visibleMessages.map((message, index) => {
            const showDate = index === 0 || messageDateKey(visibleMessages[index - 1].createdAt) !== messageDateKey(message.createdAt);
            return <Fragment key={message.id}>
              {showDate && <View style={styles.datePill}><Text style={styles.datePillText}>{messageDateLabel(message.createdAt)}</Text></View>}
              <View style={[styles.messageRow, message.mine && styles.messageRowMine]}>
                {!message.mine && <View style={[styles.avatar, { backgroundColor: message.color }]}><Text style={styles.avatarText}>{message.initials}</Text></View>}
                <View style={[styles.messageContent, message.mine && styles.messageContentMine]}>
                  {!message.mine && <View style={styles.authorRow}><Text style={styles.author}>{message.author}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`${message.author}さんのメッセージを通報またはブロック`} onPress={() => router.push({ pathname: '/safety/report', params: { eventId: id, messageId: message.id, targetUserId: message.authorId, targetName: message.author } })}><Ionicons name="ellipsis-horizontal" size={16} color={palette.muted} /></TouchableOpacity></View>}
                  <TouchableOpacity activeOpacity={0.8} onLongPress={() => !message.mine && router.push({ pathname: '/safety/report', params: { eventId: id, messageId: message.id, targetUserId: message.authorId, targetName: message.author } })}><View style={[styles.bubble, message.mine ? styles.bubbleMine : styles.bubbleOther]}><Text style={[styles.messageText, message.mine && styles.messageTextMine]}>{message.text}</Text></View></TouchableOpacity>
                  <Text style={[styles.time, message.mine && styles.timeMine]}>{messageTimeLabel(message.createdAt, message.time)}</Text>
                </View>
              </View>
            </Fragment>;
          })}
        </ScrollView>
        <View style={styles.composer}>
          <View style={styles.inputWrap}><TextInput accessibilityLabel="メッセージ" style={styles.input} placeholder="メッセージを入力" placeholderTextColor="#9AA29D" value={text} onChangeText={setText} multiline selectionColor={palette.primary} /></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="メッセージを送信" accessibilityState={{ disabled: !text.trim() }} style={[styles.send, !text.trim() && styles.sendDisabled]} onPress={send} disabled={!text.trim()}><Ionicons name="arrow-up" size={20} color={palette.surface} /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 },
  eventBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, paddingHorizontal: 15, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  eventIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, eventCopy: { flex: 1, marginLeft: 11 }, eventTitle: { color: palette.ink, fontSize: 13, fontWeight: '800', marginBottom: 3 }, memberText: { color: palette.muted, fontSize: 12 },
  messages: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 22 }, datePill: { alignSelf: 'center', backgroundColor: '#E4E5DF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, marginBottom: 16, marginTop: 2 }, datePillText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  hidden: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', backgroundColor: '#E4E5DF', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 15 }, hiddenText: { color: palette.muted, fontSize: 11, marginLeft: 5 },
  emptyMessages: { alignItems: 'center', paddingVertical: 45 }, emptyTitle: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: 10 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 17, maxWidth: '88%' }, messageRowMine: { alignSelf: 'flex-end', justifyContent: 'flex-end' }, avatar: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8 }, avatarText: { color: palette.surface, fontSize: 11, fontWeight: '800' }, messageContent: { maxWidth: '88%' }, messageContentMine: { alignItems: 'flex-end' }, authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, author: { color: palette.muted, fontSize: 12, marginLeft: 4, marginBottom: 5 },
  bubble: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18 }, bubbleOther: { backgroundColor: palette.surface, borderBottomLeftRadius: 5 }, bubbleMine: { backgroundColor: palette.primary, borderBottomRightRadius: 5 }, messageText: { color: palette.ink, fontSize: 13, lineHeight: 20 }, messageTextMine: { color: palette.surface }, time: { color: palette.muted, fontSize: 11, marginTop: 4, marginLeft: 4 }, timeMine: { marginRight: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: palette.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, paddingHorizontal: 11, paddingTop: 9, paddingBottom: 10 }, inputWrap: { flex: 1, minHeight: 42, maxHeight: 100, borderRadius: 17, backgroundColor: '#F0F1ED', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 }, input: { flex: 1, color: palette.ink, fontSize: 13, paddingVertical: 10 }, send: { width: 42, height: 42, borderRadius: 15, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }, sendDisabled: { backgroundColor: '#B8C2BC' },
});
