import {
  PAYMENT_DISCLOSURE,
  PAYMENT_METHODS,
  PaymentMethodModal,
  paymentMethodLabel,
} from '@/components/checkout/payment-method-modal';
import { renderSheet } from '@/test-utils/sheet-harness';
import { fireEvent, screen } from '@testing-library/react-native';

// See the note in `service-fee-modal.test.tsx`: reanimated's native half is not
// initialised under jest, so the press wrapper is swapped for a plain Pressable.
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

function renderModal(overrides: Partial<React.ComponentProps<typeof PaymentMethodModal>> = {}) {
  return renderSheet(
    <PaymentMethodModal
      visible
      selected="cash"
      onSelect={jest.fn()}
      onClose={jest.fn()}
      {...overrides}
    />
  );
}

it('renders all four options in the order the design lists them', async () => {
  await renderModal();

  expect(PAYMENT_METHODS.map((option) => option.id)).toEqual([
    'cash',
    'points',
    'bank',
    'sim',
  ]);
  expect(screen.getByText('Cash')).toBeTruthy();
  expect(screen.getByText('Hungry Points')).toBeTruthy();
  expect(screen.getByText('Bank')).toBeTruthy();
  expect(screen.getByText('SIM Credits')).toBeTruthy();
});

it('puts the check mark on the selected option only', async () => {
  await renderModal({ selected: 'bank' });

  expect(screen.getByTestId('payment-check-bank')).toBeTruthy();
  expect(screen.queryByTestId('payment-check-cash')).toBeNull();
  expect(screen.queryByTestId('payment-check-points')).toBeNull();
  expect(screen.queryByTestId('payment-check-sim')).toBeNull();
});

it('calls onSelect with the id of the tapped row', async () => {
  const onSelect = jest.fn();
  await renderModal({ onSelect });

  fireEvent.press(screen.getByLabelText('SIM Credits'));

  expect(onSelect).toHaveBeenCalledWith('sim');
});

// Nothing behind these options charges anything (plan §3.3); the sheet has to
// say so where the customer chooses.
it('discloses that only Cash is actually settled', async () => {
  await renderModal();

  expect(screen.getByText(PAYMENT_DISCLOSURE)).toBeTruthy();
  expect(PAYMENT_DISCLOSURE).toMatch(/Cash/);
  expect(PAYMENT_DISCLOSURE).toMatch(/aren't processed yet/);
});

it('calls onClose when Close is tapped', async () => {
  const onClose = jest.fn();
  await renderModal({ onClose });

  fireEvent.press(screen.getByLabelText('Close'));

  expect(onClose).toHaveBeenCalledTimes(1);
});

it('renders nothing when not visible', async () => {
  await renderModal({ visible: false });

  expect(screen.queryByText('Payment Method')).toBeNull();
  expect(screen.queryByText('Cash')).toBeNull();
});

it('maps every id to its design label', () => {
  expect(paymentMethodLabel('cash')).toBe('Cash');
  expect(paymentMethodLabel('points')).toBe('Hungry Points');
  expect(paymentMethodLabel('bank')).toBe('Bank');
  expect(paymentMethodLabel('sim')).toBe('SIM Credits');
});
