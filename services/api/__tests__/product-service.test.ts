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
const CATALOG_VERSION_ID = '11111111-2222-3333-4444-555555555555';
const CATALOG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const STANDARD_UUID = '99999999-8888-7777-6666-555555555555';

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
  return JSON.parse(String(lastQuery().filter));
}

/** `fetchMenu` issues one request; `productType` labels the rows. */
function mockMenu(products: unknown[]) {
  mockedGet.mockResolvedValue(pageOf(products));
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('fetchMenu', () => {
  it('reads the polymorphic /products/all — a menu holds standard dishes too', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(lastUrl()).toBe('/products/all');
  });

  it('costs ONE request — productType labels the rows, so nothing has to be looked up', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(urls()).toEqual(['/products/all']);
  });

  it('labels discriminator 2 as configurable', async () => {
    mockMenu([CONFIGURABLE_PRODUCT]);

    const page = await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(page.content[0].isConfigurable).toBe(true);
  });

  it('labels discriminator 1 as standard', async () => {
    mockMenu([PRODUCT]);

    const page = await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(page.content[0].isConfigurable).toBe(false);
  });

  it('treats a missing or unknown productType as standard rather than dropping the dish', async () => {
    // `resolveProductType` answers null for a subtype it does not know, and a
    // future subtype must not blank the menu or open an empty sheet.
    mockMenu([
      { ...PRODUCT, productType: null },
      { ...PRODUCT, id: STANDARD_UUID, productType: 7 },
    ]);

    const page = await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(page.content).toHaveLength(2);
    expect(page.content.map((product) => product.isConfigurable)).toEqual([false, false]);
  });

  it('carries both subtypes through in one page — a menu holds standard dishes too', async () => {
    mockMenu([CONFIGURABLE_PRODUCT, { ...PRODUCT, id: STANDARD_UUID, name: 'Plain Fries' }]);

    const page = await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(page.content.map((product) => product.name)).toEqual([
      'Crispy Chicken',
      'Plain Fries',
    ]);
    expect(page.content.map((product) => product.isConfigurable)).toEqual([true, false]);
  });

  it('sends catalogVersionId as a plain string, not a FilterSpecification', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(lastFilter()).toEqual({ catalogVersionId: CATALOG_VERSION_ID });
  });

  it('sends catalogId as a plain string when that is the scope', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu({ catalogId: CATALOG_ID });

    expect(lastFilter()).toEqual({ catalogId: CATALOG_ID });
  });

  it('passes the caller paging straight through', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID }, { page: 3, size: 5 });

    expect(lastQuery()).toMatchObject({ page: 3, size: 5 });
  });

  it('adds categoryId to the same filter object as a plain string', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID }, { categoryId: 'cat-1' });

    expect(lastFilter()).toEqual({
      catalogVersionId: CATALOG_VERSION_ID,
      categoryId: 'cat-1',
    });
  });

  it('turns nameLike into a names + LIKE specification', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID }, { nameLike: '  pizza ' });

    expect(lastFilter().names).toEqual([
      { operator: 'LIKE', fieldValue: 'pizza', fieldType: 'STRING' },
    ]);
  });

  it('NEVER emits a keyword filter — the backend answers it with a 500', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID }, { nameLike: 'pizza' });

    expect(Object.keys(lastFilter())).not.toContain('keyword');
    expect(JSON.stringify(lastQuery())).not.toContain('keyword');
  });

  it('omits an empty nameLike rather than sending a LIKE on nothing', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID }, { nameLike: '   ' });

    expect(lastFilter()).toEqual({ catalogVersionId: CATALOG_VERSION_ID });
  });

  it('sends sort only when asked, and only from the whitelisted union', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID }, { sort: 'name' });

    expect(lastQuery().sort).toBe(JSON.stringify([{ field: 'name', direction: 'ASC' }]));
  });

  it('omits sort entirely when none is given — an unknown field is a 500', async () => {
    mockMenu([PRODUCT]);

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(lastQuery()).not.toHaveProperty('sort');
  });

  it('parses the flat PageImpl envelope down to the five fields the client uses', async () => {
    mockMenu([PRODUCT]);

    const page = await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(page.content).toHaveLength(1);
    expect(page.content[0].name).toBe('Crispy Chicken');
    expect(page.totalElements).toBe(1);
    expect(page).not.toHaveProperty('pageable');
  });

  it('accepts the catalog and catalogVersion the backend really sends — objects, not strings', async () => {
    mockMenu([
      {
        ...PRODUCT,
        catalog: { id: CATALOG_ID, code: 'RESTAURANT-MENU-x', name: 'Menu' },
        catalogVersion: { id: CATALOG_VERSION_ID, code: 'RESTAURANT-MENU-x-V1', name: 'V1' },
      },
    ]);

    const page = await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(page.content[0].catalogVersion?.id).toBe(CATALOG_VERSION_ID);
  });

  it('throws an ApiError naming the offending path when the response does not match', async () => {
    mockMenu([{ name: 'no id here' }]);

    await expect(fetchMenu({ catalogVersionId: CATALOG_VERSION_ID })).rejects.toThrow(
      ApiError
    );
    await expect(fetchMenu({ catalogVersionId: CATALOG_VERSION_ID })).rejects.toThrow(
      /content\.0\.id/
    );
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
