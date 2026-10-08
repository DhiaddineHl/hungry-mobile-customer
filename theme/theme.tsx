// Hungry customer app — theme object, ThemeProvider and useTheme hook.
//   <ThemeProvider><App /></ThemeProvider>
//   const { colors, typography, space, radius, size, shadow } = useTheme();
import React, { createContext, useContext, useMemo } from 'react';
import { lightColors, type Colors } from './colors';
import { typography } from './typography';

export const space = { 2: 2, 4: 4, 6: 6, 8: 8, 10: 10, 12: 12, 14: 14, 16: 16, 20: 20, 22: 22, 24: 24, 28: 28, 32: 32 } as const;

export const radius = { badge: 6, segmentInner: 9, control: 12, field: 14, thumb: 16, card: 20, logo: 22, sheet: 28, pill: 999 } as const;

export const size = {
  minTouch: 44, iconButton: 44, addButton: 40, addButtonSmall: 32,
  input: 52, button: 52, pillButton: 40, pillButtonSmall: 36,
  stepper: 52, stepperCompact: 32, chip: 40, segment: 44, segmentSmall: 32,
  checkbox: 22, radio: 22, toggle: { w: 44, h: 26, knob: 22 },
  otpBox: 56, emailChip: 48, optionRow: 56, listRow: 60,
  tabBar: 88, tabBarItem: 48, homeIndicator: 34,
  mapSearchPill: 56, mapPin: 40, sheetGrabber: { w: 36, h: 4 },
  restaurantHero: 220, dishHero: 194, restaurantLogo: 80,
  authHeader: 300, authHeaderCompact: 180, authLogoWidth: 176, authLogoWidthCompact: 120, authSheetOverlap: 28,
  categoryTile: { w: 57, h: 86 }, restaurantCardImage: 172, restaurantRowThumb: 64,
  popularTile: 96, dishCardImage: 132, dishThumb: 56, menuThumb: 96, cartThumb: 64, logoTile: 40,
  suggestionThumb: 40, suggestionRow: 60, metaIconWell: 28, iconWell: 36, notificationWell: 40, stateWell: 72, avatar: 56,
  typeTile: 64, progressSegment: 4, unreadDot: 8, counter: 18,
  icon: { clear: 12, inline: 14, small: 16, row: 18, field: 20, nav: 22, state: 30 },
} as const;

export const screenPadding = 24;
export const chromePadding = 16;

const sh = (opacity: number, y: number, r: number, elevation: number) => ({
  shadowColor: '#003049', shadowOpacity: opacity, shadowOffset: { width: 0, height: y }, shadowRadius: r, elevation,
});
export const shadow = {
  segmentSelected: sh(0.14, 1, 2, 1),
  floatingButton: sh(0.18, 2, 8, 3), // add buttons, map pill, locate, pin label — NOT hero buttons
  logo: sh(0.12, 2, 8, 2),
  sheet: sh(0.12, -4, 24, 8),
  toast: sh(0.45, 8, 24, 6),
} as const;

export const opacity = { tabInactiveIcon: 0.45, closedThumb: 0.45, disabledImage: 0.5, lockedInput: 0.6, pageBusy: 0.55, upcomingStep: 0.5 } as const;
export const motion = { toastMs: 4000, toastUndoMs: 6000, skeletonPulseMs: 1200, spinnerMs: 800, pressScale: 0.98 } as const;

export type Theme = {
  colors: Colors;
  typography: typeof typography;
  space: typeof space;
  radius: typeof radius;
  size: typeof size;
  shadow: typeof shadow;
  opacity: typeof opacity;
  motion: typeof motion;
  screenPadding: number;
  chromePadding: number;
};

export const lightTheme: Theme = { colors: lightColors, typography, space, radius, size, shadow, opacity, motion, screenPadding, chromePadding };

const ThemeContext = createContext<Theme>(lightTheme);

// Light only. Components must read from useTheme() and never import hex values,
// so a dark Theme can be passed here later.
export function ThemeProvider({ theme = lightTheme, children }: { theme?: Theme; children: React.ReactNode }) {
  const value = useMemo(() => theme, [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
