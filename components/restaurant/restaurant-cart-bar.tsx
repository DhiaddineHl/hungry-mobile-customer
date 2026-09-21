import { PressableScale } from '@/components/ui/pressable-scale';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { ShoppingCart } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RestaurantCartBarProps {
  /** Units of THIS restaurant's dishes in the cart, not lines. */
  itemCount: number;
  /** Already formatted (`formatDT`). */
  total: string;
  onPress?: () => void;
}

/**
 * Floating "View cart" bar pinned to the bottom of a restaurant's menu.
 *
 * Adding a dish drops the customer back on the menu, and until now the only
 * way from there to the cart was the tab bar. The caller renders this only
 * while the cart holds something from the restaurant on screen, so the bar
 * doubles as the "you have dishes from here" cue.
 */
export function RestaurantCartBar({ itemCount, total, onPress }: RestaurantCartBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
      pointerEvents="box-none"
    >
      <PressableScale
        style={styles.button}
        onPress={onPress}
        scaleTo={0.98}
        dimTo={0.95}
        haptic
        accessibilityLabel={`View cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}, total ${total}`}
      >
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{itemCount}</Text>
        </View>
        <View style={styles.label}>
          <ShoppingCart size={18} color={Palette.textInverse} />
          <Text style={styles.labelText}>View cart</Text>
        </View>
        <Text style={styles.totalText}>{total}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.ink,
    borderRadius: Radius.xxl + 4,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Palette.textInverse,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  labelText: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
  totalText: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Palette.textInverse,
  },
});
