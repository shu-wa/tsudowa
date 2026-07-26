import { legalConfig } from '@/constants/legal';
import { supabase } from '@/lib/supabase';
import { OnboardingInput, UserProfile } from '@/types/event';

export async function syncOnboardingToCloud(input: OnboardingInput, profile: UserProfile) {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  const recordedAt = new Date().toISOString();
  const { error: profileError } = await supabase.from('profiles').update({
    display_name: input.name.trim(),
    handle: profile.handle,
    city: profile.city,
    date_of_birth: input.dateOfBirth,
    age_verified_at: recordedAt,
    avatar_color: profile.avatarColor,
  }).eq('id', userId);
  if (profileError) throw profileError;
  const { error: consentError } = await supabase.from('consent_records').insert([
    { user_id: userId, document: 'terms', version: legalConfig.termsVersion, accepted: true, recorded_at: recordedAt },
    { user_id: userId, document: 'privacy', version: legalConfig.privacyVersion, accepted: true, recorded_at: recordedAt },
    { user_id: userId, document: 'community', version: legalConfig.communityVersion, accepted: true, recorded_at: recordedAt },
  ]);
  if (consentError) throw consentError;
}

export async function syncProfileToCloud(profile: UserProfile) {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from('profiles').update({ display_name: profile.name, handle: profile.handle, city: profile.city, avatar_color: profile.avatarColor }).eq('id', data.user.id);
}
