import { useProductConfiguration } from '@/hooks/use-products';
import * as configurationService from '@/services/api/configuration-service';
import type { MenuProductOutput } from '@/services/api/product-service';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

/**
 * A configurable dish's addon groups arrive AFTER the dish itself — they are a
 * separate, more expensive read (see `services/api/configuration-service.ts`).
 *
 * That gap is the whole point of this test. Between the dish rendering and its
 * groups arriving, `groups` is empty, which reads exactly like "this dish asks
 * for nothing" — so a screen that only looked at the list would let the
 * customer add a dish without the choices it requires. `isResolving` is what
 * closes that window, and the food screen folds it into `canAddToCart`.
 *
 * One rendered test per file, for the reason
 * `use-create-order-success.test.tsx` documents.
 */

jest.mock('@/services/api/configuration-service');

const mockedConfigurationService = jest.mocked(configurationService);

const CONFIGURABLE: MenuProductOutput = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  name: 'Burger',
  productType: 2,
  isConfigurable: true,
  configuration: { id: 'conf-1', attributes: [] },
  subcategories: [],
  subclassifications: [],
  keywords: [],
  prices: [],
};

/** Every state the hook passed through, as the food screen's gate reads them. */
const seen: string[] = [];

function Probe() {
  const { groups, isResolving } = useProductConfiguration(CONFIGURABLE);

  // The screen's own gate: a configurable dish is not addable while its
  // choices are still unknown.
  const state = isResolving ? 'blocked' : groups.length > 0 ? 'choices' : 'none';
  if (seen[seen.length - 1] !== state) seen.push(state);

  return <Text>{state}</Text>;
}

it('blocks on a configurable dish until its groups arrive, never before', async () => {
  let resolveGroups: (groups: never[]) => void = () => {};
  mockedConfigurationService.fetchProductConfiguration.mockReturnValue(
    new Promise((resolve) => {
      resolveGroups = resolve as (groups: never[]) => void;
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

  // In flight: no groups yet, and the dish must NOT read as "asks for nothing".
  await waitFor(() => expect(screen.getByText('blocked')).toBeTruthy());

  resolveGroups([
    {
      id: 'g1',
      name: 'Size',
      required: true,
      attributes: [{ id: 'a1', name: 'Large', prices: [] }],
    },
  ] as never);

  await waitFor(() => expect(screen.getByText('choices')).toBeTruthy());

  // Addressed by the CONFIGURATION id, not the product id.
  expect(mockedConfigurationService.fetchProductConfiguration).toHaveBeenCalledWith('conf-1');
  // And the empty list was never mistaken for a settled answer.
  expect(seen).toEqual(['blocked', 'choices']);

  client.clear();
});
