import type {
  AttributeGroup,
  Category,
  ConfigurableProductOutput,
  Currency,
  Price,
  ProductOutput,
} from '@/schemas/product';
import {
  formatAmount,
  groupBySection,
  selectPrice,
  toAddonGroups,
  UNBACKED_ADDON_FIELDS,
} from '@/services/api/product-view-model';

const DINAR: Currency = {
  id: 'cur-1',
  code: 'TND',
  name: 'Tunisian Dinar',
  isoCode: 'TND',
  symbol: 'DT',
  decimalPlaces: 2,
  displayFormat: 'SUFFIX',
  active: true,
};

const NOW = new Date('2026-06-15T12:00:00Z');

function price(partial: Partial<Price>): Price {
  return { amount: 10, currency: DINAR, ...partial };
}

describe('formatAmount', () => {
  it('puts the symbol after the amount for SUFFIX', () => {
    expect(formatAmount(9.68, DINAR)).toBe('9.68 DT');
  });

  it('puts the symbol before the amount for PREFIX', () => {
    expect(formatAmount(9.68, { ...DINAR, displayFormat: 'PREFIX' })).toBe('DT 9.68');
  });

  it('honours decimalPlaces of 0', () => {
    expect(formatAmount(9.68, { ...DINAR, decimalPlaces: 0 })).toBe('10 DT');
  });

  it('honours decimalPlaces of 2', () => {
    expect(formatAmount(9.6, { ...DINAR, decimalPlaces: 2 })).toBe('9.60 DT');
  });

  it('honours decimalPlaces of 3, which is what the dinar actually uses', () => {
    expect(formatAmount(9.68, { ...DINAR, decimalPlaces: 3 })).toBe('9.680 DT');
  });

  it('formats the bare number when the currency is missing rather than crashing', () => {
    expect(formatAmount(9.68, null)).toBe('9.68');
    expect(formatAmount(9.68, undefined)).toBe('9.68');
  });

  it('formats the bare number when the currency carries no symbol', () => {
    expect(formatAmount(9.68, { ...DINAR, symbol: null })).toBe('9.68');
  });

  it('never hardcodes DT — a different currency formats with its own symbol', () => {
    expect(formatAmount(9.68, { ...DINAR, symbol: '€', displayFormat: 'PREFIX' })).toBe(
      '€ 9.68'
    );
  });

  it('falls back to two decimal places when the currency does not say', () => {
    expect(formatAmount(9.6, { ...DINAR, decimalPlaces: null })).toBe('9.60 DT');
  });
});

describe('selectPrice', () => {
  it('returns null for an empty list — unorderable, not free', () => {
    expect(selectPrice([], NOW)).toBeNull();
  });

  it('takes an unrestricted price', () => {
    const applied = selectPrice([price({ amount: 9.68 })], NOW);

    expect(applied?.amount).toBe(9.68);
    expect(applied?.formatted).toBe('9.68 DT');
    expect(applied?.original).toBeUndefined();
    expect(applied?.discountLabel).toBeUndefined();
  });

  it('ignores a price whose window has not opened yet', () => {
    const future = price({
      restriction: { effectiveFrom: '2026-07-01T00:00:00Z', effectiveTo: null },
    });

    expect(selectPrice([future], NOW)).toBeNull();
  });

  it('takes a price whose window is open now', () => {
    const current = price({
      amount: 7,
      restriction: {
        effectiveFrom: '2026-06-01T00:00:00Z',
        effectiveTo: '2026-06-30T00:00:00Z',
      },
    });

    expect(selectPrice([current], NOW)?.amount).toBe(7);
  });

  it('ignores a price whose window has closed', () => {
    const expired = price({
      restriction: {
        effectiveFrom: '2026-01-01T00:00:00Z',
        effectiveTo: '2026-02-01T00:00:00Z',
      },
    });

    expect(selectPrice([expired], NOW)).toBeNull();
  });

  it('applies exactly on effectiveFrom — the bound is inclusive', () => {
    const boundary = price({
      amount: 5,
      restriction: { effectiveFrom: NOW.toISOString(), effectiveTo: null },
    });

    expect(selectPrice([boundary], NOW)?.amount).toBe(5);
  });

  it('applies exactly on effectiveTo — the bound is inclusive', () => {
    const boundary = price({
      amount: 5,
      restriction: { effectiveFrom: null, effectiveTo: NOW.toISOString() },
    });

    expect(selectPrice([boundary], NOW)?.amount).toBe(5);
  });

  it('treats a null effectiveFrom as open-ended in the past', () => {
    const openStart = price({
      amount: 4,
      restriction: { effectiveFrom: null, effectiveTo: '2026-12-31T00:00:00Z' },
    });

    expect(selectPrice([openStart], NOW)?.amount).toBe(4);
  });

  it('treats a null effectiveTo as open-ended in the future', () => {
    const openEnd = price({
      amount: 4,
      restriction: { effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: null },
    });

    expect(selectPrice([openEnd], NOW)?.amount).toBe(4);
  });

  it('treats a restriction with both bounds null as always applying', () => {
    const always = price({ amount: 3, restriction: { effectiveFrom: null, effectiveTo: null } });

    expect(selectPrice([always], NOW)?.amount).toBe(3);
  });

  it('takes the lowest applicable price and exposes the highest as the original', () => {
    const applied = selectPrice(
      [price({ amount: 12.9 }), price({ amount: 9.68 })],
      NOW
    );

    expect(applied?.amount).toBe(9.68);
    expect(applied?.formatted).toBe('9.68 DT');
    expect(applied?.original).toBe('12.90 DT');
    expect(applied?.discountLabel).toBe('-25%');
  });

  it('does not fabricate a discount when two applicable prices are equal', () => {
    const applied = selectPrice([price({ amount: 9.68 }), price({ amount: 9.68 })], NOW);

    expect(applied?.amount).toBe(9.68);
    expect(applied?.original).toBeUndefined();
    expect(applied?.discountLabel).toBeUndefined();
  });

  it('does not fabricate a discount from a float epsilon', () => {
    // 0.1 + 0.2 !== 0.3 as doubles; in minor units both are 30.
    const applied = selectPrice([price({ amount: 0.1 + 0.2 }), price({ amount: 0.3 })], NOW);

    expect(applied?.discountLabel).toBeUndefined();
    expect(applied?.original).toBeUndefined();
  });

  it('ignores an expired promotion and falls back to the base price, not to zero', () => {
    const applied = selectPrice(
      [
        price({ amount: 12.9 }),
        price({
          amount: 6,
          restriction: {
            effectiveFrom: '2026-01-01T00:00:00Z',
            effectiveTo: '2026-02-01T00:00:00Z',
          },
        }),
      ],
      NOW
    );

    expect(applied?.amount).toBe(12.9);
    expect(applied?.original).toBeUndefined();
  });

  it('returns null when every price is restricted out — never 0', () => {
    const applied = selectPrice(
      [
        price({
          amount: 6,
          restriction: {
            effectiveFrom: '2026-01-01T00:00:00Z',
            effectiveTo: '2026-02-01T00:00:00Z',
          },
        }),
      ],
      NOW
    );

    expect(applied).toBeNull();
  });

  it('ignores a price with no amount rather than treating it as free', () => {
    expect(selectPrice([price({ amount: null })], NOW)).toBeNull();
  });

  it('ignores a price whose bound cannot be parsed, rather than assuming open-ended', () => {
    const garbled = price({
      restriction: { effectiveFrom: 'not-a-date', effectiveTo: null },
    });

    expect(selectPrice([garbled], NOW)).toBeNull();
  });

  it('reads `now` from the argument, so the same list resolves differently over time', () => {
    const promo = [
      price({ amount: 12 }),
      price({
        amount: 8,
        restriction: {
          effectiveFrom: '2026-06-01T00:00:00Z',
          effectiveTo: '2026-06-30T00:00:00Z',
        },
      }),
    ];

    expect(selectPrice(promo, new Date('2026-06-15T12:00:00Z'))?.amount).toBe(8);
    expect(selectPrice(promo, new Date('2026-07-15T12:00:00Z'))?.amount).toBe(12);
  });
});

// --- Addons ----------------------------------------------------------------

function configurable(groups: AttributeGroup[]): ConfigurableProductOutput {
  return {
    id: 'prod-1',
    subcategories: [],
    subclassifications: [],
    keywords: [],
    prices: [],
    configuration: {
      id: 'conf-1',
      attributes: groups,
    },
  };
}

describe('toAddonGroups', () => {
  it('maps a required group with priced options', () => {
    const groups = toAddonGroups(
      configurable([
        {
          id: 'grp-1',
          name: 'Add some sauce',
          description: 'Pick your sauces',
          required: true,
          attributes: [
            { id: 'bbq', name: 'BBQ sauce', prices: [price({ amount: 2 })] },
          ],
        },
      ]),
      NOW
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('grp-1');
    expect(groups[0].title).toBe('Add some sauce');
    expect(groups[0].subtitle).toBe('Pick your sauces');
    expect(groups[0].required).toBe(true);
    expect(groups[0].options[0].price).toBe('+2.00 DT');
  });

  it('defaults type to checkbox — the backend cannot express single-select', () => {
    const groups = toAddonGroups(
      configurable([{ id: 'grp-1', name: 'Size', required: true, attributes: [] }]),
      NOW
    );

    expect(groups[0].type).toBe('checkbox');
    expect(groups[0].maxSelect).toBeUndefined();
  });

  it('treats a missing `required` as not required rather than blocking the order', () => {
    const groups = toAddonGroups(
      configurable([{ id: 'grp-1', name: 'Extras', attributes: [] }]),
      NOW
    );

    expect(groups[0].required).toBe(false);
  });

  it('handles a group with an empty attribute list', () => {
    const groups = toAddonGroups(
      configurable([{ id: 'grp-1', name: 'Extras', attributes: [] }]),
      NOW
    );

    expect(groups[0].options).toEqual([]);
  });

  it('renders an option whose prices are all restricted out with no price, not a crash', () => {
    const groups = toAddonGroups(
      configurable([
        {
          id: 'grp-1',
          name: 'Extras',
          attributes: [
            {
              id: 'egg',
              name: 'Egg',
              prices: [
                price({
                  restriction: {
                    effectiveFrom: '2026-01-01T00:00:00Z',
                    effectiveTo: '2026-02-01T00:00:00Z',
                  },
                }),
              ],
            },
          ],
        },
      ]),
      NOW
    );

    expect(groups[0].options).toHaveLength(1);
    expect(groups[0].options[0].name).toBe('Egg');
    expect(groups[0].options[0].price).toBeUndefined();
  });

  it('never invents isPopular', () => {
    const groups = toAddonGroups(
      configurable([
        { id: 'grp-1', attributes: [{ id: 'egg', name: 'Egg', prices: [] }] },
      ]),
      NOW
    );

    expect(groups[0].options[0].isPopular).toBeUndefined();
  });

  it('drops a group or option with no id — the screen keys selections by id', () => {
    const groups = toAddonGroups(
      configurable([
        { id: 'grp-1', attributes: [{ name: 'no id', prices: [] }] },
        { name: 'no id either', attributes: [] },
      ]),
      NOW
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].options).toEqual([]);
  });

  it('returns an empty list for a product with no configuration', () => {
    const product = { ...configurable([]), configuration: null };

    expect(toAddonGroups(product, NOW)).toEqual([]);
  });

  it('documents exactly the three fields the backend does not carry', () => {
    expect(UNBACKED_ADDON_FIELDS).toEqual(['type', 'maxSelect', 'isPopular']);
  });
});

// --- Sections --------------------------------------------------------------

function category(partial: Partial<Category>): Category {
  return { id: 'cat-1', name: 'Classiques', keywords: [], ...partial };
}

function product(
  id: string,
  name: string,
  subcategories: Category[] = [],
  prices: Price[] = []
): ProductOutput {
  return {
    id,
    name,
    subcategories,
    subclassifications: [],
    keywords: [],
    prices,
  };
}

describe('groupBySection', () => {
  it('groups products under their category names', () => {
    const sections = groupBySection(
      [
        product('p1', 'Crispy', [category({ id: 'c1', name: 'Classiques' })]),
        product('p2', 'Bowl', [category({ id: 'c2', name: 'Bowls' })]),
      ],
      NOW
    );

    expect(sections.map((s) => s.title)).toEqual(['Bowls', 'Classiques']);
    expect(sections[0].products[0].name).toBe('Bowl');
  });

  it('excludes an inactive category', () => {
    const sections = groupBySection(
      [product('p1', 'Crispy', [category({ id: 'c1', name: 'Hidden', active: false })])],
      NOW
    );

    expect(sections.map((s) => s.title)).toEqual(['']);
  });

  it('excludes an invisible category', () => {
    const sections = groupBySection(
      [product('p1', 'Crispy', [category({ id: 'c1', name: 'Hidden', visible: false })])],
      NOW
    );

    expect(sections.map((s) => s.title)).toEqual(['']);
  });

  it('keeps a category that simply does not state active or visible', () => {
    const sections = groupBySection(
      [product('p1', 'Crispy', [category({ id: 'c1', name: 'Classiques' })])],
      NOW
    );

    expect(sections.map((s) => s.title)).toEqual(['Classiques']);
  });

  it('puts uncategorised products in a single untitled group placed last', () => {
    const sections = groupBySection(
      [
        product('p1', 'Loose one'),
        product('p2', 'Bowl', [category({ id: 'c2', name: 'Bowls' })]),
        product('p3', 'Another loose one'),
      ],
      NOW
    );

    expect(sections.map((s) => s.title)).toEqual(['Bowls', '']);
    expect(sections[1].products.map((p) => p.name)).toEqual([
      'Another loose one',
      'Loose one',
    ]);
  });

  it('lists a product under every visible category it belongs to', () => {
    const sections = groupBySection(
      [
        product('p1', 'Crispy', [
          category({ id: 'c1', name: 'Classiques' }),
          category({ id: 'c2', name: 'Bowls' }),
        ]),
      ],
      NOW
    );

    expect(sections.map((s) => s.title)).toEqual(['Bowls', 'Classiques']);
    expect(sections[0].products[0].id).toBe('p1');
    expect(sections[1].products[0].id).toBe('p1');
  });

  it('orders sections and products identically for shuffled input', () => {
    const classiques = category({ id: 'c1', name: 'Classiques' });
    const bowls = category({ id: 'c2', name: 'Bowls' });
    const products = [
      product('p1', 'Crispy', [classiques]),
      product('p2', 'Bowl', [bowls]),
      product('p3', 'Cordon', [classiques]),
    ];

    const first = groupBySection(products, NOW);
    const second = groupBySection([...products].reverse(), NOW);

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first[1].products.map((p) => p.name)).toEqual(['Cordon', 'Crispy']);
  });

  it('carries the selected price onto the product, and null when none applies', () => {
    const sections = groupBySection(
      [
        product('p1', 'Priced', [], [price({ amount: 9.68 })]),
        product('p2', 'Unpriced', [], []),
      ],
      NOW
    );

    const [priced, unpriced] = sections[0].products;
    expect(priced.price?.formatted).toBe('9.68 DT');
    expect(unpriced.price).toBeNull();
  });

  it('returns an empty list for no products at all', () => {
    expect(groupBySection([], NOW)).toEqual([]);
  });
});
