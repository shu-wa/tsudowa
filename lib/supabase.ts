import { authStorage } from '@/lib/auth-storage';
import { createClient, processLock, SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const isStaticWebRender = Platform.OS === 'web' && typeof window === 'undefined';

const staticRenderStorage = {
  getItem: async (_key: string) => null,
  setItem: async (_key: string, _value: string) => undefined,
  removeItem: async (_key: string) => undefined,
};

export const isSupabaseConfigured = Boolean(
  supabaseUrl?.startsWith('https://')
  && supabaseUrl.includes('.supabase.co')
  && supabasePublishableKey
  && !supabasePublishableKey.includes('YOUR_KEY'),
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
    auth: {
      storage: isStaticWebRender ? staticRenderStorage : authStorage,
      autoRefreshToken: !isStaticWebRender,
      persistSession: !isStaticWebRender,
      detectSessionInUrl: false,
      flowType: 'pkce',
      lock: processLock,
    },
  })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
