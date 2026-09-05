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
  /**
   * Blocks the Add button — the dish cannot go into the cart as it stands,
   * because a required choice is still unanswered. Quantity stays editable:
   * nothing about it is invalid.
   */
  disabled?: boolean;
  /**
   * Why the button is blocked, shown above it. A disabled control with no
   * stated reason is the worst of both worlds — the customer taps, nothing
   * happens, and the missing group may be scrolled off-screen.
   */
  hint?: string;
}

export function AddToCartBar({
  quantity,
  total,
  onDecrement,
  onIncrement,
  onAddToCart,
  disabled = false,
  hint,
}: AddToCartBarProps) {
  const insets = useSafeAreaInsets();
  const canDecrement = quantity > 1;

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <View style={styles.row}>
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
          style={[styles.addBtn, disabled && styles.addBtnDisabled]}
          onPress={onAddToCart}
          disabled={disabled}
          scaleTo={0.98}
          dimTo={0.95}
          haptic
          accessibilityLabel={`Add to cart for ${total}`}
        >
          <Text style={[styles.addBtnText, disabled && styles.addBtnTextDisabled]}>
            Add for {total}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingTop: Spacing.md,
    backgroundColor: Palette.surface,
    borderTopWidth: 1,
    borderTopColor: Palette.borderSubtle,
  },
  hint: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    color: Palette.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
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
  addBtnDisabled: {
    backgroundColor: Palette.surfaceMuted,
  },
  addBtnText: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
  addBtnTextDisabled: {
    color: Palette.textMuted,
  },
});
