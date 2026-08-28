export const PROFILE_HANDLE_TAKEN_MESSAGE = 'この表示IDはすでに使用されています。別の表示IDを入力してください。';

const HANDLE_BODY_PATTERN = /^[A-Za-z0-9_]{2,30}$/;

export const profileHandleBody = (value: string) => value.trim().replace(/^@+/, '');

export const normalizeProfileHandle = (value: string) => `@${profileHandleBody(value)}`;

export const defaultProfileHandleBody = (email: string) => {
  const localPart = email.trim().split('@')[0]?.normalize('NFKC') ?? '';
  const sanitized = localPart
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  return sanitized.length >= 2 ? sanitized : 'member';
};

export const validateProfileHandle = (value: string) => (
  HANDLE_BODY_PATTERN.test(profileHandleBody(value))
    ? null
    : '表示IDは英数字とアンダーバーを使い、2〜30文字で入力してください。'
);

const errorText = (error: unknown) => {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (!error || typeof error !== 'object') return String(error ?? '');
  const record = error as Record<string, unknown>;
  return [record.code, record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
};

export const isProfileHandleConflict = (error: unknown) => {
  const text = errorText(error);
  return /profiles_handle_key/i.test(text)
    || (/23505/.test(text) && /handle|duplicate key/i.test(text));
};

export const profileSaveErrorMessage = (error: unknown) => (
  isProfileHandleConflict(error) ? PROFILE_HANDLE_TAKEN_MESSAGE : null
);
