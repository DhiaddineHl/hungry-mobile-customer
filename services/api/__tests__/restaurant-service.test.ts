import { ApiError, apiClient } from '@/services/api/client';
import { fetchRestaurantById, fetchRestaurants } from '@/services/api/restaurant-service';

jest.mock('@/services/api/client', () => {
  const actual = jest.requireActual('@/services/api/client');
  return {
    ...actual,
    apiClient: { get: jest.fn(), defaults: { baseURL: 'http://192.168.1.10:8082' } },
  };
});

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

const VALID_UUID = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';

const RESTAURANT = {
  id: VALID_UUID,
  name: 'Tacoth',
  cuisines: ['French Tacos'],
  dishes: [],
  days: [],
};

function pageOf(content: unknown[]) {
  return {
    data: {
      content,
      number: 0,
      totalPages: 1,
      totalElements: content.length,
      last: true,
      size: 10,
      first: true,
      numberOfElements: content.length,
      empty: content.length === 0,
      sort: { sorted: false },
      pageable: { pageNumber: 0 },
    },
  };
}

/** The `params` object axios was handed on the single call made. */
function lastQuery(): Record<string, unknown> {
  const [, config] = mockedGet.mock.calls[0];
  return (config as { params: Record<string, unknown> }).params;
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('fetchRestaurants', () => {
  it('parses the flat PageImpl envelope down to the five fields the client uses', async () => {
    mockedGet.mockResolvedValue(pageOf([RESTAURANT]));

    const page = await fetchRestaurants();

    expect(page.content).toHaveLength(1);
    expect(page.content[0].name).toBe('Tacoth');
    expect(page.totalElements).toBe(1);
    expect(page.last).toBe(true);
    expect(page).not.toHaveProperty('pageable');
  });

  it('defaults to page 0 / size 10 and emits no filter or sort', async () => {
    mockedGet.mockResolvedValue(pageOf([]));

    await fetchRestaurants();

    expect(mockedGet).toHaveBeenCalledWith('/restaurants/all', expect.anything());
    expect(lastQuery()).toEqual({ page: 0, size: 10 });
  });

  it('builds a names + LIKE + STRING filter for nameLike', async () => {
    mockedGet.mockResolvedValue(pageOf([]));

    await fetchRestaurants({ nameLike: 'taco' });

    expect(JSON.parse(lastQuery().filter as string)).toEqual({
      names: [{ operator: 'LIKE', fieldValue: 'taco', fieldType: 'STRING' }],
    });
  });

  it('never emits a cuisines or dishes filter — the backend 500s on those', async () => {
    mockedGet.mockResolvedValue(pageOf([]));

    await fetchRestaurants({ nameLike: 'taco', sort: 'name' });

    const filter = lastQuery().filter as string;
    expect(filter).not.toContain('cuisines');
    expect(filter).not.toContain('dishes');
  });

  it('omits the filter entirely for a blank nameLike', async () => {
    mockedGet.mockResolvedValue(pageOf([]));

    await fetchRestaurants({ nameLike: '   ' });

    expect(lastQuery()).not.toHaveProperty('filter');
  });

  it('serializes a whitelisted sort field', async () => {
    mockedGet.mockResolvedValue(pageOf([]));

    await fetchRestaurants({ sort: 'foundedYear', page: 2, size: 25 });

    const query = lastQuery();
    expect(query.page).toBe(2);
    expect(query.size).toBe(25);
    expect(JSON.parse(query.sort as string)).toEqual([
      { field: 'foundedYear', direction: 'ASC' },
    ]);
  });

  it('rejects a sort field outside the whitelist at the type level', async () => {
    mockedGet.mockResolvedValue(pageOf([]));

    // @ts-expect-error 'notAField' is not a RestaurantSortField — the backend 500s on it.
    await fetchRestaurants({ sort: 'notAField' });
  });

  it('throws an ApiError naming the offending path when an item fails to parse', async () => {
    mockedGet.mockResolvedValue(pageOf([{ name: 'no id here' }]));

    await expect(fetchRestaurants()).rejects.toThrow(ApiError);
    await expect(fetchRestaurants()).rejects.toThrow(/content\.0\.id/);
  });
});

describe('fetchRestaurantById', () => {
  it('returns the parsed restaurant', async () => {
    mockedGet.mockResolvedValue({ data: RESTAURANT });

    const restaurant = await fetchRestaurantById(VALID_UUID);

    expect(restaurant?.id).toBe(VALID_UUID);
    expect(mockedGet).toHaveBeenCalledWith(`/restaurants/${VALID_UUID}`);
  });

  it('reads a 500 on a well-formed UUID as not-found — the backend does not send 404', async () => {
    mockedGet.mockRejectedValue(new ApiError('NoSuchElementException', 500));

    await expect(fetchRestaurantById(VALID_UUID)).resolves.toBeNull();
  });

  it('treats a 400 as not-found', async () => {
    mockedGet.mockRejectedValue(new ApiError('Invalid UUID string', 400));

    await expect(fetchRestaurantById(VALID_UUID)).resolves.toBeNull();
  });

  it('treats a 404 as not-found, should the backend ever be fixed', async () => {
    mockedGet.mockRejectedValue(new ApiError('Not Found', 404));

    await expect(fetchRestaurantById(VALID_UUID)).resolves.toBeNull();
  });

  it('re-throws anything that is not 400/404/500', async () => {
    mockedGet.mockRejectedValue(new ApiError('Unauthorized', 401));

    await expect(fetchRestaurantById(VALID_UUID)).rejects.toThrow('Unauthorized');
  });

  it('short-circuits a non-UUID id without making a request', async () => {
    await expect(fetchRestaurantById('1')).resolves.toBeNull();
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('throws an ApiError when the response does not match the schema', async () => {
    mockedGet.mockResolvedValue({ data: { name: 'no id here' } });

    await expect(fetchRestaurantById(VALID_UUID)).rejects.toThrow(ApiError);
    await expect(fetchRestaurantById(VALID_UUID)).rejects.toThrow(/id/);
  });
});
