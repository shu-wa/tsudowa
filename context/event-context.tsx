import { validateUserContent } from '@/constants/safety';
import { legalConfig } from '@/constants/legal';
import { fetchCloudOnboardingState, fetchCloudProfile, syncOnboardingToCloud, syncProfileToCloud } from '@/lib/cloud-profile';
import { supabase } from '@/lib/supabase';
import { archiveCloudEvent, cancelCloudEventLeave, confirmCloudDateCandidate, createCloudEvent, createCloudInvite, deleteCloudCollection, deleteCloudEvent, deleteCloudSchedule, fetchCloudEvents, joinCloudEvent, previewCloudEventInvite, requestCloudEventLeave, reviewCloudEventLeave, reviewCloudJoinRequest, syncCloudAttendance, syncCloudAvailabilityVote, syncCloudChatRead, syncCloudCollection, syncCloudDateCandidate, syncCloudDateTime, syncCloudEventCover, syncCloudLocation, syncCloudMemberRole, syncCloudMessage, syncCloudPayment, syncCloudSchedule, updateCloudCollection, updateCloudSchedule } from '@/lib/cloud-events';
import { normalizeEventDateRange, parseLocalDateKey, toDateString } from '@/lib/date-values';
import { buildCollectionShares, collectionSharesTotal } from '@/lib/collection-values';
import { isEventArchived, isEventPast } from '@/lib/event-display';
import { requestNotificationPermission, syncLocalReminders } from '@/lib/notifications';
import { isEventHost, isEventManager } from '@/lib/event-permissions';
import { hasStoredOnboardingEvidence, isKnownProfileName } from '@/lib/onboarding-state';
import { formatEventTimeLabel } from '@/lib/time-values';
import { useAuth } from '@/context/auth-context';
import {
  AppSettings,
  AttendanceChoice,
  AvailabilityChoice,
  BlockedUser,
  ChatImageInput,
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
import { authStorage } from '@/lib/auth-storage';
import * as Crypto from 'expo-crypto';
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = '@tsudowa/app-data-v2';
const LEGACY_STORAGE_KEY = ['@do', 'eventer/app-data-v2'].join('-');
const LEGACY_SAMPLE_EVENT_IDS = new Set(['hakone-retreat', 'summer-bbq', 'design-meetup']);

const defaultProfile: UserProfile = {
  name: '',
  handle: '',
  city: '',
  initials: '',
  avatarColor: '#173E33',
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
  addCollection: (eventId: string, input: NewCollectionInput) => Promise<string | null>;
  updateCollection: (eventId: string, collectionId: string, input: NewCollectionInput) => Promise<string | null>;
  deleteCollection: (eventId: string, collectionId: string) => Promise<string | null>;
  addScheduleItem: (eventId: string, input: NewScheduleInput) => Promise<string | null>;
  updateScheduleItem: (eventId: string, scheduleId: string, input: NewScheduleInput) => Promise<string | null>;
  deleteScheduleItem: (eventId: string, scheduleId: string) => Promise<string | null>;
  addMessage: (eventId: string, text: string, image?: ChatImageInput) => Promise<string | null>;
  updateEventDateTime: (eventId: string, input: EventDateTimeInput) => void;
  updateEventLocation: (eventId: string, input: EventLocationInput) => void;
  toggleCollectionPayment: (eventId: string, collectionId: string, participantId: string) => Promise<string | null>;
  updateProfile: (profile: UserProfile, image?: ChatImageInput) => Promise<string | null>;
  updateEventCover: (eventId: string, image: ChatImageInput) => Promise<string | null>;
  deleteEvent: (eventId: string) => Promise<string | null>;
  archiveEvent: (eventId: string) => Promise<string | null>;
  requestEventLeave: (eventId: string) => Promise<string | null>;
  cancelEventLeave: (eventId: string) => Promise<string | null>;
  reviewEventLeave: (eventId: string, userId: string, decision: 'approved' | 'declined') => Promise<string | null>;
  completeOnboarding: (input: OnboardingInput) => Promise<string | null>;
  setNotificationsEnabled: (enabled: boolean) => Promise<string | null>;
  submitSafetyReport: (report: Omit<SafetyReport, 'id' | 'createdAt' | 'status'>) => Promise<string | null>;
  toggleBlockUser: (name: string, userId?: string) => void;
  exportUserData: () => Promise<string>;
  deleteLocalAccount: () => Promise<string | null>;
  resetLocalData: () => void;
  findEvent: (id: string) => EventItem | undefined;
  joinByCode: (code: string) => EventItem | undefined;
  previewEventByCode: (code: string) => Promise<{ preview?: EventInvitePreview; error?: string }>;
  joinEventByCode: (code: string) => Promise<{ eventId?: string; pending?: boolean; refreshPending?: boolean; error?: string }>;
  getUnreadMessageCount: (eventId: string) => number;
  markChatRead: (eventId: string) => void;
  createInviteCode: (eventId: string) => Promise<string | null>;
  setMyAttendance: (eventId: string, attendance: AttendanceChoice) => Promise<string | null>;
  reviewJoinRequest: (eventId: string, userId: string, decision: 'approved' | 'declined') => Promise<string | null>;
  addDateCandidate: (eventId: string, input: NewDateCandidateInput) => Promise<string | null>;
  setAvailabilityVote: (eventId: string, candidateId: string, choice: AvailabilityChoice) => Promise<string | null>;
  setMemberRole: (eventId: string, userId: string, role: 'cohost' | 'member') => Promise<string | null>;
  confirmDateCandidate: (eventId: string, candidateId: string) => Promise<string | null>;
  refreshData: () => Promise<string | null>;
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

const normalizeScheduleDay = (value: string | undefined, fallback: string) => {
  const strict = parseLocalDateKey(value);
  if (strict) return toDateString(strict);
  const legacy = /^(\d{4})[年/](\d{1,2})[月/](\d{1,2})日?$/.exec(value ?? '');
  if (!legacy) return fallback;
  const parsed = new Date(Number(legacy[1]), Number(legacy[2]) - 1, Number(legacy[3]), 12);
  return parsed.getFullYear() === Number(legacy[1])
    && parsed.getMonth() === Number(legacy[2]) - 1
    && parsed.getDate() === Number(legacy[3])
    ? toDateString(parsed)
    : fallback;
};

const normalizeEvents = (events: EventItem[]): EventItem[] => events.map((event) => {
  const normalizedDates = normalizeEventDateRange(event.startDate, event.endDate);
  return ({
  ...event,
  ...normalizedDates,
  dateLabel: formatDateLabel(normalizedDates.startDate, normalizedDates.endDate),
  startTime: event.startTime ?? event.timeLabel.match(/\d{1,2}:\d{2}/)?.[0]?.padStart(5, '0') ?? '09:00',
  endTime: event.endTime ?? event.timeLabel.match(/\d{1,2}:\d{2}/g)?.[1]?.padStart(5, '0'),
  timeMode: event.timeMode ?? (event.timeLabel.match(/\d{1,2}:\d{2}/g)?.length === 2 ? 'range' : 'start'),
  schedule: (event.schedule ?? []).map((item) => ({
    ...item,
    day: normalizeScheduleDay(item.day, normalizedDates.startDate),
  })).sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`)),
  collections: event.collections ?? [],
  messages: (event.messages ?? []).map((message) => ({
    ...message,
    createdAt: message.createdAt ?? new Date(`${normalizedDates.startDate}T12:00:00`).toISOString(),
  })),
  joinRequests: event.joinRequests ?? [],
  leaveRequests: event.leaveRequests ?? [],
  dateCandidates: event.dateCandidates ?? [],
  });
});

export function EventProvider({ children }: PropsWithChildren) {
  const { user, isConfigured } = useAuth();
  const authenticatedUserId = user?.id;
  const authenticatedUserEmail = user?.email;
  const storageKey = `${STORAGE_KEY}/${authenticatedUserId ?? 'local'}`;
  const legacyStorageKey = `${LEGACY_STORAGE_KEY}/${authenticatedUserId ?? 'local'}`;
  const dataStorage = isConfigured ? authStorage : AsyncStorage;
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
    dataStorage.getItem(storageKey)
      .then(async (stored) => {
        if (stored) return stored;
        const legacyStored = await dataStorage.getItem(legacyStorageKey);
        if (!legacyStored) return null;
        await dataStorage.setItem(storageKey, legacyStored);
        await dataStorage.removeItem(legacyStorageKey);
        return legacyStored;
      })
      .then(async (stored) => {
        if (!active) return;
        const parsed = stored
          ? JSON.parse(stored) as { events?: EventItem[]; profile?: UserProfile; settings?: AppSettings; reports?: SafetyReport[]; consentHistory?: ConsentRecord[]; blockedUsers?: BlockedUser[] }
          : {};
        let nextProfile = parsed.profile ?? defaultProfile;
        const legacyDefaultCity = nextProfile.name === 'Test' && nextProfile.handle === '@tamasyu0202' && nextProfile.city === 'Tokyo';
        if (legacyDefaultCity) nextProfile = { ...nextProfile, city: '' };
        let nextSettings = { ...defaultSettings, ...parsed.settings };
        let nextConsentHistory = parsed.consentHistory ?? [];
        const hasLocalOnboardingEvidence = hasStoredOnboardingEvidence(
          nextSettings,
          nextProfile,
          nextConsentHistory,
        );

        // Completion is an account property, not a device property. Restore it
        // from the protected profile and consent rows after every new session.
        if (isConfigured && authenticatedUserId) {
          try {
            const cloudState = await fetchCloudOnboardingState(authenticatedUserId);
            if (cloudState) {
              const cloudProfileHasName = isKnownProfileName(cloudState.profile.name);
              nextProfile = {
                ...nextProfile,
                ...cloudState.profile,
                name: cloudProfileHasName ? cloudState.profile.name : nextProfile.name,
                initials: cloudProfileHasName ? cloudState.profile.initials : nextProfile.initials,
                email: authenticatedUserEmail,
              };
              nextSettings = {
                ...nextSettings,
                dateOfBirth: cloudState.dateOfBirth || nextSettings.dateOfBirth,
                onboardingCompleted: cloudState.completed || hasLocalOnboardingEvidence,
              };
              if (cloudState.completed) {
                const latestConsent = (document: ConsentRecord['document']) => (
                  [...cloudState.consentHistory].reverse().find((record) => record.document === document)
                );
                const terms = latestConsent('terms');
                const privacy = latestConsent('privacy');
                const community = latestConsent('community');
                nextSettings = {
                  ...nextSettings,
                  dateOfBirth: cloudState.dateOfBirth,
                  termsAcceptedAt: terms?.recordedAt,
                  privacyAcceptedAt: privacy?.recordedAt,
                  communityAcceptedAt: community?.recordedAt,
                  acceptedTermsVersion: terms?.version,
                  acceptedPrivacyVersion: privacy?.version,
                  acceptedCommunityVersion: community?.version,
                };
                nextConsentHistory = cloudState.consentHistory;
              } else if (hasLocalOnboardingEvidence && nextSettings.dateOfBirth) {
                // Older releases kept the accepted legal versions in encrypted
                // local storage before consent rows were recoverable per account.
                // Preserve that valid registration and repair the account rows.
                try {
                  await syncOnboardingToCloud({
                    name: nextProfile.name,
                    email: authenticatedUserEmail ?? nextProfile.email ?? '',
                    dateOfBirth: nextSettings.dateOfBirth,
                  }, nextProfile);
                  const repairedState = await fetchCloudOnboardingState(authenticatedUserId);
                  if (repairedState?.completed) {
                    const latestConsent = (document: ConsentRecord['document']) => (
                      [...repairedState.consentHistory].reverse().find((record) => record.document === document)
                    );
                    const terms = latestConsent('terms');
                    const privacy = latestConsent('privacy');
                    const community = latestConsent('community');
                    nextProfile = { ...nextProfile, ...repairedState.profile, email: authenticatedUserEmail };
                    nextConsentHistory = repairedState.consentHistory;
                    nextSettings = {
                      ...nextSettings,
                      onboardingCompleted: true,
                      dateOfBirth: repairedState.dateOfBirth,
                      termsAcceptedAt: terms?.recordedAt,
                      privacyAcceptedAt: privacy?.recordedAt,
                      communityAcceptedAt: community?.recordedAt,
                      acceptedTermsVersion: terms?.version,
                      acceptedPrivacyVersion: privacy?.version,
                      acceptedCommunityVersion: community?.version,
                    };
                  }
                } catch {
                  // The encrypted evidence still keeps the user registered while
                  // a temporary network failure prevents the cloud repair.
                }
              }
            }
          } catch {
            // Keep the encrypted local state when the network is temporarily unavailable.
          }
        }
        if (!active) return;
        if (!isConfigured && parsed.events) setEvents(normalizeEvents(parsed.events).filter((event) => !LEGACY_SAMPLE_EVENT_IDS.has(event.id)));
        setProfile(nextProfile);
        setSettings(nextSettings);
        if (!isConfigured && parsed.reports) setReports(parsed.reports);
        setConsentHistory(nextConsentHistory);
        if (!isConfigured && parsed.blockedUsers) setBlockedUsers(parsed.blockedUsers);
      })
      .catch(() => undefined)
      .finally(() => active && setIsHydrated(true));
    return () => { active = false; };
  }, [authenticatedUserEmail, authenticatedUserId, dataStorage, isConfigured, legacyStorageKey, storageKey]);

  useEffect(() => {
    if (!isHydrated) return;
    const persisted = isConfigured
      ? { profile: { ...profile, email: undefined }, settings, consentHistory }
      : { events, profile, settings, reports, consentHistory, blockedUsers };
    dataStorage.setItem(storageKey, JSON.stringify(persisted)).catch(() => undefined);
  }, [blockedUsers, consentHistory, dataStorage, events, isConfigured, isHydrated, profile, reports, settings, storageKey]);

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
    if (!isConfigured || !isHydrated || !settings.onboardingCompleted || !user) return;
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collection_shares' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_leave_requests' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, refresh)
      .subscribe();
    return () => { active = false; if (client && channel) void client.removeChannel(channel); };
  }, [isConfigured, isHydrated, settings.onboardingCompleted, user]);

  useEffect(() => {
    if (!isConfigured || !isHydrated || !settings.onboardingCompleted || !user) return;
    let active = true;
    void fetchCloudProfile(user.id).then(async (cloudProfile) => {
      if (!active || !cloudProfile) return;
      if (cloudProfile.name === '新しいメンバー' && profile.name.trim()) {
        await syncProfileToCloud(profile);
        return;
      }
      setProfile((current) => {
        const next = { ...current, ...cloudProfile, email: user.email };
        return JSON.stringify(current) === JSON.stringify(next) ? current : next;
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [isConfigured, isHydrated, profile, settings.onboardingCompleted, user]);

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
    refreshData: async () => {
      if (!isConfigured || !user) return null;
      try {
        let cloudProfile = await fetchCloudProfile(user.id);
        const hasLocalProfile = profile.name.trim() && profile.name !== '新しいメンバー';
        if ((!cloudProfile || cloudProfile.name === '新しいメンバー') && hasLocalProfile) {
          await syncProfileToCloud(profile);
          cloudProfile = await fetchCloudProfile(user.id);
        }
        const cloudEvents = await fetchCloudEvents(user.id);
        setEvents(cloudEvents);
        if (cloudProfile) setProfile((current) => ({ ...current, ...cloudProfile, email: user.email }));
        return null;
      } catch {
        return '情報を更新できませんでした。通信状態を確認してください。';
      }
    },
    findEvent: (id) => events.find((event) => event.id === id),
    joinByCode: (code) => events.find((event) => event.inviteCode === code.trim().toUpperCase()),
    previewEventByCode: async (code) => {
      const normalizedCode = code.trim().toUpperCase();
      if (!normalizedCode) return { error: '招待コードを入力してください。' };
      if (!supabase) {
        const localEvent = events.find((event) => event.inviteCode === normalizedCode);
        if (localEvent && isEventArchived(localEvent)) return { error: 'このイベントはアーカイブ済みのため参加できません。' };
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
        if (isEventArchived(localEvent)) return { error: 'このイベントはアーカイブ済みのため参加できません。' };
        const alreadyJoined = localEvent.participants.some((participant) => participant.id === 'me' || participant.name === profile.name);
        if (!alreadyJoined) setEvents((current) => current.map((event) => event.id !== localEvent.id ? event : {
          ...event,
          participants: [...event.participants, { id: 'me', name: profile.name, initials: profile.initials, role: '参加者', avatarColor: profile.avatarColor, avatarUri: profile.avatarUri, attendance: '参加' }],
        }));
        return { eventId: localEvent.id };
      }
      let result: Awaited<ReturnType<typeof joinCloudEvent>>;
      try {
        if (profile.name.trim() && profile.name !== '新しいメンバー') {
          // Profile repair is useful for older accounts, but must never block
          // an otherwise valid invite join (for example after a stale web session).
          await syncProfileToCloud(profile).catch(() => undefined);
        }
        result = await joinCloudEvent(code);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('event_full')) return { error: 'このイベントは参加上限に達しています。' };
        if (message.includes('event_unavailable')) return { error: 'このイベントは現在参加できません。' };
        if (message.includes('profile_not_found')) return { error: 'プロフィール登録を完了してから、もう一度お試しください。' };
        if (message.includes('not_authenticated')) return { error: 'ログインし直してから、もう一度お試しください。' };
        if (message.includes('invalid_invite')) return { error: '招待コードが無効、期限切れ、または使用上限に達しています。' };
        return { error: '参加処理に失敗しました。通信状態を確認して、もう一度お試しください。' };
      }
      if (!result) return { error: 'イベントが見つかりません。' };
      try {
        const cloudEvents = user ? await fetchCloudEvents(user.id) : [];
        setEvents(cloudEvents);
        return { eventId: result.eventId, pending: result.status === 'pending' };
      } catch {
        return { eventId: result.eventId, pending: result.status === 'pending', refreshPending: true };
      }
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
      const targetEvent = events.find((event) => event.id === eventId);
      if (!targetEvent || isEventArchived(targetEvent)) return null;
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
      if (isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
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
      if (isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
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
            attendance: '参加',
          }] : event.participants,
        }));
        return null;
      } catch { return '参加申請を更新できませんでした。権限や通信状態を確認してください。'; }
    },
    addDateCandidate: async (eventId, input) => {
      const targetEvent = events.find((event) => event.id === eventId);
      if (!targetEvent) return 'イベントが見つかりません。';
      if (isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
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
      if (isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
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
      if (isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
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
      const targetEvent = events.find((event) => event.id === eventId);
      if (targetEvent && isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
      const candidate = targetEvent?.dateCandidates?.find((item) => item.id === candidateId);
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
          timeLabel: formatEventTimeLabel(candidate.startTime, undefined, 'start'),
        }));
        return null;
      } catch {
        return '日程を確定できませんでした。管理権限や通信状態を確認してください。';
      }
    },
    updateProfile: async (nextProfile, image) => {
      const previous = profile;
      const optimistic = { ...nextProfile, avatarUri: image?.uri ?? nextProfile.avatarUri };
      setProfile(optimistic);
      setEvents((current) => current.map((event) => ({
        ...event,
        host: event.participants.some((participant) => participant.id === user?.id && participant.role === '主催者') ? optimistic.name : event.host,
        participants: event.participants.map((participant) => participant.id === user?.id || (!user && participant.id === 'me')
          ? { ...participant, name: optimistic.name, initials: optimistic.initials, avatarColor: optimistic.avatarColor, avatarUri: optimistic.avatarUri }
          : participant),
      })));
      try {
        const avatarPath = await syncProfileToCloud(nextProfile, image);
        setProfile((current) => ({ ...current, avatarPath: avatarPath ?? current.avatarPath }));
        return null;
      } catch (error) {
        setProfile(previous);
        const message = error instanceof Error ? error.message : '';
        if (message.includes('duplicate') || message.includes('profiles_handle_key')) return 'この表示IDはすでに使われています。';
        if (message === 'image_too_large') return 'プロフィール画像は8MB以下にしてください。';
        return 'プロフィールを保存できませんでした。通信状態を確認してください。';
      }
    },
    updateEventCover: async (eventId, image) => {
      const target = events.find((event) => event.id === eventId);
      if (!target || !isEventManager(target, user?.id, profile.name)) return '主催者または共同主催者のみ変更できます。';
      if (isEventArchived(target)) return 'アーカイブ済みのイベントは変更できません。';
      const previousUri = target.coverImageUri;
      setEvents((current) => current.map((event) => event.id === eventId ? { ...event, coverImageUri: image.uri } : event));
      try {
        const coverImagePath = await syncCloudEventCover(eventId, image, target.coverImagePath);
        setEvents((current) => current.map((event) => event.id === eventId ? { ...event, coverImagePath } : event));
        return null;
      } catch (error) {
        setEvents((current) => current.map((event) => event.id === eventId ? { ...event, coverImageUri: previousUri } : event));
        if (error instanceof Error && error.message === 'image_too_large') return 'イベント画像は8MB以下にしてください。';
        return 'イベント画像を保存できませんでした。通信状態を確認してください。';
      }
    },
    deleteEvent: async (eventId) => {
      const target = events.find((event) => event.id === eventId);
      const host = target?.participants.find((participant) => participant.role === '主催者');
      const isHost = host && (host.id === user?.id || (!user && host.id === 'me'));
      if (!target || !isHost) return 'イベントを削除できるのは主催者だけです。';
      if (isEventArchived(target)) return 'アーカイブ済みのイベントは削除できません。';
      try {
        await deleteCloudEvent(eventId, target.coverImagePath, target.messages.map((message) => message.imagePath).filter((path): path is string => Boolean(path)));
        setEvents((current) => current.filter((event) => event.id !== eventId));
        return null;
      } catch {
        return 'イベントを削除できませんでした。通信状態を確認してください。';
      }
    },
    archiveEvent: async (eventId) => {
      const target = events.find((event) => event.id === eventId);
      if (!target || !isEventManager(target, user?.id, profile.name)) return 'アーカイブできるのは主催者・共同主催者だけです。';
      if (isEventArchived(target)) return null;
      if (!isEventPast(target)) return '終了したイベントのみアーカイブできます。';
      try {
        const archivedAt = await archiveCloudEvent(eventId);
        setEvents((current) => current.map((event) => event.id === eventId ? { ...event, archivedAt } : event));
        return null;
      } catch (error) {
        const message = error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : String(error);
        if (message.includes('event_not_finished')) return 'イベントの終了時刻を過ぎてからアーカイブできます。';
        if (message.includes('not_allowed')) return 'アーカイブできるのは主催者・共同主催者だけです。';
        if (message.includes('event_not_found')) return 'イベントが見つかりません。ホームで再読み込みしてください。';
        return 'アーカイブできませんでした。通信状態を確認して、もう一度お試しください。';
      }
    },
    requestEventLeave: async (eventId) => {
      const target = events.find((event) => event.id === eventId);
      if (target && isEventArchived(target)) return 'アーカイブ済みのイベントからは脱退できません。';
      const myId = user?.id ?? 'me';
      const me = target?.participants.find((participant) => participant.id === myId || (!user && participant.name === profile.name));
      if (!target || !me) return 'このイベントの参加者ではありません。';
      if (me.role === '主催者') return '主催者はイベントを削除するか、主催者移行後に脱退してください。';
      if (target.leaveRequests?.some((request) => request.userId === me.id)) return null;
      try {
        await requestCloudEventLeave(eventId);
        setEvents((current) => current.map((event) => event.id !== eventId ? event : {
          ...event,
          leaveRequests: [...(event.leaveRequests ?? []), {
            userId: me.id,
            name: me.name,
            initials: me.initials,
            avatarColor: me.avatarColor,
            avatarUri: me.avatarUri,
            requestedAt: new Date().toISOString(),
            mine: true,
          }],
        }));
        return null;
      } catch {
        return '脱退申請を送信できませんでした。通信状態を確認してください。';
      }
    },
    cancelEventLeave: async (eventId) => {
      const target = events.find((event) => event.id === eventId);
      if (target && isEventArchived(target)) return 'アーカイブ済みのイベントは変更できません。';
      const myId = user?.id ?? 'me';
      if (!target?.leaveRequests?.some((request) => request.userId === myId || request.mine)) return '脱退申請が見つかりません。';
      try {
        await cancelCloudEventLeave(eventId);
        setEvents((current) => current.map((event) => event.id !== eventId ? event : {
          ...event,
          leaveRequests: (event.leaveRequests ?? []).filter((request) => request.userId !== myId && !request.mine),
        }));
        return null;
      } catch {
        return '脱退申請を取り消せませんでした。';
      }
    },
    reviewEventLeave: async (eventId, targetUserId, decision) => {
      const target = events.find((event) => event.id === eventId);
      if (!target || !isEventManager(target, user?.id, profile.name)) return '管理権限がありません。';
      if (isEventArchived(target)) return 'アーカイブ済みのイベントは変更できません。';
      try {
        await reviewCloudEventLeave(eventId, targetUserId, decision);
        setEvents((current) => current.map((event) => event.id !== eventId ? event : {
          ...event,
          leaveRequests: (event.leaveRequests ?? []).filter((request) => request.userId !== targetUserId),
          participants: decision === 'approved' ? event.participants.filter((participant) => participant.id !== targetUserId) : event.participants,
        }));
        return null;
      } catch {
        return '脱退申請を更新できませんでした。通信状態と権限を確認してください。';
      }
    },
    completeOnboarding: async (input) => {
      const recordedAt = new Date().toISOString();
      const initials = input.name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'ME';
      const handlePart = input.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
      const nextProfile = { ...profile, name: input.name.trim(), email: input.email.trim().toLowerCase(), initials, handle: `@${handlePart.length >= 2 ? handlePart : 'member'}` };
      try {
        await syncOnboardingToCloud(input, nextProfile);
      } catch {
        return 'プロフィールを登録できませんでした。通信状態を確認して、もう一度お試しください。';
      }
      const nextSettings = {
        ...settings,
        onboardingCompleted: true,
        dateOfBirth: input.dateOfBirth,
        termsAcceptedAt: recordedAt,
        privacyAcceptedAt: recordedAt,
        communityAcceptedAt: recordedAt,
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: PRIVACY_VERSION,
        acceptedCommunityVersion: COMMUNITY_VERSION,
      };
      const nextConsentHistory: ConsentRecord[] = [...consentHistory,
        { id: `terms-${Date.now()}`, document: 'terms', version: TERMS_VERSION, accepted: true, recordedAt },
        { id: `privacy-${Date.now()}`, document: 'privacy', version: PRIVACY_VERSION, accepted: true, recordedAt },
        { id: `community-${Date.now()}`, document: 'community', version: COMMUNITY_VERSION, accepted: true, recordedAt },
      ];
      // Persist before leaving onboarding. This removes the previous race where
      // navigation could happen before the state-driven storage effect finished.
      const persisted = isConfigured
        ? { profile: { ...nextProfile, email: undefined }, settings: nextSettings, consentHistory: nextConsentHistory }
        : { events, profile: nextProfile, settings: nextSettings, reports, consentHistory: nextConsentHistory, blockedUsers };
      try {
        await dataStorage.setItem(storageKey, JSON.stringify(persisted));
      } catch {
        return '登録情報を端末に安全に保存できませんでした。空き容量を確認して、もう一度お試しください。';
      }
      setProfile(nextProfile);
      setSettings(nextSettings);
      setConsentHistory(nextConsentHistory);
      return null;
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
        const { error } = await supabase.rpc('submit_safety_report', {
          target_event_id: report.eventId?.match(/^[0-9a-f-]{36}$/i) ? report.eventId : null,
          target_message_id: report.messageId?.match(/^[0-9a-f-]{36}$/i) ? report.messageId : null,
          reported_user_id: report.targetUserId?.match(/^[0-9a-f-]{36}$/i) ? report.targetUserId : null,
          reported_user_name: report.targetUserName ?? null,
          report_reason: report.reason,
          report_details: report.details ?? null,
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
      await Promise.all([dataStorage.removeItem(storageKey), dataStorage.removeItem(legacyStorageKey)]);
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
    addMessage: async (eventId, text, image) => {
      const target = events.find((event) => event.id === eventId);
      if (!target) return 'イベントが見つかりません。';
      if (isEventArchived(target)) return 'アーカイブ済みのイベントには投稿できません。';
      const normalizedText = text.trim();
      if (!normalizedText && !image) return 'メッセージまたは写真を追加してください。';
      const validationError = normalizedText ? validateUserContent(normalizedText) : null;
      if (validationError) return validationError;
      if (image?.fileSize && image.fileSize > 8 * 1024 * 1024) return '写真は8MB以下にしてください。';
      const message: ChatMessage = {
        id: Crypto.randomUUID(),
        authorId: user?.id,
        author: profile.name,
        initials: profile.initials,
        text: normalizedText,
        time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        mine: true,
        color: profile.avatarColor,
        imageUri: image?.uri,
        imageMimeType: image?.mimeType,
        imageWidth: image?.width,
        imageHeight: image?.height,
      };
      try {
        message.imagePath = await syncCloudMessage(eventId, message.id, normalizedText, image);
      } catch (error) {
        const messageText = error instanceof Error
          ? error.message
          : error && typeof error === 'object' && 'message' in error
            ? String(error.message)
            : '';
        if (messageText === 'image_too_large') return '写真は8MB以下にしてください。';
        if (messageText.includes('objectionable_content')) return 'コミュニティガイドラインにより、この内容は投稿できません。';
        return '写真またはメッセージを送信できませんでした。通信状態を確認して、もう一度お試しください。';
      }
      setEvents((current) => current.map((event) => event.id === eventId
        ? { ...event, messages: event.messages.some((existing) => existing.id === message.id) ? event.messages : [...event.messages, message] }
        : event));
      return null;
    },
    updateEventDateTime: (eventId, input) => {
      const target = events.find((event) => event.id === eventId);
      if (!target || isEventArchived(target)) return;
      const normalizedDates = normalizeEventDateRange(input.startDate, input.endDate);
      const normalizedInput = { ...input, ...normalizedDates };
      setEvents((current) => current.map((event) => event.id !== eventId ? event : {
        ...event,
        ...normalizedInput,
        dateLabel: formatDateLabel(normalizedInput.startDate, normalizedInput.endDate),
        timeLabel: formatEventTimeLabel(normalizedInput.startTime, normalizedInput.endTime, normalizedInput.timeMode),
      }));
      void syncCloudDateTime(eventId, normalizedInput);
    },
    updateEventLocation: (eventId, input) => {
      const target = events.find((event) => event.id === eventId);
      if (!target || isEventArchived(target)) return;
      setEvents((current) => current.map((event) => event.id === eventId ? { ...event, ...input } : event));
      void syncCloudLocation(eventId, input);
    },
    addScheduleItem: async (eventId, input) => {
      const scheduleId = Crypto.randomUUID();
      const targetEvent = events.find((event) => event.id === eventId);
      if (!targetEvent || !isEventManager(targetEvent, user?.id, profile.name)) return '主催者・共同主催者のみ追加できます。';
      if (isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
      setEvents((current) => current.map((event) => event.id === eventId
        ? { ...event, schedule: [...event.schedule, { ...input, id: scheduleId }] }
        : event));
      try {
        await syncCloudSchedule(targetEvent, scheduleId, input);
        return null;
      } catch {
        setEvents((current) => current.map((event) => event.id === eventId
          ? { ...event, schedule: event.schedule.filter((item) => item.id !== scheduleId) }
          : event));
        return '予定を追加できませんでした。通信状態を確認してください。';
      }
    },
    updateScheduleItem: async (eventId, scheduleId, input) => {
      const targetEvent = events.find((event) => event.id === eventId);
      if (!targetEvent || !isEventManager(targetEvent, user?.id, profile.name)) return '主催者・共同主催者のみ編集できます。';
      if (isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
      const previous = targetEvent.schedule.find((item) => item.id === scheduleId);
      if (!previous) return '予定が見つかりません。';
      setEvents((current) => current.map((event) => event.id !== eventId ? event : {
        ...event,
        schedule: event.schedule.map((item) => item.id === scheduleId ? { ...item, ...input } : item)
          .sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`)),
      }));
      try {
        await updateCloudSchedule(targetEvent, scheduleId, input);
        return null;
      } catch {
        setEvents((current) => current.map((event) => event.id !== eventId ? event : { ...event, schedule: event.schedule.map((item) => item.id === scheduleId ? previous : item) }));
        return '予定を更新できませんでした。通信状態を確認してください。';
      }
    },
    deleteScheduleItem: async (eventId, scheduleId) => {
      const targetEvent = events.find((event) => event.id === eventId);
      if (!targetEvent || !isEventManager(targetEvent, user?.id, profile.name)) return '主催者・共同主催者のみ削除できます。';
      if (isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
      const previous = targetEvent.schedule;
      setEvents((current) => current.map((event) => event.id === eventId ? { ...event, schedule: event.schedule.filter((item) => item.id !== scheduleId) } : event));
      try {
        await deleteCloudSchedule(eventId, scheduleId);
        return null;
      } catch {
        setEvents((current) => current.map((event) => event.id === eventId ? { ...event, schedule: previous } : event));
        return '予定を削除できませんでした。通信状態を確認してください。';
      }
    },
    addCollection: async (eventId, input) => {
      const targetEvent = events.find((event) => event.id === eventId);
      if (!targetEvent || !isEventHost(targetEvent, user?.id, profile.name)) return '集金を追加できるのは主催者だけです。';
      if (isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
      const shares = buildCollectionShares(input);
      const collection: CollectionItem = {
        id: Crypto.randomUUID(),
        title: input.title,
        category: input.category,
        paidByParticipantId: input.paidByParticipantId,
        totalAmount: collectionSharesTotal(shares),
        splitMethod: input.splitMethod,
        autoAssignNewMembers: input.autoAssignNewMembers ?? false,
        defaultShareAmount: input.defaultShareAmount,
        dueDate: input.dueDate,
        note: input.note,
        shares,
      };
      setEvents((current) => current.map((event) => event.id === eventId
        ? { ...event, collections: [...event.collections, collection] }
        : event));
      try {
        await syncCloudCollection(eventId, collection);
        return null;
      } catch {
        setEvents((current) => current.map((event) => event.id === eventId
          ? { ...event, collections: event.collections.filter((item) => item.id !== collection.id) }
          : event));
        return '集金項目を追加できませんでした。通信状態を確認してください。';
      }
    },
    updateCollection: async (eventId, collectionId, input) => {
      const targetEvent = events.find((event) => event.id === eventId);
      if (!targetEvent || !isEventHost(targetEvent, user?.id, profile.name)) return '集金を編集できるのは主催者だけです。';
      if (isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
      const previous = targetEvent.collections.find((collection) => collection.id === collectionId);
      if (!previous) return '集金項目が見つかりません。';
      const shares = buildCollectionShares(input, previous.shares);
      const nextCollection: CollectionItem = {
        ...previous,
        title: input.title,
        category: input.category,
        paidByParticipantId: input.paidByParticipantId,
        totalAmount: collectionSharesTotal(shares),
        splitMethod: input.splitMethod,
        autoAssignNewMembers: input.autoAssignNewMembers ?? false,
        defaultShareAmount: input.defaultShareAmount,
        dueDate: input.dueDate,
        note: input.note,
        shares,
      };
      setEvents((current) => current.map((event) => event.id !== eventId ? event : {
        ...event,
        collections: event.collections.map((collection) => collection.id === collectionId ? nextCollection : collection),
      }));
      try {
        await updateCloudCollection(eventId, nextCollection);
        return null;
      } catch {
        setEvents((current) => current.map((event) => event.id !== eventId ? event : {
          ...event,
          collections: event.collections.map((collection) => collection.id === collectionId ? previous : collection),
        }));
        return '集金項目を更新できませんでした。通信状態と権限を確認してください。';
      }
    },
    deleteCollection: async (eventId, collectionId) => {
      const targetEvent = events.find((event) => event.id === eventId);
      if (!targetEvent || !isEventHost(targetEvent, user?.id, profile.name)) return '集金を削除できるのは主催者だけです。';
      if (isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
      const previousCollections = targetEvent.collections;
      if (!previousCollections.some((collection) => collection.id === collectionId)) return '集金項目が見つかりません。';
      setEvents((current) => current.map((event) => event.id === eventId
        ? { ...event, collections: event.collections.filter((collection) => collection.id !== collectionId) }
        : event));
      try {
        await deleteCloudCollection(eventId, collectionId);
        return null;
      } catch {
        setEvents((current) => current.map((event) => event.id === eventId ? { ...event, collections: previousCollections } : event));
        return '集金項目を削除できませんでした。通信状態と権限を確認してください。';
      }
    },
    toggleCollectionPayment: async (eventId, collectionId, participantId) => {
      const targetEvent = events.find((event) => event.id === eventId);
      if (!isEventHost(targetEvent, user?.id, profile.name)) return '支払状態を変更できるのは主催者だけです。';
      if (targetEvent && isEventArchived(targetEvent)) return 'アーカイブ済みのイベントは変更できません。';
      const currentShare = targetEvent?.collections.find((collection) => collection.id === collectionId)?.shares.find((share) => share.participantId === participantId);
      if (!currentShare) return '対象の支払い情報が見つかりません。';
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
      try {
        await syncCloudPayment(collectionId, participantId, nextPaid);
        return null;
      } catch {
        setEvents((current) => current.map((event) => event.id !== eventId ? event : {
          ...event,
          collections: event.collections.map((collection) => collection.id !== collectionId ? collection : {
            ...collection,
            shares: collection.shares.map((share) => share.participantId !== participantId ? share : currentShare),
          }),
        }));
        return '支払状態を更新できませんでした。通信状態と権限を確認してください。';
      }
    },
    addEvent: (input) => {
      const id = Crypto.randomUUID();
      const normalizedDates = normalizeEventDateRange(input.startDate, input.endDate);
      const safeInput = { ...input, ...normalizedDates };
      const event: EventItem = {
        id,
        title: input.title,
        category: 'EVENT',
        tagline: input.description || '',
        host: profile.name,
        startDate: safeInput.startDate,
        endDate: safeInput.endDate,
        dateLabel: formatDateLabel(safeInput.startDate, safeInput.endDate),
        startTime: input.startTime,
        endTime: input.endTime,
        timeMode: input.timeMode,
        timeLabel: formatEventTimeLabel(input.startTime, input.endTime, input.timeMode),
        location: input.location || '場所未設定',
        address: input.address || input.location || '場所未設定',
        latitude: input.latitude,
        longitude: input.longitude,
        description: input.description || '',
        coverColor: '#242A26',
        accentColor: '#A8442F',
        coverImageUri: input.coverImage?.uri,
        status: '予定',
        inviteCode: supabase ? '' : Math.random().toString(36).slice(2, 8).toUpperCase(),
        capacity: 10000,
        participants: [
          { id: user?.id ?? 'me', name: profile.name, initials: profile.initials, role: '主催者', avatarColor: profile.avatarColor, avatarUri: profile.avatarUri, attendance: '参加' },
        ],
        joinRequests: [],
        leaveRequests: [],
        dateCandidates: [],
        schedule: [
          { id: Crypto.randomUUID(), day: safeInput.startDate, time: input.startTime, title: 'イベント開始', type: 'activity' },
        ],
        collections: input.initialFee > 0 ? [{
          id: Crypto.randomUUID(),
          title: '参加費',
          category: 'entry',
          paidByParticipantId: user?.id ?? 'me',
          totalAmount: input.initialFee,
          splitMethod: 'equal',
          autoAssignNewMembers: true,
          defaultShareAmount: input.initialFee,
          note: 'イベント作成時に登録した参加費です。',
          shares: [{ participantId: user?.id ?? 'me', amount: input.initialFee, paid: false }],
        }] : [],
        messages: [],
      };
      setEvents((current) => [event, ...current]);
      void createCloudEvent(event).then(async (inviteCode) => {
        if (inviteCode) setEvents((current) => current.map((item) => item.id === event.id ? { ...item, inviteCode } : item));
        await Promise.all([
          ...event.collections.map((collection) => syncCloudCollection(event.id, collection)),
          ...event.schedule.map((schedule) => syncCloudSchedule(event, schedule.id, schedule)),
        ]);
        if (input.coverImage) {
          const coverImagePath = await syncCloudEventCover(event.id, input.coverImage);
          setEvents((current) => current.map((item) => item.id === event.id ? { ...item, coverImagePath, coverImageUri: input.coverImage?.uri } : item));
        }
      }).catch(() => undefined);
      return event;
    },
  }), [blockedUsers, consentHistory, dataStorage, events, isConfigured, isHydrated, legacyStorageKey, profile, reports, settings, storageKey, user]);

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvents() {
  const context = useContext(EventContext);
  if (!context) throw new Error('useEvents must be used inside EventProvider');
  return context;
}
