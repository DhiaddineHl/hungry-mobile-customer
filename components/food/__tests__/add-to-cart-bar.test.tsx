import { AddToCartBar } from '@/components/food/add-to-cart-bar';
import { renderSheet } from '@/test-utils/sheet-harness';
import { fireEvent, screen } from '@testing-library/react-native';

/**
 * The Add button is the gate on a dish whose required choices are unanswered.
 *
 * `PressableScale` drives its press animation through reanimated worklets,
 * whose native half is not initialised under jest — importing it throws before
 * a single assertion runs. It is replaced with a plain `Pressable`, which
 * honours the same `onPress` / `disabled` / `accessibilityLabel` contract these
 * tests exercise (and, like the real one, does not fire `onPress` when
 * disabled).
 */
jest.mock('@/components/ui/pressable-scale', () => {
  const { Pressable } = jest.requireActual('react-native');
  return {
    PressableScale: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <Pressable accessibilityRole="button" {...props}>
        {children}
      </Pressable>
    ),
  };
});

const HINT = 'Choose an option in every required section to continue.';

function renderBar(props: Partial<React.ComponentProps<typeof AddToCartBar>> = {}) {
  const onAddToCart = jest.fn();
  return {
    onAddToCart,
    rendered: renderSheet(
      <AddToCartBar
        quantity={1}
        total="9.68 DT"
        onDecrement={jest.fn()}
        onIncrement={jest.fn()}
        onAddToCart={onAddToCart}
        {...props}
      />
    ),
  };
}

it('adds to the cart when nothing is missing', async () => {
  const { onAddToCart, rendered } = renderBar();
  await rendered;

  fireEvent.press(screen.getByLabelText('Add to cart for 9.68 DT'));

  expect(onAddToCart).toHaveBeenCalledTimes(1);
});

it('does NOT add to the cart while a required choice is missing', async () => {
  const { onAddToCart, rendered } = renderBar({ disabled: true });
  await rendered;

  fireEvent.press(screen.getByLabelText('Add to cart for 9.68 DT'));

  expect(onAddToCart).not.toHaveBeenCalled();
});

it('reports the button as disabled rather than just looking greyed out', async () => {
  const { rendered } = renderBar({ disabled: true });
  await rendered;

  expect(screen.getByLabelText('Add to cart for 9.68 DT')).toBeDisabled();
});

it('states why the button is blocked', async () => {
  const { rendered } = renderBar({ disabled: true, hint: HINT });
  await rendered;

  expect(screen.getByText(HINT)).toBeTruthy();
});

it('carries no hint once the dish is orderable', async () => {
  const { rendered } = renderBar();
  await rendered;

  expect(screen.queryByText(HINT)).toBeNull();
});

it('keeps the quantity editable while the Add button is blocked', async () => {
  // Nothing about the quantity is invalid — only the missing choice is.
  const onIncrement = jest.fn();
  const { rendered } = renderBar({ disabled: true, onIncrement });
  await rendered;

  fireEvent.press(screen.getByLabelText('Increase quantity'));

  expect(onIncrement).toHaveBeenCalledTimes(1);
});
