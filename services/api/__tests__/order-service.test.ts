import type { OrderInput } from '@/schemas/order';
import { ApiError, apiClient } from '@/services/api/client';
import {
  createOrder,
  fetchOrderById,
  isUuid,
} from '@/services/api/order-service';

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

const ORDER_ID = '9a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d';
const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const PRODUCT_ID = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';
const ATTRIBUTE_ID = 'a4a4a4a4-1111-2222-3333-444444444444';

const INPUT: OrderInput = {
  code: `ho:${CUSTOMER_ID}:${RESTAURANT_ID}:1756000000000`,
  name: 'Baguette & Baguette',
  restaurantId: RESTAURANT_ID,
  customerId: CUSTOMER_ID,
  comment: 'Payment: Cash',
  items: [
    {
      code: 'line-1',
      name: 'Crispy Chicken',
      quantity: 2,
      orderedProduct: {
        code: PRODUCT_ID,
        name: 'Crispy Chicken',
        productId: PRODUCT_ID,
        attributes: [
          {
            code: ATTRIBUTE_ID,
            name: 'Extra cheese',
            attributeId: ATTRIBUTE_ID,
            checked: true,
          },
        ],
      },
    },
  ],
};

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    code: INPUT.code,
    name: 'Baguette & Baguette',
    restaurantId: RESTAURANT_ID,
    customerId: CUSTOMER_ID,
    status: 'CREATED',
    items: [
      {
        id: 'item-1',
        quantity: 2,
        product: { id: PRODUCT_ID, productId: PRODUCT_ID, attributes: [] },
      },
    ],
    createdAt: '2026-08-24T12:00:00',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isUuid', () => {
  it('accepts a UUID and rejects anything else', () => {
    expect(isUuid(ORDER_ID)).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
  });
});

describe('createOrder', () => {
  it('POSTs to /orders with the payload untouched', async () => {
    mockedPost.mockResolvedValueOnce({ data: order() });

    await createOrder(INPUT);

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [url, body] = mockedPost.mock.calls[0];
    expect(url).toBe('/orders');
    expect(body).toEqual(INPUT);
    // The input nesting key, which the response calls `product`.
    expect((body as OrderInput).items[0].orderedProduct.productId).toBe(PRODUCT_ID);
  });

  it('returns the parsed order', async () => {
    mockedPost.mockResolvedValueOnce({ data: order() });

    const created = await createOrder(INPUT);

    expect(created.id).toBe(ORDER_ID);
    expect(created.items).toHaveLength(1);
  });

  it('throws when a 2xx carries an empty body — the PUT no-op signature', async () => {
    // `DefaultCrudService.update()` returns null and the controller answers
    // `ResponseEntity.ok(null)`. Reporting that as a created order would tell
    // the customer a delivery is coming that no one will make.
    mockedPost.mockResolvedValueOnce({ data: null });

    await expect(createOrder(INPUT)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws an ApiError naming the field path when the response does not parse', async () => {
    const { id: _id, ...withoutId } = order();
    mockedPost.mockResolvedValueOnce({ data: withoutId });

    await expect(createOrder(INPUT)).rejects.toThrow(/id/);
  });

  it('does not swallow a 500 — and issues exactly one POST', async () => {
    // No retry at this layer: a create that reached the database enqueues a
    // driver, so a second attempt risks a second delivery (plan §3.6).
    mockedPost.mockRejectedValueOnce(new ApiError('A populator has failed', 500));

    await expect(createOrder(INPUT)).rejects.toBeInstanceOf(ApiError);
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });
});

describe('fetchOrderById', () => {
  it('GETs /orders/{id} and returns the parsed order', async () => {
    mockedGet.mockResolvedValueOnce({ data: order() });

    const found = await fetchOrderById(ORDER_ID);

    expect(mockedGet).toHaveBeenCalledWith(`/orders/${ORDER_ID}`);
    expect(found?.id).toBe(ORDER_ID);
  });

  it('reads a 500 on a well-formed UUID as not-found', async () => {
    // `DefaultCrudRepository.find` is `findById(...).orElseThrow()` with no
    // exception handler registered, so a missing order is a 500, not a 404.
    mockedGet.mockRejectedValueOnce(new ApiError('NoSuchElementException', 500));

    await expect(fetchOrderById(ORDER_ID)).resolves.toBeNull();
  });

  it('returns null for a malformed id without touching the network', async () => {
    await expect(fetchOrderById('not-a-uuid')).resolves.toBeNull();
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('rethrows a fault that is not a not-found', async () => {
    mockedGet.mockRejectedValueOnce(new ApiError('Gateway unavailable', 503));

    await expect(fetchOrderById(ORDER_ID)).rejects.toBeInstanceOf(ApiError);
  });

  it('parses an order that reads back with no items', async () => {
    // The back-reference is never set, so `order_item.order_id` stays NULL and
    // a fresh order re-reads empty (plan §2.2). It still has to parse.
    mockedGet.mockResolvedValueOnce({ data: order({ items: [] }) });

    const found = await fetchOrderById(ORDER_ID);

    expect(found?.items).toEqual([]);
  });
});

describe('forbidden calls', () => {
  it('never calls PUT /orders, on any path', async () => {
    mockedPost.mockResolvedValueOnce({ data: order() });
    mockedGet.mockResolvedValueOnce({ data: order() });

    await createOrder(INPUT);
    await fetchOrderById(ORDER_ID);

    // 200 OK, empty body, writes nothing. Never called.
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it('never requests /orders/all, and never emits a broken filter key', async () => {
    mockedPost.mockResolvedValueOnce({ data: order() });
    mockedGet.mockResolvedValueOnce({ data: order() });

    await createOrder(INPUT);
    await fetchOrderById(ORDER_ID);

    const requested = JSON.stringify([
      ...mockedGet.mock.calls,
      ...mockedPost.mock.calls,
    ]);

    expect(requested).not.toContain('/orders/all');
    // `restaurantIds`/`customerIds` answer 500; `statuses` compares an ORDINAL
    // enum to a String; `ids`/`codes`/`names` are silently ignored.
    for (const key of ['restaurantIds', 'customerIds', 'statuses', 'filter']) {
      expect(requested).not.toContain(key);
    }
  });
});
