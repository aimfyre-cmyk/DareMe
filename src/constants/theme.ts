/**
 * DareMe — centralized design tokens.
 * Locked palette per Phase 0 spec. Do not scatter raw colors in components —
 * always import from here.
 */

export const colors = {
  background: '#0B0B0D',
  surface: '#151518',
  surfaceElevated: '#1B1B1F',
  primaryText: '#FFFFFF',
  secondaryText: '#A7A7AD',
  accent: '#B7FF3C',
  danger: '#FF4D5A',
  success: '#35D07F',
  border: '#29292E',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

// Font family names assume Space Grotesk / Inter are loaded via expo-font
// (useFonts) at the root layout. Until loaded, RN falls back to the system
// font automatically if the family isn't found, so these are safe defaults.
export const fontFamily = {
  headingBold: 'SpaceGrotesk-Bold',
  headingMedium: 'SpaceGrotesk-Medium',
  body: 'Inter-Regular',
  bodyMedium: 'Inter-Medium',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const elevation = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export const touchTarget = {
  minSize: 44,
} as const;
// Backward-compatible theme exports for the original Expo starter components.
const legacyColors = {
  background: colors.background,
  backgroundSelected: colors.surfaceElevated,
  backgroundElement: colors.surface,
  text: colors.primaryText,
  textSecondary: colors.secondaryText,
  tint: colors.accent,
  icon: colors.secondaryText,
  iconSelected: colors.accent,
  border: colors.border,
} as const;

export const Colors = {
  light: legacyColors,
  dark: legacyColors,
} as const;

export const Spacing = {
  ...spacing,
  half: 2,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
} as const;

export const Fonts = {
  ...fontFamily,
  mono: 'monospace',
} as const;

export type ThemeColor = keyof typeof legacyColors;