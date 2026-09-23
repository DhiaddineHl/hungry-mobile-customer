import { ApiError, apiClient } from '@/services/api/client';
import {
  addCartItem,
  clearCart,
  fetchActiveCart,
  removeCartItem,
  removeRestaurantItems,
  updateCartItemQuantity,
  updateCheckoutOptions,
} from '@/services/api/cart-service';

jest.mock('@/services/api/client', () => {
  const actual = jest.requireActual('@/services/api/client');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockedPut = apiClient.put as jest.MockedFunction<typeof apiClient.put>;
const mockedDelete = apiClient.delete as jest.MockedFunction<typeof apiClient.delete>;

const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const ITEM_ID = 'a1a1a1a1-2222-3333-4444-555555555555';
const RESTAURANT_ID = '11111111-1111-1111-1111-111111111111';
const PRODUCT_ID = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';

const CART = { id: CART_ID, status: 'ACTIVE', items: [], total: 12.5, blockers: ['EMPTY_CART'] };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the customer cart is addressed by the token, never by an id the app chooses', () => {
  it('reads the latest state from GET /carts/active', async () => {
    mockedGet.mockResolvedValueOnce({ data: CART });

    const cart = await fetchActiveCart();

    expect(mockedGet).toHaveBeenCalledWith('/carts/active');
    expect(cart.id).toBe(CART_ID);
    expect(cart.total).toBe(12.5);
  });

  it('adds a dish with its options and note, and no price or restaurant', async () => {
    mockedPost.mockResolvedValueOnce({ data: CART });
    const input = {
      productId: PRODUCT_ID,
      quantity: 2,
      note: 'no onions',
      attributes: [{ attributeId: 'opt-1', checked: true }],
    };

    await addCartItem(input);

    expect(mockedPost).toHaveBeenCalledWith('/carts/active/items', input);
    const body = JSON.stringify(mockedPost.mock.calls[0][1]);
    for (const forbidden of ['price', 'restaurant', 'customer', 'total']) {
      expect(body.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('sets a line quantity with PUT and leaves removal to zero', async () => {
    mockedPut.mockResolvedValueOnce({ data: CART });

    await updateCartItemQuantity(ITEM_ID, 3);

    expect(mockedPut).toHaveBeenCalledWith(`/carts/active/items/${ITEM_ID}`, { quantity: 3 });
  });

  it('removes a line, a restaurant and the whole cart', async () => {
    mockedDelete.mockResolvedValue({ data: CART });

    await removeCartItem(ITEM_ID);
    await removeRestaurantItems(RESTAURANT_ID);
    await clearCart();

    expect(mockedDelete.mock.calls.map((call) => call[0])).toEqual([
      `/carts/active/items/${ITEM_ID}`,
      `/carts/active/restaurants/${RESTAURANT_ID}`,
      '/carts/active',
    ]);
  });

  it('writes the delivery address, payment method, note and coupon in one replace-all call', async () => {
    mockedPut.mockResolvedValueOnce({ data: CART });
    const options = {
      deliveryAddress: { formattedAddress: 'Somewhere', coordinates: { latitude: 35.8, longitude: 10.6 } },
      paymentMethod: 'cash',
      comment: null,
      couponCode: null,
    };

    await updateCheckoutOptions(options);

    expect(mockedPut).toHaveBeenCalledWith('/carts/active/checkout-options', options);
  });

  it('sends an explicit null to clear a custom delivery point', async () => {
    mockedPut.mockResolvedValueOnce({ data: CART });

    await updateCheckoutOptions({ deliveryAddress: null, paymentMethod: 'cash', comment: null, couponCode: null });

    const body = mockedPut.mock.calls[0][1] as Record<string, unknown>;
    expect(body).toHaveProperty('deliveryAddress', null);
  });
});

describe('the response is always checked, never trusted', () => {
  it('throws when a 2xx carries no cart — that would look like a change that was saved', async () => {
    mockedPost.mockResolvedValueOnce({ data: null });

    await expect(addCartItem({ productId: PRODUCT_ID, quantity: 1, attributes: [] })).rejects.toBeInstanceOf(ApiError);
  });

  it('names the offending field when the cart does not parse', async () => {
    mockedGet.mockResolvedValueOnce({ data: { status: 'ACTIVE' } });

    await expect(fetchActiveCart()).rejects.toThrow(/id/);
  });

  it('passes the server\'s own refusal through, status included', async () => {
    mockedPost.mockRejectedValueOnce(new ApiError('Quantity must be between 1 and 99.', 400));

    await expect(addCartItem({ productId: PRODUCT_ID, quantity: 100, attributes: [] })).rejects.toMatchObject({
      status: 400,
      message: 'Quantity must be between 1 and 99.',
    });
  });

  it('issues exactly one request per call: nothing here retries', async () => {
    mockedPost.mockRejectedValueOnce(new ApiError('Network error.'));

    await expect(addCartItem({ productId: PRODUCT_ID, quantity: 1, attributes: [] })).rejects.toBeInstanceOf(ApiError);
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });
});

describe('what the app no longer does', () => {
  it('never calls the generic cart CRUD routes, which do not scope to the caller', async () => {
    mockedGet.mockResolvedValue({ data: CART });
    mockedPost.mockResolvedValue({ data: CART });
    mockedPut.mockResolvedValue({ data: CART });
    mockedDelete.mockResolvedValue({ data: CART });

    await fetchActiveCart();
    await addCartItem({ productId: PRODUCT_ID, quantity: 1, attributes: [] });
    await updateCartItemQuantity(ITEM_ID, 1);
    await removeCartItem(ITEM_ID);
    await clearCart();
    await updateCheckoutOptions({ deliveryAddress: null, paymentMethod: null, comment: null, couponCode: null });

    const urls = [mockedGet, mockedPost, mockedPut, mockedDelete].flatMap((mock) => mock.mock.calls.map((call) => String(call[0])));
    expect(urls.every((url) => url.startsWith('/carts/active'))).toBe(true);
    expect(urls.some((url) => url === '/carts' || url.includes('/carts/all'))).toBe(false);
  });
});
