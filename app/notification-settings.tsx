import { NativeTimeField } from '@/components/native-time-field';
import { RefreshableScrollView as ScrollView } from '@/components/refreshable-scroll-view';
import { palette } from '@/constants/theme';
import { useEvents } from '@/context/event-context';
import { defaultNotificationPreferences } from '@/lib/cloud-notifications';
import { isEventArchived, isEventPast } from '@/lib/event-display';
import { NotificationPreferences } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PreferenceKey = Exclude<keyof NotificationPreferences, 'quietStart' | 'quietEnd'>;

export default function NotificationSettingsScreen() {
  const {
    events,
    settings,
    setNotificationsEnabled,
    setNotificationPreferences,
    setEventNotificationMuted,
  } = useEvents();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    ...defaultNotificationPreferences,
    ...settings.notificationPreferences,
  });
  const [masterUpdating, setMasterUpdating] = useState(false);
  const [openTime, setOpenTime] = useState<'start' | 'end'>();

  useEffect(() => {
    setPreferences({
      ...defaultNotificationPreferences,
      ...settings.notificationPreferences,
    });
  }, [settings.notificationPreferences]);

  const setPreference = async (key: PreferenceKey, value: boolean) => {
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    const error = await setNotificationPreferences(next);
    if (error) {
      setPreferences(previous);
      Alert.alert('保存できませんでした', error);
    }
  };

  const setQuietTime = async (key: 'quietStart' | 'quietEnd', value: string) => {
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    const error = await setNotificationPreferences(next);
    if (error) {
      setPreferences(previous);
      Alert.alert('保存できませんでした', error);
    }
  };

  const setMaster = async (enabled: boolean) => {
    setMasterUpdating(true);
    const error = await setNotificationsEnabled(enabled);
    setMasterUpdating(false);
    if (error) Alert.alert('通知設定を変更できませんでした', error);
  };

  const activeEvents = events
    .filter((event) => !isEventArchived(event) && !isEventPast(event))
    .sort((a, b) => {
      if (a.dateStatus === 'undecided' && b.dateStatus !== 'undecided') return 1;
      if (b.dateStatus === 'undecided' && a.dateStatus !== 'undecided') return -1;
      return `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`);
    });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>通知設定</Text>
        <Text style={styles.lead}>
          必要な情報だけを受け取れます。イベントごとの通知停止は、この端末以外にも同期されます。
        </Text>

        {Platform.OS === 'web' ? (
          <View style={styles.notice}>
            <Ionicons name="phone-portrait-outline" size={18} color={palette.primary} />
            <Text style={styles.noticeText}>プッシュ通知の受信はiOS・Androidアプリで利用できます。</Text>
          </View>
        ) : null}

        <View style={styles.master}>
          <View style={styles.masterIcon}><Ionicons name="notifications-outline" size={22} color={palette.surface} /></View>
          <View style={styles.masterCopy}>
            <Text style={styles.masterTitle}>通知を受け取る</Text>
            <Text style={styles.masterText}>端末通知全体のオン・オフ</Text>
          </View>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={setMaster}
            disabled={masterUpdating}
            trackColor={{ false: '#AEB3AF', true: palette.accent }}
            thumbColor={palette.surface}
          />
        </View>

        <Section title="予定のリマインダー" description="指定時刻の前に端末へお知らせします">
          <ToggleRow label="イベント開始" detail="前日、または開始1時間前" value={preferences.eventReminders} onChange={(value) => setPreference('eventReminders', value)} />
          <ToggleRow label="集金の支払期限" detail="期限の前日にお知らせ" value={preferences.collectionReminders} onChange={(value) => setPreference('collectionReminders', value)} />
        </Section>

        <Section title="新着情報" description="アプリを閉じていても受け取れます">
          <ToggleRow label="チャットの新着" detail="新しいメッセージと写真" value={preferences.chatMessages} onChange={(value) => setPreference('chatMessages', value)} />
          <ToggleRow label="メンション・返信" detail="自分宛ての重要なメッセージ" value={preferences.mentionsAndReplies} onChange={(value) => setPreference('mentionsAndReplies', value)} />
          <ToggleRow label="イベント情報の変更" detail="日時、場所、イベント名" value={preferences.eventUpdates} onChange={(value) => setPreference('eventUpdates', value)} />
          <ToggleRow label="参加者の変更" detail="参加・脱退申請と承認結果" value={preferences.membershipUpdates} onChange={(value) => setPreference('membershipUpdates', value)} />
          <ToggleRow label="集金の変更" detail="項目、期限、支払状態" value={preferences.collectionUpdates} onChange={(value) => setPreference('collectionUpdates', value)} />
          <ToggleRow label="グループの新しいイベント" detail="同じメンバーで次の予定が追加された時" value={preferences.groupUpdates} onChange={(value) => setPreference('groupUpdates', value)} />
          <ToggleRow label="主催者からのお知らせ" detail="チャットで固定されたお知らせ" value={preferences.announcements} onChange={(value) => setPreference('announcements', value)} />
        </Section>

        <Section title="おやすみ時間" description="この時間帯の新着通知は終了後にまとめて届きます">
          <ToggleRow label="おやすみ時間を使う" value={preferences.quietHoursEnabled} onChange={(value) => setPreference('quietHoursEnabled', value)} />
          {preferences.quietHoursEnabled ? (
            <View style={styles.times}>
              <View style={styles.timeField}>
                <NativeTimeField
                  label="開始"
                  value={preferences.quietStart}
                  onChange={(value) => setQuietTime('quietStart', value)}
                  open={openTime === 'start'}
                  onOpenChange={(open) => setOpenTime(open ? 'start' : undefined)}
                />
              </View>
              <View style={styles.timeField}>
                <NativeTimeField
                  label="終了"
                  value={preferences.quietEnd}
                  onChange={(value) => setQuietTime('quietEnd', value)}
                  open={openTime === 'end'}
                  onOpenChange={(open) => setOpenTime(open ? 'end' : undefined)}
                />
              </View>
            </View>
          ) : null}
        </Section>

        <Section title="イベントごとの通知" description="オフにしたイベントからは新着通知を送りません">
          {activeEvents.length ? activeEvents.map((event) => (
            <ToggleRow
              key={event.id}
              label={event.title}
              detail={event.dateLabel}
              value={!event.notificationsMuted}
              onChange={async (enabled) => {
                const error = await setEventNotificationMuted(event.id, !enabled);
                if (error) Alert.alert('保存できませんでした', error);
              }}
            />
          )) : <Text style={styles.empty}>設定できるイベントはありません</Text>}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDescription}>{description}</Text>
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

function ToggleRow({ label, detail, value, onChange }: { label: string; detail?: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#BFC2BE', true: palette.primary }}
        thumbColor={palette.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 42 },
  title: { color: palette.ink, fontSize: 27, fontWeight: '800' },
  lead: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  notice: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: palette.primary, padding: 12, marginTop: 16 },
  noticeText: { flex: 1, color: palette.muted, fontSize: 12, lineHeight: 18, marginLeft: 8 },
  master: { backgroundColor: palette.primary, minHeight: 78, borderRadius: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  masterIcon: { width: 42, height: 42, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  masterCopy: { flex: 1, marginLeft: 12 },
  masterTitle: { color: palette.surface, fontSize: 15, fontWeight: '800' },
  masterText: { color: '#CFD9D4', fontSize: 11, marginTop: 4 },
  section: { marginTop: 27 },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '800' },
  sectionDescription: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 4, marginBottom: 11 },
  rows: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 8, overflow: 'hidden' },
  row: { minHeight: 67, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  rowCopy: { flex: 1, paddingVertical: 11, marginRight: 12 },
  rowLabel: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  rowDetail: { color: palette.muted, fontSize: 11, marginTop: 4 },
  times: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 14 },
  timeField: { flex: 1 },
  empty: { color: palette.muted, fontSize: 12, padding: 18, textAlign: 'center' },
});
