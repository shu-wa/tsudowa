import type { AppSettings, ConsentRecord, UserProfile } from '@/types/event';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isKnownProfileName = (name: string) => {
  const normalized = name.trim();
  return Boolean(normalized && normalized !== '新しいメンバー');
};

export const hasStoredOnboardingEvidence = (
  settings: AppSettings,
  profile: UserProfile,
  consentHistory: ConsentRecord[] = [],
) => {
  const acceptedDocuments = new Set(
    consentHistory
      .filter((record) => record.accepted)
      .map((record) => record.document),
  );
  const hasAcceptedVersions = Boolean(
    settings.acceptedTermsVersion
      && settings.acceptedPrivacyVersion
      && settings.acceptedCommunityVersion,
  );
  const hasAcceptedRecords = acceptedDocuments.has('terms')
    && acceptedDocuments.has('privacy')
    && acceptedDocuments.has('community');

  return Boolean(
    DATE_KEY_PATTERN.test(settings.dateOfBirth ?? '')
      && isKnownProfileName(profile.name)
      && (hasAcceptedVersions || hasAcceptedRecords),
  );
};

export const hasKnownOnboardingProfile = (settings: AppSettings, profile: UserProfile) => Boolean(
  DATE_KEY_PATTERN.test(settings.dateOfBirth ?? '')
    && isKnownProfileName(profile.name),
);
