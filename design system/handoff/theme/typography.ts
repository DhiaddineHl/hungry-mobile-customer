// Hungry customer app — typography. Montserrat (+ JetBrains Mono for coordinates).
// Android does not synthesize weights for custom fonts: load each weight as its
// own file and select it by fontFamily, not fontWeight.
import type { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'Montserrat-Regular',
  medium: 'Montserrat-Medium',
  semibold: 'Montserrat-SemiBold',
  bold: 'Montserrat-Bold',
  extrabold: 'Montserrat-ExtraBold',
  mono: 'JetBrainsMono-Medium',
} as const;

const t = (family: string, fontSize: number, lineHeight: number, letterSpacing = 0): TextStyle => ({
  fontFamily: family,
  fontSize,
  lineHeight,
  letterSpacing,
});
const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const typography = {
  display: t(fontFamily.bold, 28, 34, -0.6), // greeting, page titles, restaurant name, auth headings
  title: t(fontFamily.bold, 24, 30, -0.4), // dish name, success title
  heading: t(fontFamily.bold, 20, 26, -0.3), // state view title, sheet title
  sectionTitle: t(fontFamily.bold, 18, 24, -0.2),
  cardTitle: t(fontFamily.bold, 18, 24, -0.2),
  rowTitle: t(fontFamily.bold, 16, 22),
  address: t(fontFamily.bold, 16, 22),
  button: t(fontFamily.bold, 16, 20),
  buttonSecondary: t(fontFamily.semibold, 16, 20),
  input: t(fontFamily.regular, 16, 22),
  body: t(fontFamily.regular, 16, 24),
  bodySmall: t(fontFamily.regular, 15, 22),
  itemTitle: t(fontFamily.bold, 15, 20),
  itemLabel: t(fontFamily.semibold, 15, 20),
  price: { ...t(fontFamily.bold, 15, 20), ...tabular } as TextStyle,
  priceLarge: { ...t(fontFamily.bold, 18, 24), ...tabular } as TextStyle,
  chip: t(fontFamily.semibold, 14, 18),
  link: { ...t(fontFamily.semibold, 14, 18), textDecorationLine: 'underline' } as TextStyle,
  description: t(fontFamily.regular, 14, 20),
  meta: t(fontFamily.medium, 13, 18),
  label: t(fontFamily.semibold, 13, 18),
  caption: t(fontFamily.medium, 12, 16),
  fieldMessage: t(fontFamily.semibold, 12, 16),
  badge: t(fontFamily.bold, 12, 16),
  overline: { ...t(fontFamily.semibold, 11, 14, 1), textTransform: 'uppercase' } as TextStyle,
  tabLabel: t(fontFamily.semibold, 11, 14),
  counter: { ...t(fontFamily.bold, 11, 16), ...tabular } as TextStyle,
  coords: t(fontFamily.mono, 11, 14),
  otpDigit: { ...t(fontFamily.bold, 22, 28), ...tabular } as TextStyle,
} as const;

export type TypographyToken = keyof typeof typography;
