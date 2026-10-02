import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/** Schneller, nicht-sensibler Key-Value-Speicher (Einstellungen, UI-State). */
export const mmkv = createMMKV({ id: 'jobcockpit' });

export const zustandStorage: StateStorage = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => mmkv.set(name, value),
  removeItem: (name) => {
    mmkv.remove(name);
  },
};
