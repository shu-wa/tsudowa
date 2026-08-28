const errorText = (error: unknown) => {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (!error || typeof error !== 'object') return String(error ?? '');
  const record = error as Record<string, unknown>;
  return [record.code, record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
};

export const eventCreationErrorMessage = (error: unknown) => {
  const text = errorText(error);
  if (/not_authenticated|jwt expired|invalid jwt|401/i.test(text)) {
    return 'ログイン状態を確認できませんでした。ログインし直してから、もう一度お試しください。';
  }
  if (/42501|row-level security|permission denied|not_allowed|403/i.test(text)) {
    return 'イベントを保存する権限を確認できませんでした。ログインし直してから、もう一度お試しください。';
  }
  if (/network|fetch|timeout|timed out|offline|connection|socket/i.test(text)) {
    return 'イベントを保存できませんでした。通信状態を確認して、もう一度お試しください。';
  }
  if (/23505|duplicate key/i.test(text)) {
    return '同じイベントがすでに保存されている可能性があります。一覧を更新して確認してください。';
  }
  return 'イベントを保存できませんでした。入力内容と通信状態を確認して、もう一度お試しください。';
};
