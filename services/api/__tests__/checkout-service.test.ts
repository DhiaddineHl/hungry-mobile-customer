import { ApiError, apiClient } from '@/services/api/client';
import { blockersOf, placeOrders } from '@/services/api/checkout-service';

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

const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';

function order(id: string, restaurantId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    code: 'ORD-20260925-K3F9QX',
    restaurantId,
    status: 'CREATED',
    items: [],
    subtotal: 30,
    discountTotal: 3,
    deliveryFee: 1.5,
    serviceFee: 0.5,
    additionalFees: 0,
    total: 29,
    adjustments: [{ type: 'SERVICE_FEE', code: 'SERVICE', label: 'Service fee', amount: 0.5 }],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('placeOrders', () => {
  it('POSTs /checkout with NO body: the server reads everything from the cart', async () => {
    mockedPost.mockResolvedValueOnce({ data: { cartId: CART_ID, orders: [order('o1', 'r1')] } });

    await placeOrders();

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost.mock.calls[0]).toEqual(['/checkout']);
  });

  it('returns every order the checkout created, with the money the server snapshotted', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { cartId: CART_ID, orders: [order('o1', 'r1'), order('o2', 'r2', { serviceFee: 0.5 })] },
    });

    const result = await placeOrders();

    expect(result.cartId).toBe(CART_ID);
    expect(result.orders.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(result.orders[0].total).toBe(29);
    expect(result.orders[0].adjustments?.[0]).toMatchObject({ type: 'SERVICE_FEE', amount: 0.5 });
  });

  it('throws when a 2xx carries no orders — a placed order the app cannot see would be reported as nothing', async () => {
    mockedPost.mockResolvedValueOnce({ data: null });

    await expect(placeOrders()).rejects.toBeInstanceOf(ApiError);
  });

  it('names the field when the result does not parse', async () => {
    mockedPost.mockResolvedValueOnce({ data: { cartId: CART_ID, orders: [{ code: 'no id' }] } });

    await expect(placeOrders()).rejects.toThrow(/orders/);
  });

  it('issues exactly one POST even when it fails: a retry could place the same order twice', async () => {
    mockedPost.mockRejectedValueOnce(new ApiError('Request failed (500)', 500));

    await expect(placeOrders()).rejects.toBeInstanceOf(ApiError);
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });
});

describe('blockersOf', () => {
  it('reads the blockers off a 409 not-ready refusal', () => {
    const error = new ApiError('Your cart cannot be checked out yet', 409, {
      blockers: ['NO_DELIVERY_ADDRESS', 'EMPTY_CART'],
    });

    expect(blockersOf(error)).toEqual(['NO_DELIVERY_ADDRESS', 'EMPTY_CART']);
  });

  it('is empty for any other failure, so it cannot be mistaken for a fixable cart', () => {
    expect(blockersOf(new ApiError('boom', 500, { blockers: ['EMPTY_CART'] }))).toEqual([]);
    expect(blockersOf(new ApiError('conflict', 409))).toEqual([]);
    expect(blockersOf(new Error('plain'))).toEqual([]);
    expect(blockersOf(null)).toEqual([]);
  });

  it('ignores anything in the list that is not a string', () => {
    expect(blockersOf(new ApiError('x', 409, { blockers: ['EMPTY_CART', 7, null] }))).toEqual(['EMPTY_CART']);
  });
});
