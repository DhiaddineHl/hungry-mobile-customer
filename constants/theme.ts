import { Platform } from 'react-native';

/**
 * Design tokens for the Hungry customer app.
 *
 * Single source of truth for color, spacing, radius, shadow, motion and
 * typography. Components should import from here instead of hardcoding hex
 * values or magic numbers so the UI stays consistent and themeable.
 */

// ---------------------------------------------------------------------------
// Brand palette
// ---------------------------------------------------------------------------

const brandPrimary = '#F5A623';
const brandPrimaryDark = '#E0900F';
const brandInk = '#1A2B3D';

// Deep tones lifted straight from the auth artwork (assets/auth-page-upper-section.svg)
// so the auth screens sit on the same palette as the illustration behind them.
const brandDeep = '#EA8608';
const brandNavy = '#003049';

export const Palette = {
  // Brand
  primary: brandPrimary,
  primaryDark: brandPrimaryDark,
  primaryDeep: brandDeep,
  primarySoft: '#FFF5E6',

  // Auth backdrop
  navy: brandNavy,
  navyDeep: '#00263A',

  // Ink / text
  ink: brandInk,
  textPrimary: brandInk,
  textSecondary: '#5A6B7B',
  textMuted: '#8A8A8A',
  textPlaceholder: '#C7C7C7',
  textInverse: '#FFFFFF',

  // Surfaces
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F8FA',
  surfaceMuted: '#F2F3F5',

  // Lines
  border: '#E0E0E0',
  borderSubtle: '#EEEEEE',

  // Status
  success: '#2E9E5B',
  successSoft: '#E6F5EC',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  warning: '#F5A623',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.45)',
  disabled: '#CCCCCC',
} as const;

// ---------------------------------------------------------------------------
// Theme colors (kept light/dark shape for backward compatibility with the
// themed-text / themed-view / use-theme-color helpers).
// ---------------------------------------------------------------------------

export const Colors = {
  light: {
    text: Palette.textPrimary,
    background: Palette.background,
    tint: Palette.primary,
    icon: Palette.textSecondary,
    tabIconDefault: Palette.ink,
    tabIconSelected: Palette.primary,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: Palette.primary,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: Palette.primary,
  },
};

// ---------------------------------------------------------------------------
// Spacing — 4pt rhythm
// ---------------------------------------------------------------------------

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  // Wide gutter used by the auth card, matching the design frames.
  xxxxl: 40,
} as const;

// ---------------------------------------------------------------------------
// Radius
// ---------------------------------------------------------------------------

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// Elevation / shadow scale (consistent, not random per-component)
// ---------------------------------------------------------------------------

export const Shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: Palette.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: Palette.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    android: { elevation: 6 },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: Palette.black,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
    },
    android: { elevation: 12 },
    default: {},
  }),
} as const;

// ---------------------------------------------------------------------------
// Motion — shared duration/easing tokens so all animations feel unified.
// Micro-interactions 150–250ms; exits ~70% of enter (Material/HIG).
// ---------------------------------------------------------------------------

export const Duration = {
  fast: 150,
  base: 220,
  slow: 320,
  /** One-off screen reveals (e.g. the auth landing → login intro). */
  reveal: 880,
} as const;

// Stagger delay per list/grid item for entrance sequences.
export const STAGGER_MS = 60;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const Fonts = {
  regular: 'Poppins-Regular',
  medium: 'Poppins-Medium',
  semiBold: 'Poppins-SemiBold',
  bold: 'Poppins-Bold',
};

export const FontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  display: 24,
} as const;
