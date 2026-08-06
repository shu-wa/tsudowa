import { EventProvider, useEvents } from '@/context/event-context';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { palette } from '@/constants/theme';
import NotificationObserver from '@/components/notification-observer';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '@/lib/web-alert-polyfill';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <EventProvider>
        <NavigationGuard />
        <NotificationObserver />
        <ThemeProvider value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: palette.canvas } }}>
        <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: palette.canvas }, headerTintColor: palette.ink }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="reset-password" options={{ title: 'パスワード再設定' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="legal/[document]" options={{ title: 'ポリシー', headerBackTitle: '戻る' }} />
          <Stack.Screen name="terms" options={{ title: '利用規約', headerBackTitle: '戻る' }} />
          <Stack.Screen name="privacy" options={{ title: 'プライバシーポリシー', headerBackTitle: '戻る' }} />
          <Stack.Screen name="community-guidelines" options={{ title: 'コミュニティガイドライン', headerBackTitle: '戻る' }} />
          <Stack.Screen name="account-deletion" options={{ title: 'アカウント削除', headerBackTitle: '戻る' }} />
          <Stack.Screen name="support" options={{ title: 'サポート', headerBackTitle: '戻る' }} />
          <Stack.Screen name="acknowledgements" options={{ title: '第三者ソフトウェア', headerBackTitle: '戻る' }} />
          <Stack.Screen name="privacy-center" options={{ title: 'プライバシーセンター', headerBackTitle: 'マイページ' }} />
          <Stack.Screen name="safety/index" options={{ title: '安全センター', headerBackTitle: 'マイページ' }} />
          <Stack.Screen name="safety/report" options={{ title: '通報する', presentation: 'modal' }} />
          <Stack.Screen name="event/[id]" options={{ title: 'イベント詳細', headerBackTitle: '戻る' }} />
          <Stack.Screen name="event/[id]/chat" options={{ title: 'グループチャット', headerBackTitle: '詳細' }} />
          <Stack.Screen name="event/[id]/edit-date" options={{ title: '日時を変更', presentation: 'modal' }} />
          <Stack.Screen name="event/[id]/edit-location" options={{ title: '場所を設定', presentation: 'modal' }} />
          <Stack.Screen name="event/[id]/participants" options={{ title: '参加者一覧', headerBackTitle: '詳細' }} />
          <Stack.Screen name="event/[id]/availability" options={{ title: '候補日の投票', headerBackTitle: '詳細' }} />
          <Stack.Screen name="event/[id]/availability/new" options={{ title: '候補日を追加', presentation: 'modal' }} />
          <Stack.Screen name="event/[id]/collection/new" options={{ title: '集金項目を追加', presentation: 'modal' }} />
          <Stack.Screen name="event/[id]/collection/[collectionId]" options={{ title: '集金の詳細', headerBackTitle: '集金' }} />
          <Stack.Screen name="create" options={{ title: 'イベントを作成', presentation: 'modal' }} />
          <Stack.Screen name="join" options={{ title: 'イベントに参加', presentation: 'modal' }} />
          <Stack.Screen name="past-events" options={{ title: '過去の予定', headerBackTitle: 'ホーム' }} />
          <Stack.Screen name="scan" options={{ title: 'QRコードを読み取る', presentation: 'modal' }} />
          <Stack.Screen name="profile-edit" options={{ title: 'プロフィール編集', presentation: 'modal' }} />
          <Stack.Screen name="event/[id]/schedule/new" options={{ title: '予定を追加', presentation: 'modal' }} />
          <Stack.Screen name="event/[id]/schedule/index" options={{ title: 'タイムフロー編集', headerBackTitle: '詳細' }} />
        </Stack>
        <StatusBar style="dark" />
        </ThemeProvider>
      </EventProvider>
    </AuthProvider>
  );
}

function NavigationGuard() {
  const { isHydrated, settings } = useEvents();
  const { isConfigured, isLoading: isAuthLoading, session } = useAuth();
  const segments = useSegments();
  useEffect(() => {
    if (!isHydrated || isAuthLoading) return;
    const first = segments[0];
    const publicDocumentRoute = ['legal', 'terms', 'privacy', 'community-guidelines', 'account-deletion', 'support', 'acknowledgements'].includes(first ?? '');
    const authCallbackRoute = first === 'reset-password';
    if (isConfigured && !session && first !== 'auth' && !publicDocumentRoute && !authCallbackRoute) {
      router.replace('/auth');
      return;
    }
    if (isConfigured && session && first === 'auth') {
      router.replace(settings.onboardingCompleted ? '/' : '/onboarding');
      return;
    }
    const publicRoute = first === 'onboarding' || publicDocumentRoute || first === 'auth' || first === 'reset-password';
    if (!settings.onboardingCompleted && !publicRoute) router.replace('/onboarding');
    if (settings.onboardingCompleted && first === 'onboarding') router.replace('/');
  }, [isAuthLoading, isConfigured, isHydrated, segments, session, settings.onboardingCompleted]);
  return null;
}
