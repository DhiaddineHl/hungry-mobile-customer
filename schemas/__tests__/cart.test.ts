import { cartOutputSchema } from '@/schemas/cart';

const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const PRODUCT_ID = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';
const ATTRIBUTE_ID = 'a4a4a4a4-1111-2222-3333-444444444444';

/** `GET /carts/active` as `CartQuotePopulator` fills it. */
const FULL_CART = {
  id: CART_ID,
  customerId: CUSTOMER_ID,
  status: 'ACTIVE',
  comment: null,
  paymentMethod: 'cash',
  deliveryAddress: null,
  items: [
    {
      id: 'item-1',
      productId: PRODUCT_ID,
      productCode: 'CRISPY',
      productName: 'Crispy Chicken',
      quantity: 2,
      restaurantId: RESTAURANT_ID,
      restaurantName: 'Baguette & Baguette',
      unitPrice: 11.5,
      lineTotal: 23,
      note: 'No onions',
      giftItem: false,
      options: [{ attributeId: ATTRIBUTE_ID, name: 'Extra cheese', price: 2 }],
    },
  ],
  createdAt: '2026-08-23T12:34:56',
  currency: 'TND',
  subtotal: 23,
  discountTotal: 0,
  feesTotal: 4.4,
  total: 27.4,
  applicablePromotions: [],
  deliveryFees: [
    { restaurantId: RESTAURANT_ID, restaurantName: 'Baguette & Baguette', distanceKm: 3.5, amount: 2.4 },
  ],
  serviceFee: { amount: 1, orderCount: 1 },
  additionalFees: [{ code: 'NIGHT', label: 'Night surcharge', scope: 'PER_CART', amount: 1 }],
  orders: [
    {
      restaurantId: RESTAURANT_ID,
      restaurantName: 'Baguette & Baguette',
      itemIds: ['item-1'],
      subtotal: 23,
      discount: 0,
      deliveryFee: 2.4,
      serviceFeeShare: 1,
      additionalFees: [{ code: 'NIGHT', label: 'Night surcharge', scope: 'PER_CART', amount: 1 }],
      total: 27.4,
    },
  ],
  blockers: [],
};

describe('cartOutputSchema', () => {
  it('parses a fully priced cart', () => {
    const result = cartOutputSchema.safeParse(FULL_CART);

    expect(result.success).toBe(true);
    expect(result.data?.items?.[0].options?.[0].attributeId).toBe(ATTRIBUTE_ID);
    expect(result.data?.serviceFee?.amount).toBe(1);
    expect(result.data?.orders?.[0].deliveryFee).toBe(2.4);
    expect(result.data?.total).toBe(27.4);
  });

  it('reads a BigDecimal sent as a string', () => {
    const result = cartOutputSchema.safeParse({ ...FULL_CART, total: '27.400' });

    expect(result.data?.total).toBe(27.4);
  });

  it('degrades an unreadable amount to null (unknown), never to zero', () => {
    const result = cartOutputSchema.safeParse({ ...FULL_CART, total: 'n/a' });

    expect(result.success).toBe(true);
    expect(result.data?.total).toBeNull();
  });

  it('parses a cart carrying nothing but an id', () => {
    const result = cartOutputSchema.safeParse({ id: CART_ID });

    expect(result.success).toBe(true);
  });

  it('keeps the rest of the cart when `status` is a value the app does not know', () => {
    const result = cartOutputSchema.safeParse({ ...FULL_CART, status: 'FROZEN' });

    expect(result.success).toBe(true);
    expect(result.data?.status).toBeNull();
    expect(result.data?.items).toHaveLength(1);
  });

  it('keeps a blocker name the app does not know yet', () => {
    const result = cartOutputSchema.safeParse({ ...FULL_CART, blockers: ['SOMETHING_NEW'] });

    expect(result.data?.blockers).toEqual(['SOMETHING_NEW']);
  });

  it('fails with `id` in the issue path when the cart has no id', () => {
    const { id: _id, ...withoutId } = FULL_CART;

    const result = cartOutputSchema.safeParse(withoutId);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('id');
  });
});
