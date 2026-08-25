import { useCartSync } from '@/hooks/use-cart-sync';
import * as cartService from '@/services/api/cart-service';
import { cartCodeFor } from '@/services/api/cart-view-model';
import { useCartStore } from '@/store/cart-store';
import { act, render } from '@testing-library/react-native';

/**
 * The ONE test that actually mounts `useCartSync`, deliberately alone in its
 * own file.
 *
 * Under this repo's React 19 / RNTL 14 combination, the automatic `cleanup()`
 * that runs after a test whose body has awaited leaves React unable to mount
 * anything in the next test — every later `render` silently becomes a no-op and
 * the assertions pass against a hook that never ran. One rendered test per file
 * is the only arrangement that cannot be quietly wrong. Everything else about
 * the engine is covered renderer-free in `use-cart-sync.test.ts`, against the
 * exported `syncCarts`.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@/services/api/cart-service');

jest.mock('@/hooks/use-delivery-address', () => ({
  useCurrentCustomer: jest.fn(() => ({
    data: { id: 'c1c1c1c1-2222-3333-4444-555555555555' },
  })),
}));

const mockedCartService = jest.mocked(cartService);

const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const PIZZA = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';

function Probe() {
  useCartSync();
  return null;
}

it('collapses five taps on + into a single sync', async () => {
  useCartStore.setState({ items: [], remote: {} });
  mockedCartService.replaceCart.mockResolvedValue({
    id: CART_ID,
    code: cartCodeFor(CUSTOMER_ID, RESTAURANT_ID),
    items: [],
  } as never);

  useCartStore.getState().addItem({
    foodId: PIZZA,
    name: 'Crispy Chicken',
    unitPrice: 9.5,
    basePrice: 9.5,
    quantity: 1,
    addons: [],
    restaurantId: RESTAURANT_ID,
    restaurantName: 'Baguette & Baguette',
  });

  render(<Probe />);

  const lineId = useCartStore.getState().items[0].lineId;
  for (let i = 0; i < 5; i += 1) useCartStore.getState().increment(lineId);

  await act(async () => {
    // Comfortably past the 800ms debounce, plus room for the write itself.
    await new Promise((resolve) => setTimeout(resolve, 1600));
  });

  expect(mockedCartService.replaceCart).toHaveBeenCalledTimes(1);
  const [input] = mockedCartService.replaceCart.mock.calls[0];
  expect(input.items).toEqual([{ productId: PIZZA, quantity: 6 }]);
});
