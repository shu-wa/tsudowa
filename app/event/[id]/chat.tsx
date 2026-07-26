import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { ChatImageInput } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const [selectedImage, setSelectedImage] = useState<ChatImageInput | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    markChatRead(id);
  }, [event?.messages.length, id, markChatRead]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        selectionLimit: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024) return Alert.alert('写真が大きすぎます', '8MB以下の写真を選択してください。');
      setSelectedImage({
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        fileName: asset.fileName ?? undefined,
      });
    } catch {
      Alert.alert('写真を開けませんでした', '端末の写真アクセス設定を確認して、もう一度お試しください。');
    }
  };

  const send = async () => {
    if ((!text.trim() && !selectedImage) || sending) return;
    setSending(true);
    const error = await addMessage(id, text.trim(), selectedImage ?? undefined);
    setSending(false);
    if (error) return Alert.alert('このメッセージは送信できません', error);
    setText('');
    setSelectedImage(null);
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
                  <TouchableOpacity activeOpacity={0.8} onLongPress={() => !message.mine && router.push({ pathname: '/safety/report', params: { eventId: id, messageId: message.id, targetUserId: message.authorId, targetName: message.author } })}>
                    <View style={[styles.bubble, message.mine ? styles.bubbleMine : styles.bubbleOther, message.imagePath || message.imageUri ? styles.imageBubble : null]}>
                      {message.imageUri ? <TouchableOpacity accessibilityRole="imagebutton" accessibilityLabel={`${message.author}さんが共有した写真を拡大`} activeOpacity={0.9} onPress={() => setViewingImage(message.imageUri!)}><Image source={{ uri: message.imageUri }} style={[styles.messageImage, { aspectRatio: imageAspectRatio(message.imageWidth, message.imageHeight) }]} contentFit="cover" transition={150} /></TouchableOpacity> : null}
                      {!message.imageUri && message.imagePath ? <View style={styles.imageUnavailable}><Ionicons name="image-outline" size={24} color={palette.muted} /><Text style={styles.imageUnavailableText}>写真を読み込めませんでした</Text></View> : null}
                      {message.text ? <Text style={[styles.messageText, message.mine && styles.messageTextMine, (message.imagePath || message.imageUri) && styles.messageTextWithImage]}>{message.text}</Text> : null}
                    </View>
                  </TouchableOpacity>
                  <Text style={[styles.time, message.mine && styles.timeMine]}>{messageTimeLabel(message.createdAt, message.time)}</Text>
                </View>
              </View>
            </Fragment>;
          })}
        </ScrollView>
        <View style={styles.composerArea}>
          {selectedImage ? <View style={styles.selectedImageRow}><Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} contentFit="cover" /><View style={styles.selectedImageCopy}><Text style={styles.selectedImageTitle}>写真を添付しました</Text><Text style={styles.selectedImageNote}>送信するとイベント参加者へ共有されます</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="添付した写真を外す" style={styles.removeImage} onPress={() => setSelectedImage(null)}><Ionicons name="close" size={18} color={palette.ink} /></TouchableOpacity></View> : null}
          <View style={styles.composer}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="写真を選択" style={styles.attach} onPress={pickImage} disabled={sending}><Ionicons name="image-outline" size={21} color={palette.primary} /></TouchableOpacity>
            <View style={styles.inputWrap}><TextInput accessibilityLabel="メッセージ" style={styles.input} placeholder={selectedImage ? 'コメントを追加（任意）' : 'メッセージを入力'} placeholderTextColor="#9AA29D" value={text} onChangeText={setText} multiline selectionColor={palette.primary} editable={!sending} /></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="メッセージを送信" accessibilityState={{ disabled: sending || (!text.trim() && !selectedImage) }} style={[styles.send, (sending || (!text.trim() && !selectedImage)) && styles.sendDisabled]} onPress={send} disabled={sending || (!text.trim() && !selectedImage)}><Ionicons name={sending ? 'hourglass-outline' : 'arrow-up'} size={20} color={palette.surface} /></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={Boolean(viewingImage)} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <SafeAreaView style={styles.viewer}><TouchableOpacity accessibilityRole="button" accessibilityLabel="写真を閉じる" style={styles.viewerClose} onPress={() => setViewingImage(null)}><Ionicons name="close" size={26} color="#FFFFFF" /></TouchableOpacity>{viewingImage ? <Image source={{ uri: viewingImage }} style={styles.viewerImage} contentFit="contain" /> : null}</SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const imageAspectRatio = (width?: number, height?: number) => {
  if (!width || !height) return 1;
  return Math.max(0.7, Math.min(1.6, width / height));
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, flex: { flex: 1 },
  eventBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, paddingHorizontal: 15, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  eventIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, eventCopy: { flex: 1, marginLeft: 11 }, eventTitle: { color: palette.ink, fontSize: 13, fontWeight: '800', marginBottom: 3 }, memberText: { color: palette.muted, fontSize: 12 },
  messages: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 22 }, datePill: { alignSelf: 'center', backgroundColor: '#E4E5DF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, marginBottom: 16, marginTop: 2 }, datePillText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  hidden: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', backgroundColor: '#E4E5DF', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 15 }, hiddenText: { color: palette.muted, fontSize: 11, marginLeft: 5 },
  emptyMessages: { alignItems: 'center', paddingVertical: 45 }, emptyTitle: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: 10 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 17, maxWidth: '88%' }, messageRowMine: { alignSelf: 'flex-end', justifyContent: 'flex-end' }, avatar: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8 }, avatarText: { color: palette.surface, fontSize: 11, fontWeight: '800' }, messageContent: { maxWidth: '88%' }, messageContentMine: { alignItems: 'flex-end' }, authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, author: { color: palette.muted, fontSize: 12, marginLeft: 4, marginBottom: 5 },
  bubble: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18, overflow: 'hidden' }, bubbleOther: { backgroundColor: palette.surface, borderBottomLeftRadius: 5 }, bubbleMine: { backgroundColor: palette.primary, borderBottomRightRadius: 5 }, imageBubble: { width: 242, padding: 5 }, messageImage: { width: '100%', maxHeight: 320, borderRadius: 14, backgroundColor: '#DDE1DD' }, imageUnavailable: { height: 130, borderRadius: 14, backgroundColor: '#E6E8E4', alignItems: 'center', justifyContent: 'center' }, imageUnavailableText: { color: palette.muted, fontSize: 11, fontWeight: '700', marginTop: 7 }, messageText: { color: palette.ink, fontSize: 13, lineHeight: 20 }, messageTextMine: { color: palette.surface }, messageTextWithImage: { marginHorizontal: 9, marginTop: 8, marginBottom: 5 }, time: { color: palette.muted, fontSize: 11, marginTop: 4, marginLeft: 4 }, timeMine: { marginRight: 4 },
  composerArea: { backgroundColor: palette.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line }, selectedImageRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 9 }, selectedImage: { width: 54, height: 54, borderRadius: 13, backgroundColor: '#E6E8E4' }, selectedImageCopy: { flex: 1, marginHorizontal: 10 }, selectedImageTitle: { color: palette.ink, fontSize: 12, fontWeight: '800' }, selectedImageNote: { color: palette.muted, fontSize: 10, marginTop: 3 }, removeImage: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#ECEDE9', alignItems: 'center', justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 11, paddingTop: 9, paddingBottom: 10 }, attach: { width: 42, height: 42, borderRadius: 15, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }, inputWrap: { flex: 1, minHeight: 42, maxHeight: 100, borderRadius: 17, backgroundColor: '#F0F1ED', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 }, input: { flex: 1, color: palette.ink, fontSize: 13, paddingVertical: 10 }, send: { width: 42, height: 42, borderRadius: 15, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }, sendDisabled: { backgroundColor: '#B8C2BC' },
  viewer: { flex: 1, backgroundColor: 'rgba(10, 16, 13, 0.96)', alignItems: 'center', justifyContent: 'center' }, viewerImage: { width: '100%', height: '82%' }, viewerClose: { position: 'absolute', top: 12, right: 14, zIndex: 2, width: 46, height: 46, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
});
