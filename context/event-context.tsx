import { validateUserContent } from '@/constants/safety';
import { legalConfig } from '@/constants/legal';
import { syncOnboardingToCloud, syncProfileToCloud } from '@/lib/cloud-profile';
import { supabase } from '@/lib/supabase';
import { confirmCloudDateCandidate, createCloudEvent, createCloudInvite, fetchCloudEvents, joinCloudEvent, previewCloudEventInvite, reviewCloudJoinRequest, syncCloudAttendance, syncCloudAvailabilityVote, syncCloudChatRead, syncCloudCollection, syncCloudDateCandidate, syncCloudDateTime, syncCloudLocation, syncCloudMemberRole, syncCloudMessage, syncCloudPayment, syncCloudSchedule } from '@/lib/cloud-events';
import { requestNotificationPermission, syncLocalReminders } from '@/lib/notifications';
import { useAuth } from '@/context/auth-context';
import {
  AppSettings,
  AttendanceChoice,
  AvailabilityChoice,
  BlockedUser,
  ChatMessage,
  CollectionItem,
  ConsentRecord,
  EventDateTimeInput,
  EventInvitePreview,
  EventItem,
  EventLocationInput,
  NewCollectionInput,
  NewDateCandidateInput,
  NewEventInput,
  NewScheduleInput,
  OnboardingInput,
  SafetyReport,
  UserProfile,
} from '@/types/event';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = '@tsudowa/app-data-v2';
const LEGACY_STORAGE_KEY = ['@do', 'eventer/app-data-v2'].join('-');
const LEGACY_SAMPLE_EVENT_IDS = new Set(['hakone-retreat', 'summer-bbq', 'design-meetup']);

const defaultProfile: UserProfile = {
  name: 'Test',
  handle: '@tamasyu0202',
  city: '',
  initials: 'TE',
  avatarColor: '#285943',
};

const defaultSettings: AppSettings = {
  notificationsEnabled: false,
  onboardingCompleted: false,
};

const TERMS_VERSION = legalConfig.termsVersion;
const PRIVACY_VERSION = legalConfig.privacyVersion;
const COMMUNITY_VERSION = legalConfig.communityVersion;

type EventContextValue = {
  events: EventItem[];
  profile: UserProfile;
  settings: AppSettings;
  reports: SafetyReport[];
  consentHistory: ConsentRecord[];
  blockedUsers: BlockedUser[];
  isHydrated: boolean;
  addEvent: (input: NewEventInput) => EventItem;
  addCollection: (eventId: string, input: NewCollectionInput) => CollectionItem;
  addScheduleItem: (eventId: string, input: NewScheduleInput) => void;
  addMessage: (eventId: string, text: string) => string | null;
  updateEventDateTime: (eventId: string, input: EventDateTimeInput) => void;
  updateEventLocation: (eventId: string, input: EventLocationInput) => void;
  toggleCollectionPayment: (eventId: string, collectionId: string, participantId: string) => void;
  updateProfile: (profile: UserProfile) => void;
  completeOnboarding: (input: OnboardingInput) => void;
  setNotificationsEnabled: (enabled: boolean) => Promise<string | null>;
  submitSafetyReport: (report: Omit<SafetyReport, 'id' | 'createdAt' | 'status'>) => Promise<string | null>;
  toggleBlockUser: (name: string, userId?: string) => void;
  exportUserData: () => Promise<string>;
  deleteLocalAccount: () => Promise<string | null>;
  resetLocalData: () => void;
  findEvent: (id: string) => EventItem | undefined;
  joinByCode: (code: string) => EventItem | undefined;
  previewEventByCode: (code: string) => Promise<{ preview?: EventInvitePreview; error?: string }>;
  joinEventByCode: (code: string) => Promise<{ eventId?: string; pending?: boolean; error?: string }>;
  getUnreadMessageCount: (eventId: string) => number;
  markChatRead: (eventId: string) => void;
  createInviteCode: (eventId: string) => Promise<string | null>;
  setMyAttendance: (eventId: string, attendance: AttendanceChoice) => Promise<string | null>;
  reviewJoinRequest: (eventId: string, userId: string, decision: 'approved' | 'declined') => Promise<string | null>;
  addDateCandidate: (eventId: string, input: NewDateCandidateInput) => Promise<string | null>;
  setAvailabilityVote: (eventId: string, candidateId: string, choice: AvailabilityChoice) => Promise<string | null>;
  setMemberRole: (eventId: string, userId: string, role: 'cohost' | 'member') => Promise<string | null>;
  confirmDateCandidate: (eventId: string, candidateId: string) => Promise<string | null>;
};

const EventContext = createContext<EventContextValue | null>(null);

const formatDateLabel = (start: string, end: string) => {
  const format = (value: string, withYear = true) => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value || '日付未設定';
    return `${withYear ? `${year}年` : ''}${month}月${day}日`;
  };
  if (start === end) return format(start);
  return `${format(start)} – ${format(end, start.slice(0, 4) !== end.slice(0, 4))}`;
};

const formatTimeLabel = (start: string, end: string | undefined, mode: 'start' | 'range') =>
  mode === 'range' && end ? `${start}–${end}` : `${start} 開始`;

const normalizeEvents = (events: EventItem[]): EventItem[] => events.map((event) => ({
  ...event,
  startTime: event.startTime ?? event.timeLabel.match(/\d{1,2}:\d{2}/)?.[0]?.padStart(5, '0') ?? '09:00',
  endTime: event.endTime ?? event.timeLabel.match(/\d{1,2}:\d{2}/g)?.[1]?.padStart(5, '0'),
  timeMode: event.timeMode ?? (event.timeLabel.match(/\d{1,2}:\d{2}/g)?.length === 2 ? 'range' : 'start'),
  schedule: event.schedule ?? [],
  collections: event.collections ?? [],
  messages: (event.messages ?? []).map((message) => ({
    ...message,
    createdAt: message.createdAt ?? new Date(`${event.startDate}T00:00:00`).toISOString(),
  })),
  joinRequests: event.joinRequests ?? [],
  dateCandidates: event.dateCandidates ?? [],
}));

export function EventProvider({ children }: PropsWithChildren) {
  const { user, isConfigured } = useAuth();
  const storageKey = `${STORAGE_KEY}/${user?.id ?? 'local'}`;
  const legacyStorageKey = `${LEGACY_STORAGE_KEY}/${user?.id ?? 'local'}`;
  const [events, setEvents] = useState<EventItem[]>([]);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [consentHistory, setConsentHistory] = useState<ConsentRecord[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    setIsHydrated(false);
    setEvents([]);
    setProfile(defaultProfile);
    setSettings(defaultSettings);
    setReports([]);
    setConsentHistory([]);
    setBlockedUsers([]);
    AsyncStorage.getItem(storageKey)
      .then(async (stored) => {
        if (stored) return stored;
        const legacyStored = await AsyncStorage.getItem(legacyStorageKey);
        if (!legacyStored) return null;
        await AsyncStorage.setItem(storageKey, legacyStored);
        await AsyncStorage.removeItem(legacyStorageKey);
        return legacyStored;
      })
      .then((stored) => {
        if (!active || !stored) return;
        const parsed = JSON.parse(stored) as { events?: EventItem[]; profile?: UserProfile; settings?: AppSettings; reports?: SafetyReport[]; consentHistory?: ConsentRecord[]; blockedUsers?: BlockedUser[] };
        if (parsed.events) setEvents(normalizeEvents(parsed.events).filter((event) => !LEGACY_SAMPLE_EVENT_IDS.has(event.id)));
        if (parsed.profile) {
          const legacyDefaultCity = parsed.profile.name === 'Test' && parsed.profile.handle === '@tamasyu0202' && parsed.profile.city === 'Tokyo';
          setProfile(legacyDefaultCity ? { ...parsed.profile, city: '' } : parsed.profile);
        }
        if (parsed.settings) setSettings({ ...defaultSettings, ...parsed.settings });
        if (parsed.reports) setReports(parsed.reports);
        if (parsed.consentHistory) setConsentHistory(parsed.consentHistory);
        if (parsed.blockedUsers) setBlockedUsers(parsed.blockedUsers);
      })
      .catch(() => undefined)
      .finally(() => active && setIsHydrated(true));
    return () => { active = false; };
  }, [legacyStorageKey, storageKey]);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(storageKey, JSON.stringify({ events, profile, settings, reports, consentHistory, blockedUsers })).catch(() => undefined);
  }, [blockedUsers, consentHistory, events, isHydrated, profile, reports, settings, storageKey]);

  useEffect(() => {
    if (!isHydrated) return;
    setBlockedUsers((current) => {
      const filtered = current.filter((blocked) => blocked.userId
        ? blocked.userId !== user?.id
        : blocked.name.trim().toLowerCase() !== profile.name.trim().toLowerCase());
      return filtered.length === current.length ? current : filtered;
    });
  }, [isHydrated, profile.name, user?.id]);

  useEffect(() => {
    if (!isHydrated) return;
    void syncLocalReminders(events, settings.notificationsEnabled).catch(() => undefined);
  }, [events, isHydrated, settings.notificationsEnabled]);

  useEffect(() => {
    if (!isConfigured || !isHydrated || !user) return;
    let active = true;
    const refresh = () => fetchCloudEvents(user.id).then((cloudEvents) => { if (active) setEvents(cloudEvents); }).catch(() => undefined);
    void refresh();
    const client = supabase;
    const channel = client?.channel(`tsudowa-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_members' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'date_candidates' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'date_candidate_votes' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, refresh)
      .subscribe();
    return () => { active = false; if (client && channel) void client.removeChannel(channel); };
  }, [isConfigured, isHydrated, user]);

  useEffect(() => {
    if (!isConfigured || !isHydrated || !user || !supabase) return;
    let active = true;
    const client = supabase;
    const refreshBlocks = async () => {
      const { data, error } = await client.from('blocked_users').select('blocked_id, created_at').eq('blocker_id', user.id);
      if (!active || error) return;
      setBlockedUsers((current) => (data ?? []).map((row) => {
        const knownName = events.flatMap((event) => event.participants).find((participant) => participant.id === row.blocked_id)?.name
          ?? current.find((blocked) => blocked.userId === row.blocked_id)?.name
          ?? 'ブロック中の利用者';
        return { key: row.blocked_id, userId: row.blocked_id, name: knownName, blockedAt: row.created_at };
      }));
    };
    void refreshBlocks();
    const channel = client.channel(`tsudowa-blocks-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users', filter: `blocker_id=eq.${user.id}` }, refreshBlocks)
      .subscribe();
    return () => { active = false; void client.removeChannel(channel); };
  }, [events, isConfigured, isHydrated, user]);

  const value = useMemo<EventContextValue>(() => ({
    events,
    profile,
    settings,
    reports,
    consentHistory,
    blockedUsers,
    isHydrated,
    findEvent: (id) => events.find((event) => event.id === id),
    joinByCode: (code) => events.find((event) => event.inviteCode === code.trim().toUpperCase()),
    previewEventByCode: async (code) => {
      const normalizedCode = code.trim().toUpperCase();
      if (!normalizedCode) return { error: '招待コードを入力してください。' };
      if (!supabase) {
        const localEvent = events.find((event) => event.inviteCode === normalizedCode);
        return localEvent ? { preview: {
          eventId: localEvent.id,
          title: localEvent.title,
          startDate: localEvent.startDate,
          endDate: localEvent.endDate,
          dateLabel: localEvent.dateLabel,
          timeLabel: localEvent.timeLabel,
        } } : { error: 'イベントが見つかりません。招待コードを確認してください。' };
      }
      try {
        const preview = await previewCloudEventInvite(normalizedCode);
        return preview ? { preview } : { error: 'イベントが見つかりません。招待コードを確認してください。' };
      } catch {
        return { error: '招待コードが無効、期限切れ、または使用上限に達しています。' };
      }
    },
    joinEventByCode: async (code) => {
      const localEvent = events.find((event) => event.inviteCode === code.trim().toUpperCase());
      if (!supabase) {
        if (!localEvent) return { error: 'イベントが見つかりません。招待コードを確認してください。' };
        const alreadyJoined = localEvent.participants.some((participant) => participant.id === 'me' || participant.name === profile.name);
        if (!alreadyJoined) setEvents((current) => current.map((event) => event.id !== localEvent.id ? event : {
          ...event,
          participants: [...event.participants, { id: 'me', name: profile.name, initials: profile.initials, role: '参加者', avatarColor: profile.avatarColor, attendance: '参加' }],
        }));
        return { eventId: localEvent.id };
      }
      try {
        const result = await joinCloudEvent(code);
        if (!result) return { error: 'イベントが見つかりません。' };
        const cloudEvents = user ? await fetchCloudEvents(user.id) : [];
        setEvents(cloudEvents);
        return { eventId: result.eventId, pending: result.status === 'pending' };
      } catch { return { error: '招待コードが無効、期限切れ、または使用上限に達しています。' }; }
    },
    getUnreadMessageCount: (eventId) => {
      const targetEvent = events.find((event) => event.id === eventId);
      if (!targetEvent) return 0;
      const lastReadAt = targetEvent.chatLastReadAt ? Date.parse(targetEvent.chatLastReadAt) : Number.NaN;
      return targetEvent.messages.filter((message) => {
        if (message.mine) return false;
        const blocked = blockedUsers.some((item) => message.authorId ? item.userId === message.authorId : item.name === message.author);
        if (blocked) return false;
        const createdAt = Date.parse(message.createdAt);
        return Number.isNaN(lastReadAt) || Number.isNaN(createdAt) || createdAt > lastReadAt;
      }).length;
    },
    markChatRead: (eventId) => {
      const targetEvent = events.find((event) => event.id === eventId);
      const latestCreatedAt = targetEvent?.messages.at(-1)?.createdAt;
      if (!targetEvent || !latestCreatedAt) return;
      if (targetEvent.chatLastReadAt && Date.parse(targetEvent.chatLastReadAt) >= Date.parse(latestCreatedAt)) return;
      setEvents((current) => current.map((event) => event.id === eventId ? { ...event, chatLastReadAt: latestCreatedAt } : event));
      void syncCloudChatRead(eventId).catch(() => undefined);
    },
    createInviteCode: async (eventId) => {
      try {
        const code = await createCloudInvite(eventId);
        if (code) setEvents((current) => current.map((event) => event.id === eventId ? { ...event, inviteCode: code } : event));
        return code;
      } catch { return null; }
    },
    setMyAttendance: async (eventId, attendance) => {
      const targetEvent = events.find((event) => event.id === eventId);
      const currentParticipant = user
        ? targetEvent?.participants.find((participant) => participant.id === user.id)
        : targetEvent?.participants.find((participant) => participant.name === profile.name);
      if (!targetEvent || !currentParticipant) return 'このイベントの参加者ではありません。';
      try {
        await syncCloudAttendance(eventId, attendance);
        setEvents((current) => current.map((event) => event.id !== eventId ? event : {
          ...event,
          participants: event.participants.map((participant) => participant.id === currentParticipant.id ? { ...participant, attendance } : participant),
        }));
        return null;
      } catch { return '参加可否を更新できませんでした。通信状態を確認してください。'; }
    },
    reviewJoinRequest: async (eventId, userId, decision) => {
      const targetEvent = events.find((event) => event.id === eventId);
      const request = targetEvent?.joinRequests?.find((item) => item.userId === userId);
      if (!targetEvent || !request) return '参加申請が見つかりません。';
      try {
        await reviewCloudJoinRequest(eventId, userId, decision);
        setEvents((current) => current.map((event) => event.id !== eventId ? event : {
          ...event,
          joinRequests: (event.joinRequests ?? []).filter((item) => item.userId !== userId),
          participants: decision === 'approved' ? [...event.participants, {
            id: request.userId,
            name: request.name,
            initials: request.initials,
            role: '参加者' as const,
            avatarColor: request.avatarColor,
            attendance: '未定',
          }] : event.participants,
        }));
        return null;
      } catch { return '参加申請を更新できませんでした。権限や通信状態を確認してください。'; }
    },
    addDateCandidate: async (eventId, input) => {
      const targetEvent = events.find((event) => event.id === eventId);
      if (!targetEvent) return 'イベントが見つかりません。';
      const candidateId = Crypto.randomUUID();
      try {
        await syncCloudDateCandidate(eventId, candidateId, input);
        setEvents((current) => current.map((event) => event.id !== eventId ? event : {
          ...event,
          dateCandidates: [...(event.dateCandidates ?? []), { id: candidateId, ...input, votes: [] }]
            .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
        }));
        return null;
      } catch {
        return '候補日を追加できませんでした。主催者権限や通信状態を確認してください。';
      }
    },
    setAvailabilityVote: async (eventId, candidateId, choice) => {
      const targetEvent = events.find((event) => event.id === eventId);
      const participantId = user?.id ?? targetEvent?.participants.find((participant) => participant.name === profile.name)?.id ?? 'me';
      if (!targetEvent?.dateCandidates?.some((candidate) => candidate.id === candidateId)) return '候補日が見つかりません。';
      try {
        await syncCloudAvailabilityVote(candidateId, choice);
        setEvents((current) => current.map((event) => event.id !== eventId ? event : {
          ...event,
          dateCandidates: (event.dateCandidates ?? []).map((candidate) => candidate.id !== candidateId ? candidate : {
            ...candidate,
            votes: [...candidate.votes.filter((vote) => vote.participantId !== participantId), { participantId, choice }],
          }),
        }));
        return null;
      } catch {
        return '回答を保存できませんでした。通信状態を確認してください。';
      }
    },
    setMemberRole: async (eventId, userId, role) => {
      const targetEvent = events.find((event) => event.id === eventId);
      const target = targetEvent?.participants.find((participant) => participant.id === userId);
      if (!targetEvent || !target) return '参加者が見つかりません。';
      if (target.role === '主催者') return '主催者本人の権限は変更できません。';
      try {
        await syncCloudMemberRole(eventId, userId, role);
        setEvents((current) => current.map((event) => event.id !== eventId ? event : {
          ...event,
          participants: event.participants.map((participant) => participant.id !== userId ? participant : {
            ...participant,
            role: role === 'cohost' ? '共同主催者' : '参加者',
          }),
        }));
        return null;
      } catch {
        return '権限を変更できませんでした。主催者権限や通信状態を確認してください。';
      }
    },
    confirmDateCandidate: async (eventId, candidateId) => {
      const candidate = events.find((event) => event.id === eventId)?.dateCandidates?.find((item) => item.id === candidateId);
      if (!candidate) return '候補日が見つかりません。';
      try {
        await confirmCloudDateCandidate(candidateId);
        setEvents((current) => current.map((event) => event.id !== eventId ? event : {
          ...event,
          startDate: candidate.date,
          endDate: candidate.date,
          dateLabel: formatDateLabel(candidate.date, candidate.date),
          startTime: candidate.startTime,
          endTime: undefined,
          timeMode: 'start',
          timeLabel: formatTimeLabel(candidate.startTime, undefined, 'start'),
        }));
        return null;
      } catch {
        return '日程を確定できませんでした。管理権限や通信状態を確認してください。';
      }
    },
    updateProfile: (nextProfile) => {
      setProfile(nextProfile);
      void syncProfileToCloud(nextProfile);
    },
    completeOnboarding: (input) => {
      const recordedAt = new Date().toISOString();
      const initials = input.name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'ME';
      const handlePart = input.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
      const nextProfile = { ...profile, name: input.name.trim(), email: input.email.trim().toLowerCase(), initials, handle: `@${handlePart.length >= 2 ? handlePart : 'member'}` };
      setProfile(nextProfile);
      setSettings((current) => ({
        ...current,
        onboardingCompleted: true,
        dateOfBirth: input.dateOfBirth,
        termsAcceptedAt: recordedAt,
        privacyAcceptedAt: recordedAt,
        communityAcceptedAt: recordedAt,
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: PRIVACY_VERSION,
        acceptedCommunityVersion: COMMUNITY_VERSION,
      }));
      setConsentHistory((current) => [...current,
        { id: `terms-${Date.now()}`, document: 'terms', version: TERMS_VERSION, accepted: true, recordedAt },
        { id: `privacy-${Date.now()}`, document: 'privacy', version: PRIVACY_VERSION, accepted: true, recordedAt },
        { id: `community-${Date.now()}`, document: 'community', version: COMMUNITY_VERSION, accepted: true, recordedAt },
      ]);
      void syncOnboardingToCloud(input, nextProfile).catch(() => undefined);
    },
    setNotificationsEnabled: async (enabled) => {
      if (enabled) {
        try {
          const granted = await requestNotificationPermission();
          if (!granted) return '端末の設定でTSUDOWAの通知を許可してください。';
        } catch {
          return '通知を有効にできませんでした。端末の設定を確認してください。';
        }
      }
      setSettings((current) => ({ ...current, notificationsEnabled: enabled }));
      if (!enabled) void syncLocalReminders(events, false).catch(() => undefined);
      return null;
    },
    submitSafetyReport: async (report) => {
      const reportingSelf = report.targetUserId
        ? report.targetUserId === user?.id
        : report.targetUserName?.trim().toLowerCase() === profile.name.trim().toLowerCase();
      if (reportingSelf) return '自分自身を通報することはできません。';
      if (supabase) {
        if (!user) return 'ログイン情報を確認できません。もう一度ログインしてください。';
        const { error } = await supabase.from('safety_reports').insert({
        reporter_id: user.id,
        event_id: report.eventId?.match(/^[0-9a-f-]{36}$/i) ? report.eventId : null,
        message_id: report.messageId?.match(/^[0-9a-f-]{36}$/i) ? report.messageId : null,
        target_user_id: report.targetUserId?.match(/^[0-9a-f-]{36}$/i) ? report.targetUserId : null,
        target_user_name: report.targetUserName,
        reason: report.reason,
        details: report.details,
        });
        if (error) return '通報を送信できませんでした。通信状態を確認して、もう一度お試しください。';
      }
      setReports((current) => [...current, { ...report, id: `report-${Date.now()}`, createdAt: new Date().toISOString(), status: 'received' }]);
      return null;
    },
    toggleBlockUser: (name, targetUserId) => {
      const blockingSelf = targetUserId ? targetUserId === user?.id : name.trim().toLowerCase() === profile.name.trim().toLowerCase();
      if (blockingSelf) return;
      const key = targetUserId ?? name.trim().toLowerCase();
      const alreadyBlocked = blockedUsers.some((blocked) => blocked.key === key);
      setBlockedUsers((current) => current.some((blocked) => blocked.key === key)
        ? current.filter((blocked) => blocked.key !== key)
        : [...current, { key, userId: targetUserId, name, blockedAt: new Date().toISOString() }]);
      if (supabase && user && targetUserId) {
        const request = alreadyBlocked
          ? supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', targetUserId)
          : supabase.from('blocked_users').upsert({ blocker_id: user.id, blocked_id: targetUserId });
        void request.then(({ error }) => {
          if (error) {
            setBlockedUsers((current) => alreadyBlocked
              ? [...current.filter((blocked) => blocked.key !== key), { key, userId: targetUserId, name, blockedAt: new Date().toISOString() }]
              : current.filter((blocked) => blocked.key !== key));
          }
        });
      }
    },
    exportUserData: async () => {
      if (supabase) {
        const { data, error } = await supabase.functions.invoke('export-account');
        if (error) throw error;
        return JSON.stringify(data, null, 2);
      }
      return JSON.stringify({ exportedAt: new Date().toISOString(), profile, settings, events, reports, consentHistory, blockedUsers }, null, 2);
    },
    deleteLocalAccount: async () => {
      if (supabase) {
        const { error } = await supabase.functions.invoke('delete-account');
        if (error) return 'サーバー上のアカウントを削除できませんでした。通信状態を確認して、もう一度お試しください。';
        await supabase.auth.signOut({ scope: 'local' });
      }
      await AsyncStorage.removeItem(storageKey);
      setEvents([]);
      setProfile(defaultProfile);
      setSettings(defaultSettings);
      setReports([]);
      setConsentHistory([]);
      setBlockedUsers([]);
      return null;
    },
    resetLocalData: () => {
      setEvents([]);
    },
    addMessage: (eventId, text) => {
      const validationError = validateUserContent(text);
      if (validationError) return validationError;
      const message: ChatMessage = {
        id: Crypto.randomUUID(),
        authorId: user?.id,
        author: profile.name,
        initials: profile.initials,
        text,
        time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        mine: true,
        color: profile.avatarColor,
      };
      setEvents((current) => current.map((event) => event.id === eventId
        ? { ...event, messages: [...event.messages, message] }
        : event));
      void syncCloudMessage(eventId, message.id, text);
      return null;
    },
    updateEventDateTime: (eventId, input) => {
      setEvents((current) => current.map((event) => event.id !== eventId ? event : {
        ...event,
        ...input,
        dateLabel: formatDateLabel(input.startDate, input.endDate),
        timeLabel: formatTimeLabel(input.startTime, input.endTime, input.timeMode),
      }));
      void syncCloudDateTime(eventId, input);
    },
    updateEventLocation: (eventId, input) => {
      setEvents((current) => current.map((event) => event.id === eventId ? { ...event, ...input } : event));
      void syncCloudLocation(eventId, input);
    },
    addScheduleItem: (eventId, input) => {
      const scheduleId = Crypto.randomUUID();
      const targetEvent = events.find((event) => event.id === eventId);
      setEvents((current) => current.map((event) => event.id === eventId
        ? { ...event, schedule: [...event.schedule, { ...input, id: scheduleId }] }
        : event));
      if (targetEvent) void syncCloudSchedule(targetEvent, scheduleId, input);
    },
    addCollection: (eventId, input) => {
      const baseAmount = input.participantIds.length ? Math.floor(input.totalAmount / input.participantIds.length) : 0;
      const remainder = input.totalAmount - baseAmount * input.participantIds.length;
      const collection: CollectionItem = {
        id: Crypto.randomUUID(),
        title: input.title,
        category: input.category,
        paidByParticipantId: input.paidByParticipantId,
        totalAmount: input.totalAmount,
        splitMethod: input.splitMethod,
        dueDate: input.dueDate,
        note: input.note,
        shares: input.participantIds.map((participantId, index) => ({
          participantId,
          amount: input.splitMethod === 'custom'
            ? input.customAmounts?.[participantId] ?? 0
            : baseAmount + (index === 0 ? remainder : 0),
          paid: false,
        })),
      };
      setEvents((current) => current.map((event) => event.id === eventId
        ? { ...event, collections: [...event.collections, collection] }
        : event));
      void syncCloudCollection(eventId, collection);
      return collection;
    },
    toggleCollectionPayment: (eventId, collectionId, participantId) => {
      const targetEvent = events.find((event) => event.id === eventId);
      const currentMember = user ? targetEvent?.participants.find((participant) => participant.id === user.id) : undefined;
      if (supabase && participantId !== user?.id && !['主催者', '共同主催者'].includes(currentMember?.role ?? '')) return;
      const currentShare = targetEvent?.collections.find((collection) => collection.id === collectionId)?.shares.find((share) => share.participantId === participantId);
      const nextPaid = !(currentShare?.paid ?? false);
      setEvents((current) => current.map((event) => event.id !== eventId ? event : {
        ...event,
        collections: event.collections.map((collection) => collection.id !== collectionId ? collection : {
          ...collection,
          shares: collection.shares.map((share) => share.participantId !== participantId ? share : {
            ...share,
            paid: !share.paid,
            paidAt: !share.paid ? '確認済み' : undefined,
          }),
        }),
      }));
      void syncCloudPayment(collectionId, participantId, nextPaid);
    },
    addEvent: (input) => {
      const id = Crypto.randomUUID();
      const event: EventItem = {
        id,
        title: input.title,
        category: 'EVENT',
        tagline: input.description || '',
        host: profile.name,
        startDate: input.startDate,
        endDate: input.endDate,
        dateLabel: formatDateLabel(input.startDate, input.endDate),
        startTime: input.startTime,
        endTime: input.endTime,
        timeMode: input.timeMode,
        timeLabel: formatTimeLabel(input.startTime, input.endTime, input.timeMode),
        location: input.location || '場所未設定',
        address: input.address || input.location || '場所未設定',
        latitude: input.latitude,
        longitude: input.longitude,
        description: input.description || '',
        coverColor: '#E2E9D5',
        accentColor: '#52683F',
        status: '予定',
        inviteCode: supabase ? '' : Math.random().toString(36).slice(2, 8).toUpperCase(),
        capacity: 10000,
        participants: [
          { id: 'me', name: profile.name, initials: profile.initials, role: '主催者', avatarColor: profile.avatarColor, attendance: '参加' },
        ],
        joinRequests: [],
        dateCandidates: [],
        schedule: [
          { id: 'start', day: input.startDate || '当日', time: input.startTime, title: 'イベント開始', type: 'activity' },
        ],
        collections: input.initialFee > 0 ? [{
          id: Crypto.randomUUID(),
          title: '参加費',
          category: 'entry',
          paidByParticipantId: 'me',
          totalAmount: input.initialFee,
          splitMethod: 'equal',
          note: 'イベント作成時に登録した参加費です。',
          shares: [{ participantId: 'me', amount: input.initialFee, paid: false }],
        }] : [],
        messages: [],
      };
      setEvents((current) => [event, ...current]);
      void createCloudEvent(event).then(async (inviteCode) => {
        if (inviteCode) setEvents((current) => current.map((item) => item.id === event.id ? { ...item, inviteCode } : item));
        await Promise.all(event.collections.map((collection) => syncCloudCollection(event.id, collection)));
      }).catch(() => undefined);
      return event;
    },
  }), [blockedUsers, consentHistory, events, isHydrated, profile, reports, settings, storageKey, user]);

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvents() {
  const context = useContext(EventContext);
  if (!context) throw new Error('useEvents must be used inside EventProvider');
  return context;
}
