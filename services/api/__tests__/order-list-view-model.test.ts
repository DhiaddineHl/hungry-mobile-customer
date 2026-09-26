import type { OrderOutput } from '@/schemas/order';
import {
  formatOrderDate,
  needsDeliveryRead,
  orderBucket,
  orderItemCount,
  orderProgressStep,
  orderReference,
  orderStage,
  orderStatusLabel,
  sortByNewest,
  splitOrders,
  toCustomerOrder,
  withDeliveryStatus,
  type CustomerOrder,
} from '@/services/api/order-list-view-model';

const ORDER_ID = '9a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d';
const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const PRODUCT_ID = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';
/** A fixed "now", a few hours after the default `createdAt`. */
const NOW = new Date('2026-08-28T21:00:00').getTime();

function output(overrides: Partial<OrderOutput> = {}): OrderOutput {
  return {
    id: ORDER_ID,
    code: `ho:${CUSTOMER_ID}:${RESTAURANT_ID}:1756000000000`,
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
      { id: 'item-1', name: 'Crispy Chicken', quantity: 2, productId: PRODUCT_ID },
    ]);
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

describe('orderStage — the order and delivery statuses read together', () => {
  it('follows the restaurant through the order status', () => {
    expect(orderStage(view({ status: 'CREATED' }))).toBe('PLACED');
    expect(orderStage(view({ status: 'CONFIRMED' }))).toBe('CONFIRMED');
    expect(orderStage(view({ status: 'PREPARING' }))).toBe('PREPARING');
    expect(orderStage(view({ status: 'READY' }))).toBe('READY');
  });

  it('keeps a READY order waiting until the driver picks it up', () => {
    expect(orderStage(view({ status: 'READY', deliveryStatus: 'ACCEPTED' }))).toBe('READY');
  });

  it('puts the order on the way once the delivery is PICKED_UP', () => {
    // The backend closes the ORDER at pickup: FINISHED is not "delivered".
    expect(orderStage(view({ status: 'FINISHED', deliveryStatus: 'PICKED_UP' }))).toBe(
      'ON_THE_WAY'
    );
    // The two reads can disagree for a moment — the delivery wins.
    expect(orderStage(view({ status: 'READY', deliveryStatus: 'PICKED_UP' }))).toBe(
      'ON_THE_WAY'
    );
  });

  it('marks it delivered only once the driver confirms the drop-off', () => {
    expect(orderStage(view({ status: 'FINISHED', deliveryStatus: 'DELIVERED' }))).toBe(
      'DELIVERED'
    );
    expect(orderStage(view({ status: 'FINISHED', deliveryStatus: 'FINISHED' }))).toBe(
      'DELIVERED'
    );
  });

  it('reports a delivery that ended after pickup without arriving', () => {
    expect(orderStage(view({ status: 'FINISHED', deliveryStatus: 'FAILED' }))).toBe(
      'DELIVERY_FAILED'
    );
    expect(orderStage(view({ status: 'FINISHED', deliveryStatus: 'RETURNED' }))).toBe(
      'DELIVERY_FAILED'
    );
  });

  it('treats a recent FINISHED order with no delivery read yet as on the way', () => {
    const order = view({ status: 'FINISHED', createdAt: '2026-08-28T18:00:00' });
    expect(orderStage(order, NOW)).toBe('ON_THE_WAY');
  });

  it('closes an old FINISHED order without claiming it was delivered', () => {
    const order = view({ status: 'FINISHED', createdAt: '2026-08-20T18:00:00' });
    expect(orderStage(order, NOW)).toBe('COMPLETED');
  });

  it('reads the declined and cancelled orders from the order status alone', () => {
    expect(orderStage(view({ status: 'REJECTED' }))).toBe('REJECTED');
    expect(orderStage(view({ status: 'CANCELLED', deliveryStatus: 'ACCEPTED' }))).toBe(
      'CANCELLED'
    );
  });

  it('keeps an unreadable status unknown', () => {
    expect(orderStage(view({ status: null }))).toBe('UNKNOWN');
  });
});

describe('needsDeliveryRead', () => {
  it('reads the delivery from dispatch until the food has arrived', () => {
    expect(needsDeliveryRead(view({ status: 'CREATED' }), NOW)).toBe(false);
    expect(needsDeliveryRead(view({ status: 'CONFIRMED' }), NOW)).toBe(false);
    expect(needsDeliveryRead(view({ status: 'PREPARING' }), NOW)).toBe(true);
    expect(needsDeliveryRead(view({ status: 'READY' }), NOW)).toBe(true);
    expect(needsDeliveryRead(view({ status: 'CANCELLED' }), NOW)).toBe(false);
  });

  it('reads a FINISHED order only while it is recent', () => {
    expect(
      needsDeliveryRead(view({ status: 'FINISHED', createdAt: '2026-08-28T18:00:00' }), NOW)
    ).toBe(true);
    expect(
      needsDeliveryRead(view({ status: 'FINISHED', createdAt: '2026-08-20T18:00:00' }), NOW)
    ).toBe(false);
  });
});

describe('withDeliveryStatus', () => {
  it('leaves an order unread when there is nothing to fold in', () => {
    const order = view({ status: 'READY' });
    expect(withDeliveryStatus(order, undefined)).toBe(order);
    expect(withDeliveryStatus(order, 'ACCEPTED').deliveryStatus).toBe('ACCEPTED');
  });
});

describe('orderBucket', () => {
  it('keeps every stage before the drop-off in progress', () => {
    for (const status of ['CREATED', 'CONFIRMED', 'PREPARING', 'READY'] as const) {
      expect(orderBucket(view({ status }))).toBe('active');
    }
    expect(orderBucket(view({ status: 'FINISHED', deliveryStatus: 'PICKED_UP' }))).toBe(
      'active'
    );
  });

  it('files an order under completed once the delivery is done', () => {
    expect(orderBucket(view({ status: 'FINISHED', deliveryStatus: 'DELIVERED' }))).toBe(
      'completed'
    );
    expect(orderBucket(view({ status: 'FINISHED', deliveryStatus: 'FAILED' }))).toBe(
      'completed'
    );
  });

  it('files declined and cancelled orders under completed', () => {
    expect(orderBucket(view({ status: 'CANCELLED' }))).toBe('completed');
    expect(orderBucket(view({ status: 'REJECTED' }))).toBe('completed');
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
  it('moves through the restaurant stages with the order status', () => {
    expect(orderProgressStep(view({ status: 'CREATED' }))).toBe(1);
    expect(orderProgressStep(view({ status: 'CONFIRMED' }))).toBe(2);
    expect(orderProgressStep(view({ status: 'PREPARING' }))).toBe(3);
  });

  it('does not light "On the way" before the driver has the food', () => {
    expect(orderProgressStep(view({ status: 'READY' }))).toBe(3);
    expect(orderProgressStep(view({ status: 'READY', deliveryStatus: 'ACCEPTED' }))).toBe(3);
  });

  it('moves through the driver stages with the delivery status', () => {
    expect(
      orderProgressStep(view({ status: 'FINISHED', deliveryStatus: 'PICKED_UP' }))
    ).toBe(4);
    expect(
      orderProgressStep(view({ status: 'FINISHED', deliveryStatus: 'DELIVERED' }))
    ).toBe(5);
  });

  it('gives a cancelled or declined order no progress at all', () => {
    expect(orderProgressStep(view({ status: 'CANCELLED' }))).toBe(0);
    expect(orderProgressStep(view({ status: 'REJECTED' }))).toBe(0);
  });

  it('credits an unknown status with the one stage that is certain', () => {
    expect(orderProgressStep(view({ status: null }))).toBe(1);
  });
});

describe('orderStatusLabel', () => {
  it('never dresses an unknown status as progress', () => {
    expect(orderStatusLabel(view({ status: null }))).toBe('Status unavailable');
    expect(orderStatusLabel(view({ status: null }), true)).toBe('Unknown');
  });

  it('no longer calls a READY order "on the way"', () => {
    expect(orderStatusLabel(view({ status: 'READY' }), true)).toBe('Ready');
  });

  it('says what the driver is doing once the order is FINISHED', () => {
    expect(
      orderStatusLabel(view({ status: 'FINISHED', deliveryStatus: 'PICKED_UP' }), true)
    ).toBe('On the way');
    expect(
      orderStatusLabel(view({ status: 'FINISHED', deliveryStatus: 'DELIVERED' }), true)
    ).toBe('Delivered');
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
        { id: 'a', name: 'A', quantity: 2 },
        { id: 'b', name: 'B', quantity: 3 },
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
