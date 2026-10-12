import type { CartOutput } from '@/schemas/cart';
import {
  lineKey,
  planCartSync,
  serverSyncSignature,
  syncSignature,
  toCartQuote,
  toCheckoutBlocker,
} from '@/services/api/cart-view-model';
import type { CartLine } from '@/store/cart-store';

const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const RESTAURANT_B = 'b3b3b3b3-2222-3333-4444-777777777777';
const PIZZA = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';
const SALAD = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const CHEESE = 'a4a4a4a4-1111-2222-3333-444444444444';
const OLIVES = 'a5a5a5a5-1111-2222-3333-444444444444';

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    lineId: 'line-1',
    foodId: PIZZA,
    name: 'Pizza',
    unitPrice: 9.5,
    basePrice: 9.5,
    quantity: 1,
    addons: [],
    restaurantId: RESTAURANT_ID,
    restaurantName: 'Baguette & Baguette',
    ...overrides,
  };
}

function cart(items: NonNullable<CartOutput['items']>, extra: Partial<CartOutput> = {}): CartOutput {
  return { id: 'cart-1', items, ...extra };
}

describe('lineKey', () => {
  it('ignores option order and note case, like the backend merge rule', () => {
    expect(lineKey(PIZZA, [CHEESE, OLIVES], 'No Onions ')).toBe(
      lineKey(PIZZA, [OLIVES, CHEESE], 'no onions')
    );
  });

  it('tells two option sets of one product apart', () => {
    expect(lineKey(PIZZA, [CHEESE])).not.toBe(lineKey(PIZZA, []));
  });
});

describe('planCartSync', () => {
  it('adds every line to an empty server cart, with its options and note', () => {
    const ops = planCartSync(
      [line({ quantity: 2, note: 'Well done', addons: [{ id: CHEESE, name: 'Cheese', price: 2 }] })],
      cart([])
    );

    expect(ops).toEqual([
      {
        type: 'add',
        input: {
          productId: PIZZA,
          quantity: 2,
          note: 'Well done',
          attributes: [{ attributeId: CHEESE, checked: true }],
        },
      },
    ]);
  });

  it('does nothing when the server already holds the cart', () => {
    const ops = planCartSync(
      [line({ quantity: 2 })],
      cart([{ id: 'item-1', productId: PIZZA, quantity: 2, options: [] }])
    );

    expect(ops).toEqual([]);
  });

  it('updates a quantity in place rather than removing and re-adding', () => {
    const ops = planCartSync(
      [line({ quantity: 3 })],
      cart([{ id: 'item-1', productId: PIZZA, quantity: 1, options: [] }])
    );

    expect(ops).toEqual([{ type: 'update', itemId: 'item-1', quantity: 3 }]);
  });

  it('removes a line the customer deleted — and removes before it adds', () => {
    const ops = planCartSync(
      [line({ foodId: SALAD, restaurantId: RESTAURANT_B })],
      cart([{ id: 'item-1', productId: PIZZA, quantity: 1, options: [] }])
    );

    expect(ops.map((op) => op.type)).toEqual(['remove', 'add']);
    expect(ops[0]).toEqual({ type: 'remove', itemId: 'item-1' });
  });

  it('keeps two configurations of one dish as two server lines', () => {
    const ops = planCartSync(
      [
        line({ lineId: 'plain' }),
        line({ lineId: 'cheese', addons: [{ id: CHEESE, name: 'Cheese', price: 2 }] }),
      ],
      cart([{ id: 'item-1', productId: PIZZA, quantity: 1, options: [] }])
    );

    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ type: 'add', input: { attributes: [{ attributeId: CHEESE }] } });
  });

  it('never touches a free gift the promotion engine added', () => {
    const ops = planCartSync(
      [],
      cart([{ id: 'gift-1', productId: SALAD, quantity: 1, giftItem: true, options: [] }])
    );

    expect(ops).toEqual([]);
  });

  it('removes a duplicate server line instead of letting it double the order', () => {
    const ops = planCartSync(
      [line()],
      cart([
        { id: 'item-1', productId: PIZZA, quantity: 1, options: [] },
        { id: 'item-2', productId: PIZZA, quantity: 1, options: [] },
      ])
    );

    expect(ops).toEqual([{ type: 'remove', itemId: 'item-2' }]);
  });

  it('empties the server cart when the local one is empty', () => {
    const ops = planCartSync([], cart([{ id: 'item-1', productId: PIZZA, quantity: 1 }]));

    expect(ops).toEqual([{ type: 'remove', itemId: 'item-1' }]);
  });
});

describe('syncSignature / serverSyncSignature', () => {
  it('agree once the server holds the local cart', () => {
    const lines = [line({ quantity: 2, note: 'Hot', addons: [{ id: CHEESE, name: 'Cheese', price: 2 }] })];
    const server = cart([
      {
        id: 'item-1',
        productId: PIZZA,
        quantity: 2,
        note: 'hot',
        options: [{ attributeId: CHEESE, name: 'Cheese', price: 2 }],
      },
    ]);

    expect(serverSyncSignature(server)).toBe(syncSignature(lines));
  });

  it('change with a note — the backend stores notes now', () => {
    expect(syncSignature([line({ note: 'Hot' })])).not.toBe(syncSignature([line()]));
  });

  it('ignore free gifts on the server side', () => {
    const server = cart([
      { id: 'item-1', productId: PIZZA, quantity: 1, options: [] },
      { id: 'gift-1', productId: SALAD, quantity: 1, giftItem: true, options: [] },
    ]);

    expect(serverSyncSignature(server)).toBe(syncSignature([line()]));
  });
});

describe('toCartQuote', () => {
  const priced = cart(
    [{ id: 'item-1', productId: PIZZA, quantity: 2, options: [] }],
    {
      currency: 'TND',
      subtotal: 19,
      discountTotal: 1,
      total: 23.4,
      serviceFee: { amount: 1, orderCount: 2 },
      additionalFees: [
        { code: 'NIGHT', label: 'Night surcharge', scope: 'PER_CART', amount: 1 },
        { code: 'ZERO', label: 'Nothing', scope: 'PER_CART', amount: 0 },
      ],
      orders: [
        { restaurantId: RESTAURANT_ID, restaurantName: 'A', subtotal: 10, discount: 1, deliveryFee: 1.5, serviceFeeShare: 0.5, total: 11.5 },
        { restaurantId: RESTAURANT_B, restaurantName: 'B', subtotal: 9, discount: 0, deliveryFee: 1.9, serviceFeeShare: 0.5, total: 11.9 },
      ],
      blockers: [],
    }
  );

  it('sums the delivery fee of every order and keeps the service fee whole', () => {
    const quote = toCartQuote(priced);

    expect(quote.deliveryFee).toBeCloseTo(3.4, 5);
    expect(quote.serviceFee).toBe(1);
    expect(quote.total).toBe(23.4);
    expect(quote.orders.map((order) => order.serviceFee)).toEqual([0.5, 0.5]);
  });

  it('lists additional fees by their rule name and drops zero ones', () => {
    expect(toCartQuote(priced).additionalFees).toEqual([
      { code: 'NIGHT', label: 'Night surcharge', amount: 1 },
    ]);
  });

  it('marks the delivery fee unpriced while the address has no coordinates', () => {
    expect(toCartQuote(priced).deliveryPriced).toBe(true);
    expect(toCartQuote({ ...priced, blockers: ['NO_ADDRESS_COORDINATES'] }).deliveryPriced).toBe(false);
  });

  it('carries the signature of the cart it priced', () => {
    expect(toCartQuote(priced).signature).toBe(syncSignature([line({ quantity: 2 })]));
  });
});

describe('toCheckoutBlocker', () => {
  it('maps every backend CartBlocker, and an unknown one to "unknown"', () => {
    expect(toCheckoutBlocker('EMPTY_CART')).toBe('empty-cart');
    expect(toCheckoutBlocker('NO_DELIVERY_ADDRESS')).toBe('no-address');
    expect(toCheckoutBlocker('NO_ADDRESS_COORDINATES')).toBe('no-address-coords');
    expect(toCheckoutBlocker('RESTAURANT_LOCATION_MISSING')).toBe('no-restaurant-coords');
    expect(toCheckoutBlocker('SOMETHING_NEW')).toBe('unknown');
  });
});
