import { useWindowDimensions, View } from 'react-native';
import FoodPattern from '@/assets/brand/food-pattern.svg';
import HungryLogo from '@/assets/brand/logo-hungry.svg';
import { createStyles, useTheme } from '@/theme';

const PATTERN = { w: 520, h: 372 };
const LOGO_RATIO = 76 / 232;

/**
 * AuthHeader (design system §6 Chrome): an ink block carrying the food
 * pattern and the white wordmark, centred. 300 tall; `compact` (180) on
 * Sign up, where the form needs the room.
 */
export function AuthHeader({ compact = false }: { compact?: boolean }) {
  const styles = useStyles();
  const { size } = useTheme();
  const { width } = useWindowDimensions();
  const height = compact ? size.authHeaderCompact : size.authHeader;
  const logoWidth = compact ? size.authLogoWidthCompact : size.authLogoWidth;
  const logoTop = compact ? 66 : 120;

  return (
    <View style={[styles.header, { height }]} accessibilityRole="image" accessibilityLabel="Hungry">
      <View style={[styles.pattern, { left: (width - PATTERN.w) / 2, top: compact ? -104 : -30 }]}>
        <FoodPattern width={PATTERN.w} height={PATTERN.h} />
      </View>
      <View style={[styles.logo, { top: logoTop }]}>
        <HungryLogo width={logoWidth} height={logoWidth * LOGO_RATIO} />
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  header: { backgroundColor: t.colors.ink, overflow: 'hidden' },
  pattern: { position: 'absolute' },
  logo: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
}));
