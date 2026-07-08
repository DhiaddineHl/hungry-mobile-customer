import { View, Text, StyleSheet } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';

interface AddToCartBarProps {
  quantity: number;
  total: string;
  onDecrement: () => void;
  onIncrement: () => void;
  onAddToCart: () => void;
}

export function AddToCartBar({
  quantity,
  total,
  onDecrement,
  onIncrement,
  onAddToCart,
}: AddToCartBarProps) {
  const insets = useSafeAreaInsets();
  const canDecrement = quantity > 1;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.quantityControl}>
        <PressableScale
          style={styles.quantityBtn}
          onPress={onDecrement}
          disabled={!canDecrement}
          scaleTo={0.88}
          accessibilityLabel="Decrease quantity"
        >
          <Minus size={18} color={canDecrement ? Palette.ink : Palette.textMuted} />
        </PressableScale>
        <Text style={styles.quantity}>{quantity}</Text>
        <PressableScale
          style={styles.quantityBtn}
          onPress={onIncrement}
          scaleTo={0.88}
          accessibilityLabel="Increase quantity"
        >
          <Plus size={18} color={Palette.ink} />
        </PressableScale>
      </View>

      <PressableScale
        style={styles.addBtn}
        onPress={onAddToCart}
        scaleTo={0.98}
        dimTo={0.95}
        haptic
        accessibilityLabel={`Add to cart for ${total}`}
      >
        <Text style={styles.addBtnText}>Add for {total}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderTopWidth: 1,
    borderTopColor: Palette.borderSubtle,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surfaceMuted,
    borderRadius: Radius.xxl + 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  quantityBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Palette.ink,
    minWidth: 28,
    textAlign: 'center',
  },
  addBtn: {
    flex: 1,
    backgroundColor: Palette.primary,
    borderRadius: Radius.xxl + 4,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
});
