import { legalConfig } from '@/constants/legal';
import { appImageExtension, createAppImageUrls, uploadAppImage } from '@/lib/cloud-media';
import { supabase } from '@/lib/supabase';
import { ChatImageInput, OnboardingInput, UserProfile } from '@/types/event';
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
