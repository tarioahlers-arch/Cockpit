import de from '@/locales/de.json';
import en from '@/locales/en.json';
import { resolveLanguage } from '@/lib/i18n';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n', () => {
  it('DE und EN haben identische Keys', () => {
    expect(keys(en).sort()).toEqual(keys(de).sort());
  });

  it('löst Gerätesprache auf, Default ist Deutsch', () => {
    expect(resolveLanguage('en-US')).toBe('en');
    expect(resolveLanguage('de-AT')).toBe('de');
    expect(resolveLanguage('fr-CH')).toBe('de');
    expect(resolveLanguage(undefined)).toBe('de');
  });
});

describe('i18n setup', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { dateLocale, initI18n } = require('@/lib/i18n') as typeof import('@/lib/i18n');

  it('liefert passende date-fns-Locale', () => {
    expect(dateLocale('de').code).toBe('de');
    expect(dateLocale('en').code).toBe('en-GB');
  });

  it('initialisiert mit bevorzugter Sprache und interpoliert', () => {
    const i18n = initI18n('en');
    expect(i18n.language).toBe('en');
    expect(i18n.t('settings.version', { version: '1.0.0' })).toBe('Version 1.0.0');
    expect(initI18n('de')).toBe(i18n); // idempotent
  });
});
