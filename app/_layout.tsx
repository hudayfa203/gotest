import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { persistOptions, queryClient } from '../src/api/queryClient';
import { AppBootstrap } from '../src/features/bootstrap';
import { UpdateGate } from '../src/features/UpdateGate';
import { loadSettings, useSettings } from '../src/state/settings';
import { useTheme } from '../src/state/theme';
import { savedStore } from '../src/storage/savedDb';
import { brand, fontFiles } from '../src/theme';

export { ErrorBoundary } from '../src/components/RouteErrorBoundary';

// a deep-linked article still gets the tabs underneath, so Back returns to the feed
export const unstable_settings = { initialRouteName: '(tabs)' };

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 250, fade: true });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const settingsLoaded = useSettings((s) => s.loaded);

  useEffect(() => {
    void loadSettings();
    void savedStore.init().catch(() => {});
  }, []);

  const ready = (fontsLoaded || !!fontError) && settingsLoaded;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <ThemedApp />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedApp() {
  const { c, isDark } = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: isDark ? '#FFFFFF' : brand.navy, background: c.bg, card: c.bg, text: c.text, border: c.border, notification: brand.red },
  };
  return (
    <ThemeProvider value={navTheme}>
      <AppBootstrap />
      <UpdateGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="article/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="explore" />
          <Stack.Screen name="menu" options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="section/[slug]" />
          <Stack.Screen name="author/[slug]" />
          <Stack.Screen name="topic/[slug]" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="settings/page/[key]" />
          <Stack.Screen name="settings/sign-in" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'fade' }} />
          <Stack.Screen name="link" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        </Stack>
      </UpdateGate>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
