import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { AppLanguage } from '@/types/database';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface SettingsState {
  language: AppLanguage | null; // null = Gerätesprache
  theme: ThemePreference;
  hasSeenWelcome: boolean;
  setLanguage: (language: AppLanguage) => void;
  setTheme: (theme: ThemePreference) => void;
  markWelcomeSeen: () => void;
  reset: () => void;
}

const initial = { language: null, theme: 'system' as ThemePreference, hasSeenWelcome: false };

export function createSettingsStore(storage: StateStorage) {
  return create<SettingsState>()(
    persist(
      (set) => ({
        ...initial,
        setLanguage: (language) => set({ language }),
        setTheme: (theme) => set({ theme }),
        markWelcomeSeen: () => set({ hasSeenWelcome: true }),
        reset: () => set(initial),
      }),
      {
        name: 'settings',
        storage: createJSONStorage(() => storage),
        partialize: ({ language, theme, hasSeenWelcome }) => ({ language, theme, hasSeenWelcome }),
      },
    ),
  );
}
