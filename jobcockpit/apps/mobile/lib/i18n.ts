import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { de as deLocale, enGB as enLocale } from 'date-fns/locale';

import de from '@/locales/de.json';
import en from '@/locales/en.json';
import type { AppLanguage } from '@/types/database';

export const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['de', 'en'];
export const DEFAULT_LANGUAGE: AppLanguage = 'de';

export function resolveLanguage(tag: string | null | undefined): AppLanguage {
  const code = tag?.slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.find((l) => l === code) ?? DEFAULT_LANGUAGE;
}

export function dateLocale(lang: AppLanguage) {
  return lang === 'en' ? enLocale : deLocale;
}

export function initI18n(preferred?: AppLanguage) {
  if (i18n.isInitialized) return i18n;
  void i18n.use(initReactI18next).init({
    resources: { de: { translation: de }, en: { translation: en } },
    lng: preferred ?? resolveLanguage(getLocales()[0]?.languageTag),
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export default i18n;
