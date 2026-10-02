/** Design-Tokens laut Design-System (Abschnitt 7). Framework-unabhängig. */
export const palette = {
  navy: '#1A2E4A',
  navyDark: '#0F1D31',
  gold: '#C8A84B',
  goldLight: '#E8D5A0',
  cream: '#F7F3EC',
  success: '#2ECC71',
  error: '#E74C3C',
  warning: '#F39C12',
  textPrimary: '#1A1A1A',
  textSecondary: '#555555',
  white: '#FFFFFF',
} as const;

export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 } as const;

/** Apple HIG: Touch-Targets min. 44x44 pt. */
export const MIN_TOUCH_TARGET = 44;

export const fontFamilies = {
  heading: 'PlayfairDisplay_700Bold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
} as const;
