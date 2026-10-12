import { orderOutputSchema } from '@/schemas/order';
import { pageSchema } from '@/schemas/page';

const ORDER_ID = '9a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d';
const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const PRODUCT_ID = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';
const ATTRIBUTE_ID = 'a4a4a4a4-1111-2222-3333-444444444444';

const FULL_ORDER = {
  id: ORDER_ID,
  code: `ho:${CUSTOMER_ID}:1756000000000`,
  name: 'Baguette & Baguette',
  restaurantId: RESTAURANT_ID,
  restaurantCode: 'BAGUETTE',
  restaurantName: 'Baguette & Baguette',
  pickupLatitude: 36.8065,
  pickupLongitude: 10.1815,
  customerId: CUSTOMER_ID,
  customerCode: 'kc-sub-1',
  customerFullName: 'Amine Ben Salah',
  dropoffLatitude: 36.8529,
  dropoffLongitude: 10.3376,
  status: 'CREATED',
  comment: 'Payment: Cash',
  items: [
    {
      id: 'item-1',
      code: 'line-1',
      name: 'Crispy Chicken',
      quantity: 2,
      // The OUTPUT nests the ordered product under `product`; the input uses
      // `orderedProduct`. Getting this backwards silently yields undefined.
      product: {
        id: PRODUCT_ID,
        code: 'CRISPY',
        name: 'Crispy Chicken',
        productId: PRODUCT_ID,
        productCode: 'CRISPY',
        productName: 'Crispy Chicken',
        attributes: [{ id: ATTRIBUTE_ID, code: 'EXTRA_CHEESE', name: 'Extra cheese' }],
      },
    },
  ],
  createdAt: '2026-08-24T12:34:56',
};

describe('orderOutputSchema', () => {
  it('parses a full order payload', () => {
    const result = orderOutputSchema.safeParse(FULL_ORDER);

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(ORDER_ID);
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.items[0].product?.productName).toBe('Crispy Chicken');
    expect(result.data?.items[0].product?.attributes[0].id).toBe(ATTRIBUTE_ID);
  });

  it('parses an order carrying nothing but an id, defaulting items to []', () => {
    const result = orderOutputSchema.safeParse({ id: ORDER_ID });

    expect(result.success).toBe(true);
    // `.catch([])` — a re-read of a freshly created order legitimately returns
    // no items today (plan §2.2), and callers must still be able to iterate.
    expect(result.data?.items).toEqual([]);
  });

  it('parses an item whose `product.attributes` is null', () => {
    const result = orderOutputSchema.safeParse({
      ...FULL_ORDER,
      items: [
        {
          ...FULL_ORDER.items[0],
          product: { ...FULL_ORDER.items[0].product, attributes: null },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.items[0].product?.attributes).toEqual([]);
  });

  it('parses an item with no `product` at all', () => {
    const result = orderOutputSchema.safeParse({
      ...FULL_ORDER,
      items: [{ id: 'item-1', quantity: 1 }],
    });

    expect(result.success).toBe(true);
    expect(result.data?.items[0].product).toBeUndefined();
  });

  it('keeps the rest of the order when `status` is a value the app does not know', () => {
    const result = orderOutputSchema.safeParse({ ...FULL_ORDER, status: 'DELIVERED' });

    expect(result.success).toBe(true);
    // The unknown member degrades to null; the order is still addressable.
    expect(result.data?.status).toBeNull();
    expect(result.data?.id).toBe(ORDER_ID);
    expect(result.data?.items).toHaveLength(1);
  });

  it('parses an order whose `status` is absent altogether', () => {
    const { status: _status, ...withoutStatus } = FULL_ORDER;

    const result = orderOutputSchema.safeParse(withoutStatus);

    expect(result.success).toBe(true);
    expect(result.data?.status).toBeUndefined();
  });

  it('fails with `id` in the issue path when the order has no id', () => {
    const { id: _id, ...withoutId } = FULL_ORDER;

    const result = orderOutputSchema.safeParse(withoutId);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('id');
  });
});

describe('pageSchema(orderOutputSchema)', () => {
  it('parses the flat PageImpl envelope an order page would return', () => {
    const result = pageSchema(orderOutputSchema).safeParse({
      content: [FULL_ORDER],
      number: 0,
      totalPages: 1,
      totalElements: 1,
      last: true,
    });

    expect(result.success).toBe(true);
    expect(result.data?.content).toHaveLength(1);
  });
});
