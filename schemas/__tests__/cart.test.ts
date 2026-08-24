import { cartOutputSchema } from '@/schemas/cart';
import { pageSchema } from '@/schemas/page';

const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const PRODUCT_ID = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';

const FULL_CART = {
  id: CART_ID,
  code: `hc:${CUSTOMER_ID}:${RESTAURANT_ID}`,
  name: 'Baguette & Baguette',
  customerId: CUSTOMER_ID,
  customerCode: 'kc-sub-1',
  customerFullName: 'Amine Ben Salah',
  status: 'ACTIVE',
  comment: null,
  items: [
    {
      id: 'item-1',
      code: null,
      name: null,
      productId: PRODUCT_ID,
      productCode: 'CRISPY',
      productName: 'Crispy Chicken',
      quantity: 2,
    },
  ],
  createdAt: '2026-08-23T12:34:56',
};

describe('cartOutputSchema', () => {
  it('parses a full cart payload', () => {
    const result = cartOutputSchema.safeParse(FULL_CART);

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(CART_ID);
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.items[0].productName).toBe('Crispy Chicken');
  });

  it('parses a cart carrying nothing but an id, defaulting items to []', () => {
    const result = cartOutputSchema.safeParse({ id: CART_ID });

    expect(result.success).toBe(true);
    // `.catch([])` — callers iterate `items` without optional-chaining first.
    expect(result.data?.items).toEqual([]);
  });

  it('parses an item whose `name` is null — it always is on the wire', () => {
    const result = cartOutputSchema.safeParse({
      ...FULL_CART,
      items: [{ ...FULL_CART.items[0], name: null, code: null }],
    });

    expect(result.success).toBe(true);
    expect(result.data?.items[0].name).toBeNull();
    // The readable label lives on `productName`, which survives.
    expect(result.data?.items[0].productName).toBe('Crispy Chicken');
  });

  it('keeps the rest of the cart when `status` is a value the app does not know', () => {
    const result = cartOutputSchema.safeParse({ ...FULL_CART, status: 'FROZEN' });

    expect(result.success).toBe(true);
    // The unknown member degrades to null; the cart is still addressable.
    expect(result.data?.status).toBeNull();
    expect(result.data?.id).toBe(CART_ID);
    expect(result.data?.items).toHaveLength(1);
  });

  it('parses a cart whose `status` is absent altogether', () => {
    const { status: _status, ...withoutStatus } = FULL_CART;

    const result = cartOutputSchema.safeParse(withoutStatus);

    expect(result.success).toBe(true);
    expect(result.data?.status).toBeUndefined();
  });

  it('fails with `id` in the issue path when the cart has no id', () => {
    const { id: _id, ...withoutId } = FULL_CART;

    const result = cartOutputSchema.safeParse(withoutId);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('id');
  });
});

describe('pageSchema(cartOutputSchema)', () => {
  it('parses the flat PageImpl envelope /carts/all returns', () => {
    const result = pageSchema(cartOutputSchema).safeParse({
      content: [FULL_CART],
      number: 0,
      totalPages: 1,
      totalElements: 1,
      last: true,
      size: 20,
      first: true,
      numberOfElements: 1,
      empty: false,
      sort: { sorted: false },
      pageable: { pageNumber: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.data?.content).toHaveLength(1);
  });

  it('surfaces an unparseable cart as an error rather than dropping it', () => {
    // `content` is deliberately NOT `.catch([])` — see schemas/page.ts.
    const result = pageSchema(cartOutputSchema).safeParse({
      content: [{ code: 'hc:a:b' }],
    });

    expect(result.success).toBe(false);
  });
});
