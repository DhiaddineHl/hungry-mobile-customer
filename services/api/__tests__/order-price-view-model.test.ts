import type { CustomerOrderLine } from '@/services/api/order-list-view-model';
import { priceOrder } from '@/services/api/order-price-view-model';
import type { OrderPriceSnapshot } from '@/store/order-price-store';

/**
 * Which of the two price sources answers, and what each is allowed to claim.
 *
 * The backend keeps no money on an order at all, so every case here is about
 * not overstating what the app knows: a receipt is exact, menu prices are
 * today's, and a partial answer is never dressed up as a total.
 */

function line(partial: Partial<CustomerOrderLine> = {}): CustomerOrderLine {
  return {
    id: 'item-1',
    name: 'Crispy Chicken',
    quantity: 1,
    productId: 'prod-1',
    ...partial,
  };
}

function snapshot(partial: Partial<OrderPriceSnapshot> = {}): OrderPriceSnapshot {
  return {
    lines: [
      {
        lineId: 'cart-line-1',
        foodId: 'prod-1',
        name: 'Crispy Chicken',
        quantity: 1,
        unitPrice: 9.68,
        basePrice: 9.68,
        addons: [],
      },
    ],
    subtotal: 9.68,
    serviceFee: 3,
    deliveryFee: 0,
    total: 12.68,
    savedAt: '2026-09-01T12:00:00.000Z',
    ...partial,
  };
}

describe('priceOrder — from this device’s receipt', () => {
  it('prices a line from the receipt and reports the source', () => {
    const pricing = priceOrder({
      lines: [line({ code: 'cart-line-1' })],
      snapshot: snapshot(),
    });

    expect(pricing.source).toBe('checkout');
    expect(pricing.byLine.get('item-1')).toEqual({ unit: 9.68, total: 9.68 });
  });

  it('multiplies by the quantity the SERVER returned, not the receipt’s', () => {
    // The order is the record of what was placed; the receipt only knows what
    // a unit cost.
    const pricing = priceOrder({
      lines: [line({ code: 'cart-line-1', quantity: 3 })],
      snapshot: snapshot(),
    });

    expect(pricing.byLine.get('item-1')).toEqual({ unit: 9.68, total: 9.68 * 3 });
  });

  it('carries the fees and total the customer actually agreed to', () => {
    const pricing = priceOrder({ lines: [line()], snapshot: snapshot() });

    expect(pricing.totals).toEqual({
      subtotal: 9.68,
      serviceFee: 3,
      deliveryFee: 0,
      total: 12.68,
    });
  });

  it('still reports the total when the server returned no lines at all', () => {
    // The plan §2.2 defect: a good order re-reads with `items: []`. What it
    // cost is true regardless.
    const pricing = priceOrder({ lines: [], snapshot: snapshot() });

    expect(pricing.totals?.total).toBe(12.68);
    expect(pricing.byLine.size).toBe(0);
  });

  it('matches by the item code, which is the cart line id that was sent', () => {
    const pricing = priceOrder({
      lines: [line({ code: 'cart-line-1', productId: 'a-different-product' })],
      snapshot: snapshot(),
    });

    expect(pricing.byLine.get('item-1')?.unit).toBe(9.68);
  });

  it('falls back to the product when an item comes back with no code', () => {
    const pricing = priceOrder({
      lines: [line({ code: undefined })],
      snapshot: snapshot(),
    });

    expect(pricing.byLine.get('item-1')?.unit).toBe(9.68);
  });

  it('gives two lines of the same dish their own prices, not the first one twice', () => {
    // Same pizza, one with extra cheese: same product id, different codes and
    // different prices. Matching by product alone would price both at 9.68.
    const pricing = priceOrder({
      lines: [
        line({ id: 'item-1', code: 'cart-line-1' }),
        line({ id: 'item-2', code: 'cart-line-2' }),
      ],
      snapshot: snapshot({
        lines: [
          {
            lineId: 'cart-line-1',
            foodId: 'prod-1',
            name: 'Pizza',
            quantity: 1,
            unitPrice: 9.68,
            basePrice: 9.68,
            addons: [],
          },
          {
            lineId: 'cart-line-2',
            foodId: 'prod-1',
            name: 'Pizza + cheese',
            quantity: 1,
            unitPrice: 11.68,
            basePrice: 9.68,
            addons: [{ name: 'Extra cheese', price: 2 }],
          },
        ],
      }),
    });

    expect(pricing.byLine.get('item-1')?.unit).toBe(9.68);
    expect(pricing.byLine.get('item-2')?.unit).toBe(11.68);
  });

  it('consumes each receipt line once when neither carries a code', () => {
    const pricing = priceOrder({
      lines: [line({ id: 'item-1' }), line({ id: 'item-2' })],
      snapshot: snapshot({
        lines: [
          {
            lineId: 'cart-line-1',
            foodId: 'prod-1',
            name: 'Pizza',
            quantity: 1,
            unitPrice: 9.68,
            basePrice: 9.68,
            addons: [],
          },
          {
            lineId: 'cart-line-2',
            foodId: 'prod-1',
            name: 'Pizza + cheese',
            quantity: 1,
            unitPrice: 11.68,
            basePrice: 9.68,
            addons: [],
          },
        ],
      }),
    });

    expect(pricing.byLine.get('item-1')?.unit).toBe(9.68);
    expect(pricing.byLine.get('item-2')?.unit).toBe(11.68);
  });

  it('leaves a line the receipt does not cover unpriced rather than guessing', () => {
    const pricing = priceOrder({
      lines: [line({ id: 'item-1', code: 'cart-line-1' }), line({ id: 'item-2', code: 'x', productId: 'prod-9' })],
      snapshot: snapshot(),
    });

    expect(pricing.byLine.has('item-2')).toBe(false);
  });

  it('never mixes menu prices into a receipt', () => {
    // The receipt is what was paid; a menu price beside it would be a
    // different claim wearing the same styling.
    const pricing = priceOrder({
      lines: [line({ id: 'item-1', code: 'unmatched', productId: 'prod-9' })],
      snapshot: snapshot(),
      menuUnitPrices: new Map([['prod-9', 5]]),
    });

    expect(pricing.source).toBe('checkout');
    expect(pricing.byLine.has('item-1')).toBe(false);
  });
});

describe('priceOrder — from today’s menu', () => {
  it('prices lines from the menu when there is no receipt', () => {
    const pricing = priceOrder({
      lines: [line({ quantity: 2 })],
      menuUnitPrices: new Map([['prod-1', 4.5]]),
    });

    expect(pricing.source).toBe('menu');
    expect(pricing.byLine.get('item-1')).toEqual({ unit: 4.5, total: 9 });
  });

  it('totals the items when every line resolved', () => {
    const pricing = priceOrder({
      lines: [line({ id: 'item-1' }), line({ id: 'item-2', productId: 'prod-2' })],
      menuUnitPrices: new Map([
        ['prod-1', 4.5],
        ['prod-2', 5.5],
      ]),
    });

    expect(pricing.itemsTotal).toBe(10);
  });

  it('refuses a total when a line could not be priced', () => {
    // A sum over some of the lines is not what the order came to.
    const pricing = priceOrder({
      lines: [line({ id: 'item-1' }), line({ id: 'item-2', productId: 'prod-2' })],
      menuUnitPrices: new Map([
        ['prod-1', 4.5],
        ['prod-2', null],
      ]),
    });

    expect(pricing.byLine.get('item-1')?.unit).toBe(4.5);
    expect(pricing.byLine.has('item-2')).toBe(false);
    expect(pricing.itemsTotal).toBeNull();
  });

  it('never offers order totals from menu prices — the fees were never recorded', () => {
    const pricing = priceOrder({
      lines: [line()],
      menuUnitPrices: new Map([['prod-1', 4.5]]),
    });

    expect(pricing.totals).toBeNull();
  });

  it('treats a product with no applicable price as unknown, not free', () => {
    const pricing = priceOrder({
      lines: [line()],
      menuUnitPrices: new Map([['prod-1', null]]),
    });

    expect(pricing.source).toBe('none');
    expect(pricing.byLine.size).toBe(0);
  });
});

describe('priceOrder — nothing to say', () => {
  it('reports no source when there is neither a receipt nor a menu price', () => {
    const pricing = priceOrder({ lines: [line()] });

    expect(pricing).toEqual({
      source: 'none',
      byLine: new Map(),
      totals: null,
      itemsTotal: null,
    });
  });

  it('reports no source for an order with no lines and no receipt', () => {
    const pricing = priceOrder({
      lines: [],
      menuUnitPrices: new Map([['prod-1', 4.5]]),
    });

    expect(pricing.source).toBe('none');
  });
});
