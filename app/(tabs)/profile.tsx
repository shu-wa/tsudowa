import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { useAuth } from '@/context/auth-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

export default function ProfileScreen() {
  const { events, profile, settings, setNotificationsEnabled, resetLocalData } = useEvents();
  const { isConfigured, user, signOut } = useAuth();
  const [notificationUpdating, setNotificationUpdating] = useState(false);
  const hostedCount = events.filter((event) => event.participants.some((person) => person.role === '主催者' && (person.id === user?.id || (!user && person.id === 'me')))).length;
  const connections = new Set(events.flatMap((event) => event.participants.filter((person) => person.id !== user?.id && person.id !== 'me').map((person) => person.id))).size;

  const confirmReset = () => Alert.alert('イベントデータを削除しますか？', 'この端末に保存されたイベント、チャット、支払状態を削除します。登録情報と同意履歴は残ります。', [
    { text: 'キャンセル', style: 'cancel' },
    { text: '削除する', style: 'destructive', onPress: resetLocalData },
  ]);

  const changeNotifications = async (enabled: boolean) => {
    setNotificationUpdating(true);
    const error = await setNotificationsEnabled(enabled);
    setNotificationUpdating(false);
    if (error) Alert.alert('通知を有効にできません', error);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>MY PAGE</Text><Text style={styles.title}>マイページ</Text>
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: profile.avatarColor }]}><Text style={styles.avatarText}>{profile.initials}</Text></View>
          <View style={styles.profileCopy}><Text style={styles.name}>{profile.name}</Text><Text style={styles.handle}>{[profile.handle, profile.city].filter(Boolean).join(' · ')}</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="プロフィールを編集" style={styles.edit} onPress={() => router.push('/profile-edit')}><Ionicons name="pencil" size={16} color={palette.primary} /></TouchableOpacity>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statNumber}>{events.length}</Text><Text style={styles.statLabel}>参加イベント</Text></View>
          <View style={styles.divider} />
          <View style={styles.stat}><Text style={styles.statNumber}>{hostedCount}</Text><Text style={styles.statLabel}>主催</Text></View>
          <View style={styles.divider} />
          <View style={styles.stat}><Text style={styles.statNumber}>{connections}</Text><Text style={styles.statLabel}>つながり</Text></View>
        </View>

        <View style={[styles.cloudStatus, { backgroundColor: isConfigured ? palette.primarySoft : '#F7EECF' }]}><Ionicons name={isConfigured ? 'cloud-outline' : 'phone-portrait-outline'} size={21} color={isConfigured ? palette.primary : '#8C6717'} /><View style={styles.cloudCopy}><Text style={styles.cloudTitle}>{isConfigured ? 'クラウド保存を使用' : 'この端末に保存'}</Text><Text style={styles.cloudText}>{isConfigured ? user?.email ?? 'ログイン済み' : 'イベント情報はこの端末に保存されています'}</Text></View></View>

        <Text style={styles.sectionTitle}>設定</Text>
        <View style={styles.settings}>
          <View style={styles.row}>
            <View style={styles.rowIcon}><Ionicons name="notifications-outline" size={20} color={palette.primary} /></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>端末リマインダー</Text><Text style={styles.rowSub}>イベント開始と集金期限を事前に通知</Text></View><Switch value={settings.notificationsEnabled} onValueChange={changeNotifications} disabled={notificationUpdating} trackColor={{ false: '#D5D9D6', true: '#8FB5A0' }} thumbColor={palette.surface} />
          </View>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/profile-edit')}><View style={styles.rowIcon}><Ionicons name="person-outline" size={20} color={palette.primary} /></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>プロフィールを編集</Text><Text style={styles.rowSub}>名前、表示ID、地域</Text></View><Ionicons name="chevron-forward" size={18} color={palette.muted} /></TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/privacy-center')}><View style={styles.rowIcon}><Ionicons name="lock-closed-outline" size={20} color={palette.primary} /></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>プライバシーセンター</Text><Text style={styles.rowSub}>データ利用、書き出し、アカウント削除</Text></View><Ionicons name="chevron-forward" size={18} color={palette.muted} /></TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/safety')}><View style={styles.rowIcon}><Ionicons name="shield-checkmark-outline" size={20} color={palette.primary} /></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>安全センター</Text><Text style={styles.rowSub}>通報、ブロック、コミュニティルール</Text></View><Ionicons name="chevron-forward" size={18} color={palette.muted} /></TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/legal/terms')}><View style={styles.rowIcon}><Ionicons name="document-text-outline" size={20} color={palette.primary} /></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>規約とポリシー</Text><Text style={styles.rowSub}>利用規約と同意内容を確認</Text></View><Ionicons name="chevron-forward" size={18} color={palette.muted} /></TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/support')}><View style={styles.rowIcon}><Ionicons name="help-circle-outline" size={20} color={palette.primary} /></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>ヘルプとお問い合わせ</Text><Text style={styles.rowSub}>使い方、プライバシー、安全に関する連絡</Text></View><Ionicons name="chevron-forward" size={18} color={palette.muted} /></TouchableOpacity>
          {isConfigured && <TouchableOpacity style={styles.row} onPress={() => Alert.alert('ログアウトしますか？', undefined, [{ text: 'キャンセル', style: 'cancel' }, { text: 'ログアウト', style: 'destructive', onPress: signOut }])}><View style={styles.rowIcon}><Ionicons name="log-out-outline" size={20} color={palette.primary} /></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>ログアウト</Text><Text style={styles.rowSub}>この端末のセッションを終了</Text></View><Ionicons name="chevron-forward" size={18} color={palette.muted} /></TouchableOpacity>}
        </View>
        {!isConfigured && <TouchableOpacity style={styles.resetButton} onPress={confirmReset}><Ionicons name="refresh-outline" size={17} color={palette.danger} /><Text style={styles.resetText}>保存データを初期化</Text></TouchableOpacity>}
        <Text style={styles.version}>Do Eventer · Version {Constants.expoConfig?.version ?? '0.12.0'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas }, content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 34 }, eyebrow: { fontSize: 13, letterSpacing: 1.8, color: palette.accent, fontWeight: '800', marginBottom: 4 }, title: { fontSize: 26, color: palette.ink, fontWeight: '800', marginBottom: 24 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 23, padding: 17 }, avatar: { width: 58, height: 58, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }, avatarText: { color: palette.surface, fontSize: 16, fontWeight: '800' }, profileCopy: { flex: 1, marginLeft: 14 }, name: { color: palette.ink, fontSize: 18, fontWeight: '800', marginBottom: 4 }, handle: { color: palette.muted, fontSize: 12 }, edit: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  stats: { flexDirection: 'row', backgroundColor: palette.primary, borderRadius: 23, paddingVertical: 18, marginTop: 12, marginBottom: 28 }, stat: { flex: 1, alignItems: 'center' }, statNumber: { color: palette.surface, fontSize: 20, fontWeight: '800', marginBottom: 3 }, statLabel: { color: '#D8E6DE', fontSize: 12 }, divider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.25)' },
  cloudStatus: { flexDirection: 'row', alignItems: 'center', borderRadius: 17, padding: 14, marginTop: -16, marginBottom: 25 }, cloudCopy: { flex: 1, marginLeft: 10 }, cloudTitle: { color: palette.ink, fontSize: 13, fontWeight: '900' }, cloudText: { color: palette.muted, fontSize: 12, marginTop: 3 },
  sectionTitle: { color: palette.ink, fontSize: 19, fontWeight: '800', marginBottom: 12 }, settings: { backgroundColor: palette.surface, borderRadius: 23, overflow: 'hidden' }, row: { minHeight: 72, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft }, rowCopy: { flex: 1, marginLeft: 12 }, rowLabel: { color: palette.ink, fontSize: 14, fontWeight: '700', marginBottom: 3 }, rowSub: { color: palette.muted, fontSize: 12, lineHeight: 17 }, resetButton: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18 }, resetText: { color: palette.danger, fontSize: 13, fontWeight: '700', marginLeft: 6 }, version: { textAlign: 'center', color: palette.muted, fontSize: 12, marginTop: 10 },
});
