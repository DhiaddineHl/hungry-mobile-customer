import { BottomBar, PrimaryButton, Stepper } from '@/components/ds';
import { createStyles } from '@/theme';

interface AddToCartBarProps {
  quantity: number;
  /** Running total for the chosen quantity and options (`21,36 DT`). */
  total: string;
  onDecrement: () => void;
  onIncrement: () => void;
  onAddToCart: () => void;
  /** A required choice is still unanswered. */
  disabled?: boolean;
  /** Why the button is blocked ("Choose a sauce") — shown as its label. */
  hint?: string;
  loading?: boolean;
}

/**
 * One bar (F1–F3): the large quantity stepper and `Add to cart` with the
 * running total share the BottomBar. Until every required group is answered
 * the button is disabled and names what is missing instead of failing on tap.
 */
export function AddToCartBar({
  quantity,
  total,
  onDecrement,
  onIncrement,
  onAddToCart,
  disabled = false,
  hint,
  loading,
}: AddToCartBarProps) {
  const styles = useStyles();
  return (
    <BottomBar>
      <Stepper value={quantity} onIncrement={onIncrement} onDecrement={onDecrement} min={1} />
      <PrimaryButton
        label={disabled && hint ? hint : 'Add to cart'}
        right={disabled ? undefined : total}
        onPress={onAddToCart}
        disabled={disabled}
        loading={loading}
        loadingLabel="Adding…"
        accessibilityLabel={`Add to cart for ${total}`}
        accessibilityHint={disabled ? hint : undefined}
        style={styles.flex}
      />
    </BottomBar>
  );
}

const useStyles = createStyles(() => ({
  flex: { flex: 1 },
}));
