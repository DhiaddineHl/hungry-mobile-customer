import { useProductImageSources } from '@/hooks/use-products';
import * as productService from '@/services/api/product-service';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

/**
 * Menu artwork is one `GET /files/products/{id}` per dish: products carry no
 * image field and there is no batch files endpoint (plan §3.5). That fan-out
 * is what this hook exists to contain, so what it must prove is that the cost
 * is one request per DISTINCT product — a dish listed under two sections is
 * one request, not two — and that what reaches the card is a resolved,
 * authenticated source rather than the raw relative path, which `expo-image`
 * cannot load and which would 401 if it could.
 *
 * One rendered test per file, for the reason
 * `use-create-order-success.test.tsx` documents.
 */

// Only the network call is faked: `isUuid` is real, because filtering ids
// through it is part of what the hook does.
jest.mock('@/services/api/product-service', () => ({
  ...jest.requireActual('@/services/api/product-service'),
  fetchProductImageUrl: jest.fn(),
}));

// Stands in for the API base and the stored bearer token — neither exists in
// a test process. The join and the header themselves are covered by
// `services/api/__tests__/image-url.test.ts`.
jest.mock('@/services/api/image-url', () => ({
  resolveImageUrl: (path?: string | null) => (path ? `https://api.test${path}` : undefined),
  imageAuthHeaders: async () => ({ Authorization: 'Bearer test-token' }),
}));

const mockedProductService = jest.mocked(productService);

const BURGER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const SALAD = '11111111-2222-3333-4444-555555555555';

// The burger appears twice: the same dish under two menu sections.
const IDS = [BURGER, SALAD, BURGER];

function Probe() {
  const imageFor = useProductImageSources(IDS);

  const burger = imageFor(BURGER) as { uri?: string; headers?: Record<string, string> };

  return (
    <>
      <Text>{burger?.uri ?? 'no-uri'}</Text>
      <Text>{burger?.headers?.Authorization ?? 'no-auth'}</Text>
      {/* A dish with no artwork resolves to nothing, so the card placeholders. */}
      <Text>{imageFor(SALAD) === undefined ? 'salad-none' : 'salad-image'}</Text>
    </>
  );
}

it('resolves one authenticated source per distinct product', async () => {
  mockedProductService.fetchProductImageUrl.mockImplementation(async (id: string) =>
    id === BURGER ? '/files/products/burger/photo.jpg' : null
  );

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  await render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );

  await waitFor(() =>
    expect(screen.getByText('https://api.test/files/products/burger/photo.jpg')).toBeTruthy()
  );

  // `<Image>` bypasses the axios interceptor, so the token is attached here.
  expect(screen.getByText('Bearer test-token')).toBeTruthy();
  // `200 []` is the normal answer for a dish with no photo — not an error.
  expect(screen.getByText('salad-none')).toBeTruthy();

  // The duplicate id cost nothing: two distinct dishes, two requests.
  expect(mockedProductService.fetchProductImageUrl).toHaveBeenCalledTimes(2);
  expect(mockedProductService.fetchProductImageUrl).toHaveBeenCalledWith(BURGER);
  expect(mockedProductService.fetchProductImageUrl).toHaveBeenCalledWith(SALAD);

  client.clear();
});
