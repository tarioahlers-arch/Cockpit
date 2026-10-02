import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import { env, isSupabaseConfigured } from '@/lib/env';
import { createChunkedStorage } from '@/lib/secureStorage';
import type { Database } from '@/types/database';

const storage = Platform.OS === 'web' ? undefined : createChunkedStorage(SecureStore);

if (!isSupabaseConfigured() && __DEV__) {
  console.warn('Supabase ist nicht konfiguriert – siehe .env.example (EXPO_PUBLIC_SUPABASE_*).');
}

// Fallback auf die lokale Supabase-Instanz, damit die App ohne .env nicht beim Start abstürzt.
export const supabase = createClient<Database>(
  env.supabaseUrl || 'http://127.0.0.1:54321',
  env.supabaseAnonKey || 'not-configured',
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Token-Refresh nur, solange die App im Vordergrund ist (Supabase-Empfehlung für RN).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
