import { ApiError, apiClient } from '@/services/api/client';
import {
  fetchMenu,
  fetchProductById,
  fetchProductImageUrl,
} from '@/services/api/product-service';

jest.mock('@/services/api/client', () => {
  const actual = jest.requireActual('@/services/api/client');
  return {
    ...actual,
    apiClient: { get: jest.fn(), defaults: { baseURL: 'http://192.168.1.10:8082' } },
  };
});

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

const VALID_UUID = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';
const STANDARD_UUID = '99999999-8888-7777-6666-555555555555';

/**
 * A menu is its restaurant's menu CATEGORY plus the sections under it, and the
 * sections are the only thing that narrows products to one restaurant — see
 * `services/api/menu-service.ts`. `fetchMenu` therefore reads one section per
 * request.
 */
const MENU_CATEGORY_ID = '11111111-2222-3333-4444-555555555555';
const PIZZAS_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const DRINKS_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

const ONE_SECTION = {
  menuCategoryId: MENU_CATEGORY_ID,
  sections: [{ id: PIZZAS_ID, name: 'Pizzas' }],
};

const TWO_SECTIONS = {
  menuCategoryId: MENU_CATEGORY_ID,
  sections: [
    { id: PIZZAS_ID, name: 'Pizzas' },
    { id: DRINKS_ID, name: 'Drinks' },
  ],
};

/** A standard dish, discriminator 1. */
const PRODUCT = {
  id: VALID_UUID,
  name: 'Crispy Chicken',
  productType: 1,
  subcategories: [],
  subclassifications: [],
  keywords: [],
  prices: [],
};

/** The same dish as a configurable one, discriminator 2. */
const CONFIGURABLE_PRODUCT = { ...PRODUCT, productType: 2 };

function pageOf(content: unknown[]) {
  return {
    data: {
      content,
      number: 0,
      totalPages: 1,
      totalElements: content.length,
      last: true,
      size: 20,
      first: true,
      numberOfElements: content.length,
      empty: content.length === 0,
      sort: { sorted: false },
      pageable: { pageNumber: 0 },
    },
  };
}

/** The URL axios was handed on the first call made. */
function lastUrl(): string {
  return mockedGet.mock.calls[0][0];
}

/** Every URL axios was handed, in call order. */
function urls(): string[] {
  return mockedGet.mock.calls.map((call) => call[0]);
}

/** The `params` object axios was handed on the first call made. */
function lastQuery(): Record<string, unknown> {
  return queryOf(0);
}

/** The `params` object of the nth call. */
function queryOf(index: number): Record<string, unknown> {
  const [, config] = mockedGet.mock.calls[index];
  return (config as { params: Record<string, unknown> }).params;
}

function lastFilter(): Record<string, unknown> {
  return filterOf(0);
}

/** The parsed `filter` of the nth call — one call per menu section. */
function filterOf(index: number): Record<string, unknown> {
  return JSON.parse(String(queryOf(index).filter));
}

/** Every section answers the same page; `productType` labels the rows. */
function mockMenu(products: unknown[]) {
  mockedGet.mockResolvedValue(pageOf(products));
}

/** Routes each section's request to its own products, by the categoryId sent. */
function mockSections(bySection: Record<string, unknown[]>) {
  mockedGet.mockImplementation((_url: string, config?: unknown) => {
    const params = (config as { params: Record<string, unknown> }).params;
    const { categoryId } = JSON.parse(String(params.filter));
    return Promise.resolve(pageOf(bySection[String(categoryId)] ?? []));
  });
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('fetchMenu', () => {
  it('reads the polymorphic /products/all — a menu holds standard dishes too', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu(ONE_SECTION);

    expect(lastUrl()).toBe('/products/all');
  });

  it('filters by categoryId as a plain string — the only field that narrows to one menu', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu(ONE_SECTION);

    expect(lastFilter()).toEqual({ categoryId: PIZZAS_ID });
  });

  it('NEVER filters on a catalog — every restaurant now shares one', async () => {
    // A catalogVersionId filter would return the whole platform's dishes.
    mockMenu([PRODUCT]);

    await fetchMenu(ONE_SECTION);

    const query = JSON.stringify(lastQuery());
    expect(query).not.toContain('catalogVersionId');
    expect(query).not.toContain('catalogId');
  });

  it('costs one request per section, each scoped to its own category', async () => {
    mockSections({ [PIZZAS_ID]: [PRODUCT], [DRINKS_ID]: [] });

    await fetchMenu(TWO_SECTIONS);

    expect(urls()).toEqual(['/products/all', '/products/all']);
    expect([filterOf(0).categoryId, filterOf(1).categoryId]).toEqual([
      PIZZAS_ID,
      DRINKS_ID,
    ]);
  });

  it('merges the sections into one menu', async () => {
    mockSections({
      [PIZZAS_ID]: [PRODUCT],
      [DRINKS_ID]: [{ ...PRODUCT, id: STANDARD_UUID, name: 'Lemonade' }],
    });

    const page = await fetchMenu(TWO_SECTIONS);

    expect(page.content.map((product) => product.name)).toEqual([
      'Crispy Chicken',
      'Lemonade',
    ]);
    expect(page.totalElements).toBe(2);
  });

  it('keeps a dish filed under two sections ONCE — the duplicate is the fan-out, not the menu', async () => {
    mockSections({ [PIZZAS_ID]: [PRODUCT], [DRINKS_ID]: [PRODUCT] });

    const page = await fetchMenu(TWO_SECTIONS);

    expect(page.content).toHaveLength(1);
    expect(page.totalElements).toBe(1);
  });

  it('narrows to a single section when the caller asks for one', async () => {
    mockSections({ [PIZZAS_ID]: [PRODUCT], [DRINKS_ID]: [] });

    const page = await fetchMenu(TWO_SECTIONS, { categoryId: PIZZAS_ID });

    expect(urls()).toEqual(['/products/all']);
    expect(lastFilter()).toEqual({ categoryId: PIZZAS_ID });
    expect(page.content).toHaveLength(1);
  });

  it('reads a categoryId outside the menu as an empty menu, without a request', async () => {
    // The scope decides which products are this restaurant's; a caller must
    // not be able to step outside it.
    mockMenu([PRODUCT]);

    const page = await fetchMenu(TWO_SECTIONS, { categoryId: 'not-a-section-of-this-menu' });

    expect(page.content).toEqual([]);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('asks for nothing when the menu has no section yet', async () => {
    mockMenu([PRODUCT]);

    const page = await fetchMenu({ menuCategoryId: MENU_CATEGORY_ID, sections: [] });

    expect(page.content).toEqual([]);
    expect(page.totalElements).toBe(0);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('labels discriminator 2 as configurable', async () => {
    mockMenu([CONFIGURABLE_PRODUCT]);

    const page = await fetchMenu(ONE_SECTION);

    expect(page.content[0].isConfigurable).toBe(true);
  });

  it('labels discriminator 1 as standard', async () => {
    mockMenu([PRODUCT]);

    const page = await fetchMenu(ONE_SECTION);

    expect(page.content[0].isConfigurable).toBe(false);
  });

  it('treats a missing or unknown productType as standard rather than dropping the dish', async () => {
    // `resolveProductType` answers null for a subtype it does not know, and a
    // future subtype must not blank the menu or open an empty sheet.
    mockMenu([
      { ...PRODUCT, productType: null },
      { ...PRODUCT, id: STANDARD_UUID, productType: 7 },
    ]);

    const page = await fetchMenu(ONE_SECTION);

    expect(page.content).toHaveLength(2);
    expect(page.content.map((product) => product.isConfigurable)).toEqual([false, false]);
  });

  it('carries both subtypes through in one page — a menu holds standard dishes too', async () => {
    mockMenu([CONFIGURABLE_PRODUCT, { ...PRODUCT, id: STANDARD_UUID, name: 'Plain Fries' }]);

    const page = await fetchMenu(ONE_SECTION);

    expect(page.content.map((product) => product.name)).toEqual([
      'Crispy Chicken',
      'Plain Fries',
    ]);
    expect(page.content.map((product) => product.isConfigurable)).toEqual([true, false]);
  });

  it('passes the caller paging straight through to each section', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu(ONE_SECTION, { page: 3, size: 5 });

    expect(lastQuery()).toMatchObject({ page: 3, size: 5 });
  });

  it('turns nameLike into a names + LIKE specification, per section', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu(ONE_SECTION, { nameLike: '  pizza ' });

    expect(lastFilter().names).toEqual([
      { operator: 'LIKE', fieldValue: 'pizza', fieldType: 'STRING' },
    ]);
    expect(lastFilter().categoryId).toBe(PIZZAS_ID);
  });

  it('NEVER emits a keyword filter — the backend answers it with a 500', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu(ONE_SECTION, { nameLike: 'pizza' });

    expect(Object.keys(lastFilter())).not.toContain('keyword');
    expect(JSON.stringify(lastQuery())).not.toContain('keyword');
  });

  it('omits an empty nameLike rather than sending a LIKE on nothing', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu(ONE_SECTION, { nameLike: '   ' });

    expect(lastFilter()).toEqual({ categoryId: PIZZAS_ID });
  });

  it('sends sort only when asked, and only from the whitelisted union', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu(ONE_SECTION, { sort: 'name' });

    expect(lastQuery().sort).toBe(JSON.stringify([{ field: 'name', direction: 'ASC' }]));
  });

  it('omits sort entirely when none is given — an unknown field is a 500', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu(ONE_SECTION);

    expect(lastQuery()).not.toHaveProperty('sort');
  });

  it('parses the flat PageImpl envelope down to the five fields the client uses', async () => {
    mockMenu([PRODUCT]);

    const page = await fetchMenu(ONE_SECTION);

    expect(page.content).toHaveLength(1);
    expect(page.content[0].name).toBe('Crispy Chicken');
    expect(page.totalElements).toBe(1);
    expect(page).not.toHaveProperty('pageable');
  });

  it('accepts the catalog and catalogVersion the backend really sends — objects, not strings', async () => {
    mockMenu([
      {
        ...PRODUCT,
        catalog: { id: 'cat-1', code: 'DEFAULT-CATALOG', name: 'Default Catalog' },
        catalogVersion: { id: 'ver-1', code: 'DEFAULT-STAGED', name: 'Staged' },
      },
    ]);

    const page = await fetchMenu(ONE_SECTION);

    expect(page.content[0].catalogVersion?.id).toBe('ver-1');
  });

  it('throws an ApiError naming the offending path when the response does not match', async () => {
    mockMenu([{ name: 'no id here' }]);

    await expect(fetchMenu(ONE_SECTION)).rejects.toThrow(ApiError);
    await expect(fetchMenu(ONE_SECTION)).rejects.toThrow(/content\.0\.id/);
  });
});

describe('fetchProductById', () => {
  it('reads the polymorphic base route first — it answers for every dish', async () => {
    mockedGet.mockResolvedValue({ data: PRODUCT });

    const product = await fetchProductById(VALID_UUID);

    expect(product?.name).toBe('Crispy Chicken');
    expect(product?.isConfigurable).toBe(false);
    expect(urls()).toEqual([`/products/${VALID_UUID}`]);
  });

  it('costs ONE request for a standard dish — the old order cost two', async () => {
    mockedGet.mockResolvedValue({ data: PRODUCT });

    await fetchProductById(VALID_UUID);

    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('asks the configurable route only for discriminator 2, and only for its configuration', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: CONFIGURABLE_PRODUCT })
      .mockResolvedValueOnce({
        data: { ...CONFIGURABLE_PRODUCT, configuration: { id: 'conf-1', attributes: [] } },
      });

    const product = await fetchProductById(VALID_UUID);

    expect(product?.isConfigurable).toBe(true);
    expect(product?.configuration?.id).toBe('conf-1');
    expect(urls()).toEqual([
      `/products/${VALID_UUID}`,
      `/configurable-products/${VALID_UUID}`,
    ]);
  });

  it('never mislabels a configurable dish as standard when its detail read fails', async () => {
    // The old order read a 500 from the configurable route as "then it must be
    // standard", which silently dropped the choices the dish requires. The
    // discriminator has already answered by this point, so a failure here costs
    // the configuration, not the label.
    mockedGet
      .mockResolvedValueOnce({ data: CONFIGURABLE_PRODUCT })
      .mockRejectedValueOnce(new ApiError('Internal Server Error', 500));

    const product = await fetchProductById(VALID_UUID);

    expect(product?.isConfigurable).toBe(true);
    expect(product?.configuration).toBeUndefined();
    expect(product?.name).toBe('Crispy Chicken');
  });

  it('returns null when the base route reports not-found', async () => {
    mockedGet.mockRejectedValue(new ApiError('Internal Server Error', 500));

    await expect(fetchProductById(VALID_UUID)).resolves.toBeNull();
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('treats 404 and 400 as not-found too', async () => {
    mockedGet.mockRejectedValue(new ApiError('Not Found', 404));
    await expect(fetchProductById(VALID_UUID)).resolves.toBeNull();

    mockedGet.mockRejectedValue(new ApiError('Bad Request', 400));
    await expect(fetchProductById(VALID_UUID)).resolves.toBeNull();
  });

  it('rejects a malformed id without a request — it would 500 indistinguishably', async () => {
    await expect(fetchProductById('abc')).resolves.toBeNull();

    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('re-throws a failure that is not a not-found, such as a 503 from the gateway', async () => {
    mockedGet.mockRejectedValue(new ApiError('Service Unavailable', 503));

    await expect(fetchProductById(VALID_UUID)).rejects.toThrow(ApiError);
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('throws an ApiError when the product does not match the schema', async () => {
    mockedGet.mockResolvedValue({ data: { name: 'no id here' } });

    await expect(fetchProductById(VALID_UUID)).rejects.toThrow(/id/);
  });
});

describe('fetchProductImageUrl', () => {
  it('returns the first file url RAW, so a persisted path survives a base-URL change', async () => {
    mockedGet.mockResolvedValue({
      data: [{ id: 'f1', url: '/files/products/x/photo.jpg' }],
    });

    await expect(fetchProductImageUrl(VALID_UUID)).resolves.toBe(
      '/files/products/x/photo.jpg'
    );
    expect(lastUrl()).toBe(`/files/products/${VALID_UUID}`);
  });

  it('returns null for the empty list an unknown id answers with', async () => {
    mockedGet.mockResolvedValue({ data: [] });

    await expect(fetchProductImageUrl(VALID_UUID)).resolves.toBeNull();
  });

  it('skips an entry with no url rather than resolving undefined', async () => {
    mockedGet.mockResolvedValue({
      data: [{ id: 'f1' }, { id: 'f2', url: '/files/products/x/photo.jpg' }],
    });

    await expect(fetchProductImageUrl(VALID_UUID)).resolves.toBe(
      '/files/products/x/photo.jpg'
    );
  });

  it('does not request artwork for a malformed id', async () => {
    await expect(fetchProductImageUrl('abc')).resolves.toBeNull();

    expect(mockedGet).not.toHaveBeenCalled();
  });
});
