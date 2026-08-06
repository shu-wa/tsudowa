import { supabase } from '@/lib/supabase';
import { AttendanceChoice, AvailabilityChoice, ChatImageInput, CollectionItem, EventDateTimeInput, EventInvitePreview, EventItem, EventLocationInput, NewDateCandidateInput, NewScheduleInput } from '@/types/event';
import { appImageExtension, createAppImageUrls, uploadAppImage } from '@/lib/cloud-media';
import { normalizeEventDateRange, toDateString } from '@/lib/date-values';
import * as Crypto from 'expo-crypto';

export const isCloudId = (value?: string) => Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
const CHAT_MEDIA_BUCKET = 'chat-media';
const MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024;

type CloudProfile = { id: string; display_name: string; avatar_color: string; avatar_path?: string };
type CloudMember = { user_id: string; role: 'host' | 'cohost' | 'member'; status: string; attendance_label?: string; chat_read_at?: string; joined_at: string; profile?: CloudProfile };
type CloudSchedule = { id: string; starts_at: string; title: string; note?: string; item_type: 'move' | 'activity' | 'food' | 'stay' };
type CloudShare = { user_id: string; amount: number | string; paid: boolean; paid_at?: string };
type CloudCollection = { id: string; title: string; category: CollectionItem['category']; paid_by_user_id: string; total_amount: number | string; split_method: CollectionItem['splitMethod']; auto_assign_new_members?: boolean; default_share_amount?: number | string; due_date?: string; note?: string; shares?: CloudShare[] };
type CloudMessage = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  image_path?: string;
  image_mime_type?: string;
  image_width?: number;
  image_height?: number;
  author?: CloudProfile;
};
type CloudCandidateVote = { user_id: string; choice: AvailabilityChoice };
type CloudDateCandidate = { id: string; candidate_date: string; start_time: string; note?: string; votes?: CloudCandidateVote[] };
type CloudLeaveRequest = { user_id: string; status: string; requested_at: string; profile?: CloudProfile };
type CloudEvent = {
  id: string; owner_id: string; title: string; category: string; tagline?: string; description?: string;
  start_date: string; end_date: string; start_time: string; end_time?: string; time_mode: 'start' | 'range';
  location_name?: string; address?: string; latitude?: number; longitude?: number; capacity: number; status: string;
  cover_color: string; accent_color: string; cover_image_path?: string; members?: CloudMember[]; schedule?: CloudSchedule[];
  archived_at?: string;
  collections?: CloudCollection[]; messages?: CloudMessage[];
  date_candidates?: CloudDateCandidate[];
  leave_requests?: CloudLeaveRequest[];
};

const dateLabel = (start: string, end: string) => {
  const format = (value: string, year = true) => { const [y, m, d] = value.split('-').map(Number); return `${year ? `${y}年` : ''}${m}月${d}日`; };
  return start === end ? format(start) : `${format(start)} – ${format(end, start.slice(0, 4) !== end.slice(0, 4))}`;
};

export async function fetchCloudEvents(currentUserId: string): Promise<EventItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('events').select(`
    *,
    members:event_members(*, profile:profiles(id, display_name, avatar_color, avatar_path)),
    schedule:schedule_items(*),
    collections(*, shares:collection_shares(*)),
    messages(*, author:profiles(id, display_name, avatar_color)),
    date_candidates(*, votes:date_candidate_votes(*)),
    leave_requests:event_leave_requests(*, profile:profiles!event_leave_requests_user_id_fkey(id, display_name, avatar_color, avatar_path))
  `).order('start_date', { ascending: true });
  if (error) throw error;
  const cloudEvents = (data ?? []) as CloudEvent[];
  const memberUserIds = [...new Set(cloudEvents.flatMap((event) => (event.members ?? []).map((member) => member.user_id)))];
  const { data: visibleProfiles } = memberUserIds.length
    ? await supabase.from('profiles').select('id, display_name, avatar_color, avatar_path').in('id', memberUserIds)
    : { data: [] };
  const profileByUserId = new Map(((visibleProfiles ?? []) as CloudProfile[]).map((memberProfile) => [memberProfile.id, memberProfile]));
  const imagePaths = [...new Set(cloudEvents.flatMap((event) => (event.messages ?? []).map((message) => message.image_path).filter((path): path is string => Boolean(path))))];
  const signedImageUrls = new Map<string, string>();
  if (imagePaths.length) {
    const { data: signedData, error: signedError } = await supabase.storage.from(CHAT_MEDIA_BUCKET).createSignedUrls(imagePaths, 60 * 60);
    if (!signedError) {
      for (const signed of signedData ?? []) {
        if (signed.path && signed.signedUrl) signedImageUrls.set(signed.path, signed.signedUrl);
      }
    }
  }
  const appImagePaths = [...new Set(cloudEvents.flatMap((event) => [
    event.cover_image_path,
    ...(event.members ?? []).map((member) => (member.profile ?? profileByUserId.get(member.user_id))?.avatar_path),
    ...(event.leave_requests ?? []).map((request) => request.profile?.avatar_path),
  ].filter((path): path is string => Boolean(path))))];
  const appImageUrls = await createAppImageUrls(appImagePaths);
  return cloudEvents.map((event) => {
    const normalizedDates = normalizeEventDateRange(event.start_date, event.end_date);
    const members = (event.members ?? []).filter((member) => member.status === 'approved');
    const participants = members.map((member) => {
      const memberProfile = member.profile ?? profileByUserId.get(member.user_id);
      return ({
      id: member.user_id,
      name: memberProfile?.display_name ?? 'メンバー',
      initials: (memberProfile?.display_name ?? 'ME').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      role: member.role === 'host' ? '主催者' as const : member.role === 'cohost' ? '共同主催者' as const : '参加者' as const,
      avatarColor: memberProfile?.avatar_color ?? '#68736C',
      avatarUri: memberProfile?.avatar_path ? appImageUrls.get(memberProfile.avatar_path) : undefined,
      attendance: member.attendance_label ?? '参加',
    });
    });
    const joinRequests = (event.members ?? []).filter((member) => member.status === 'pending').map((member) => {
      const memberProfile = member.profile ?? profileByUserId.get(member.user_id);
      return ({
      userId: member.user_id,
      name: memberProfile?.display_name ?? 'メンバー',
      initials: (memberProfile?.display_name ?? 'ME').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      avatarColor: memberProfile?.avatar_color ?? '#68736C',
      avatarUri: memberProfile?.avatar_path ? appImageUrls.get(memberProfile.avatar_path) : undefined,
      requestedAt: member.joined_at,
    });
    });
    const profileById = new Map(participants.map((participant) => [participant.id, participant]));
    return {
      id: event.id,
      title: event.title,
      category: event.category,
      tagline: event.tagline ?? '',
      host: profileById.get(event.owner_id)?.name ?? '主催者',
      startDate: normalizedDates.startDate,
      endDate: normalizedDates.endDate,
      dateLabel: dateLabel(normalizedDates.startDate, normalizedDates.endDate),
      startTime: event.start_time.slice(0, 5),
      endTime: event.end_time?.slice(0, 5),
      timeMode: event.time_mode,
      timeLabel: event.time_mode === 'range' && event.end_time ? `${event.start_time.slice(0, 5)}–${event.end_time.slice(0, 5)}` : `${event.start_time.slice(0, 5)} 開始`,
      location: event.location_name ?? '場所未設定',
      address: event.address ?? '場所未設定',
      latitude: event.latitude,
      longitude: event.longitude,
      description: event.description ?? '',
      coverColor: event.cover_color,
      accentColor: event.accent_color,
      coverImagePath: event.cover_image_path,
      coverImageUri: event.cover_image_path ? appImageUrls.get(event.cover_image_path) : undefined,
      status: event.status === 'active' ? '開催中' : event.status === 'completed' || event.status === 'cancelled' ? '終了' : '予定',
      inviteCode: '',
      capacity: event.capacity,
      participants,
      joinRequests,
      leaveRequests: (event.leave_requests ?? []).filter((request) => request.status === 'pending').map((request) => ({
        userId: request.user_id,
        name: request.profile?.display_name ?? '参加者',
        initials: (request.profile?.display_name ?? 'ME').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
        avatarColor: request.profile?.avatar_color ?? '#68736C',
        avatarUri: request.profile?.avatar_path ? appImageUrls.get(request.profile.avatar_path) : undefined,
        requestedAt: request.requested_at,
        mine: request.user_id === currentUserId,
      })),
      dateCandidates: (event.date_candidates ?? []).sort((a, b) => `${a.candidate_date}${a.start_time}`.localeCompare(`${b.candidate_date}${b.start_time}`)).map((candidate) => ({
        id: candidate.id,
        date: candidate.candidate_date,
        startTime: candidate.start_time.slice(0, 5),
        note: candidate.note,
        votes: (candidate.votes ?? []).map((vote) => ({ participantId: vote.user_id, choice: vote.choice })),
      })),
      schedule: (event.schedule ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((item) => ({ id: item.id, day: toDateString(new Date(item.starts_at)), time: new Date(item.starts_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }), title: item.title, note: item.note, type: item.item_type })),
      collections: (event.collections ?? []).map((collection) => ({ id: collection.id, title: collection.title, category: collection.category, paidByParticipantId: collection.paid_by_user_id, totalAmount: Number(collection.total_amount), splitMethod: collection.split_method, autoAssignNewMembers: collection.auto_assign_new_members ?? false, defaultShareAmount: collection.default_share_amount == null ? undefined : Number(collection.default_share_amount), dueDate: collection.due_date, note: collection.note, shares: (collection.shares ?? []).map((share) => ({ participantId: share.user_id, amount: Number(share.amount), paid: share.paid, paidAt: share.paid_at ? new Date(share.paid_at).toLocaleDateString('ja-JP') : undefined })) })),
      messages: (event.messages ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((message) => ({
        id: message.id,
        authorId: message.author_id,
        author: message.author?.display_name ?? 'メンバー',
        initials: (message.author?.display_name ?? 'ME').slice(0, 2),
        text: message.body ?? '',
        time: new Date(message.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        createdAt: message.created_at,
        mine: message.author_id === currentUserId,
        color: message.author?.avatar_color ?? '#68736C',
        imageUri: message.image_path ? signedImageUrls.get(message.image_path) : undefined,
        imagePath: message.image_path,
        imageMimeType: message.image_mime_type,
        imageWidth: message.image_width,
        imageHeight: message.image_height,
      })),
      chatLastReadAt: event.members?.find((member) => member.user_id === currentUserId)?.chat_read_at,
      archivedAt: event.archived_at,
    };
  });
}

export async function createCloudEvent(event: EventItem) {
  if (!supabase || !isCloudId(event.id)) return null;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;
  const { error } = await supabase.from('events').insert({
    id: event.id, owner_id: userId, title: event.title, category: event.category, tagline: event.tagline,
    description: event.description, start_date: event.startDate, end_date: event.endDate, start_time: event.startTime,
    end_time: event.timeMode === 'range' ? event.endTime : null, time_mode: event.timeMode, location_name: event.location,
    address: event.address, latitude: event.latitude, longitude: event.longitude, capacity: event.capacity,
    cover_color: event.coverColor, accent_color: event.accentColor,
  });
  if (error) throw error;
  const { data: inviteCode, error: inviteError } = await supabase.rpc('create_event_invite', { target_event_id: event.id });
  if (inviteError) throw inviteError;
  return inviteCode as string;
}

export async function createCloudInvite(eventId: string) {
  if (!supabase || !isCloudId(eventId)) return null;
  const { data, error } = await supabase.rpc('create_event_invite', { target_event_id: eventId });
  if (error) throw error;
  return data as string;
}

export async function archiveCloudEvent(eventId: string) {
  if (!supabase || !isCloudId(eventId)) return new Date().toISOString();
  const { data, error } = await supabase.rpc('archive_event', { target_event_id: eventId });
  if (error) throw error;
  return String(data);
}

export async function joinCloudEvent(code: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('join_event_by_invite', { raw_token: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { eventId: row.event_id as string, status: row.membership_status as string } : null;
}

export async function previewCloudEventInvite(code: string): Promise<EventInvitePreview | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('preview_event_invite', { raw_token: code.trim().toUpperCase() });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const startTime = String(row.start_time).slice(0, 5);
  const endTime = row.end_time ? String(row.end_time).slice(0, 5) : undefined;
  return {
    eventId: row.event_id as string,
    title: row.event_title as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    dateLabel: dateLabel(row.start_date as string, row.end_date as string),
    timeLabel: row.time_mode === 'range' && endTime ? `${startTime}–${endTime}` : `${startTime} 開始`,
  };
}

export async function syncCloudMessage(eventId: string, messageId: string, body: string, image?: ChatImageInput) {
  if (!supabase || !isCloudId(eventId)) return undefined;
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('not_authenticated');

  let imagePath: string | undefined;
  if (image) {
    if (image.fileSize && image.fileSize > MAX_CHAT_IMAGE_BYTES) throw new Error('image_too_large');
    const response = await fetch(image.uri);
    if (!response.ok) throw new Error('image_read_failed');
    const imageData = await response.arrayBuffer();
    if (imageData.byteLength > MAX_CHAT_IMAGE_BYTES) throw new Error('image_too_large');
    const extension = imageExtension(image.mimeType, image.fileName);
    imagePath = `${eventId}/${data.user.id}/${messageId}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(imagePath, imageData, {
      contentType: image.mimeType,
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) throw uploadError;
  }

  const { error } = await supabase.rpc('send_event_message', {
    message_id: messageId,
    target_event_id: eventId,
    message_body: body,
    message_image_path: imagePath ?? null,
    message_image_mime_type: image?.mimeType ?? null,
    message_image_width: image?.width ?? null,
    message_image_height: image?.height ?? null,
  });
  if (error) {
    if (imagePath) await supabase.storage.from(CHAT_MEDIA_BUCKET).remove([imagePath]);
    throw error;
  }
  return imagePath;
}

export async function syncCloudEventCover(eventId: string, image: ChatImageInput, previousPath?: string) {
  if (!supabase || !isCloudId(eventId)) return undefined;
  const path = `events/${eventId}/cover/${Crypto.randomUUID()}.${appImageExtension(image.mimeType, image.fileName)}`;
  await uploadAppImage(path, image);
  const { error } = await supabase.from('events').update({ cover_image_path: path }).eq('id', eventId);
  if (error) {
    await supabase.storage.from('app-media').remove([path]);
    throw error;
  }
  if (previousPath && previousPath !== path) await supabase.storage.from('app-media').remove([previousPath]);
  return path;
}

export async function deleteCloudEvent(eventId: string, coverPath?: string, chatImagePaths: string[] = []) {
  if (!supabase || !isCloudId(eventId)) return;
  if (coverPath) await supabase.storage.from('app-media').remove([coverPath]);
  if (chatImagePaths.length) await supabase.storage.from(CHAT_MEDIA_BUCKET).remove(chatImagePaths);
  const { error } = await supabase.rpc('delete_owned_event', { target_event_id: eventId });
  if (error) throw error;
}

export async function requestCloudEventLeave(eventId: string) {
  if (!supabase || !isCloudId(eventId)) return;
  const { error } = await supabase.rpc('request_event_leave', { target_event_id: eventId });
  if (error) throw error;
}

export async function cancelCloudEventLeave(eventId: string) {
  if (!supabase || !isCloudId(eventId)) return;
  const { error } = await supabase.rpc('cancel_event_leave_request', { target_event_id: eventId });
  if (error) throw error;
}

export async function reviewCloudEventLeave(eventId: string, userId: string, decision: 'approved' | 'declined') {
  if (!supabase || !isCloudId(eventId) || !isCloudId(userId)) return;
  const { error } = await supabase.rpc('review_event_leave_request', {
    target_event_id: eventId,
    target_user_id: userId,
    decision,
  });
  if (error) throw error;
}

function imageExtension(mimeType: string, fileName?: string) {
  const byMimeType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  if (byMimeType[mimeType]) return byMimeType[mimeType];
  const fromName = fileName?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  return fromName && fromName.length <= 5 ? fromName : 'jpg';
}

export async function syncCloudChatRead(eventId: string) {
  if (!supabase || !isCloudId(eventId)) return;
  const { error } = await supabase.rpc('mark_event_chat_read', { target_event_id: eventId });
  if (error) throw error;
}

export async function syncCloudDateTime(eventId: string, input: EventDateTimeInput) {
  if (!supabase || !isCloudId(eventId)) return;
  await supabase.from('events').update({ start_date: input.startDate, end_date: input.endDate, start_time: input.startTime, end_time: input.timeMode === 'range' ? input.endTime : null, time_mode: input.timeMode }).eq('id', eventId);
}

export async function syncCloudLocation(eventId: string, input: EventLocationInput) {
  if (!supabase || !isCloudId(eventId)) return;
  await supabase.from('events').update({ location_name: input.location, address: input.address, latitude: input.latitude, longitude: input.longitude }).eq('id', eventId);
}

export async function syncCloudSchedule(event: EventItem, scheduleId: string, input: NewScheduleInput) {
  if (!supabase || !isCloudId(event.id)) return;
  const { data } = await supabase.auth.getUser(); if (!data.user) return;
  const scheduleDate = /^\d{4}-\d{2}-\d{2}$/.test(input.day) ? input.day : event.startDate;
  const start = new Date(`${scheduleDate}T${input.time}:00`);
  const { error } = await supabase.from('schedule_items').insert({ id: scheduleId, event_id: event.id, starts_at: start.toISOString(), title: input.title, note: input.note, item_type: input.type, created_by: data.user.id });
  if (error) throw error;
}

export async function updateCloudSchedule(event: EventItem, scheduleId: string, input: NewScheduleInput) {
  if (!supabase || !isCloudId(event.id) || !isCloudId(scheduleId)) return;
  const scheduleDate = /^\d{4}-\d{2}-\d{2}$/.test(input.day) ? input.day : event.startDate;
  const start = new Date(`${scheduleDate}T${input.time}:00`);
  const { error } = await supabase.from('schedule_items').update({ starts_at: start.toISOString(), title: input.title, note: input.note, item_type: input.type }).eq('id', scheduleId).eq('event_id', event.id);
  if (error) throw error;
}

export async function deleteCloudSchedule(eventId: string, scheduleId: string) {
  if (!supabase || !isCloudId(eventId) || !isCloudId(scheduleId)) return;
  const { error } = await supabase.from('schedule_items').delete().eq('id', scheduleId).eq('event_id', eventId);
  if (error) throw error;
}

export async function syncCloudCollection(eventId: string, collection: CollectionItem) {
  if (!supabase || !isCloudId(eventId) || !isCloudId(collection.id)) return;
  const { data } = await supabase.auth.getUser(); if (!data.user) return;
  const payerId = isCloudId(collection.paidByParticipantId) ? collection.paidByParticipantId : data.user.id;
  const { error } = await supabase.from('collections').insert({ id: collection.id, event_id: eventId, title: collection.title, category: collection.category, paid_by_user_id: payerId, total_amount: collection.totalAmount, currency: 'JPY', split_method: collection.splitMethod, auto_assign_new_members: collection.autoAssignNewMembers ?? false, default_share_amount: collection.defaultShareAmount, due_date: collection.dueDate, note: collection.note, created_by: data.user.id });
  if (error) throw error;
  const shares = collection.shares
    .map((share) => ({ ...share, cloudUserId: isCloudId(share.participantId) ? share.participantId : share.participantId === 'me' ? data.user!.id : null }))
    .filter((share) => Boolean(share.cloudUserId))
    .map((share) => ({ collection_id: collection.id, user_id: share.cloudUserId!, amount: share.amount, paid: share.paid, paid_at: share.paid ? new Date().toISOString() : null, confirmed_by: share.paid ? data.user!.id : null }));
  if (shares.length) {
    const { error: sharesError } = await supabase.from('collection_shares').upsert(shares, { onConflict: 'collection_id,user_id', ignoreDuplicates: true });
    if (sharesError) throw sharesError;
  }
}

export async function syncCloudPayment(collectionId: string, participantId: string, paid: boolean) {
  if (!supabase || !isCloudId(collectionId) || !isCloudId(participantId)) return;
  const { error } = await supabase.rpc('set_collection_share_paid', { target_collection_id: collectionId, target_user_id: participantId, is_paid: paid });
  if (error) throw error;
}

export async function syncCloudAttendance(eventId: string, attendance: AttendanceChoice) {
  if (!supabase || !isCloudId(eventId)) return;
  const { error } = await supabase.rpc('set_my_attendance', { target_event_id: eventId, attendance });
  if (error) throw error;
}

export async function reviewCloudJoinRequest(eventId: string, userId: string, decision: 'approved' | 'declined') {
  if (!supabase || !isCloudId(eventId) || !isCloudId(userId)) return;
  const { error } = await supabase.rpc('review_event_join_request', { target_event_id: eventId, target_user_id: userId, decision });
  if (error) throw error;
}

export async function syncCloudDateCandidate(eventId: string, candidateId: string, input: NewDateCandidateInput) {
  if (!supabase || !isCloudId(eventId) || !isCloudId(candidateId)) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { error } = await supabase.from('date_candidates').insert({
    id: candidateId,
    event_id: eventId,
    candidate_date: input.date,
    start_time: input.startTime,
    note: input.note,
    created_by: data.user.id,
  });
  if (error) throw error;
}

export async function syncCloudAvailabilityVote(candidateId: string, choice: AvailabilityChoice) {
  if (!supabase || !isCloudId(candidateId)) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { error } = await supabase.from('date_candidate_votes').upsert({
    candidate_id: candidateId,
    user_id: data.user.id,
    choice,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'candidate_id,user_id' });
  if (error) throw error;
}

export async function syncCloudMemberRole(eventId: string, userId: string, role: 'cohost' | 'member') {
  if (!supabase || !isCloudId(eventId) || !isCloudId(userId)) return;
  const { error } = await supabase.rpc('set_event_member_role', {
    target_event_id: eventId,
    target_user_id: userId,
    new_role: role,
  });
  if (error) throw error;
}

export async function confirmCloudDateCandidate(candidateId: string) {
  if (!supabase || !isCloudId(candidateId)) return;
  const { error } = await supabase.rpc('confirm_event_date_candidate', { target_candidate_id: candidateId });
  if (error) throw error;
}
