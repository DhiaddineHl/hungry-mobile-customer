import { ApiError, apiClient } from '@/services/api/client';
import {
  fetchCustomerOrders,
  fetchOrderById,
  isUuid,
  MAX_ORDER_PAGES,
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

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    code: 'ORD-20260925-K3F9QX',
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

function page(
  content: Record<string, unknown>[],
  { last = true }: { last?: boolean } = {}
) {
  return { content, number: 0, totalPages: 1, totalElements: content.length, last };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchCustomerOrders', () => {
  const OTHER_CUSTOMER = 'd4d4d4d4-2222-3333-4444-555555555555';

  it('drops orders belonging to other customers', async () => {
    // `/orders/all` is not scoped to the caller and no filter on it works, so
    // the response genuinely contains other people's rows.
    mockedGet.mockResolvedValueOnce({
      data: page(
        [
          order({ id: ORDER_ID }),
          order({ id: 'f0f0f0f0-1111-2222-3333-444444444444', customerId: OTHER_CUSTOMER }),
        ],
        { last: true }
      ),
    });

    const orders = await fetchCustomerOrders(CUSTOMER_ID);

    expect(orders.map((o) => o.id)).toEqual([ORDER_ID]);
  });

  it('keeps paging while the server says there are more pages', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: page([order({ id: ORDER_ID })], { last: false }) })
      .mockResolvedValueOnce({
        data: page([order({ id: '11111111-2222-3333-4444-555555555555' })], {
          last: true,
        }),
      });

    const orders = await fetchCustomerOrders(CUSTOMER_ID);

    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(orders).toHaveLength(2);
    expect(mockedGet.mock.calls[1][1]?.params).toMatchObject({ page: 1 });
  });

  it('stops at the page cap instead of crawling an unbounded table', async () => {
    mockedGet.mockResolvedValue({
      data: page([order({ customerId: OTHER_CUSTOMER })], { last: false }),
    });

    const orders = await fetchCustomerOrders(CUSTOMER_ID);

    expect(mockedGet).toHaveBeenCalledTimes(MAX_ORDER_PAGES);
    expect(orders).toEqual([]);
  });

  it('asks for the newest orders first', async () => {
    mockedGet.mockResolvedValueOnce({ data: page([], { last: true }) });

    await fetchCustomerOrders(CUSTOMER_ID);

    const params = mockedGet.mock.calls[0][1]?.params as { sort: string };
    expect(JSON.parse(params.sort)).toEqual([
      { field: 'createdAt', direction: 'DESC' },
    ]);
  });

  it('throws when a page does not parse, rather than returning half a history', async () => {
    mockedGet.mockResolvedValueOnce({ data: page([order({ id: 42 })], { last: true }) });

    await expect(fetchCustomerOrders(CUSTOMER_ID)).rejects.toThrow(ApiError);
  });
});

describe('isUuid', () => {
  it('accepts a UUID and rejects anything else', () => {
    expect(isUuid(ORDER_ID)).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
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

describe('what this module never does', () => {
  it('never writes: orders are created by POST /checkout, not from here', async () => {
    mockedGet.mockResolvedValueOnce({ data: order() });
    mockedGet.mockResolvedValueOnce({ data: page([order()], { last: true }) });

    await fetchOrderById(ORDER_ID);
    await fetchCustomerOrders(CUSTOMER_ID);

    expect(mockedPost).not.toHaveBeenCalled();
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it('reads one order by id without touching the list endpoint', async () => {
    mockedGet.mockResolvedValueOnce({ data: order() });

    await fetchOrderById(ORDER_ID);

    const requested = JSON.stringify(mockedGet.mock.calls);
    expect(requested).not.toContain('/orders/all');
    expect(requested).not.toContain('filter');
  });

  it('sends NO filter at all when listing', async () => {
    // Orders used to carry an app-made `ho:<customer>:...` code and a `LIKE`
    // filter on it was a harmless no-op. They now get server-generated codes
    // (`ORD-20260925-K3F9QX`), so a filter on the old prefix that the backend
    // honoured would hide every order. The list is narrowed on the device.
    mockedGet.mockResolvedValueOnce({ data: page([order()], { last: true }) });

    await fetchCustomerOrders(CUSTOMER_ID);

    const params = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>;
    expect(params).not.toHaveProperty('filter');
    expect(JSON.stringify(mockedGet.mock.calls)).not.toContain('ho:');
  });

  it('still narrows the list to the customer even though it asks for no filter', async () => {
    mockedGet.mockResolvedValueOnce({
      data: page(
        [order({ id: ORDER_ID }), order({ id: 'f0f0f0f0-1111-2222-3333-444444444444', customerId: 'someone-else' })],
        { last: true }
      ),
    });

    const orders = await fetchCustomerOrders(CUSTOMER_ID);

    expect(orders.map((o) => o.id)).toEqual([ORDER_ID]);
  });
});
