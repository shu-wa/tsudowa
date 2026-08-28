export type AuthFailureReason =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'already_registered'
  | 'weak_password'
  | 'rate_limited'
  | 'unknown';

type AuthErrorLike = {
  code?: string;
  message: string;
};

export const describeAuthError = (error: AuthErrorLike): { reason: AuthFailureReason; message: string } => {
  const code = error.code?.toLowerCase();
  const message = error.message;

  // Supabase intentionally returns the same code for a missing account and a
  // wrong password. Keep the wording neutral so the app cannot be used to
  // enumerate registered email addresses.
  if (code === 'invalid_credentials' || /invalid login/i.test(message)) {
    return { reason: 'invalid_credentials', message: 'メールアドレスまたはパスワードが正しくありません。' };
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return { reason: 'email_not_confirmed', message: '確認メール内のリンクを開いてからログインしてください。' };
  }
  if (['email_exists', 'user_already_exists'].includes(code ?? '') || /already registered/i.test(message)) {
    return { reason: 'already_registered', message: 'このメールアドレスはすでに登録されています。' };
  }
  if (code === 'weak_password' || /password/i.test(message)) {
    return { reason: 'weak_password', message: 'パスワードは8文字以上で設定してください。' };
  }
  if (code?.includes('rate_limit') || /rate limit|too many requests/i.test(message)) {
    return { reason: 'rate_limited', message: '試行回数が多すぎます。しばらく待ってから、もう一度お試しください。' };
  }
  return { reason: 'unknown', message: '認証処理に失敗しました。通信状態を確認して、もう一度お試しください。' };
};
