import { Platform } from 'react-native';
import { lightColors, palette } from '@/theme/colors';
import { fontFamily } from '@/theme/typography';

/**
 * Design tokens for the Hungry customer app.
 *
 * Single source of truth for color, spacing, radius, shadow, motion and
 * typography. Components should import from here instead of hardcoding hex
 * values or magic numbers so the UI stays consistent and themeable.
 */

// ---------------------------------------------------------------------------
// Brand palette — LEGACY BRIDGE
//
// The app is moving to the design-system theme in `@/theme` (tokens from
// `design system/handoff/tokens.json`). Until every screen is migrated, these
// legacy names are re-pointed at the new tokens so un-migrated screens already
// render in navy / orange / Montserrat. Do not use in new code — read
// `useTheme()` instead. Removed once the redesign lands (plan RD-09).
// ---------------------------------------------------------------------------

export const Palette = {
  // Brand
  primary: lightColors.primary,
  primaryDark: lightColors.primary,
  primaryDeep: lightColors.primary,
  primarySoft: lightColors.primarySoft,

  // Auth backdrop
  navy: lightColors.ink,
  navyDeep: lightColors.ink,

  // Ink / text
  ink: lightColors.ink,
  textPrimary: lightColors.ink,
  textSecondary: lightColors.inkMuted,
  textMuted: lightColors.inkMuted,
  textPlaceholder: lightColors.inkSubtle,
  textInverse: lightColors.onInk,

  // Surfaces
  background: lightColors.background,
  surface: lightColors.surface,
  surfaceAlt: lightColors.surfaceMuted,
  surfaceMuted: lightColors.surfaceSunken,

  // Lines
  border: lightColors.outline,
  borderSubtle: lightColors.divider,

  // Status
  success: lightColors.success,
  successSoft: lightColors.successSoft,
  danger: lightColors.danger,
  dangerSoft: lightColors.dangerSoft,
  warning: lightColors.primary,

  // Utility
  white: palette.white,
  black: '#000000',
  overlay: lightColors.scrim,
  disabled: lightColors.surfaceSunken,
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
  regular: fontFamily.regular,
  medium: fontFamily.medium,
  semiBold: fontFamily.semibold,
  bold: fontFamily.bold,
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
