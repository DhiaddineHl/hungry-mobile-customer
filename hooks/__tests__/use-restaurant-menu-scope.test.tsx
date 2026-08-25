import { useRestaurantMenu } from '@/hooks/use-products';
import * as catalogService from '@/services/api/catalog-service';
import * as productService from '@/services/api/product-service';
import type { RestaurantDetail } from '@/services/api/restaurant-view-model';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

/**
 * The menu reaches the screen through a catalog the restaurant payload does
 * not name: no `RestaurantOutputData` carries a catalog link, so the scope is
 * resolved from the code the back-office files the menu under.
 *
 * One rendered test per file, for the reason
 * `use-create-order-success.test.tsx` documents.
 *
 * What this proves: the resolved scope is what the menu is actually fetched
 * with — the regression that left every restaurant showing an empty menu.
 */

jest.mock('@/services/api/catalog-service');
jest.mock('@/services/api/product-service');

const mockedCatalogService = jest.mocked(catalogService);
const mockedProductService = jest.mocked(productService);

const RESTAURANT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const VERSION_ID = '11111111-2222-3333-4444-555555555555';

const RESTAURANT: RestaurantDetail = {
  id: RESTAURANT_ID,
  name: 'Baguette & Baguette',
  categories: 'Fast food',
  isOpen: true,
  phones: [],
  days: [],
  // Deliberately absent: the backend serves no catalog link today.
  catalogVersionId: null,
  catalogId: null,
};

function menuProduct(id: string, name: string, isConfigurable: boolean) {
  return {
    id,
    name,
    subcategories: [],
    subclassifications: [],
    keywords: [],
    prices: [],
    isConfigurable,
  };
}

function Probe() {
  const { data, isPending, unavailable } = useRestaurantMenu(RESTAURANT);

  if (isPending) return <Text>loading</Text>;
  if (unavailable) return <Text>unavailable</Text>;

  return (
    <Text>
      {(data ?? [])
        .flatMap((section) => section.products)
        .map((product) => `${product.name}:${product.requiresConfiguration}`)
        .join(',')}
    </Text>
  );
}

it('fetches the menu with the scope resolved from the catalog code', async () => {
  mockedCatalogService.fetchMenuScope.mockResolvedValue({ catalogVersionId: VERSION_ID });
  mockedProductService.fetchMenu.mockResolvedValue({
    content: [
      menuProduct('p1', 'Plain Fries', false),
      {
        ...menuProduct('p2', 'Build-a-Burger', true),
        configuration: {
          id: 'conf-1',
          attributes: [
            { id: 'g1', name: 'Sauce', attributes: [{ id: 'a1', name: 'Harissa', prices: [] }] },
          ],
        },
      },
    ],
    number: 0,
    totalPages: 1,
    totalElements: 2,
    last: true,
  });

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  await render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );

  // Both subtypes reach the menu, each labelled with whether ordering it means
  // answering something first.
  await waitFor(() =>
    expect(
      screen.getByText('Build-a-Burger:true,Plain Fries:false')
    ).toBeTruthy()
  );

  expect(mockedCatalogService.fetchMenuScope).toHaveBeenCalledWith(RESTAURANT_ID);
  expect(mockedProductService.fetchMenu).toHaveBeenCalledWith(
    { catalogVersionId: VERSION_ID },
    {}
  );

  client.clear();
});
