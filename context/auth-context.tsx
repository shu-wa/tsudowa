import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { NATIVE_ONBOARDING_REDIRECT, NATIVE_RESET_PASSWORD_REDIRECT, parseAuthCallbackUrl } from '@/lib/auth-redirect';
import { describeAuthError, type AuthFailureReason } from '@/lib/auth-errors';
import { unregisterRemoteNotificationDevice } from '@/lib/notifications';
import { EmailOtpType, Session, User } from '@supabase/supabase-js';
import * as ExpoLinking from 'expo-linking';
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

type AuthResult = { ok: true; needsEmailConfirmation?: boolean } | { ok: false; message: string; reason: AuthFailureReason };

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
      if (!supabase) return { ok: false, message: 'Supabaseがまだ設定されていません。', reason: 'unknown' };
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (!error) return { ok: true };
      return { ok: false, ...describeAuthError(error) };
    },
    signUp: async (email, password) => {
      if (!supabase) return { ok: false, message: 'Supabaseがまだ設定されていません。', reason: 'unknown' };
      const emailRedirectTo = Platform.OS === 'web' ? ExpoLinking.createURL('/onboarding') : NATIVE_ONBOARDING_REDIRECT;
      const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo } });
      if (error) return { ok: false, ...describeAuthError(error) };
      return { ok: true, needsEmailConfirmation: !data.session };
    },
    sendPasswordReset: async (email) => {
      if (!supabase) return { ok: false, message: 'Supabaseがまだ設定されていません。', reason: 'unknown' };
      const redirectTo = Platform.OS === 'web' ? ExpoLinking.createURL('/reset-password') : NATIVE_RESET_PASSWORD_REDIRECT;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      return error ? { ok: false, ...describeAuthError(error) } : { ok: true };
    },
    updatePassword: async (password) => {
      if (!supabase) return { ok: false, message: 'Supabaseがまだ設定されていません。', reason: 'unknown' };
      const { error } = await supabase.auth.updateUser({ password });
      return error ? { ok: false, ...describeAuthError(error) } : { ok: true };
    },
    reauthenticate: async (password) => {
      if (!supabase || !session?.user.email) return { ok: false, message: 'ログイン情報を確認できません。もう一度ログインしてください。', reason: 'unknown' };
      const { error } = await supabase.auth.signInWithPassword({ email: session.user.email, password });
      return error ? { ok: false, message: 'パスワードが正しくありません。', reason: 'invalid_credentials' } : { ok: true };
    },
    signOut: async () => {
      await unregisterRemoteNotificationDevice().catch(() => undefined);
      await supabase?.auth.signOut();
    },
  }), [isLoading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
