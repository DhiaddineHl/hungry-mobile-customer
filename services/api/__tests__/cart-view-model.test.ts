import {
  CART_CODE_PREFIX,
  cartCodeFor,
  customerCartCodePrefix,
  parseCartCode,
  syncSignature,
  toCartInput,
} from '@/services/api/cart-view-model';
import type { CartLine } from '@/store/cart-store';

const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const PIZZA = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';
const SALAD = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function line(overrides: Partial<CartLine> & Pick<CartLine, 'foodId'>): CartLine {
  return {
    lineId: `${overrides.foodId}-${JSON.stringify(overrides.addons ?? [])}`,
    name: 'Pizza',
    unitPrice: 10,
    basePrice: 10,
    quantity: 1,
    addons: [],
    restaurantId: RESTAURANT_ID,
    restaurantName: 'Baguette & Baguette',
    ...overrides,
  };
}

describe('cartCodeFor / parseCartCode', () => {
  it('round-trips a customer and a restaurant through a code', () => {
    const code = cartCodeFor(CUSTOMER_ID, RESTAURANT_ID);

    expect(code).toBe(`hc:${CUSTOMER_ID}:${RESTAURANT_ID}`);
    expect(parseCartCode(code)).toEqual({
      customerId: CUSTOMER_ID,
      restaurantId: RESTAURANT_ID,
    });
  });

  it('returns null for null, undefined and the empty string', () => {
    expect(parseCartCode(null)).toBeNull();
    expect(parseCartCode(undefined)).toBeNull();
    expect(parseCartCode('')).toBeNull();
  });

  it('returns null for a code this app did not write', () => {
    // /carts/all is not scoped to the caller, so foreign rows do turn up.
    expect(parseCartCode('other:a:b')).toBeNull();
  });

  it('returns null for too few and too many segments', () => {
    expect(parseCartCode('hc:a')).toBeNull();
    expect(parseCartCode('hc')).toBeNull();
    expect(parseCartCode('hc:a:b:c')).toBeNull();
  });

  it('returns null when a segment is empty', () => {
    expect(parseCartCode('hc::b')).toBeNull();
    expect(parseCartCode('hc:a:')).toBeNull();
  });

  it('never throws on a malformed code', () => {
    expect(() => parseCartCode('::::')).not.toThrow();
    expect(parseCartCode('::::')).toBeNull();
  });

  it("parses a code belonging to a DIFFERENT customer — matching the customer is the caller's job", () => {
    const foreign = cartCodeFor('someone-else', RESTAURANT_ID);

    // This function reports what the code SAYS. `fetchCustomerCarts` is what
    // decides whether that customer is the one we asked about; putting the
    // check here would make the parser lie about the data it was given.
    expect(parseCartCode(foreign)).toEqual({
      customerId: 'someone-else',
      restaurantId: RESTAURANT_ID,
    });
  });
});

describe('customerCartCodePrefix', () => {
  it('ends with the separator so one customer id cannot prefix another', () => {
    expect(customerCartCodePrefix(CUSTOMER_ID)).toBe(`${CART_CODE_PREFIX}:${CUSTOMER_ID}:`);
  });

  it('is a prefix of every code that customer owns', () => {
    expect(cartCodeFor(CUSTOMER_ID, RESTAURANT_ID)).toContain(
      customerCartCodePrefix(CUSTOMER_ID)
    );
  });
});

describe('toCartInput', () => {
  const base = {
    customerId: CUSTOMER_ID,
    restaurantId: RESTAURANT_ID,
    restaurantName: 'Baguette & Baguette',
  };

  it('collapses two lines of the same product into ONE item with summed quantity', () => {
    const input = toCartInput({
      ...base,
      lines: [
        line({ foodId: PIZZA, quantity: 1, addons: [{ id: 'a1', name: 'Cheese', price: 2 }] }),
        line({ foodId: PIZZA, quantity: 2, addons: [] }),
      ],
    });

    // Two rows for one product would read back as the pizza appearing twice.
    expect(input.items).toEqual([{ productId: PIZZA, quantity: 3 }]);
  });

  it('keeps two different products as two items with their own quantities', () => {
    const input = toCartInput({
      ...base,
      lines: [
        line({ foodId: PIZZA, quantity: 2 }),
        line({ foodId: SALAD, quantity: 5 }),
      ],
    });

    expect(input.items).toHaveLength(2);
    expect(input.items).toEqual(
      expect.arrayContaining([
        { productId: PIZZA, quantity: 2 },
        { productId: SALAD, quantity: 5 },
      ])
    );
  });

  it('excludes a line whose quantity is 0', () => {
    const input = toCartInput({
      ...base,
      lines: [line({ foodId: PIZZA, quantity: 0 }), line({ foodId: SALAD, quantity: 1 })],
    });

    expect(input.items).toEqual([{ productId: SALAD, quantity: 1 }]);
  });

  it('excludes a line with no backend product id — it would 500 the whole cart', () => {
    const input = toCartInput({
      ...base,
      lines: [line({ foodId: '', quantity: 2 }), line({ foodId: PIZZA, quantity: 1 })],
    });

    expect(input.items).toEqual([{ productId: PIZZA, quantity: 1 }]);
  });

  it('maps an empty group to items: [], never undefined', () => {
    const input = toCartInput({ ...base, lines: [] });

    expect(input.items).toEqual([]);
  });

  it('always carries a non-empty code', () => {
    const input = toCartInput({ ...base, lines: [] });

    expect(input.code).toBeTruthy();
    expect(input.code).toBe(cartCodeFor(CUSTOMER_ID, RESTAURANT_ID));
  });

  it('names the cart after the restaurant — the one label that is persisted', () => {
    const input = toCartInput({ ...base, lines: [line({ foodId: PIZZA })] });

    expect(input.name).toBe('Baguette & Baguette');
  });

  it('sends no status, addon, note or price key anywhere in the payload', () => {
    const input = toCartInput({
      ...base,
      lines: [
        line({
          foodId: PIZZA,
          quantity: 1,
          unitPrice: 12,
          note: 'no onions',
          addons: [{ id: 'a1', name: 'Cheese', price: 2 }],
        }),
      ],
    });

    const serialized = JSON.stringify(input);
    for (const forbidden of ['status', 'addons', 'note', 'price', 'unitPrice', 'basePrice']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(Object.keys(input.items[0]).sort()).toEqual(['productId', 'quantity']);
  });

  it('omits `comment` entirely when none was given', () => {
    const input = toCartInput({ ...base, lines: [line({ foodId: PIZZA })] });

    expect('comment' in input).toBe(false);
  });
});

describe('syncSignature', () => {
  it('is stable across line reordering', () => {
    const a = [line({ foodId: PIZZA, quantity: 1 }), line({ foodId: SALAD, quantity: 2 })];
    const b = [line({ foodId: SALAD, quantity: 2 }), line({ foodId: PIZZA, quantity: 1 })];

    expect(syncSignature(a)).toBe(syncSignature(b));
  });

  it('changes when a quantity changes', () => {
    const before = [line({ foodId: PIZZA, quantity: 1 })];
    const after = [line({ foodId: PIZZA, quantity: 2 })];

    expect(syncSignature(before)).not.toBe(syncSignature(after));
  });

  it('changes when a product is added', () => {
    const before = [line({ foodId: PIZZA, quantity: 1 })];
    const after = [...before, line({ foodId: SALAD, quantity: 1 })];

    expect(syncSignature(before)).not.toBe(syncSignature(after));
  });

  it('changes when a product is removed', () => {
    const before = [line({ foodId: PIZZA, quantity: 1 }), line({ foodId: SALAD, quantity: 1 })];
    const after = [line({ foodId: PIZZA, quantity: 1 })];

    expect(syncSignature(before)).not.toBe(syncSignature(after));
  });

  it('is UNCHANGED when only a note changes — the backend cannot store one', () => {
    const before = [line({ foodId: PIZZA, quantity: 1, note: undefined })];
    const after = [line({ foodId: PIZZA, quantity: 1, note: 'extra crispy' })];

    expect(syncSignature(before)).toBe(syncSignature(after));
  });

  it('is UNCHANGED when only an addon set changes', () => {
    const before = [line({ foodId: PIZZA, quantity: 1, addons: [] })];
    const after = [
      line({ foodId: PIZZA, quantity: 1, addons: [{ id: 'a1', name: 'Cheese', price: 2 }] }),
    ];

    expect(syncSignature(before)).toBe(syncSignature(after));
  });

  it('is UNCHANGED when two lines of one product merge but the total does not move', () => {
    // The payload is byte-identical either way, so a resync would be pure waste.
    const split = [
      line({ foodId: PIZZA, quantity: 1, addons: [{ id: 'a1', name: 'Cheese', price: 2 }] }),
      line({ foodId: PIZZA, quantity: 2, addons: [] }),
    ];
    const merged = [line({ foodId: PIZZA, quantity: 3, addons: [] })];

    expect(syncSignature(split)).toBe(syncSignature(merged));
  });

  it('maps an empty cart to an empty signature', () => {
    expect(syncSignature([])).toBe('');
  });
});
