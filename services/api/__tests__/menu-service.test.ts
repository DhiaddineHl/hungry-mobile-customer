import { ApiError, apiClient } from '@/services/api/client';
import { fetchMenuScope, menuCategoryCode } from '@/services/api/menu-service';

jest.mock('@/services/api/client', () => {
  const actual = jest.requireActual('@/services/api/client');
  return {
    ...actual,
    apiClient: { get: jest.fn(), defaults: { baseURL: 'http://192.168.1.10:8082' } },
  };
});

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

const RESTAURANT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const MENU_ID = '11111111-2222-3333-4444-555555555555';
const PIZZAS_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const DRINKS_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

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

/**
 * Both requests go to the same URL, so the mock is routed by the FILTER: the
 * menu category is looked up by code, its sections by supercategory.
 */
function mockCategories(options: { menu?: unknown[]; sections?: unknown[] }) {
  mockedGet.mockImplementation((_url: string, config?: unknown) => {
    const params = (config as { params: Record<string, unknown> }).params;
    const filter = JSON.parse(String(params.filter));
    return Promise.resolve(
      pageOf(filter.codes ? (options.menu ?? []) : (options.sections ?? []))
    );
  });
}

function urls(): string[] {
  return mockedGet.mock.calls.map((call) => call[0]);
}

function queryOf(index: number): Record<string, unknown> {
  const [, config] = mockedGet.mock.calls[index];
  return (config as { params: Record<string, unknown> }).params;
}

function filterOf(index: number): Record<string, unknown> {
  return JSON.parse(String(queryOf(index).filter));
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('menuCategoryCode', () => {
  // This must match the back-office byte for byte: it is what CREATES the
  // category, and an EQUALS filter on `code` is case-sensitive.
  it('builds the code the back-office files a menu category under', () => {
    expect(menuCategoryCode(RESTAURANT_ID)).toBe(`RESTAURANT-MENU-${RESTAURANT_ID}`);
  });

  it('does NOT upper-case the restaurant id — the back-office does not either', () => {
    const mixed = '7C9e6679-7425-40de-944b-E07fc1f90ae7';

    expect(menuCategoryCode(mixed)).toBe(`RESTAURANT-MENU-${mixed}`);
  });
});

describe('fetchMenuScope', () => {
  it('resolves the menu category and the sections hanging off it', async () => {
    mockCategories({
      menu: [{ id: MENU_ID, code: menuCategoryCode(RESTAURANT_ID) }],
      sections: [
        { id: PIZZAS_ID, name: 'Pizzas' },
        { id: DRINKS_ID, name: 'Drinks' },
      ],
    });

    await expect(fetchMenuScope(RESTAURANT_ID)).resolves.toEqual({
      menuCategoryId: MENU_ID,
      sections: [
        { id: PIZZAS_ID, name: 'Pizzas' },
        { id: DRINKS_ID, name: 'Drinks' },
      ],
    });
  });

  it('reads categories only — a menu is a category now, not a catalog', async () => {
    mockCategories({ menu: [{ id: MENU_ID }], sections: [] });

    await fetchMenuScope(RESTAURANT_ID);

    expect(urls()).toEqual(['/categories/all', '/categories/all']);
  });

  it('finds the menu on `codes` with EQUALS — the read-by-id route cannot resolve a code', async () => {
    mockCategories({ menu: [{ id: MENU_ID }], sections: [] });

    await fetchMenuScope(RESTAURANT_ID);

    expect(filterOf(0)).toEqual({
      codes: [
        {
          operator: 'EQUALS',
          fieldValue: menuCategoryCode(RESTAURANT_ID),
          fieldType: 'STRING',
        },
      ],
    });
    expect(queryOf(0)).toMatchObject({ page: 0, size: 1 });
  });

  it('finds the sections by supercategoryId, as a plain UUID string', async () => {
    mockCategories({ menu: [{ id: MENU_ID }], sections: [{ id: PIZZAS_ID }] });

    await fetchMenuScope(RESTAURANT_ID);

    expect(filterOf(1)).toEqual({ supercategoryId: MENU_ID });
  });

  it('resolves to null when the menu was never created — not an error', async () => {
    mockCategories({ menu: [] });

    await expect(fetchMenuScope(RESTAURANT_ID)).resolves.toBeNull();
    // No menu category means there is nothing to ask for sections of.
    expect(urls()).toEqual(['/categories/all']);
  });

  it('resolves to an EMPTY section list when the menu holds none — that is an empty menu, not a missing one', async () => {
    mockCategories({ menu: [{ id: MENU_ID }], sections: [] });

    await expect(fetchMenuScope(RESTAURANT_ID)).resolves.toEqual({
      menuCategoryId: MENU_ID,
      sections: [],
    });
  });

  it('drops a section switched off in the back-office rather than fetching it', async () => {
    mockCategories({
      menu: [{ id: MENU_ID }],
      sections: [
        { id: PIZZAS_ID, name: 'Pizzas' },
        { id: DRINKS_ID, name: 'Hidden', visible: false },
      ],
    });

    const scope = await fetchMenuScope(RESTAURANT_ID);

    expect(scope?.sections).toEqual([{ id: PIZZAS_ID, name: 'Pizzas' }]);
  });

  it('keeps a section that simply says nothing about active/visible', async () => {
    mockCategories({ menu: [{ id: MENU_ID }], sections: [{ id: PIZZAS_ID }] });

    const scope = await fetchMenuScope(RESTAURANT_ID);

    expect(scope?.sections).toEqual([{ id: PIZZAS_ID, name: null }]);
  });

  it('propagates a real failure rather than reading it as "no menu"', async () => {
    mockedGet.mockRejectedValue(new ApiError('Service Unavailable', 503));

    await expect(fetchMenuScope(RESTAURANT_ID)).rejects.toThrow(ApiError);
  });

  it('throws an ApiError naming the path when a category carries no id', async () => {
    mockCategories({ menu: [{ code: 'no id here' }] });

    await expect(fetchMenuScope(RESTAURANT_ID)).rejects.toThrow(/content\.0\.id/);
  });
});
