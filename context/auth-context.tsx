import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NATIVE_ONBOARDING_REDIRECT, NATIVE_RESET_PASSWORD_REDIRECT, parseAuthCallbackUrl } from '@/lib/auth-redirect';
import { EmailOtpType, Session, User } from '@supabase/supabase-js';
import * as ExpoLinking from 'expo-linking';
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

type AuthResult = { ok: true; needsEmailConfirmation?: boolean } | { ok: false; message: string };

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  reauthenticate: (password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const authErrorMessage = (message: string) => {
  if (/invalid login/i.test(message)) return 'メールアドレスまたはパスワードが正しくありません。';
  if (/email not confirmed/i.test(message)) return '確認メール内のリンクを開いてからログインしてください。';
  if (/already registered/i.test(message)) return 'このメールアドレスはすでに登録されています。';
  if (/password/i.test(message)) return 'パスワードは8文字以上で設定してください。';
  return '認証処理に失敗しました。通信状態を確認して、もう一度お試しください。';
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) { setIsLoading(false); return; }
    let active = true;
    const client = supabase;
    const applyAuthUrl = async (url: string) => {
      try {
        const currentWebOrigin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : null;
        const callback = parseAuthCallbackUrl(url, { webOrigin: currentWebOrigin, allowDevelopment: __DEV__ });
        if (!callback || callback.errorDescription) return;

        if (callback.code) {
          await client.auth.exchangeCodeForSession(callback.code);
          return;
        }
        if (callback.tokenHash && callback.type) {
          const supportedTypes = new Set<EmailOtpType>(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']);
          if (supportedTypes.has(callback.type as EmailOtpType)) {
            await client.auth.verifyOtp({ token_hash: callback.tokenHash, type: callback.type as EmailOtpType });
          }
          return;
        }
        if (callback.accessToken && callback.refreshToken) {
          await client.auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
        }
      } catch { /* 不正なURLは無視し、認証画面に留める */ }
    };
    const { data: authSubscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    const linkSubscription = ExpoLinking.addEventListener('url', ({ url }) => { void applyAuthUrl(url); });
    void (async () => {
      try {
        const [{ data }, initialUrl] = await Promise.all([client.auth.getSession(), ExpoLinking.getInitialURL()]);
        if (!active) return;
        setSession(data.session);
        if (initialUrl) await applyAuthUrl(initialUrl);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
      authSubscription.subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isConfigured: isSupabaseConfigured,
    isLoading,
    session,
    user: session?.user ?? null,
    signIn: async (email, password) => {
      if (!supabase) return { ok: false, message: 'Supabaseがまだ設定されていません。' };
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      return error ? { ok: false, message: authErrorMessage(error.message) } : { ok: true };
    },
    signUp: async (email, password) => {
      if (!supabase) return { ok: false, message: 'Supabaseがまだ設定されていません。' };
      const emailRedirectTo = Platform.OS === 'web' ? ExpoLinking.createURL('/onboarding') : NATIVE_ONBOARDING_REDIRECT;
      const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo } });
      if (error) return { ok: false, message: authErrorMessage(error.message) };
      return { ok: true, needsEmailConfirmation: !data.session };
    },
    sendPasswordReset: async (email) => {
      if (!supabase) return { ok: false, message: 'Supabaseがまだ設定されていません。' };
      const redirectTo = Platform.OS === 'web' ? ExpoLinking.createURL('/reset-password') : NATIVE_RESET_PASSWORD_REDIRECT;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      return error ? { ok: false, message: authErrorMessage(error.message) } : { ok: true };
    },
    updatePassword: async (password) => {
      if (!supabase) return { ok: false, message: 'Supabaseがまだ設定されていません。' };
      const { error } = await supabase.auth.updateUser({ password });
      return error ? { ok: false, message: authErrorMessage(error.message) } : { ok: true };
    },
    reauthenticate: async (password) => {
      if (!supabase || !session?.user.email) return { ok: false, message: 'ログイン情報を確認できません。もう一度ログインしてください。' };
      const { error } = await supabase.auth.signInWithPassword({ email: session.user.email, password });
      return error ? { ok: false, message: 'パスワードが正しくありません。' } : { ok: true };
    },
    signOut: async () => { await supabase?.auth.signOut(); },
  }), [isLoading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
