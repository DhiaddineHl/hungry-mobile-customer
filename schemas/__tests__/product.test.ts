import {
  configurableProductOutputSchema,
  productOutputSchema,
} from '@/schemas/product';

const CURRENCY = {
  id: 'cur-1',
  code: 'TND',
  name: 'Tunisian Dinar',
  isoCode: 'TND',
  symbol: 'DT',
  decimalPlaces: 3,
  displayFormat: 'SUFFIX',
  active: true,
};

const FULL_PAYLOAD = {
  id: '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f',
  code: 'CRISPY',
  name: 'Crispy Chicken',
  description: 'Breaded chicken escalope, bell peppers, fries',
  catalog: 'hungry',
  catalogVersion: 'Online',
  subcategories: [
    {
      id: 'cat-1',
      code: 'CLASSIQUES',
      name: 'Les Classiques',
      description: null,
      keywords: ['tacos'],
      active: true,
      visible: true,
    },
  ],
  subclassifications: [{ id: 'cls-1', code: 'HOT', name: 'Hot' }],
  keywords: ['chicken', 'crispy'],
  prices: [
    {
      id: 'price-1',
      code: 'BASE',
      name: 'Base price',
      amount: 9.68,
      currency: CURRENCY,
      category: { id: 'pc-1', code: 'BASE', name: 'Base', description: null },
      restriction: {
        id: 'tr-1',
        code: 'ALWAYS',
        name: 'Always',
        effectiveFrom: '2026-01-01T00:00:00Z',
        effectiveTo: null,
      },
    },
  ],
  configuration: {
    id: 'conf-1',
    code: 'CRISPY_CONF',
    name: 'Crispy configuration',
    description: null,
    attributes: [
      {
        id: 'grp-1',
        code: 'SAUCE',
        name: 'Add some sauce',
        description: 'Pick your sauces',
        required: true,
        attributes: [
          {
            id: 'attr-1',
            code: 'BBQ',
            name: 'BBQ sauce',
            description: null,
            prices: [{ id: 'p-a', amount: 2, currency: CURRENCY }],
          },
        ],
      },
    ],
  },
};

describe('configurableProductOutputSchema', () => {
  it('parses a full configurable product down to its addon prices', () => {
    const parsed = configurableProductOutputSchema.parse(FULL_PAYLOAD);

    expect(parsed.name).toBe('Crispy Chicken');
    expect(parsed.prices[0].amount).toBe(9.68);
    expect(parsed.prices[0].currency?.displayFormat).toBe('SUFFIX');
    expect(parsed.prices[0].restriction?.effectiveTo).toBeNull();
    expect(parsed.subcategories[0].visible).toBe(true);
    expect(parsed.configuration?.attributes[0].required).toBe(true);
    expect(parsed.configuration?.attributes[0].attributes[0].prices[0].amount).toBe(2);
  });

  it('parses an id-only product, defaulting every collection to an empty array', () => {
    const parsed = configurableProductOutputSchema.parse({ id: 'prod-1' });

    expect(parsed.prices).toEqual([]);
    expect(parsed.subcategories).toEqual([]);
    expect(parsed.subclassifications).toEqual([]);
    expect(parsed.keywords).toEqual([]);
    // Absent, not defaulted: a product with no addons is not the same as one
    // whose configuration failed to load.
    expect(parsed.configuration).toBeUndefined();
  });

  it('accepts a null configuration — a configurable product need not carry addons', () => {
    const parsed = configurableProductOutputSchema.parse({
      id: 'prod-1',
      configuration: null,
    });

    expect(parsed.configuration).toBeNull();
  });

  it('defaults a null prices list to an empty array rather than failing', () => {
    const parsed = configurableProductOutputSchema.parse({ id: 'prod-1', prices: null });

    expect(parsed.prices).toEqual([]);
  });

  it('defaults an attribute group with a null attributes list to an empty array', () => {
    const parsed = configurableProductOutputSchema.parse({
      id: 'prod-1',
      configuration: { id: 'conf-1', attributes: [{ id: 'grp-1', attributes: null }] },
    });

    expect(parsed.configuration?.attributes[0].attributes).toEqual([]);
  });

  it('rejects a product with no id, naming id in the issue path', () => {
    const result = configurableProductOutputSchema.safeParse({ name: 'no id here' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'id')).toBe(true);
  });

  it('rejects an unrecognised displayFormat instead of formatting against a guess', () => {
    const result = configurableProductOutputSchema.safeParse({
      id: 'prod-1',
      prices: [{ id: 'p-1', amount: 1, currency: { displayFormat: 'MIDDLE' } }],
    });

    // `prices` is `.catch([])`, so a bad price does not fail the parse — it
    // drops the whole list, which the caller reads as "no applicable price".
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.prices).toEqual([]);
  });
});

describe('productOutputSchema', () => {
  it('does not model configuration — the base endpoint never returns addons', () => {
    const parsed = productOutputSchema.parse(FULL_PAYLOAD);

    expect(parsed).not.toHaveProperty('configuration');
  });
});
