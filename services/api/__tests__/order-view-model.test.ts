import {
  ORDER_CODE_PREFIX,
  buildOrderComment,
  checkoutBlockers,
  customerOrderCodePrefix,
  orderCodeFor,
  orderTotals,
  parseOrderComment,
  parseOrderCodeCustomerId,
  toOrderInput,
} from '@/services/api/order-view-model';
import type { BackendAddress } from '@/services/api/types';
import type { CartLine } from '@/store/cart-store';

const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const PIZZA = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';
const SALAD = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const EXTRA_CHEESE = 'a4a4a4a4-1111-2222-3333-444444444444';
const NOW = 1_756_000_000_000;

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

function input(lines: CartLine[], overrides = {}) {
  return toOrderInput({
    customerId: CUSTOMER_ID,
    restaurantId: RESTAURANT_ID,
    restaurantName: 'Baguette & Baguette',
    lines,
    paymentMethod: 'cash',
    now: NOW,
    ...overrides,
  });
}

const ADDRESS: BackendAddress = {
  formattedAddress: '12 Rue de Marseille, Tunis',
  coordinates: { latitude: 36.8529, longitude: 10.3376 },
};

const RESTAURANT_COORDS = { latitude: 36.8065, longitude: 10.1815 };

describe('orderCodeFor', () => {
  it('is unique per checkout attempt, not per customer/restaurant pair', () => {
    // Contrast with `cartCodeFor`, which is stable for a pair: every checkout
    // is a new order, and two orders sharing a code are indistinguishable.
    const first = orderCodeFor(CUSTOMER_ID, RESTAURANT_ID, NOW);
    const second = orderCodeFor(CUSTOMER_ID, RESTAURANT_ID, NOW + 1);

    expect(first).toBe(`${ORDER_CODE_PREFIX}:${CUSTOMER_ID}:${RESTAURANT_ID}:${NOW}`);
    expect(second).not.toBe(first);
  });
});

describe('buildOrderComment', () => {
  it('names the payment method when there is no cart comment', () => {
    expect(buildOrderComment('cash')).toBe('Payment: Cash');
    expect(buildOrderComment('sim')).toBe('Payment: SIM Credits');
  });

  it('puts the cart comment on its own line after the payment line', () => {
    expect(buildOrderComment('bank', 'Ring the bell')).toBe(
      'Payment: Bank\nRing the bell'
    );
  });

  it('keeps a multi-line cart comment intact', () => {
    const note = 'Ring the bell\nSecond floor, no lift';

    expect(buildOrderComment('points', note)).toBe(
      `Payment: Hungry Points\n${note}`
    );
  });

  it('ignores a blank cart comment rather than emitting a trailing newline', () => {
    expect(buildOrderComment('cash', '   ')).toBe('Payment: Cash');
  });
});

describe('toOrderInput', () => {
  it('maps quantity and product id onto the input nesting key', () => {
    const payload = input([line({ foodId: PIZZA, quantity: 3 })]);

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].quantity).toBe(3);
    // `orderedProduct` on the way in; the response calls it `product`.
    expect(payload.items[0].orderedProduct.productId).toBe(PIZZA);
  });

  it('turns selected addons into attributes[].attributeId', () => {
    const payload = input([
      line({
        foodId: PIZZA,
        addons: [{ id: EXTRA_CHEESE, name: 'Extra cheese', price: 2 }],
      }),
    ]);

    expect(payload.items[0].orderedProduct.attributes).toEqual([
      {
        code: EXTRA_CHEESE,
        name: 'Extra cheese',
        attributeId: EXTRA_CHEESE,
        checked: true,
      },
    ]);
  });

  it('emits [] — never undefined — for a line with no addons', () => {
    const payload = input([line({ foodId: PIZZA })]);

    expect(payload.items[0].orderedProduct.attributes).toEqual([]);
  });

  it('keeps two differently-configured lines of one product as TWO items', () => {
    // The opposite of `toCartInput`, which collapses these into one line
    // because a `CartItem` has nowhere to put addons. An `OrderItem` does.
    const payload = input([
      line({
        foodId: PIZZA,
        lineId: 'pizza-cheese',
        addons: [{ id: EXTRA_CHEESE, name: 'Extra cheese', price: 2 }],
      }),
      line({ foodId: PIZZA, lineId: 'pizza-plain' }),
    ]);

    expect(payload.items).toHaveLength(2);
    expect(payload.items[0].orderedProduct.attributes).toHaveLength(1);
    expect(payload.items[1].orderedProduct.attributes).toEqual([]);
  });

  it('drops a line whose quantity is zero or negative', () => {
    const payload = input([
      line({ foodId: PIZZA, quantity: 0 }),
      line({ foodId: SALAD, lineId: 'salad', quantity: -1 }),
      line({ foodId: SALAD, lineId: 'salad-2', quantity: 2 }),
    ]);

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].orderedProduct.productId).toBe(SALAD);
  });

  it('drops a line with no backend product id', () => {
    const payload = input([line({ foodId: '' })]);

    expect(payload.items).toEqual([]);
  });

  it('always carries a non-empty code, restaurantId and customerId', () => {
    const payload = input([line({ foodId: PIZZA })]);

    expect(payload.code).toBeTruthy();
    expect(payload.restaurantId).toBe(RESTAURANT_ID);
    expect(payload.customerId).toBe(CUSTOMER_ID);
  });

  it('records the payment method in the comment and nowhere else', () => {
    const payload = input([line({ foodId: PIZZA })], { paymentMethod: 'bank' });

    expect(payload.comment).toBe('Payment: Bank');
  });

  it('emits no status, price, total or paymentMethod key anywhere', () => {
    const payload = input([
      line({
        foodId: PIZZA,
        addons: [{ id: EXTRA_CHEESE, name: 'Extra cheese', price: 2 }],
      }),
    ]);

    // Serialised, so nested keys are covered too: the backend has no such
    // column, and emitting one would imply it charges something.
    const serialised = JSON.stringify(payload);
    for (const key of [
      'status',
      'price',
      'unitPrice',
      'basePrice',
      'total',
      'subtotal',
      'fee',
      'paymentMethod',
    ]) {
      expect(serialised).not.toContain(`"${key}"`);
    }
  });
});

describe('orderTotals', () => {
  it('sums each line at its per-unit price times its quantity', () => {
    const totals = orderTotals([
      { unitPrice: 9.68, quantity: 2 },
      { unitPrice: 4.5, quantity: 1 },
    ]);

    expect(totals.subtotal).toBeCloseTo(23.86, 5);
  });

  it('adds the placeholder fees to reach the total', () => {
    const totals = orderTotals([{ unitPrice: 10, quantity: 1 }]);

    expect(totals.total).toBeCloseTo(
      totals.subtotal + totals.serviceFee + totals.deliveryFee,
      5
    );
  });

  it('charges nothing at all for an empty cart — not a fee on nothing', () => {
    expect(orderTotals([])).toEqual({
      subtotal: 0,
      serviceFee: 0,
      deliveryFee: 0,
      total: 0,
    });
  });

  it('prices the addons with the line, because unitPrice already includes them', () => {
    // The cart stores the per-unit price WITH the chosen addons, so a line at
    // 9.68 + 2 of cheese is one 11.68 unit, not two numbers to add here.
    expect(orderTotals([{ unitPrice: 11.68, quantity: 2 }]).subtotal).toBeCloseTo(
      23.36,
      5
    );
  });
});

describe('checkoutBlockers', () => {
  const VALID = {
    customerId: CUSTOMER_ID,
    address: ADDRESS,
    restaurantId: RESTAURANT_ID,
    restaurantCoordinates: RESTAURANT_COORDS,
    lines: [line({ foodId: PIZZA })],
  };

  it('returns [] when the order can be attempted', () => {
    expect(checkoutBlockers(VALID)).toEqual([]);
  });

  it('reports no-customer on its own', () => {
    expect(checkoutBlockers({ ...VALID, customerId: null })).toEqual([
      'no-customer',
    ]);
  });

  it('reports no-address on its own', () => {
    expect(checkoutBlockers({ ...VALID, address: null })).toEqual(['no-address']);
  });

  it('reports no-address-coords, not no-address, for an address without coordinates', () => {
    // The two route the user to different fixes: add an address at all, versus
    // re-pick an existing one on the map.
    const blockers = checkoutBlockers({
      ...VALID,
      address: { formattedAddress: '12 Rue de Marseille, Tunis' },
    });

    expect(blockers).toEqual(['no-address-coords']);
  });

  it('treats a half-populated coordinate pair as no-address-coords', () => {
    const blockers = checkoutBlockers({
      ...VALID,
      address: { coordinates: { latitude: 36.85, longitude: null } },
    });

    expect(blockers).toEqual(['no-address-coords']);
  });

  it('reports no-restaurant on its own', () => {
    expect(checkoutBlockers({ ...VALID, restaurantId: null })).toEqual([
      'no-restaurant',
    ]);
  });

  it('reports no-restaurant-coords on its own', () => {
    expect(checkoutBlockers({ ...VALID, restaurantCoordinates: null })).toEqual([
      'no-restaurant-coords',
    ]);
  });

  it('reports empty-cart on its own', () => {
    expect(checkoutBlockers({ ...VALID, lines: [] })).toEqual(['empty-cart']);
  });

  it('treats a cart of unsendable lines as empty', () => {
    const blockers = checkoutBlockers({
      ...VALID,
      lines: [line({ foodId: PIZZA, quantity: 0 })],
    });

    expect(blockers).toEqual(['empty-cart']);
  });

  it('reports every blocker at once rather than stopping at the first', () => {
    const blockers = checkoutBlockers({
      customerId: null,
      address: null,
      restaurantId: null,
      restaurantCoordinates: null,
      lines: [],
    });

    expect(blockers).toEqual([
      'no-customer',
      'no-address',
      'no-restaurant',
      'empty-cart',
    ]);
  });
});

describe('customerOrderCodePrefix', () => {
  it('ends on the separator so one customer id cannot match a longer one', () => {
    // `SpecificationUtils` renders LIKE as `%value%` — a substring match.
    expect(customerOrderCodePrefix(CUSTOMER_ID)).toBe(
      `${ORDER_CODE_PREFIX}:${CUSTOMER_ID}:`
    );
  });
});

describe('parseOrderCodeCustomerId', () => {
  it('reads the customer id back out of a code this app minted', () => {
    const code = orderCodeFor(CUSTOMER_ID, RESTAURANT_ID, 1756000000000);
    expect(parseOrderCodeCustomerId(code)).toBe(CUSTOMER_ID);
  });

  it('returns null for anything this app did not write', () => {
    // `/orders/all` returns rows written by other clients; they must be
    // skipped, never mis-attributed.
    expect(parseOrderCodeCustomerId('hc:someone:else')).toBeNull();
    expect(parseOrderCodeCustomerId('ho:truncated')).toBeNull();
    expect(parseOrderCodeCustomerId(null)).toBeNull();
  });
});

describe('parseOrderComment', () => {
  it('round-trips what buildOrderComment wrote', () => {
    const parsed = parseOrderComment(buildOrderComment('cash', 'Ring twice'));
    expect(parsed).toEqual({ payment: 'Cash', note: 'Ring twice' });
  });

  it('reads a payment-only comment', () => {
    expect(parseOrderComment(buildOrderComment('bank'))).toEqual({
      payment: 'Bank',
      note: null,
    });
  });

  it('treats a comment written by anything else as a plain note', () => {
    // Never present a foreign comment as a payment the customer chose.
    expect(parseOrderComment('Leave at the door')).toEqual({
      payment: null,
      note: 'Leave at the door',
    });
  });

  it('is empty for no comment at all', () => {
    expect(parseOrderComment(null)).toEqual({ payment: null, note: null });
  });
});
