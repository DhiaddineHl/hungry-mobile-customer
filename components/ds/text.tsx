import { forwardRef } from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme, type ColorToken, type TypographyToken } from '@/theme';

/** Dynamic Type ceiling — layouts are checked up to 1.3× (design system §11). */
export const MAX_FONT_SCALE = 1.3;

export interface TextProps extends RNTextProps {
  /** Typography token (design system §3). Defaults to `body`. */
  variant?: TypographyToken;
  /** Colour token. Defaults to `ink`. */
  color?: ColorToken;
  /** Prices, quantities, times, order numbers. */
  tabular?: boolean;
  align?: 'left' | 'center' | 'right';
}

/**
 * The only text component screens use. Every size, weight and colour comes
 * from a token, so a headline and a caption can never drift apart.
 */
export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = 'body', color = 'ink', tabular, align, style, maxFontSizeMultiplier = MAX_FONT_SCALE, ...rest },
  ref,
) {
  const { typography, colors } = useTheme();
  return (
    <RNText
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        typography[variant],
        { color: colors[color] },
        tabular && { fontVariant: ['tabular-nums'] },
        align && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
});

/**
 * A headline with the orange accent on its last character (`Hungry, Ahmad?`,
 * `Nothing for "x" yet.`). Board-level titles and the greeting only — never
 * body text or buttons (design system §3).
 */
export function AccentHeadline({
  text,
  accent,
  variant = 'display',
  ...rest
}: Omit<TextProps, 'children'> & { text: string; accent: '?' | '.' }) {
  return (
    <Text variant={variant} accessibilityRole="header" {...rest}>
      {text}
      <Text variant={variant} color="primary">
        {accent}
      </Text>
    </Text>
  );
}
