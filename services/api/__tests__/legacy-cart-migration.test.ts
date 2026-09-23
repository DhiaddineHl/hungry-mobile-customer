import {
  LEGACY_CART_KEY,
  LEGACY_ORDER_PRICES_KEY,
  migrateLegacyCart,
  parseLegacyCart,
  toAddCartItemInput,
} from '@/services/api/legacy-cart-migration';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), removeItem: jest.fn() },
}));

/** What the removed zustand store persisted under `hungry-cart`. */
function legacyJson(items: unknown[]): string {
  return JSON.stringify({ state: { items, remote: { cartId: null, status: 'idle' } }, version: 2 });
}

const MARGHERITA = {
  lineId: 'r1|p1||',
  foodId: 'p1',
  name: 'Margherita',
  unitPrice: 15,
  basePrice: 14,
  quantity: 2,
  addons: [{ id: 'opt-1', name: 'Extra cheese', price: 1 }],
  note: '  no onions ',
  restaurantId: 'r1',
};
const SALMON = { lineId: 'r2|p2||', foodId: 'p2', quantity: 1, addons: [], restaurantId: 'r2' };

function fakeStorage(raw: string | null) {
  const removed: string[] = [];
  return {
    removed,
    storage: {
      getItem: jest.fn(async (key: string) => (key === LEGACY_CART_KEY ? raw : null)),
      removeItem: jest.fn(async (key: string) => {
        removed.push(key);
      }),
    },
  };
}

describe('parseLegacyCart', () => {
  it('keeps what still matters on each line: the dish, quantity, note and chosen options', () => {
    expect(parseLegacyCart(legacyJson([MARGHERITA, SALMON]))).toEqual([
      { foodId: 'p1', quantity: 2, note: 'no onions', addonIds: ['opt-1'] },
      { foodId: 'p2', quantity: 1, note: undefined, addonIds: [] },
    ]);
  });

  it('drops the prices: the server prices the dish and every option itself', () => {
    expect(JSON.stringify(parseLegacyCart(legacyJson([MARGHERITA])))).not.toMatch(/price|Price/);
  });

  it('skips lines that cannot be sent instead of failing the whole cart', () => {
    const lines = parseLegacyCart(
      legacyJson([{ foodId: '', quantity: 1 }, { foodId: 'p1', quantity: 0 }, { quantity: 2 }, null, 'x', SALMON])
    );

    expect(lines.map((line) => line.foodId)).toEqual(['p2']);
  });

  it('caps a quantity at what the server accepts', () => {
    expect(parseLegacyCart(legacyJson([{ foodId: 'p1', quantity: 500 }]))[0].quantity).toBe(99);
  });

  it('yields no lines for anything malformed — it runs unattended at startup', () => {
    expect(parseLegacyCart(null)).toEqual([]);
    expect(parseLegacyCart('')).toEqual([]);
    expect(parseLegacyCart('{not json')).toEqual([]);
    expect(parseLegacyCart(JSON.stringify({ state: {} }))).toEqual([]);
    expect(parseLegacyCart(JSON.stringify({ state: { items: 'nope' } }))).toEqual([]);
  });
});

describe('toAddCartItemInput', () => {
  it('turns an old line into the add-to-cart request the server takes', () => {
    expect(toAddCartItemInput({ foodId: 'p1', quantity: 2, note: 'x', addonIds: ['opt-1', 'opt-2'] })).toEqual({
      productId: 'p1',
      quantity: 2,
      note: 'x',
      attributes: [
        { attributeId: 'opt-1', checked: true },
        { attributeId: 'opt-2', checked: true },
      ],
    });
  });
});

describe('migrateLegacyCart', () => {
  it('replays the old lines onto an empty server cart, in order, then removes the old storage', async () => {
    const { storage, removed } = fakeStorage(legacyJson([MARGHERITA, SALMON]));
    const add = jest.fn().mockResolvedValue({});

    const migrated = await migrateLegacyCart({ serverCartIsEmpty: true, storage, add });

    expect(migrated).toBe(2);
    expect(add.mock.calls.map((call) => call[0].productId)).toEqual(['p1', 'p2']);
    expect(add.mock.calls[0][0]).toMatchObject({ quantity: 2, note: 'no onions', attributes: [{ attributeId: 'opt-1', checked: true }] });
    expect(removed).toContain(LEGACY_CART_KEY);
  });

  it('does not merge into a server cart that already has lines: two baskets would order things twice', async () => {
    const { storage, removed } = fakeStorage(legacyJson([MARGHERITA]));
    const add = jest.fn();

    const migrated = await migrateLegacyCart({ serverCartIsEmpty: false, storage, add });

    expect(migrated).toBe(0);
    expect(add).not.toHaveBeenCalled();
    expect(removed).toContain(LEGACY_CART_KEY);
  });

  it('skips a dish that no longer exists and still carries over the rest', async () => {
    const { storage, removed } = fakeStorage(legacyJson([MARGHERITA, SALMON]));
    const add = jest.fn().mockRejectedValueOnce(new Error('gone')).mockResolvedValueOnce({});

    const migrated = await migrateLegacyCart({ serverCartIsEmpty: true, storage, add });

    expect(migrated).toBe(1);
    expect(removed).toContain(LEGACY_CART_KEY);
  });

  it('keeps the old cart for the next launch when nothing could be carried over', async () => {
    const { storage, removed } = fakeStorage(legacyJson([MARGHERITA, SALMON]));
    const add = jest.fn().mockRejectedValue(new Error('Network error'));

    const migrated = await migrateLegacyCart({ serverCartIsEmpty: true, storage, add });

    expect(migrated).toBe(0);
    expect(removed).not.toContain(LEGACY_CART_KEY);
  });

  it('does nothing when there is no old cart', async () => {
    const { storage } = fakeStorage(null);
    const add = jest.fn();

    expect(await migrateLegacyCart({ serverCartIsEmpty: true, storage, add })).toBe(0);
    expect(add).not.toHaveBeenCalled();
  });

  it('removes the old on-device price snapshots whatever else happens', async () => {
    const { storage, removed } = fakeStorage(null);

    await migrateLegacyCart({ serverCartIsEmpty: true, storage, add: jest.fn() });

    expect(removed).toContain(LEGACY_ORDER_PRICES_KEY);
  });

  it('never throws, even when storage fails', async () => {
    const storage = {
      getItem: jest.fn().mockRejectedValue(new Error('disk')),
      removeItem: jest.fn().mockResolvedValue(undefined),
    };

    await expect(migrateLegacyCart({ serverCartIsEmpty: true, storage, add: jest.fn() })).resolves.toBe(0);
  });
});
