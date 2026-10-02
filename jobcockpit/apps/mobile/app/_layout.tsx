import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';

import { initI18n } from '@/lib/i18n';
import { queryClient } from '@/lib/queryClient';
import { useSettingsStore } from '@/stores';
import { config } from '@/tamagui.config';

void SplashScreen.preventAutoHideAsync();
initI18n(useSettingsStore.getState().language ?? undefined);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  const systemScheme = useColorScheme();
  const themePreference = useSettingsStore((s) => s.theme);
  const theme = themePreference === 'system' ? (systemScheme ?? 'light') : themePreference;

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <TamaguiProvider config={config} defaultTheme={theme}>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }} />
        </TamaguiProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
