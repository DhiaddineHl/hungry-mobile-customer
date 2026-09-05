import { useRestaurantMenu } from '@/hooks/use-products';
import * as menuService from '@/services/api/menu-service';
import * as productService from '@/services/api/product-service';
import type { RestaurantDetail } from '@/services/api/restaurant-view-model';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

/**
 * A restaurant whose menu was never created in the back-office resolves to no
 * menu category at all, and the screen says so instead of showing an empty
 * menu.
 *
 * The ordering matters as much as the outcome: callers check `unavailable`
 * BEFORE `isPending`, because it is the more specific state. So `unavailable`
 * must stay null until the category lookup has actually settled — otherwise
 * every restaurant flashes "no menu" for the length of one round-trip.
 *
 * One rendered test per file, for the reason
 * `use-create-order-success.test.tsx` documents.
 */

jest.mock('@/services/api/menu-service');
jest.mock('@/services/api/product-service');

const mockedMenuService = jest.mocked(menuService);
const mockedProductService = jest.mocked(productService);

const RESTAURANT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const RESTAURANT: RestaurantDetail = {
  id: RESTAURANT_ID,
  name: 'Baguette & Baguette',
  categories: 'Fast food',
  isOpen: true,
  phones: [],
  days: [],
};

/** Every state the hook passed through, in order, as the screen would read them. */
const seen: string[] = [];

function Probe() {
  const { isPending, unavailable } = useRestaurantMenu(RESTAURANT);

  // The screen's own precedence: unavailable is checked before pending.
  const state = unavailable ? 'unavailable' : isPending ? 'loading' : 'menu';
  if (seen[seen.length - 1] !== state) seen.push(state);

  return <Text>{state}</Text>;
}

it('reports a missing menu category as unavailable, and never before the lookup settles', async () => {
  let resolveScope: (scope: null) => void = () => {};
  mockedMenuService.fetchMenuScope.mockReturnValue(
    new Promise((resolve) => {
      resolveScope = resolve;
    })
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  await render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );

  // While the lookup is in flight the menu is LOADING, not unavailable.
  await waitFor(() => expect(screen.getByText('loading')).toBeTruthy());

  resolveScope(null);

  await waitFor(() => expect(screen.getByText('unavailable')).toBeTruthy());

  // No menu category means no product request was ever worth firing.
  expect(mockedProductService.fetchMenu).not.toHaveBeenCalled();
  // And the screen never showed "no menu" before it knew that.
  expect(seen).toEqual(['loading', 'unavailable']);

  client.clear();
});
