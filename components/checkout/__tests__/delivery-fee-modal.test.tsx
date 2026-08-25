import {
  DELIVERY_FEE_BODY,
  DELIVERY_FEE_TITLE,
  DeliveryFeeModal,
} from '@/components/checkout/delivery-fee-modal';
import { renderSheet } from '@/test-utils/sheet-harness';
import { fireEvent, screen } from '@testing-library/react-native';

/**
 * `PressableScale` drives its press animation through reanimated worklets,
 * whose native half is not initialised under jest — importing it throws before
 * a single assertion runs. It is replaced with a plain `Pressable` that keeps
 * the same `onPress` and `accessibilityLabel` contract, which is all these
 * tests exercise.
 */
jest.mock('@/components/ui/pressable-scale', () => {
  const { Pressable } = jest.requireActual('react-native');
  return {
    PressableScale: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <Pressable {...props}>{children}</Pressable>
    ),
  };
});

it('renders the title and the body from the design when visible', async () => {
  await renderSheet(<DeliveryFeeModal visible onClose={jest.fn()} />);

  expect(screen.getByText(DELIVERY_FEE_TITLE)).toBeTruthy();
  expect(screen.getByText(DELIVERY_FEE_BODY)).toBeTruthy();
});

// The two fee sheets differ by one word; sharing one string would silently
// show the delivery copy under the service title.
it('says "delivery cost", not "service cost"', () => {
  expect(DELIVERY_FEE_BODY).toContain('delivery cost');
  expect(DELIVERY_FEE_BODY).not.toContain('service cost');
});

it('renders nothing when not visible', async () => {
  await renderSheet(<DeliveryFeeModal visible={false} onClose={jest.fn()} />);

  expect(screen.queryByText(DELIVERY_FEE_TITLE)).toBeNull();
  expect(screen.queryByText(DELIVERY_FEE_BODY)).toBeNull();
});

it('calls onClose when Close is tapped', async () => {
  const onClose = jest.fn();
  await renderSheet(<DeliveryFeeModal visible onClose={onClose} />);

  fireEvent.press(screen.getByLabelText('Close'));

  expect(onClose).toHaveBeenCalledTimes(1);
});
