import {
  SERVICE_FEE_BODY,
  SERVICE_FEE_TITLE,
  ServiceFeeModal,
} from '@/components/checkout/service-fee-modal';
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
  await renderSheet(<ServiceFeeModal visible onClose={jest.fn()} />);

  expect(screen.getByText(SERVICE_FEE_TITLE)).toBeTruthy();
  expect(screen.getByText(SERVICE_FEE_BODY)).toBeTruthy();
});

// The two fee sheets differ by one word; sharing one string would silently
// show the delivery copy under the service title.
it('says "service cost", not "delivery cost"', () => {
  expect(SERVICE_FEE_BODY).toContain('service cost');
  expect(SERVICE_FEE_BODY).not.toContain('delivery cost');
});

it('renders nothing when not visible', async () => {
  await renderSheet(<ServiceFeeModal visible={false} onClose={jest.fn()} />);

  expect(screen.queryByText(SERVICE_FEE_TITLE)).toBeNull();
  expect(screen.queryByText(SERVICE_FEE_BODY)).toBeNull();
});

it('calls onClose when Close is tapped', async () => {
  const onClose = jest.fn();
  await renderSheet(<ServiceFeeModal visible onClose={onClose} />);

  fireEvent.press(screen.getByLabelText('Close'));

  expect(onClose).toHaveBeenCalledTimes(1);
});
