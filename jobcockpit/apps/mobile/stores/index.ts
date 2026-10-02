import { zustandStorage } from '@/lib/storage';
import { createSettingsStore } from '@/stores/settingsStore';

export const useSettingsStore = createSettingsStore(zustandStorage);
