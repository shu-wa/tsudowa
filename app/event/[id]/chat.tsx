import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { palette } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useEvents } from '@/context/event-context';
import { useEventChatPresence } from '@/lib/chat-presence';
import { canDeleteChatMessage, canEditChatMessage, filterChatMessages, getMentionQuery, getMessageReadCount, insertMention } from '@/lib/chat-values';
import { isEventManager } from '@/lib/event-permissions';
import { CHAT_REACTION_EMOJIS, ChatImageInput, ChatMessage, ChatReactionEmoji } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

const imageAspectRatio = (width?: number, height?: number) => {
  if (!width || !height) return 1;
  return Math.max(0.7, Math.min(1.6, width / height));
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const {
    findEvent, addMessage, editMessage, deleteMessage, toggleMessageReaction,
    setMessagePinned, blockedUsers, markChatRead, profile,
  } = useEvents();
  const event = findEvent(id);
  const archived = Boolean(event?.archivedAt);
  const manager = isEventManager(event, user?.id, profile.name);
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<ChatImageInput | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { connected, onlineUserIds, typingNames, setTyping } = useEventChatPresence(id, profile.name, Boolean(event && !archived));

  useEffect(() => {
    markChatRead(id);
  }, [event?.messages.length, id, markChatRead]);

  useEffect(() => {
    if (archived) return;
    setTyping(Boolean(text.trim()) && !editing);
    const timer = setTimeout(() => setTyping(false), 1600);
    return () => clearTimeout(timer);
  }, [archived, editing, setTyping, text]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8, selectionLimit: 1 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024) return Alert.alert('写真が大きすぎます', '8MB以下の写真を選択してください。');
      setSelectedImage({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', width: asset.width, height: asset.height, fileSize: asset.fileSize, fileName: asset.fileName ?? undefined });
    } catch {
      Alert.alert('写真を開けませんでした', '端末の写真アクセス設定を確認して、もう一度お試しください。');
    }
  };

  const resetComposer = () => {
    setText('');
    setSelectedImage(null);
    setReplyingTo(null);
    setEditing(null);
    setTyping(false);
  };

  const send = async () => {
    if (sending) return;
    if (editing) {
      if (!text.trim()) return;
      setSending(true);
      const error = await editMessage(id, editing.id, text.trim());
      setSending(false);
      if (error) return Alert.alert('編集できませんでした', error);
      resetComposer();
      return;
    }
    if (!text.trim() && !selectedImage) return;
    setSending(true);
    const error = await addMessage(id, text.trim(), selectedImage ?? undefined, replyingTo?.id);
    setSending(false);
    if (error) return Alert.alert('このメッセージは送信できません', error);
    resetComposer();
  };

  const startEditing = (message: ChatMessage) => {
    setSelectedMessage(null);
    setReplyingTo(null);
    setSelectedImage(null);
    setEditing(message);
    setText(message.text);
  };

  const confirmDelete = (message: ChatMessage) => {
    setSelectedMessage(null);
    Alert.alert(message.mine ? '送信を取り消しますか？' : 'メッセージを削除しますか？', '参加者全員の画面で内容が非表示になります。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: message.mine ? '送信取消' : '削除', style: 'destructive', onPress: async () => {
        const error = await deleteMessage(id, message.id);
        if (error) Alert.alert('削除できませんでした', error);
      } },
    ]);
  };

  const react = async (message: ChatMessage, emoji: ChatReactionEmoji) => {
    const error = await toggleMessageReaction(id, message.id, emoji);
    if (error) Alert.alert('リアクションできませんでした', error);
  };

  const togglePin = async (message: ChatMessage) => {
    setSelectedMessage(null);
    const error = await setMessagePinned(id, message.id, !message.pinnedAt);
    if (error) Alert.alert('ピン留めを変更できませんでした', error);
  };

  const unblockedMessages = (event?.messages ?? []).filter((message) => !blockedUsers.some((blocked) => message.authorId ? blocked.userId === message.authorId : blocked.name === message.author));
  const hiddenCount = (event?.messages ?? []).length - unblockedMessages.length;
  const visibleMessages = filterChatMessages(unblockedMessages, searchQuery);
  const messageById = useMemo(() => new Map((event?.messages ?? []).map((message) => [message.id, message])), [event?.messages]);
  const pinnedMessages = unblockedMessages.filter((message) => message.pinnedAt && !message.deletedAt).sort((a, b) => String(b.pinnedAt).localeCompare(String(a.pinnedAt)));
  const mentionQuery = getMentionQuery(text);
  const mentionCandidates = mentionQuery === null ? [] : (event?.participants ?? []).filter((participant) => participant.name.toLocaleLowerCase('ja-JP').includes(mentionQuery.toLocaleLowerCase('ja-JP'))).slice(0, 5);
  const memberStatus = connected ? `${event?.participants.length ?? 0}人のメンバー・${onlineUserIds.length}人オンライン` : `${event?.participants.length ?? 0}人のメンバー`;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={88}>
        <View style={styles.eventBar}>
          <View style={[styles.eventIcon, { backgroundColor: event?.coverColor || palette.primarySoft }]}><Ionicons name="calendar" size={19} color={event?.accentColor || palette.primary} /></View>
          <View style={styles.eventCopy}><Text style={styles.eventTitle} numberOfLines={1}>{event?.title || 'イベント'}</Text><Text style={styles.memberText}>{memberStatus}</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="メッセージを検索" style={[styles.headerButton, searchOpen && styles.headerButtonActive]} onPress={() => { setSearchOpen((current) => !current); setSearchQuery(''); }}><Ionicons name={searchOpen ? 'close' : 'search'} size={20} color={palette.ink} /></TouchableOpacity>
        </View>
        {searchOpen ? <View style={styles.searchBar}><Ionicons name="search" size={17} color={palette.muted} /><TextInput autoFocus value={searchQuery} onChangeText={setSearchQuery} placeholder="メッセージ・送信者を検索" placeholderTextColor={palette.muted} style={styles.searchInput} /><Text style={styles.searchCount}>{visibleMessages.length}件</Text></View> : null}
        {pinnedMessages[0] ? <TouchableOpacity style={styles.pinnedBar} onPress={() => { setSearchOpen(true); setSearchQuery(pinnedMessages[0].text); }} activeOpacity={0.8}><Ionicons name="bookmark" size={16} color={palette.accent} /><View style={styles.pinnedCopy}><Text style={styles.pinnedLabel}>ピン留め</Text><Text style={styles.pinnedText} numberOfLines={1}>{pinnedMessages[0].text || '写真'}</Text></View>{pinnedMessages.length > 1 ? <Text style={styles.pinnedCount}>+{pinnedMessages.length - 1}</Text> : null}</TouchableOpacity> : null}
        <ScrollView style={styles.flex} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {hiddenCount > 0 && <View style={styles.hidden}><Ionicons name="eye-off-outline" size={14} color={palette.muted} /><Text style={styles.hiddenText}>ブロック中の利用者のメッセージ {hiddenCount}件を非表示</Text></View>}
          {visibleMessages.length === 0 && <View style={styles.emptyMessages}><Ionicons name={searchQuery ? 'search-outline' : 'chatbubbles-outline'} size={30} color={palette.muted} /><Text style={styles.emptyTitle}>{searchQuery ? '一致するメッセージはありません' : '最初のメッセージを送りましょう'}</Text></View>}
          {visibleMessages.map((message, index) => {
            const showDate = index === 0 || messageDateKey(visibleMessages[index - 1].createdAt) !== messageDateKey(message.createdAt);
            const replied = message.replyToId ? messageById.get(message.replyToId) : undefined;
            const readCount = event ? getMessageReadCount(message, event.participants) : 0;
            return <Fragment key={message.id}>
              {showDate && <View style={styles.datePill}><Text style={styles.datePillText}>{messageDateLabel(message.createdAt)}</Text></View>}
              <View style={[styles.messageRow, message.mine && styles.messageRowMine]}>
                {!message.mine && <View style={[styles.avatar, { backgroundColor: message.color }]}><Text style={styles.avatarText}>{message.initials}</Text></View>}
                <View style={[styles.messageContent, message.mine && styles.messageContentMine]}>
                  {!message.mine && <View style={styles.authorRow}><Text style={styles.author}>{message.author}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`${message.author}さんのメッセージを操作`} onPress={() => setSelectedMessage(message)}><Ionicons name="ellipsis-horizontal" size={17} color={palette.muted} /></TouchableOpacity></View>}
                  <TouchableOpacity activeOpacity={0.82} onLongPress={() => setSelectedMessage(message)}>
                    <View style={[styles.bubble, message.mine ? styles.bubbleMine : styles.bubbleOther, (message.imagePath || message.imageUri) && styles.imageBubble, message.deletedAt && styles.deletedBubble]}>
                      {message.pinnedAt ? <View style={styles.pinInside}><Ionicons name="bookmark" size={11} color={message.mine ? '#DCE9E4' : palette.accent} /><Text style={[styles.pinInsideText, message.mine && styles.messageTextMine]}>ピン留め</Text></View> : null}
                      {replied ? <View style={[styles.replyPreview, message.mine && styles.replyPreviewMine]}><Text style={[styles.replyAuthor, message.mine && styles.messageTextMine]} numberOfLines={1}>{replied.author}</Text><Text style={[styles.replyText, message.mine && styles.replyTextMine]} numberOfLines={1}>{replied.deletedAt ? '送信が取り消されました' : replied.text || '写真'}</Text></View> : null}
                      {message.deletedAt ? <View style={styles.deletedContent}><Ionicons name="ban-outline" size={15} color={palette.muted} /><Text style={styles.deletedText}>送信が取り消されました</Text></View> : <>
                        {message.imageUri ? <TouchableOpacity accessibilityRole="imagebutton" accessibilityLabel={`${message.author}さんが共有した写真を拡大`} activeOpacity={0.9} onPress={() => setViewingImage(message.imageUri!)}><Image source={{ uri: message.imageUri }} style={[styles.messageImage, { aspectRatio: imageAspectRatio(message.imageWidth, message.imageHeight) }]} contentFit="cover" transition={150} /></TouchableOpacity> : null}
                        {!message.imageUri && message.imagePath ? <View style={styles.imageUnavailable}><Ionicons name="image-outline" size={24} color={palette.muted} /><Text style={styles.imageUnavailableText}>写真を読み込めませんでした</Text></View> : null}
                        {message.text ? <Text style={[styles.messageText, message.mine && styles.messageTextMine, (message.imagePath || message.imageUri) && styles.messageTextWithImage]}>{message.text}</Text> : null}
                      </>}
                    </View>
                  </TouchableOpacity>
                  {!message.deletedAt && message.reactions?.length ? <View style={[styles.reactions, message.mine && styles.reactionsMine]}>{message.reactions.map((reaction) => <TouchableOpacity key={reaction.emoji} style={[styles.reactionChip, reaction.userIds.includes(user?.id ?? 'me') && styles.reactionChipMine]} onPress={() => react(message, reaction.emoji)} disabled={archived}><Text style={styles.reactionEmoji}>{reaction.emoji}</Text><Text style={styles.reactionCount}>{reaction.userIds.length}</Text></TouchableOpacity>)}</View> : null}
                  <View style={[styles.metaRow, message.mine && styles.metaRowMine]}>{message.mine && readCount > 0 ? <Text style={styles.readCount}>既読 {readCount}</Text> : null}{message.editedAt && !message.deletedAt ? <Text style={styles.edited}>編集済み</Text> : null}<Text style={[styles.time, message.mine && styles.timeMine]}>{messageTimeLabel(message.createdAt, message.time)}</Text>{message.mine ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="メッセージを操作" onPress={() => setSelectedMessage(message)}><Ionicons name="ellipsis-horizontal" size={16} color={palette.muted} /></TouchableOpacity> : null}</View>
                </View>
              </View>
            </Fragment>;
          })}
        </ScrollView>
        {typingNames.length ? <View style={styles.typingBar}><View style={styles.typingDots}><View style={styles.typingDot} /><View style={styles.typingDot} /><View style={styles.typingDot} /></View><Text style={styles.typingText}>{typingNames.slice(0, 2).join('、')}さんが入力中</Text></View> : null}
        {!archived ? <View style={styles.composerArea}>
          {mentionCandidates.length > 0 && !editing ? <View style={styles.mentions}>{mentionCandidates.map((participant) => <TouchableOpacity key={participant.id} style={styles.mention} onPress={() => setText((current) => insertMention(current, participant.name))}><View style={[styles.mentionAvatar, { backgroundColor: participant.avatarColor }]}><Text style={styles.mentionAvatarText}>{participant.initials}</Text></View><Text style={styles.mentionName}>{participant.name}</Text></TouchableOpacity>)}</View> : null}
          {replyingTo || editing ? <View style={styles.composerContext}><View style={styles.contextLine} /><View style={styles.contextCopy}><Text style={styles.contextLabel}>{editing ? 'メッセージを編集' : `${replyingTo?.author ?? ''}さんに返信`}</Text><Text style={styles.contextText} numberOfLines={1}>{editing?.text || replyingTo?.text || '写真'}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="操作を取り消す" style={styles.contextClose} onPress={resetComposer}><Ionicons name="close" size={18} color={palette.ink} /></TouchableOpacity></View> : null}
          {selectedImage ? <View style={styles.selectedImageRow}><Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} contentFit="cover" /><View style={styles.selectedImageCopy}><Text style={styles.selectedImageTitle}>写真を添付しました</Text><Text style={styles.selectedImageNote}>送信するとイベント参加者へ共有されます</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="添付した写真を外す" style={styles.removeImage} onPress={() => setSelectedImage(null)}><Ionicons name="close" size={18} color={palette.ink} /></TouchableOpacity></View> : null}
          <View style={styles.composer}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="写真を選択" style={styles.attach} onPress={pickImage} disabled={sending || Boolean(editing)}><Ionicons name="image-outline" size={21} color={editing ? palette.muted : palette.primary} /></TouchableOpacity>
            <View style={styles.inputWrap}><TextInput accessibilityLabel="メッセージ" style={styles.input} placeholder={editing ? 'メッセージを編集' : selectedImage ? 'コメントを追加（任意）' : 'メッセージを入力'} placeholderTextColor="#7B847E" value={text} onChangeText={setText} multiline maxLength={2000} selectionColor={palette.primary} editable={!sending} /></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={editing ? '編集を保存' : 'メッセージを送信'} accessibilityState={{ disabled: sending || (!text.trim() && !selectedImage) }} style={[styles.send, (sending || (!text.trim() && !selectedImage)) && styles.sendDisabled]} onPress={send} disabled={sending || (!text.trim() && !selectedImage)}><Ionicons name={sending ? 'hourglass-outline' : editing ? 'checkmark' : 'arrow-up'} size={20} color={palette.surface} /></TouchableOpacity>
          </View>
        </View> : <View style={styles.archivedBar}><Ionicons name="lock-closed-outline" size={16} color={palette.muted} /><Text style={styles.archivedText}>アーカイブ済みのため閲覧のみできます</Text></View>}
      </KeyboardAvoidingView>

      <Modal visible={Boolean(selectedMessage)} transparent animationType="fade" onRequestClose={() => setSelectedMessage(null)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setSelectedMessage(null)}>
          {selectedMessage ? <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => undefined}>
            {!selectedMessage.deletedAt && !archived ? <View style={styles.reactionPicker}>{CHAT_REACTION_EMOJIS.map((emoji) => <TouchableOpacity key={emoji} accessibilityRole="button" accessibilityLabel={`${emoji}でリアクション`} style={styles.reactionButton} onPress={() => { void react(selectedMessage, emoji); setSelectedMessage(null); }}><Text style={styles.reactionPickerEmoji}>{emoji}</Text></TouchableOpacity>)}</View> : null}
            {!selectedMessage.deletedAt && <TouchableOpacity style={styles.sheetAction} onPress={() => { setReplyingTo(selectedMessage); setEditing(null); setSelectedMessage(null); }}><Ionicons name="arrow-undo-outline" size={21} color={palette.ink} /><Text style={styles.sheetActionText}>返信</Text></TouchableOpacity>}
            {!archived && canEditChatMessage(selectedMessage) ? <TouchableOpacity style={styles.sheetAction} onPress={() => startEditing(selectedMessage)}><Ionicons name="create-outline" size={21} color={palette.ink} /><Text style={styles.sheetActionText}>編集</Text></TouchableOpacity> : null}
            {!archived && manager && !selectedMessage.deletedAt ? <TouchableOpacity style={styles.sheetAction} onPress={() => void togglePin(selectedMessage)}><Ionicons name={selectedMessage.pinnedAt ? 'bookmark-outline' : 'bookmark'} size={21} color={palette.ink} /><Text style={styles.sheetActionText}>{selectedMessage.pinnedAt ? 'ピン留めを外す' : 'ピン留めする'}</Text></TouchableOpacity> : null}
            {!archived && canDeleteChatMessage(selectedMessage, manager) ? <TouchableOpacity style={styles.sheetAction} onPress={() => confirmDelete(selectedMessage)}><Ionicons name="trash-outline" size={21} color={palette.danger} /><Text style={[styles.sheetActionText, styles.dangerText]}>{selectedMessage.mine ? '送信を取り消す' : 'メッセージを削除'}</Text></TouchableOpacity> : null}
            {!selectedMessage.mine && !selectedMessage.deletedAt ? <TouchableOpacity style={styles.sheetAction} onPress={() => { setSelectedMessage(null); router.push({ pathname: '/safety/report', params: { eventId: id, messageId: selectedMessage.id, targetUserId: selectedMessage.authorId, targetName: selectedMessage.author } }); }}><Ionicons name="flag-outline" size={21} color={palette.danger} /><Text style={[styles.sheetActionText, styles.dangerText]}>通報・ブロック</Text></TouchableOpacity> : null}
            <TouchableOpacity style={[styles.sheetAction, styles.sheetCancel]} onPress={() => setSelectedMessage(null)}><Text style={styles.sheetCancelText}>閉じる</Text></TouchableOpacity>
          </TouchableOpacity> : null}
        </TouchableOpacity>
      </Modal>

      <Modal visible={Boolean(viewingImage)} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <SafeAreaView style={styles.viewer}><TouchableOpacity accessibilityRole="button" accessibilityLabel="写真を閉じる" style={styles.viewerClose} onPress={() => setViewingImage(null)}><Ionicons name="close" size={26} color="#FFFFFF" /></TouchableOpacity>{viewingImage ? <Image source={{ uri: viewingImage }} style={styles.viewerImage} contentFit="contain" /> : null}</SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 },
  eventBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  eventIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, eventCopy: { flex: 1, marginLeft: 11 }, eventTitle: { color: palette.ink, fontSize: 14, fontWeight: '800', marginBottom: 3 }, memberText: { color: palette.muted, fontSize: 11 },
  headerButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECEDE9' }, headerButtonActive: { backgroundColor: '#DEE4E0' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: palette.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, searchInput: { flex: 1, height: 36, paddingHorizontal: 3, color: palette.ink, fontSize: 13 }, searchCount: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  pinnedBar: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: '#F3F0E8', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9D2BF' }, pinnedCopy: { flex: 1 }, pinnedLabel: { color: palette.accent, fontSize: 10, fontWeight: '800' }, pinnedText: { color: palette.ink, fontSize: 12, marginTop: 1 }, pinnedCount: { color: palette.muted, fontSize: 11, fontWeight: '800' },
  messages: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 22 }, datePill: { alignSelf: 'center', backgroundColor: '#E4E5DF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9, marginBottom: 16, marginTop: 2 }, datePillText: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  hidden: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', backgroundColor: '#E4E5DF', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 15 }, hiddenText: { color: palette.muted, fontSize: 11, marginLeft: 5 },
  emptyMessages: { alignItems: 'center', paddingVertical: 45 }, emptyTitle: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: 10 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 15, maxWidth: '90%' }, messageRowMine: { alignSelf: 'flex-end', justifyContent: 'flex-end' }, avatar: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 8 }, avatarText: { color: palette.surface, fontSize: 11, fontWeight: '800' }, messageContent: { maxWidth: '88%' }, messageContentMine: { alignItems: 'flex-end' }, authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, author: { color: palette.muted, fontSize: 11, marginLeft: 4, marginBottom: 5 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 17, overflow: 'hidden' }, bubbleOther: { backgroundColor: palette.surface, borderBottomLeftRadius: 4 }, bubbleMine: { backgroundColor: palette.primary, borderBottomRightRadius: 4 }, deletedBubble: { backgroundColor: '#E4E5E1', borderWidth: StyleSheet.hairlineWidth, borderColor: '#C9CDC8' }, imageBubble: { width: 242, padding: 5 },
  pinInside: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 }, pinInsideText: { color: palette.accent, fontSize: 9, fontWeight: '800' },
  replyPreview: { borderLeftWidth: 3, borderLeftColor: palette.accent, paddingLeft: 8, paddingVertical: 3, marginBottom: 7, minWidth: 120 }, replyPreviewMine: { borderLeftColor: '#DCE9E4' }, replyAuthor: { color: palette.accent, fontSize: 10, fontWeight: '800' }, replyText: { color: palette.muted, fontSize: 10, marginTop: 2 }, replyTextMine: { color: '#DCE9E4' },
  deletedContent: { flexDirection: 'row', alignItems: 'center', gap: 6 }, deletedText: { color: palette.muted, fontSize: 12, fontStyle: 'italic' },
  messageImage: { width: '100%', maxHeight: 320, borderRadius: 13, backgroundColor: '#DDE1DD' }, imageUnavailable: { height: 130, borderRadius: 13, backgroundColor: '#E6E8E4', alignItems: 'center', justifyContent: 'center' }, imageUnavailableText: { color: palette.muted, fontSize: 11, fontWeight: '700', marginTop: 7 }, messageText: { color: palette.ink, fontSize: 14, lineHeight: 21 }, messageTextMine: { color: palette.surface }, messageTextWithImage: { marginHorizontal: 9, marginTop: 8, marginBottom: 5 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, marginLeft: 3 }, reactionsMine: { justifyContent: 'flex-end', marginRight: 3 }, reactionChip: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 27, paddingHorizontal: 7, borderRadius: 10, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }, reactionChipMine: { borderColor: palette.primary, backgroundColor: '#E3EBE7' }, reactionEmoji: { fontSize: 13 }, reactionCount: { color: palette.ink, fontSize: 10, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, marginLeft: 4 }, metaRowMine: { justifyContent: 'flex-end', marginRight: 3 }, readCount: { color: palette.muted, fontSize: 9, fontWeight: '700' }, edited: { color: palette.muted, fontSize: 9 }, time: { color: palette.muted, fontSize: 10 }, timeMine: { marginRight: 1 },
  typingBar: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#ECEDE9' }, typingDots: { flexDirection: 'row', gap: 3 }, typingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.primary }, typingText: { color: palette.muted, fontSize: 10 },
  composerArea: { backgroundColor: palette.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line }, mentions: { maxHeight: 155, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, mention: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 7 }, mentionAvatar: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, mentionAvatarText: { color: palette.surface, fontSize: 9, fontWeight: '800' }, mentionName: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  composerContext: { minHeight: 55, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingTop: 8 }, contextLine: { width: 3, height: 35, borderRadius: 2, backgroundColor: palette.accent }, contextCopy: { flex: 1, marginHorizontal: 9 }, contextLabel: { color: palette.accent, fontSize: 10, fontWeight: '800' }, contextText: { color: palette.muted, fontSize: 11, marginTop: 3 }, contextClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  selectedImageRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 9 }, selectedImage: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#E6E8E4' }, selectedImageCopy: { flex: 1, marginHorizontal: 10 }, selectedImageTitle: { color: palette.ink, fontSize: 12, fontWeight: '800' }, selectedImageNote: { color: palette.muted, fontSize: 10, marginTop: 3 }, removeImage: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#ECEDE9', alignItems: 'center', justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 11, paddingTop: 9, paddingBottom: 10 }, attach: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }, inputWrap: { flex: 1, minHeight: 42, maxHeight: 105, borderRadius: 16, backgroundColor: '#ECEDE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 }, input: { flex: 1, color: palette.ink, fontSize: 14, paddingVertical: 10 }, send: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }, sendDisabled: { backgroundColor: '#AAB5AF' },
  archivedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: palette.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, padding: 15 }, archivedText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,16,13,0.42)', padding: 12 }, sheet: { backgroundColor: palette.surface, borderRadius: 20, padding: 10, paddingBottom: 13 }, reactionPicker: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, reactionButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECEDE9' }, reactionPickerEmoji: { fontSize: 22 }, sheetAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, sheetActionText: { color: palette.ink, fontSize: 14, fontWeight: '700' }, dangerText: { color: palette.danger }, sheetCancel: { justifyContent: 'center', borderBottomWidth: 0, marginTop: 4 }, sheetCancelText: { color: palette.muted, fontSize: 14, fontWeight: '800' },
  viewer: { flex: 1, backgroundColor: 'rgba(10, 16, 13, 0.96)', alignItems: 'center', justifyContent: 'center' }, viewerImage: { width: '100%', height: '82%' }, viewerClose: { position: 'absolute', top: 12, right: 14, zIndex: 2, width: 46, height: 46, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
});
