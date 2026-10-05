import {
  addActiveCartItem,
  checkoutActiveCart,
  CheckoutNotReadyError,
  clearActiveCart,
  fetchActiveCart,
  removeActiveCartItem,
  updateActiveCartItem,
  updateCheckoutOptions,
} from '@/services/api/cart-service';
import { ApiError, apiClient } from '@/services/api/client';

jest.mock('@/services/api/client', () => {
  const actual = jest.requireActual('@/services/api/client');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      put: jest.fn(),
      defaults: { baseURL: 'http://192.168.1.10:8082' },
    },
  };
});

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockedPut = apiClient.put as jest.MockedFunction<typeof apiClient.put>;
const mockedDelete = apiClient.delete as jest.MockedFunction<typeof apiClient.delete>;

const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const ORDER_ID = '9a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d';
const CART = { id: CART_ID, items: [], total: 3.5, serviceFee: { amount: 1, orderCount: 1 } };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('the active cart routes', () => {
  it('address "my" cart — never a customer or cart id', async () => {
    mockedGet.mockResolvedValue({ data: CART });
    mockedPost.mockResolvedValue({ data: CART });
    mockedPut.mockResolvedValue({ data: CART });
    mockedDelete.mockResolvedValue({ data: CART });

    await fetchActiveCart();
    await addActiveCartItem({ productId: 'p', quantity: 1, attributes: [] });
    await updateActiveCartItem('item-1', 3);
    await removeActiveCartItem('item-1');
    await clearActiveCart();
    await updateCheckoutOptions({ deliveryAddress: null, paymentMethod: 'cash', comment: null, couponCode: null });

    expect(mockedGet).toHaveBeenCalledWith('/carts/active');
    expect(mockedPost).toHaveBeenCalledWith('/carts/active/items', {
      productId: 'p',
      quantity: 1,
      attributes: [],
    });
    expect(mockedPut).toHaveBeenCalledWith('/carts/active/items/item-1', { quantity: 3 });
    expect(mockedDelete).toHaveBeenCalledWith('/carts/active/items/item-1');
    expect(mockedDelete).toHaveBeenCalledWith('/carts/active');
    expect(mockedPut).toHaveBeenCalledWith('/carts/active/checkout-options', expect.any(Object));
  });

  it('returns the priced cart', async () => {
    mockedGet.mockResolvedValueOnce({ data: CART });

    const cart = await fetchActiveCart();

    expect(cart.total).toBe(3.5);
    expect(cart.serviceFee?.amount).toBe(1);
  });

  it('throws an ApiError naming the field path when the cart does not parse', async () => {
    mockedGet.mockResolvedValueOnce({ data: { items: [] } });

    await expect(fetchActiveCart()).rejects.toThrow(/id/);
  });
});

describe('checkoutActiveCart', () => {
  it('POSTs /checkout with no body and returns the placed orders', async () => {
    mockedPost.mockResolvedValueOnce({ data: { cartId: CART_ID, orders: [{ id: ORDER_ID, items: [] }] } });

    const result = await checkoutActiveCart();

    expect(mockedPost).toHaveBeenCalledWith('/checkout');
    expect(result.orders.map((order) => order.id)).toEqual([ORDER_ID]);
  });

  it('turns a 409 into CheckoutNotReadyError carrying the blockers', async () => {
    mockedPost.mockRejectedValueOnce(
      new ApiError('not ready', 409, { blockers: ['NO_DELIVERY_ADDRESS'] })
    );

    const error = await checkoutActiveCart().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CheckoutNotReadyError);
    expect((error as CheckoutNotReadyError).blockers).toEqual(['NO_DELIVERY_ADDRESS']);
  });

  it('rethrows any other failure untouched — and issues exactly one POST', async () => {
    mockedPost.mockRejectedValueOnce(new ApiError('boom', 500));

    await expect(checkoutActiveCart()).rejects.toBeInstanceOf(ApiError);
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });
});
