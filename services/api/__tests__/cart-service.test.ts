import { ApiError, apiClient } from '@/services/api/client';
import { cartCodeFor, customerCartCodePrefix } from '@/services/api/cart-view-model';
import {
  createCart,
  deleteCart,
  fetchCartByCode,
  fetchCartById,
  fetchCustomerCarts,
  replaceCart,
} from '@/services/api/cart-service';
import type { CartInput } from '@/schemas/cart';

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
const mockedDelete = apiClient.delete as jest.MockedFunction<typeof apiClient.delete>;
const mockedPut = apiClient.put as jest.MockedFunction<typeof apiClient.put>;

const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const OTHER_CART_ID = '9e8d7c66-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const OTHER_CUSTOMER_ID = 'd4d4d4d4-2222-3333-4444-999999999999';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const PRODUCT_ID = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';

const CODE = cartCodeFor(CUSTOMER_ID, RESTAURANT_ID);

function cart(overrides: Record<string, unknown> = {}) {
  return {
    id: CART_ID,
    code: CODE,
    name: 'Baguette & Baguette',
    customerId: CUSTOMER_ID,
    status: 'ACTIVE',
    items: [],
    createdAt: '2026-08-23T12:00:00',
    ...overrides,
  };
}

function pageOf(content: unknown[]) {
  return {
    data: {
      content,
      number: 0,
      totalPages: 1,
      totalElements: content.length,
      last: true,
      size: 50,
      first: true,
      numberOfElements: content.length,
      empty: content.length === 0,
      sort: { sorted: true },
      pageable: { pageNumber: 0 },
    },
  };
}

const INPUT: CartInput = {
  code: CODE,
  name: 'Baguette & Baguette',
  customerId: CUSTOMER_ID,
  items: [{ productId: PRODUCT_ID, quantity: 2 }],
};

/** The `params` object axios was handed on the Nth get. */
function queryOf(call = 0): Record<string, unknown> {
  const [, config] = mockedGet.mock.calls[call];
  return (config as { params: Record<string, unknown> }).params;
}

function filterOf(call = 0): Record<string, unknown> {
  return JSON.parse(String(queryOf(call).filter));
}

/** Everything that left the device across every mocked verb, as one string. */
function everythingSent(): string {
  return JSON.stringify([
    mockedGet.mock.calls,
    mockedPost.mock.calls,
    mockedDelete.mock.calls,
  ]);
}

function apiError(status: number): ApiError {
  return new ApiError(`Request failed (${status})`, status);
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('fetchCartByCode', () => {
  it('filters on `codes` with EQUALS and the exact code', async () => {
    mockedGet.mockResolvedValue(pageOf([cart()]));

    await fetchCartByCode(CODE);

    expect(mockedGet.mock.calls[0][0]).toBe('/carts/all');
    expect(filterOf()).toEqual({
      codes: [{ operator: 'EQUALS', fieldValue: CODE, fieldType: 'STRING' }],
    });
  });

  it('sorts by a whitelisted field — an unknown one is a 500', async () => {
    mockedGet.mockResolvedValue(pageOf([cart()]));

    await fetchCartByCode(CODE);

    expect(JSON.parse(String(queryOf().sort))).toEqual([
      { field: 'createdAt', direction: 'DESC' },
    ]);
  });

  it('returns null when no cart carries that code', async () => {
    mockedGet.mockResolvedValue(pageOf([]));

    await expect(fetchCartByCode(CODE)).resolves.toBeNull();
  });

  it('takes the newest by createdAt when the code is duplicated', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockedGet.mockResolvedValue(
      pageOf([
        cart({ id: OTHER_CART_ID, createdAt: '2026-08-20T09:00:00' }),
        cart({ id: CART_ID, createdAt: '2026-08-23T12:00:00' }),
      ])
    );

    const result = await fetchCartByCode(CODE);

    // `code` has no unique constraint, so duplicates are a real possibility.
    expect(result?.id).toBe(CART_ID);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('throws an ApiError naming the field path when the response does not parse', async () => {
    mockedGet.mockResolvedValue(pageOf([{ code: CODE }])); // no `id`

    await expect(fetchCartByCode(CODE)).rejects.toThrow(ApiError);
    await expect(fetchCartByCode(CODE)).rejects.toThrow(/id/);
  });
});

describe('fetchCustomerCarts', () => {
  it('filters on `codes` with LIKE and the customer prefix', async () => {
    mockedGet.mockResolvedValue(pageOf([]));

    await fetchCustomerCarts(CUSTOMER_ID);

    expect(filterOf()).toEqual({
      codes: [
        {
          operator: 'LIKE',
          fieldValue: customerCartCodePrefix(CUSTOMER_ID),
          fieldType: 'STRING',
        },
      ],
    });
  });

  it('drops a row belonging to another customer', async () => {
    // LIKE is a substring match and /carts/all is not scoped to the caller,
    // so foreign rows genuinely come back.
    mockedGet.mockResolvedValue(
      pageOf([
        cart(),
        cart({ id: OTHER_CART_ID, code: cartCodeFor(OTHER_CUSTOMER_ID, RESTAURANT_ID) }),
      ])
    );

    const carts = await fetchCustomerCarts(CUSTOMER_ID);

    expect(carts).toHaveLength(1);
    expect(carts[0].id).toBe(CART_ID);
  });

  it('drops a row whose code this app did not write', async () => {
    mockedGet.mockResolvedValue(
      pageOf([cart({ id: OTHER_CART_ID, code: 'legacy-cart-42' }), cart()])
    );

    const carts = await fetchCustomerCarts(CUSTOMER_ID);

    expect(carts.map((each) => each.id)).toEqual([CART_ID]);
  });
});

describe('createCart', () => {
  it('POSTs to /carts and parses the response', async () => {
    mockedPost.mockResolvedValue({ data: cart() });

    const created = await createCart(INPUT);

    expect(mockedPost).toHaveBeenCalledWith('/carts', INPUT);
    expect(created.id).toBe(CART_ID);
  });

  it('always sends a non-empty code — nothing on the backend generates one', async () => {
    mockedPost.mockResolvedValue({ data: cart() });

    await createCart(INPUT);

    const [, payload] = mockedPost.mock.calls[0];
    expect((payload as CartInput).code).toBeTruthy();
  });

  it('throws an ApiError when the created cart does not parse', async () => {
    mockedPost.mockResolvedValue({ data: { code: CODE } }); // no `id`

    await expect(createCart(INPUT)).rejects.toThrow(ApiError);
  });
});

describe('deleteCart', () => {
  it('DELETEs by id', async () => {
    mockedDelete.mockResolvedValue({ data: undefined });

    await deleteCart(CART_ID);

    expect(mockedDelete).toHaveBeenCalledWith(`/carts/${CART_ID}`);
  });

  it('never lets a malformed id leave the device', async () => {
    await deleteCart('not-a-uuid');

    expect(mockedDelete).not.toHaveBeenCalled();
  });
});

describe('fetchCartById', () => {
  it('maps a 500 on a well-formed UUID to not-found', async () => {
    mockedGet.mockRejectedValue(apiError(500));

    // A missing id answers 500, not 404 — `DefaultCrudRepository.find` is
    // `orElseThrow()` and there is no controller advice behind it.
    await expect(fetchCartById(CART_ID)).resolves.toBeNull();
  });

  it('does not request a malformed id at all', async () => {
    await expect(fetchCartById('abc')).resolves.toBeNull();

    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('re-throws a failure that is not a not-found', async () => {
    mockedGet.mockRejectedValue(apiError(503));

    await expect(fetchCartById(CART_ID)).rejects.toThrow(ApiError);
  });
});

describe('replaceCart', () => {
  it('deletes BEFORE creating', async () => {
    const order: string[] = [];
    mockedDelete.mockImplementation(async () => {
      order.push('delete');
      return { data: undefined };
    });
    mockedPost.mockImplementation(async () => {
      order.push('post');
      return { data: cart() };
    });

    await replaceCart(INPUT, CART_ID);

    // Not "both happened" — the ORDER is the invariant. `code` has no unique
    // constraint, so create-then-delete can duplicate the cart.
    expect(order).toEqual(['delete', 'post']);
  });

  it('resolves the existing cart by code when no id is known', async () => {
    mockedGet.mockResolvedValue(pageOf([cart()]));
    mockedDelete.mockResolvedValue({ data: undefined });
    mockedPost.mockResolvedValue({ data: cart() });

    await replaceCart(INPUT);

    expect(filterOf()).toEqual({
      codes: [{ operator: 'EQUALS', fieldValue: CODE, fieldType: 'STRING' }],
    });
    expect(mockedDelete).toHaveBeenCalledWith(`/carts/${CART_ID}`);
  });

  it('creates without deleting when no cart exists yet', async () => {
    mockedGet.mockResolvedValue(pageOf([]));
    mockedPost.mockResolvedValue({ data: cart() });

    await replaceCart(INPUT);

    expect(mockedDelete).not.toHaveBeenCalled();
    expect(mockedPost).toHaveBeenCalled();
  });

  it('deletes and does NOT create when the item list is empty', async () => {
    mockedDelete.mockResolvedValue({ data: undefined });

    const result = await replaceCart({ ...INPUT, items: [] }, CART_ID);

    expect(mockedDelete).toHaveBeenCalledWith(`/carts/${CART_ID}`);
    expect(mockedPost).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('still creates when the delete rejects with 500 — the row is already gone', async () => {
    mockedDelete.mockRejectedValue(apiError(500));
    mockedPost.mockResolvedValue({ data: cart() });

    const result = await replaceCart(INPUT, CART_ID);

    expect(mockedPost).toHaveBeenCalled();
    expect(result?.id).toBe(CART_ID);
  });
});

describe('forbidden request shapes', () => {
  it('never calls PUT — it answers 200 with an empty body and writes nothing', async () => {
    mockedGet.mockResolvedValue(pageOf([cart()]));
    mockedDelete.mockResolvedValue({ data: undefined });
    mockedPost.mockResolvedValue({ data: cart() });

    await replaceCart(INPUT);
    await fetchCustomerCarts(CUSTOMER_ID);
    await fetchCartByCode(CODE);

    expect(mockedPut).not.toHaveBeenCalled();
  });

  it('never emits a customerIds or statuses filter — both answer 500', async () => {
    mockedGet.mockResolvedValue(pageOf([cart()]));
    mockedDelete.mockResolvedValue({ data: undefined });
    mockedPost.mockResolvedValue({ data: cart() });

    await replaceCart(INPUT);
    await fetchCustomerCarts(CUSTOMER_ID);
    await fetchCartByCode(CODE);
    await deleteCart(CART_ID);
    await fetchCartById(CART_ID).catch(() => null);

    const sent = everythingSent();
    expect(sent).not.toContain('customerIds');
    expect(sent).not.toContain('statuses');
  });
});
