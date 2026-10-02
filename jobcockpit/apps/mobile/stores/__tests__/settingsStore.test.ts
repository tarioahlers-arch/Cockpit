import type { StateStorage } from 'zustand/middleware';

import { createSettingsStore } from '@/stores/settingsStore';

function memoryStorage(): StateStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

describe('settingsStore', () => {
  it('hat sinnvolle Defaults', () => {
    const store = createSettingsStore(memoryStorage());
    expect(store.getState()).toMatchObject({
      language: null,
      theme: 'system',
      hasSeenWelcome: false,
    });
  });

  it('persistiert Änderungen', () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    store.getState().setLanguage('en');
    store.getState().setTheme('dark');
    store.getState().markWelcomeSeen();
    const persisted = JSON.parse(storage.data.get('settings') ?? '{}');
    expect(persisted.state).toEqual({ language: 'en', theme: 'dark', hasSeenWelcome: true });
  });

  it('reset stellt Defaults wieder her', () => {
    const store = createSettingsStore(memoryStorage());
    store.getState().setTheme('light');
    store.getState().reset();
    expect(store.getState().theme).toBe('system');
  });
});
