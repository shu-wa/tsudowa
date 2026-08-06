import { legalConfig } from '@/constants/legal';
import { appImageExtension, createAppImageUrls, uploadAppImage } from '@/lib/cloud-media';
import { supabase } from '@/lib/supabase';
import { ChatImageInput, ConsentRecord, OnboardingInput, UserProfile } from '@/types/event';
import * as Crypto from 'expo-crypto';

export async function syncOnboardingToCloud(input: OnboardingInput, profile: UserProfile) {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  const { error: profileError } = await supabase.from('profiles').update({
    display_name: input.name.trim(),
    handle: profile.handle,
    city: profile.city,
    date_of_birth: input.dateOfBirth,
    avatar_color: profile.avatarColor,
  }).eq('id', userId);
  if (profileError) throw profileError;
  const { error: consentError } = await supabase.rpc('record_legal_consents', {
    terms_version: legalConfig.termsVersion,
    privacy_version: legalConfig.privacyVersion,
    community_version: legalConfig.communityVersion,
  });
  if (consentError) throw consentError;
}

export async function fetchCloudProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles')
    .select('display_name, handle, city, avatar_color, avatar_path')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  const urls = data.avatar_path ? await createAppImageUrls([data.avatar_path]) : new Map<string, string>();
  const name = data.display_name;
  return {
    name,
    handle: data.handle,
    city: data.city ?? '',
    initials: name.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase() || 'ME',
    avatarColor: data.avatar_color,
    avatarPath: data.avatar_path ?? undefined,
    avatarUri: data.avatar_path ? urls.get(data.avatar_path) : undefined,
  };
}

export type CloudOnboardingState = {
  profile: UserProfile;
  dateOfBirth: string;
  consentHistory: ConsentRecord[];
  completed: boolean;
};

export async function fetchCloudOnboardingState(userId: string): Promise<CloudOnboardingState | null> {
  if (!supabase) return null;
  const [{ data: profileData, error: profileError }, { data: consentData, error: consentError }] = await Promise.all([
    supabase.from('profiles')
      .select('display_name, handle, city, date_of_birth, avatar_color, avatar_path')
      .eq('id', userId)
      .single(),
    supabase.from('consent_records')
      .select('id, document, version, accepted, recorded_at')
      .eq('user_id', userId)
      .eq('accepted', true)
      .order('recorded_at', { ascending: true }),
  ]);
  if (profileError || consentError || !profileData) throw profileError ?? consentError ?? new Error('profile_not_found');

  const urls = profileData.avatar_path ? await createAppImageUrls([profileData.avatar_path]) : new Map<string, string>();
  const name = profileData.display_name;
  const consentHistory = (consentData ?? [])
    .filter((record): record is typeof record & { document: ConsentRecord['document'] } => (
      ['terms', 'privacy', 'community', 'analytics'].includes(record.document)
    ))
    .map((record) => ({
      id: record.id,
      document: record.document,
      version: record.version,
      accepted: record.accepted,
      recordedAt: record.recorded_at,
    }));
  const acceptedDocuments = new Set(consentHistory.filter((record) => record.accepted).map((record) => record.document));
  const dateOfBirth = profileData.date_of_birth ?? '';

  return {
    profile: {
      name,
      handle: profileData.handle,
      city: profileData.city ?? '',
      initials: name.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase() || 'ME',
      avatarColor: profileData.avatar_color,
      avatarPath: profileData.avatar_path ?? undefined,
      avatarUri: profileData.avatar_path ? urls.get(profileData.avatar_path) : undefined,
    },
    dateOfBirth,
    consentHistory,
    completed: Boolean(
      dateOfBirth
      && name.trim()
      && name !== '新しいメンバー'
      && acceptedDocuments.has('terms')
      && acceptedDocuments.has('privacy')
      && acceptedDocuments.has('community')
    ),
  };
}

export async function syncProfileToCloud(profile: UserProfile, image?: ChatImageInput) {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  let avatarPath = profile.avatarPath;
  if (image) {
    avatarPath = `profiles/${data.user.id}/${Crypto.randomUUID()}.${appImageExtension(image.mimeType, image.fileName)}`;
    await uploadAppImage(avatarPath, image);
  }
  const { error } = await supabase.from('profiles').update({
    display_name: profile.name,
    handle: profile.handle,
    city: profile.city,
    avatar_color: profile.avatarColor,
    avatar_path: avatarPath ?? null,
  }).eq('id', data.user.id);
  if (error) {
    if (image && avatarPath) await supabase.storage.from('app-media').remove([avatarPath]);
    throw error;
  }
  if (image && profile.avatarPath && profile.avatarPath !== avatarPath) {
    await supabase.storage.from('app-media').remove([profile.avatarPath]);
  }
  return avatarPath;
}
