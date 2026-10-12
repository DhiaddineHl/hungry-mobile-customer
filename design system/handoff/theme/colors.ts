// Hungry customer app — colors. Source: tokens.json (light only).
export const palette = {
  navy: '#003049',
  orange: '#EA8608',
  orangeSoft: '#FCE9D2',
  white: '#FFFFFF',
  slate: '#5B6B75',
  slateLight: '#8A969C',
  green: '#2E7A3D',
  red: '#C2412D',
} as const;

export const lightColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F3F1', // inputs at rest, info note, OTP boxes
  surfaceSunken: '#F2F1EE', // segment track, placeholders, neutral wells, disabled button
  skeleton: '#EFEDEA',
  divider: '#EEF0F1',
  outline: '#D9DDE0', // chips, steppers, secondary button, checkbox off
  outlineSubtle: '#E3E6E8', // outlined icon buttons
  iconWell: '#EEF0F1',
  ink: palette.navy,
  inkMuted: palette.slate,
  inkSubtle: palette.slateLight,
  onInk: palette.white,
  primary: palette.orange, // signals only — never a button fill
  onPrimary: palette.navy,
  primarySoft: palette.orangeSoft,
  onPrimarySoft: palette.navy,
  success: palette.green,
  successSoft: 'rgba(58,151,76,0.14)',
  danger: palette.red,
  dangerSoft: '#FBEAE7',
  focusRing: palette.orangeSoft,
  scrim: 'rgba(0,48,73,0.28)',
  toast: palette.navy,
  spinnerTrackOnInk: 'rgba(255,255,255,0.35)',
  spinnerTrack: 'rgba(0,48,73,0.18)',
  pinHalo: 'rgba(234,134,8,0.16)',
} as const;

export type ColorToken = keyof typeof lightColors;
export type Colors = { [K in ColorToken]: string };
