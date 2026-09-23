import { cartOutputSchema, isKnownBlocker } from '@/schemas/cart';

const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const PIZZERIA = '11111111-1111-1111-1111-111111111111';
const SUSHI = '22222222-2222-2222-2222-222222222222';
const PRODUCT_ID = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';

/** What `GET /carts/active` answers for a two-restaurant cart. */
const FULL_CART = {
  id: CART_ID,
  status: 'ACTIVE',
  currency: 'TND',
  comment: null,
  couponCode: null,
  paymentMethod: 'cash',
  deliveryAddress: {
    formattedAddress: '1 Rue Habib Bourguiba, Sousse',
    coordinates: { latitude: 35.8256, longitude: 10.6084 },
    country: 'Tunisia',
  },
  items: [
    {
      id: 'item-1',
      productId: PRODUCT_ID,
      productCode: 'margherita',
      productName: 'Margherita',
      quantity: 2,
      restaurantId: PIZZERIA,
      restaurantName: 'Pizza Palace',
      unitPrice: 15.5,
      lineTotal: 31,
      note: 'no onions',
      giftItem: false,
      options: [{ attributeId: 'opt-1', name: 'Extra cheese', price: 1 }],
    },
    {
      id: 'item-2',
      productId: 'p2',
      productName: 'Salmon nigiri',
      quantity: 1,
      restaurantId: SUSHI,
      restaurantName: 'Sushi Bar',
      unitPrice: 9.25,
      lineTotal: 9.25,
      giftItem: false,
      options: [],
    },
  ],
  applicablePromotions: [
    {
      promotionRuleId: 'rule-1',
      promotionRuleCode: 'TEN_OFF',
      effectType: 'CartDiscountEffect',
      amount: 4,
      currency: 'TND',
      message: '10% off',
      restaurantId: null,
    },
  ],
  deliveryFees: [
    { restaurantId: PIZZERIA, restaurantName: 'Pizza Palace', distanceKm: 1.1, amount: 1.5 },
    { restaurantId: SUSHI, restaurantName: 'Sushi Bar', distanceKm: 2.2, amount: 1.9 },
  ],
  serviceFee: { amount: 1, orderCount: 2 },
  additionalFees: [{ code: 'NIGHT', label: 'Night surcharge', scope: 'PER_CART', amount: 1 }],
  orders: [
    {
      restaurantId: PIZZERIA,
      restaurantName: 'Pizza Palace',
      itemIds: ['item-1'],
      subtotal: 31,
      discount: 3.1,
      deliveryFee: 1.5,
      serviceFeeShare: 0.5,
      additionalFees: [{ code: 'NIGHT', label: 'Night surcharge', scope: 'PER_CART', amount: 0.5 }],
      total: 30.4,
    },
  ],
  subtotal: 40.25,
  discountTotal: 4,
  feesTotal: 5.4,
  total: 41.65,
  blockers: [],
  createdAt: '2026-09-25T12:34:56',
};

describe('cartOutputSchema', () => {
  it('parses a complete server cart, keeping every figure the server computed', () => {
    const cart = cartOutputSchema.parse(FULL_CART);

    expect(cart.items).toHaveLength(2);
    expect(cart.items[0].options[0]).toEqual({ attributeId: 'opt-1', name: 'Extra cheese', price: 1 });
    expect(cart.applicablePromotions[0].effectType).toBe('CartDiscountEffect');
    expect(cart.deliveryFees.map((fee) => fee.amount)).toEqual([1.5, 1.9]);
    expect(cart.serviceFee).toEqual({ amount: 1, orderCount: 2 });
    expect(cart.additionalFees[0].code).toBe('NIGHT');
    expect(cart.orders[0].serviceFeeShare).toBe(0.5);
    expect(cart.subtotal).toBe(40.25);
    expect(cart.total).toBe(41.65);
    expect(cart.deliveryAddress?.coordinates?.latitude).toBe(35.8256);
  });

  it('parses a brand-new empty cart', () => {
    const cart = cartOutputSchema.parse({ id: CART_ID, status: 'ACTIVE', items: [], blockers: ['EMPTY_CART'] });

    expect(cart.items).toEqual([]);
    expect(cart.orders).toEqual([]);
    expect(cart.deliveryFees).toEqual([]);
    expect(cart.serviceFee).toBeUndefined();
    expect(cart.blockers).toEqual(['EMPTY_CART']);
  });

  it('defaults the totals to zero rather than refusing a cart the customer must still be able to empty', () => {
    const cart = cartOutputSchema.parse({ id: CART_ID });

    expect(cart.subtotal).toBe(0);
    expect(cart.discountTotal).toBe(0);
    expect(cart.feesTotal).toBe(0);
    expect(cart.total).toBe(0);
  });

  it('requires an id: a cart that cannot be addressed is not worth carrying', () => {
    expect(cartOutputSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('degrades an unknown status to null instead of discarding the cart', () => {
    const cart = cartOutputSchema.parse({ id: CART_ID, status: 'SOMETHING_NEW' });

    expect(cart.status).toBeNull();
  });

  it('treats a malformed items list as empty rather than failing the whole cart', () => {
    const cart = cartOutputSchema.parse({ id: CART_ID, items: 'nope' });

    expect(cart.items).toEqual([]);
  });

  it('marks a free gift and gives a line without one a false default', () => {
    const cart = cartOutputSchema.parse({
      id: CART_ID,
      items: [
        { id: 'a', quantity: 1, unitPrice: 6, lineTotal: 0, giftItem: true, options: [] },
        { id: 'b', quantity: 1, unitPrice: 6, lineTotal: 6 },
      ],
    });

    expect(cart.items[0].giftItem).toBe(true);
    expect(cart.items[1].giftItem).toBe(false);
    expect(cart.items[1].options).toEqual([]);
  });

  it('keeps unknown blockers as strings so a newer backend does not break an older app', () => {
    const cart = cartOutputSchema.parse({ id: CART_ID, blockers: ['NO_DELIVERY_ADDRESS', 'BRAND_NEW_BLOCKER'] });

    expect(cart.blockers).toEqual(['NO_DELIVERY_ADDRESS', 'BRAND_NEW_BLOCKER']);
  });
});

describe('isKnownBlocker', () => {
  it('recognises the blockers the app has wording for and no others', () => {
    for (const blocker of ['EMPTY_CART', 'NO_DELIVERY_ADDRESS', 'NO_ADDRESS_COORDINATES', 'RESTAURANT_LOCATION_MISSING']) {
      expect(isKnownBlocker(blocker)).toBe(true);
    }
    expect(isKnownBlocker('BRAND_NEW_BLOCKER')).toBe(false);
  });
});
