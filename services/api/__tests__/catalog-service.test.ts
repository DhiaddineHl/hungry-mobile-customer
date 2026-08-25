import {
  fetchMenuScope,
  menuCatalogCode,
  menuVersionCode,
} from '@/services/api/catalog-service';
import { ApiError, apiClient } from '@/services/api/client';

jest.mock('@/services/api/client', () => {
  const actual = jest.requireActual('@/services/api/client');
  return {
    ...actual,
    apiClient: { get: jest.fn(), defaults: { baseURL: 'http://192.168.1.10:8082' } },
  };
});

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

const RESTAURANT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const VERSION_ID = '11111111-2222-3333-4444-555555555555';
const CATALOG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function pageOf(content: unknown[]) {
  return {
    data: {
      content,
      number: 0,
      totalPages: 1,
      totalElements: content.length,
      last: true,
    },
  };
}

/** Routes the mock by URL so a test does not depend on call order. */
function mockCatalogs(options: { version?: unknown[]; catalog?: unknown[] }) {
  mockedGet.mockImplementation((url: string) =>
    Promise.resolve(
      pageOf(url.startsWith('/catalog-versions') ? (options.version ?? []) : (options.catalog ?? []))
    )
  );
}

function urls(): string[] {
  return mockedGet.mock.calls.map((call) => call[0]);
}

function queryOf(index: number): Record<string, unknown> {
  const [, config] = mockedGet.mock.calls[index];
  return (config as { params: Record<string, unknown> }).params;
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('menu codes', () => {
  // These must match the back-office byte for byte: it is what CREATES the
  // catalog, and an EQUALS filter on `code` is case-sensitive.
  it('builds the catalog code the back-office files a menu under', () => {
    expect(menuCatalogCode(RESTAURANT_ID)).toBe(`RESTAURANT-MENU-${RESTAURANT_ID}`);
  });

  it('builds the version code as the catalog code plus -V1', () => {
    expect(menuVersionCode(RESTAURANT_ID)).toBe(`RESTAURANT-MENU-${RESTAURANT_ID}-V1`);
  });

  it('does NOT upper-case the restaurant id — the back-office does not either', () => {
    const mixed = '7C9e6679-7425-40de-944b-E07fc1f90ae7';

    expect(menuCatalogCode(mixed)).toContain(mixed);
    expect(menuVersionCode(mixed)).toContain(mixed);
  });
});

describe('fetchMenuScope', () => {
  it('resolves the catalog VERSION, which is the scope a menu should be read with', async () => {
    mockCatalogs({ version: [{ id: VERSION_ID, code: menuVersionCode(RESTAURANT_ID) }] });

    await expect(fetchMenuScope(RESTAURANT_ID)).resolves.toEqual({
      catalogVersionId: VERSION_ID,
    });
  });

  it('spends one request when the version resolves — both codes are deterministic', async () => {
    mockCatalogs({ version: [{ id: VERSION_ID }] });

    await fetchMenuScope(RESTAURANT_ID);

    expect(urls()).toEqual(['/catalog-versions/all']);
  });

  it('filters on `codes` with EQUALS — the read-by-id route cannot resolve a code', async () => {
    mockCatalogs({ version: [{ id: VERSION_ID }] });

    await fetchMenuScope(RESTAURANT_ID);

    expect(JSON.parse(String(queryOf(0).filter))).toEqual({
      codes: [
        {
          operator: 'EQUALS',
          fieldValue: menuVersionCode(RESTAURANT_ID),
          fieldType: 'STRING',
        },
      ],
    });
  });

  it('asks for a single row — codes are unique', async () => {
    mockCatalogs({ version: [{ id: VERSION_ID }] });

    await fetchMenuScope(RESTAURANT_ID);

    expect(queryOf(0)).toMatchObject({ page: 0, size: 1 });
  });

  it('falls back to the catalog when no version carries the expected code', async () => {
    mockCatalogs({ version: [], catalog: [{ id: CATALOG_ID }] });

    await expect(fetchMenuScope(RESTAURANT_ID)).resolves.toEqual({ catalogId: CATALOG_ID });
    expect(urls()).toEqual(['/catalog-versions/all', '/catalogs/all']);
  });

  it('resolves to null when the menu was never created — not an error', async () => {
    mockCatalogs({ version: [], catalog: [] });

    await expect(fetchMenuScope(RESTAURANT_ID)).resolves.toBeNull();
  });

  it('propagates a real failure rather than reading it as "no menu"', async () => {
    mockedGet.mockRejectedValue(new ApiError('Service Unavailable', 503));

    await expect(fetchMenuScope(RESTAURANT_ID)).rejects.toThrow(ApiError);
  });

  it('throws an ApiError naming the path when an entry carries no id', async () => {
    mockCatalogs({ version: [{ code: 'no id here' }] });

    await expect(fetchMenuScope(RESTAURANT_ID)).rejects.toThrow(/content\.0\.id/);
  });
});
