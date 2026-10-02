import { defaultConfig } from '@tamagui/config/v5';
import { animations } from '@tamagui/config/v5-rn';
import { createFont, createTamagui } from 'tamagui';

import { fontFamilies, palette } from '@/lib/theme';

const fontSizes = { 1: 12, 2: 14, 3: 15, 4: 17, true: 17, 5: 20, 6: 24, 7: 28, 8: 32, 9: 40 };
const lineHeights = Object.fromEntries(
  Object.entries(fontSizes).map(([k, v]) => [k, Math.round(v * 1.4)]),
) as Record<keyof typeof fontSizes, number>;

const headingFont = createFont({
  family: fontFamilies.heading,
  size: fontSizes,
  lineHeight: lineHeights,
  weight: { 4: '700' },
  face: { 700: { normal: fontFamilies.heading } },
});

const bodyFont = createFont({
  family: fontFamilies.body,
  size: fontSizes,
  lineHeight: lineHeights,
  weight: { 4: '400' },
  face: {
    400: { normal: fontFamilies.body },
    500: { normal: fontFamilies.bodyMedium },
    700: { normal: fontFamilies.bodyBold },
  },
});

// Marken-Farben als zusätzliche Theme-Keys. Dark Mode ist von Anfang an mitgedacht.
type BrandTheme = Record<
  | 'background'
  | 'backgroundStrong'
  | 'color'
  | 'colorMuted'
  | 'primary'
  | 'primaryStrong'
  | 'onPrimary'
  | 'accent'
  | 'accentSoft'
  | 'success'
  | 'error'
  | 'warning',
  string
>;

const brandLight: BrandTheme = {
  background: palette.cream,
  backgroundStrong: palette.white,
  color: palette.textPrimary,
  colorMuted: palette.textSecondary,
  primary: palette.navy,
  primaryStrong: palette.navyDark,
  onPrimary: palette.white,
  accent: palette.gold,
  accentSoft: palette.goldLight,
  success: palette.success,
  error: palette.error,
  warning: palette.warning,
};

const brandDark: BrandTheme = {
  background: palette.navyDark,
  backgroundStrong: palette.navy,
  color: palette.cream,
  colorMuted: '#B8B3AA',
  primary: palette.gold,
  primaryStrong: palette.goldLight,
  onPrimary: palette.navyDark,
  accent: palette.gold,
  accentSoft: palette.goldLight,
  success: palette.success,
  error: palette.error,
  warning: palette.warning,
};

export const config = createTamagui({
  ...defaultConfig,
  animations,
  fonts: { ...defaultConfig.fonts, heading: headingFont, body: bodyFont },
  themes: {
    ...defaultConfig.themes,
    light: { ...defaultConfig.themes.light, ...brandLight },
    dark: { ...defaultConfig.themes.dark, ...brandDark },
  },
});

export default config;

export type AppConfig = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
