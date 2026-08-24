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

const PRODUCT = {
  id: VALID_UUID,
  name: 'Crispy Chicken',
  subcategories: [],
  subclassifications: [],
  keywords: [],
  prices: [],
};

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

/** The URL axios was handed on the single call made. */
function lastUrl(): string {
  return mockedGet.mock.calls[0][0];
}

/** The `params` object axios was handed on the single call made. */
function lastQuery(): Record<string, unknown> {
  const [, config] = mockedGet.mock.calls[0];
  return (config as { params: Record<string, unknown> }).params;
}

function lastFilter(): Record<string, unknown> {
  return JSON.parse(String(lastQuery().filter));
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('fetchMenu', () => {
  it('reads /configurable-products/all, never /products/all — addons live only there', async () => {
    mockedGet.mockResolvedValue(pageOf([PRODUCT]));

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(lastUrl()).toBe('/configurable-products/all');
  });

  it('sends catalogVersionId as a plain string, not a FilterSpecification', async () => {
    mockedGet.mockResolvedValue(pageOf([PRODUCT]));

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(lastFilter()).toEqual({ catalogVersionId: CATALOG_VERSION_ID });
  });

  it('sends catalogId as a plain string when that is the scope', async () => {
    mockedGet.mockResolvedValue(pageOf([PRODUCT]));

    await fetchMenu({ catalogId: CATALOG_ID });

    expect(lastFilter()).toEqual({ catalogId: CATALOG_ID });
  });

  it('adds categoryId to the same filter object as a plain string', async () => {
    mockedGet.mockResolvedValue(pageOf([PRODUCT]));

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID }, { categoryId: 'cat-1' });

    expect(lastFilter()).toEqual({
      catalogVersionId: CATALOG_VERSION_ID,
      categoryId: 'cat-1',
    });
  });

  it('turns nameLike into a names + LIKE specification', async () => {
    mockedGet.mockResolvedValue(pageOf([PRODUCT]));

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID }, { nameLike: '  pizza ' });

    expect(lastFilter().names).toEqual([
      { operator: 'LIKE', fieldValue: 'pizza', fieldType: 'STRING' },
    ]);
  });

  it('NEVER emits a keyword filter — the backend answers it with a 500', async () => {
    mockedGet.mockResolvedValue(pageOf([PRODUCT]));

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID }, { nameLike: 'pizza' });

    expect(Object.keys(lastFilter())).not.toContain('keyword');
    expect(JSON.stringify(lastQuery())).not.toContain('keyword');
  });

  it('omits an empty nameLike rather than sending a LIKE on nothing', async () => {
    mockedGet.mockResolvedValue(pageOf([PRODUCT]));

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID }, { nameLike: '   ' });

    expect(lastFilter()).toEqual({ catalogVersionId: CATALOG_VERSION_ID });
  });

  it('sends sort only when asked, and only from the whitelisted union', async () => {
    mockedGet.mockResolvedValue(pageOf([PRODUCT]));

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID }, { sort: 'name' });

    expect(lastQuery().sort).toBe(JSON.stringify([{ field: 'name', direction: 'ASC' }]));
  });

  it('omits sort entirely when none is given — an unknown field is a 500', async () => {
    mockedGet.mockResolvedValue(pageOf([PRODUCT]));

    await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(lastQuery()).not.toHaveProperty('sort');
  });

  it('parses the flat PageImpl envelope down to the five fields the client uses', async () => {
    mockedGet.mockResolvedValue(pageOf([PRODUCT]));

    const page = await fetchMenu({ catalogVersionId: CATALOG_VERSION_ID });

    expect(page.content).toHaveLength(1);
    expect(page.content[0].name).toBe('Crispy Chicken');
    expect(page.totalElements).toBe(1);
    expect(page).not.toHaveProperty('pageable');
  });

  it('throws an ApiError naming the offending path when the response does not match', async () => {
    mockedGet.mockResolvedValue(pageOf([{ name: 'no id here' }]));

    await expect(fetchMenu({ catalogVersionId: CATALOG_VERSION_ID })).rejects.toThrow(
      ApiError
    );
    await expect(fetchMenu({ catalogVersionId: CATALOG_VERSION_ID })).rejects.toThrow(
      /content\.0\.id/
    );
  });
});

describe('fetchProductById', () => {
  it('returns the parsed product for a well-formed id', async () => {
    mockedGet.mockResolvedValue({ data: PRODUCT });

    const product = await fetchProductById(VALID_UUID);

    expect(product?.name).toBe('Crispy Chicken');
    expect(lastUrl()).toBe(`/configurable-products/${VALID_UUID}`);
  });

  it('reads a 500 on a well-formed UUID as not-found, since a missing id is a 500 here', async () => {
    mockedGet.mockRejectedValue(new ApiError('Internal Server Error', 500));

    await expect(fetchProductById(VALID_UUID)).resolves.toBeNull();
  });

  it('treats 404 and 400 as not-found too', async () => {
    mockedGet.mockRejectedValueOnce(new ApiError('Not Found', 404));
    await expect(fetchProductById(VALID_UUID)).resolves.toBeNull();

    mockedGet.mockRejectedValueOnce(new ApiError('Bad Request', 400));
    await expect(fetchProductById(VALID_UUID)).resolves.toBeNull();
  });

  it('rejects a malformed id without a request — it would 500 indistinguishably', async () => {
    await expect(fetchProductById('abc')).resolves.toBeNull();

    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('re-throws a failure that is not a not-found, such as a 503 from the gateway', async () => {
    mockedGet.mockRejectedValue(new ApiError('Service Unavailable', 503));

    await expect(fetchProductById(VALID_UUID)).rejects.toThrow(ApiError);
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
