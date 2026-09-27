import { apiClient } from '@/services/api/client';
import {
  nearbyRestaurants,
  popularRestaurants,
  searchAll,
  searchProducts,
  searchRestaurants,
} from '@/services/api/search-service';

jest.mock('@/services/api/client', () => {
  const actual = jest.requireActual('@/services/api/client');
  return {
    ...actual,
    apiClient: { get: jest.fn(), defaults: { baseURL: 'http://192.168.1.10:8082' } },
  };
});

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

const RESTAURANT_DOC = {
  id: 'r1',
  name: 'Le Petit Sousse',
  cuisines: ['Tunisian'],
  hasActivePromotion: true,
  promotionHeadline: 'Up to 55% off',
};

const PRODUCT_DOC = {
  id: 'p1',
  vendorId: 'r1',
  name: 'Coca-Cola 33cl',
  price: 3,
  effectivePrice: 1.35,
  hasActivePromotion: true,
  promotionLabel: '55% off',
};

function pageOf(content: unknown[]) {
  return { data: { content, number: 0, totalPages: 1, totalElements: content.length, last: true } };
}

/** The `params` object axios was handed on the single call made. */
function lastQuery(): Record<string, unknown> {
  const [, config] = mockedGet.mock.calls[0];
  return (config as { params: Record<string, unknown> }).params;
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('searchAll', () => {
  it('parses the grouped restaurants/products result', async () => {
    mockedGet.mockResolvedValue({
      data: {
        restaurants: { numFound: 1, documents: [RESTAURANT_DOC] },
        products: { numFound: 1, documents: [PRODUCT_DOC] },
      },
    });

    const result = await searchAll('coca');

    expect(mockedGet).toHaveBeenCalledWith('/search', expect.anything());
    expect(lastQuery()).toEqual({ q: 'coca', page: 0, size: 10 });
    expect(result.restaurants.documents[0].name).toBe('Le Petit Sousse');
    expect(result.products.documents[0].effectivePrice).toBe(1.35);
  });
});

describe('searchRestaurants', () => {
  it('hits /search/restaurants and parses the Page envelope', async () => {
    mockedGet.mockResolvedValue(pageOf([RESTAURANT_DOC]));

    const page = await searchRestaurants({ hasPromotion: true });

    expect(mockedGet).toHaveBeenCalledWith('/search/restaurants', expect.anything());
    expect(lastQuery()).toEqual({ hasPromotion: true });
    expect(page.content[0].promotionHeadline).toBe('Up to 55% off');
  });
});

describe('popularRestaurants', () => {
  it('unwraps the raw {documents} shape rather than a Page envelope', async () => {
    mockedGet.mockResolvedValue({ data: { numFound: 1, documents: [RESTAURANT_DOC] } });

    const restaurants = await popularRestaurants();

    expect(restaurants).toHaveLength(1);
    expect(restaurants[0].id).toBe('r1');
  });
});

describe('searchProducts', () => {
  it('passes vendorId through so a restaurant menu is one request', async () => {
    mockedGet.mockResolvedValue(pageOf([PRODUCT_DOC]));

    const page = await searchProducts({ vendorId: 'r1' });

    expect(lastQuery()).toEqual({ vendorId: 'r1' });
    expect(page.content[0].name).toBe('Coca-Cola 33cl');
  });
});

describe('nearbyRestaurants', () => {
  it('sends lat/lon/radiusKm through to /search/nearby-restaurants', async () => {
    mockedGet.mockResolvedValue(pageOf([RESTAURANT_DOC]));

    await nearbyRestaurants({ lat: 35.8, lon: 10.6, radiusKm: 5 });

    expect(mockedGet).toHaveBeenCalledWith('/search/nearby-restaurants', expect.anything());
    expect(lastQuery()).toEqual({ lat: 35.8, lon: 10.6, radiusKm: 5 });
  });
});
