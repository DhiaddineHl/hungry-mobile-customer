import type { OrderOutput } from '@/schemas/order';
import {
  formatOrderDate,
  orderBucket,
  orderItemCount,
  orderProgressStep,
  orderReference,
  orderStatusLabel,
  sortByNewest,
  splitOrders,
  toCustomerOrder,
  type CustomerOrder,
} from '@/services/api/order-list-view-model';

const ORDER_ID = '9a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d';
const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const PRODUCT_ID = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';

function output(overrides: Partial<OrderOutput> = {}): OrderOutput {
  return {
    id: ORDER_ID,
    code: 'ORD-20260828-K3F9QX',
    name: 'Baguette & Baguette',
    restaurantId: RESTAURANT_ID,
    restaurantName: 'Baguette & Baguette',
    customerId: CUSTOMER_ID,
    status: 'CREATED',
    comment: 'Payment: Cash',
    createdAt: '2026-08-28T18:00:00',
    items: [
      {
        id: 'item-1',
        name: 'Crispy Chicken',
        quantity: 2,
        product: { productId: PRODUCT_ID, name: 'Crispy Chicken', attributes: [] },
      },
    ],
    ...overrides,
  };
}

function view(overrides: Partial<CustomerOrder> = {}): CustomerOrder {
  return { ...toCustomerOrder(output()), ...overrides };
}

describe('toCustomerOrder', () => {
  it('reads the lines the server returned', () => {
    const order = toCustomerOrder(output());

    expect(order.hasLineDetail).toBe(true);
    expect(order.lines).toEqual([
      {
        id: 'item-1',
        name: 'Crispy Chicken',
        quantity: 2,
        productId: PRODUCT_ID,
        gift: false,
        unitPrice: undefined,
        total: undefined,
        optionsText: undefined,
      },
    ]);
  });

  it('reads each line\'s price and chosen options from the order itself', () => {
    const order = toCustomerOrder(
      output({
        items: [
          {
            id: 'item-1',
            quantity: 2,
            unitPrice: 15.5,
            total: 31,
            product: {
              productId: PRODUCT_ID,
              name: 'Margherita',
              attributes: [{ name: 'Extra cheese', price: 1 }, { name: 'Olives', price: 0.5 }],
            },
          },
        ],
      })
    );

    expect(order.lines[0]).toMatchObject({ unitPrice: 15.5, total: 31, optionsText: 'Extra cheese, Olives', gift: false });
  });

  it('marks a free gift', () => {
    const order = toCustomerOrder(
      output({ items: [{ id: 'g', quantity: 1, unitPrice: 0, total: 0, gift: true, product: { productId: PRODUCT_ID, attributes: [] } }] })
    );

    expect(order.lines[0].gift).toBe(true);
    expect(order.lines[0].total).toBe(0);
  });

  it('marks an order with no returned lines as missing detail, not as empty', () => {
    // The backend never sets the `order_item.order_id` back-reference, so a
    // real order re-reads with `items: []` (plan §2.2).
    const order = toCustomerOrder(output({ items: [] }));

    expect(order.hasLineDetail).toBe(false);
    expect(order.lines).toEqual([]);
  });

  it('falls back to the order name when the restaurant is not expanded', () => {
    const order = toCustomerOrder(output({ restaurantName: null }));
    expect(order.restaurantName).toBe('Baguette & Baguette');
  });

  it('reads the payment method out of the comment this app wrote', () => {
    const order = toCustomerOrder(output({ comment: 'Payment: Cash\nRing twice' }));

    expect(order.paymentLabel).toBe('Cash');
    expect(order.note).toBe('Ring twice');
  });

  it('treats a comment written by anything else as a plain note', () => {
    const order = toCustomerOrder(output({ comment: 'Leave at the door' }));

    expect(order.paymentLabel).toBeNull();
    expect(order.note).toBe('Leave at the door');
  });

  it('keeps an unreadable status as unknown rather than inventing one', () => {
    const order = toCustomerOrder(output({ status: null }));
    expect(order.status).toBeNull();
  });
});

describe('orderBucket — decided by the backend status alone', () => {
  it('keeps every status the backend moves through in progress', () => {
    for (const status of ['CREATED', 'CONFIRMED', 'PREPARING', 'READY'] as const) {
      expect(orderBucket(view({ status }))).toBe('active');
    }
  });

  it('files a cancelled order under completed', () => {
    expect(orderBucket(view({ status: 'CANCELLED' }))).toBe('completed');
  });

  it('keeps an order with an unreadable status in progress', () => {
    // One that might still be coming must not be filed away as finished.
    expect(orderBucket(view({ status: null }))).toBe('active');
  });
});

describe('splitOrders', () => {
  it('preserves the incoming order within each bucket', () => {
    const first = view({ id: 'a', status: 'PREPARING' });
    const second = view({ id: 'b', status: 'CANCELLED' });
    const third = view({ id: 'c', status: 'READY' });

    const { active, completed } = splitOrders([first, second, third]);

    expect(active.map((o) => o.id)).toEqual(['a', 'c']);
    expect(completed.map((o) => o.id)).toEqual(['b']);
  });
});

describe('orderProgressStep', () => {
  it('maps each status to the stage the backend reports', () => {
    expect(orderProgressStep(view({ status: 'CREATED' }))).toBe(1);
    expect(orderProgressStep(view({ status: 'CONFIRMED' }))).toBe(2);
    expect(orderProgressStep(view({ status: 'PREPARING' }))).toBe(3);
    expect(orderProgressStep(view({ status: 'READY' }))).toBe(4);
  });

  it('gives a cancelled order no progress at all', () => {
    expect(orderProgressStep(view({ status: 'CANCELLED' }))).toBe(0);
  });

  it('credits an unknown status with the one stage that is certain', () => {
    expect(orderProgressStep(view({ status: null }))).toBe(1);
  });
});

describe('orderStatusLabel', () => {
  it('never dresses an unknown status as progress', () => {
    expect(orderStatusLabel(null)).toBe('Status unavailable');
    expect(orderStatusLabel(null, true)).toBe('Unknown');
  });

  it('says READY in terms the customer can act on', () => {
    expect(orderStatusLabel('READY', true)).toBe('On the way');
  });
});

describe('orderReference', () => {
  it('is derived from the id, the only value support can look up', () => {
    expect(orderReference(ORDER_ID)).toBe('#9A7B-6C5D');
  });
});

describe('orderItemCount', () => {
  it('counts units, not lines', () => {
    const order = view({
      lines: [
        { id: 'a', name: 'A', quantity: 2, gift: false },
        { id: 'b', name: 'B', quantity: 3, gift: false },
      ],
    });
    expect(orderItemCount(order)).toBe(5);
  });
});

describe('sortByNewest', () => {
  it('puts the most recent order first', () => {
    const older = view({ id: 'older', createdAt: '2026-08-27T18:00:00' });
    const newer = view({ id: 'newer', createdAt: '2026-08-28T18:00:00' });

    expect(sortByNewest([older, newer]).map((o) => o.id)).toEqual(['newer', 'older']);
  });

  it('sorts an order with no date last instead of dropping it', () => {
    const dated = view({ id: 'dated', createdAt: '2026-08-28T18:00:00' });
    const undated = view({ id: 'undated', createdAt: undefined });

    expect(sortByNewest([undated, dated]).map((o) => o.id)).toEqual([
      'dated',
      'undated',
    ]);
  });
});

describe('formatOrderDate', () => {
  it('renders an em dash rather than "Invalid Date"', () => {
    expect(formatOrderDate('not-a-date')).toBe('—');
    expect(formatOrderDate(null)).toBe('—');
  });
});

describe('the order\'s money', () => {
  it('reads the server\'s snapshot: subtotal, discounts, fees and total', () => {
    const order = toCustomerOrder(
      output({
        subtotal: 40,
        discountTotal: 4,
        deliveryFee: 1.5,
        serviceFee: 0.5,
        additionalFees: 1,
        total: 39,
        adjustments: [
          { type: 'PRODUCT_DISCOUNT', code: 'TEN_OFF', label: '10% off', amount: 4 },
          { type: 'DELIVERY_FEE', code: 'DELIVERY', label: 'Delivery', amount: 1.5 },
          { type: 'ADDITIONAL_FEE', code: 'NIGHT', label: 'Night surcharge', amount: 1 },
        ],
      })
    );

    expect(order.money).toMatchObject({ subtotal: 40, discountTotal: 4, deliveryFee: 1.5, serviceFee: 0.5, additionalFees: 1, total: 39 });
    expect(order.money?.adjustments.map((a) => [a.label, a.isDiscount])).toEqual([
      ['10% off', true],
      ['Delivery', false],
      ['Night surcharge', false],
    ]);
  });

  it('treats a fee the order does not have as zero', () => {
    const order = toCustomerOrder(output({ subtotal: 12, total: 12 }));

    expect(order.money).toMatchObject({ subtotal: 12, discountTotal: 0, deliveryFee: 0, serviceFee: 0, additionalFees: 0, total: 12 });
    expect(order.money?.adjustments).toEqual([]);
  });

  it('is null when the response carries no total at all, rather than inventing one', () => {
    expect(toCustomerOrder(output()).money).toBeNull();
  });

  it('falls back to a label from the code when an adjustment has none', () => {
    const order = toCustomerOrder(
      output({ total: 5, adjustments: [{ type: 'SERVICE_FEE', code: 'SERVICE', amount: 1 }] })
    );

    expect(order.money?.adjustments[0].label).toBe('SERVICE');
  });
});
