import { cartOutputSchema, type CartOutput } from '@/schemas/cart';
import {
  blockerMessage,
  cartItemCount,
  discountPromotions,
  groupCartByRestaurant,
  withItemQuantity,
  withoutItem,
  withoutRestaurant,
} from '@/services/api/cart-view-model';

const PIZZERIA = '11111111-1111-1111-1111-111111111111';
const SUSHI = '22222222-2222-2222-2222-222222222222';

function cart(overrides: Record<string, unknown> = {}): CartOutput {
  return cartOutputSchema.parse({
    id: 'cart-1',
    items: [
      { id: 'a', productName: 'Margherita', quantity: 2, restaurantId: PIZZERIA, restaurantName: 'Pizza Palace', unitPrice: 10, lineTotal: 20 },
      { id: 'b', productName: 'Salmon', quantity: 1, restaurantId: SUSHI, restaurantName: 'Sushi Bar', unitPrice: 9, lineTotal: 9 },
      { id: 'c', productName: 'Calzone', quantity: 3, restaurantId: PIZZERIA, restaurantName: 'Pizza Palace', unitPrice: 12, lineTotal: 36 },
      { id: 'g', productName: 'Free tiramisu', quantity: 1, restaurantId: PIZZERIA, restaurantName: 'Pizza Palace', unitPrice: 6, lineTotal: 0, giftItem: true },
    ],
    orders: [
      { restaurantId: PIZZERIA, restaurantName: 'Pizza Palace', subtotal: 56, total: 60 },
      { restaurantId: SUSHI, restaurantName: 'Sushi Bar', subtotal: 9, total: 12 },
    ],
    applicablePromotions: [
      { promotionRuleCode: 'CART10', effectType: 'CartDiscountEffect', amount: 5, message: '10% off' },
      { promotionRuleCode: 'PROD', effectType: 'ProductDiscountEffect', amount: 2 },
      { promotionRuleCode: 'GIFT', effectType: 'FreeGiftEffect', amount: 6 },
      { promotionRuleCode: 'MSG', effectType: 'MessageEffect', amount: null },
      { promotionRuleCode: 'ZERO', effectType: 'CartDiscountEffect', amount: 0 },
    ],
    ...overrides,
  });
}

describe('groupCartByRestaurant', () => {
  it('groups lines under their restaurant in the order the restaurants first appear', () => {
    const groups = groupCartByRestaurant(cart());

    expect(groups.map((group) => group.restaurantId)).toEqual([PIZZERIA, SUSHI]);
    expect(groups[0].items.map((item) => item.id)).toEqual(['a', 'c', 'g']);
    expect(groups[1].items.map((item) => item.id)).toEqual(['b']);
  });

  it('counts units per restaurant and leaves free gifts out of the count', () => {
    const [pizzeria, sushi] = groupCartByRestaurant(cart());

    expect(pizzeria.totalQuantity).toBe(5);
    expect(sushi.totalQuantity).toBe(1);
  });

  it('attaches the order the server says checkout will create for each restaurant', () => {
    const [pizzeria, sushi] = groupCartByRestaurant(cart());

    expect(pizzeria.order?.total).toBe(60);
    expect(sushi.order?.subtotal).toBe(9);
  });

  it('keeps a line with no restaurant visible under an empty id rather than dropping it', () => {
    const groups = groupCartByRestaurant(
      cartOutputSchema.parse({ id: 'c', items: [{ id: 'x', quantity: 1, unitPrice: 1, lineTotal: 1 }] })
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].restaurantId).toBe('');
    expect(groups[0].order).toBeNull();
  });

  it('is empty for no cart', () => {
    expect(groupCartByRestaurant(undefined)).toEqual([]);
    expect(groupCartByRestaurant(null)).toEqual([]);
  });
});

describe('cartItemCount', () => {
  it('counts units, not lines, so bumping a dish from 1 to 2 moves the badge', () => {
    expect(cartItemCount(cart())).toBe(6);
  });

  it('does not count a gift the customer did not add', () => {
    const onlyGift = cartOutputSchema.parse({ id: 'c', items: [{ id: 'g', quantity: 1, giftItem: true }] });

    expect(cartItemCount(onlyGift)).toBe(0);
  });

  it('is zero before the cart has loaded', () => {
    expect(cartItemCount(undefined)).toBe(0);
  });
});

describe('discountPromotions', () => {
  it('keeps only promotions that take money off', () => {
    expect(discountPromotions(cart()).map((promotion) => promotion.promotionRuleCode)).toEqual(['CART10', 'PROD']);
  });
});

describe('blockerMessage', () => {
  it('words every blocker the app knows in the customer\'s terms', () => {
    expect(blockerMessage('EMPTY_CART')).toMatch(/empty/i);
    expect(blockerMessage('NO_DELIVERY_ADDRESS')).toMatch(/deliver/i);
    expect(blockerMessage('NO_ADDRESS_COORDINATES')).toMatch(/map/i);
    expect(blockerMessage('RESTAURANT_LOCATION_MISSING')).toMatch(/restaurant/i);
  });

  it('has a generic line for a blocker from a newer backend rather than showing a raw code', () => {
    const message = blockerMessage('BRAND_NEW_BLOCKER');

    expect(message).not.toContain('BRAND_NEW_BLOCKER');
    expect(message.length).toBeGreaterThan(0);
  });
});

describe('optimistic edits', () => {
  it('sets a line quantity and its line total, leaving the other lines and the server totals alone', () => {
    const before = cart({ total: 65 });

    const after = withItemQuantity(before, 'a', 5);

    expect(after.items.find((item) => item.id === 'a')).toMatchObject({ quantity: 5, lineTotal: 50 });
    expect(after.items.find((item) => item.id === 'b')).toEqual(before.items.find((item) => item.id === 'b'));
    expect(after.total).toBe(65);
  });

  it('removes a line when its quantity reaches zero', () => {
    expect(withItemQuantity(cart(), 'b', 0).items.map((item) => item.id)).toEqual(['a', 'c', 'g']);
  });

  it('removes one line', () => {
    expect(withoutItem(cart(), 'a').items.map((item) => item.id)).toEqual(['b', 'c', 'g']);
  });

  it('removes a restaurant\'s own lines but leaves a gift until the server re-evaluates', () => {
    expect(withoutRestaurant(cart(), PIZZERIA).items.map((item) => item.id)).toEqual(['b', 'g']);
  });

  it('never mutates the cart it was given', () => {
    const before = cart();
    const snapshot = JSON.stringify(before);

    withItemQuantity(before, 'a', 9);
    withoutItem(before, 'a');
    withoutRestaurant(before, PIZZERIA);

    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
