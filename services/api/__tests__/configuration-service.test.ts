import { ApiError, apiClient } from '@/services/api/client';
import { fetchProductConfiguration } from '@/services/api/configuration-service';

jest.mock('@/services/api/client', () => {
  const actual = jest.requireActual('@/services/api/client');
  return {
    ...actual,
    apiClient: { get: jest.fn(), defaults: { baseURL: 'http://192.168.1.10:8082' } },
  };
});

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

const CONFIG_ID = '11111111-2222-3333-4444-555555555555';

/** Every URL axios was handed, in call order. */
function urls(): string[] {
  return mockedGet.mock.calls.map((call) => call[0]);
}

/** The `params` object axios was handed on the first call made. */
function lastQuery(): Record<string, unknown> {
  const [, config] = mockedGet.mock.calls[0];
  return (config as { params: Record<string, unknown> }).params;
}

function pageOf(content: unknown[]) {
  return {
    data: {
      content,
      number: 0,
      totalPages: 1,
      totalElements: content.length,
      last: true,
      size: content.length,
      first: true,
      numberOfElements: content.length,
      empty: content.length === 0,
    },
  };
}

/** A group as `/attribute-groups/all` really returns one: options nested. */
function group(id: string, name: string, options: unknown[] = [], required = false) {
  return { id, code: `GRP-${id}`, name, description: null, required, attributes: options };
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('fetchProductConfiguration', () => {
  it('costs ONE request — the groups come back with their options nested', async () => {
    mockedGet.mockResolvedValue(pageOf([group('g1', 'Size')]));

    await fetchProductConfiguration(CONFIG_ID);

    expect(urls()).toEqual(['/attribute-groups/all']);
  });

  it('filters by productConfigurationId as a plain string, not a FilterSpecification', async () => {
    mockedGet.mockResolvedValue(pageOf([]));

    await fetchProductConfiguration(CONFIG_ID);

    expect(JSON.parse(String(lastQuery().filter))).toEqual({
      productConfigurationId: CONFIG_ID,
    });
  });

  it('asks for creation order — the controller default would reverse the groups', async () => {
    mockedGet.mockResolvedValue(pageOf([]));

    await fetchProductConfiguration(CONFIG_ID);

    expect(lastQuery().sort).toBe(
      JSON.stringify([{ field: 'createdAt', direction: 'ASC' }])
    );
  });

  it('carries `required` and each option with its own prices', async () => {
    mockedGet.mockResolvedValue(
      pageOf([
        group(
          'g1',
          'Size',
          [
            { id: 'a1', name: 'Large', prices: [{ amount: 2.5 }] },
            { id: 'a2', name: 'Small', prices: [] },
          ],
          true
        ),
        group('g2', 'Extras', [{ id: 'a3', name: 'Egg', prices: [] }]),
      ])
    );

    const groups = await fetchProductConfiguration(CONFIG_ID);

    expect(groups).toHaveLength(2);
    expect(groups[0].required).toBe(true);
    expect(groups[0].attributes.map((option) => option.name)).toEqual(['Large', 'Small']);
    expect(groups[0].attributes[0].prices[0].amount).toBe(2.5);
    expect(groups[1].required).toBe(false);
  });

  it('ignores the back-reference each option carries to its own group', async () => {
    // AttributeGroupPopulator nests a flat copy of the group on every option.
    // It has no attributes of its own, so reading it would add nothing.
    mockedGet.mockResolvedValue(
      pageOf([
        group('g1', 'Size', [
          {
            id: 'a1',
            name: 'Large',
            prices: [],
            attributeGroup: { id: 'g1', name: 'Size', required: true, attributes: null },
          },
        ]),
      ])
    );

    const groups = await fetchProductConfiguration(CONFIG_ID);

    expect(groups).toHaveLength(1);
    expect(groups[0].attributes.map((option) => option.name)).toEqual(['Large']);
  });

  it('reads no matching groups as nothing to ask, not as an error', async () => {
    // A filter matching nothing answers an empty page, unlike a /{id} route
    // where a missing record answers 500.
    mockedGet.mockResolvedValue(pageOf([]));

    await expect(fetchProductConfiguration(CONFIG_ID)).resolves.toEqual([]);
  });

  it('tolerates a group whose options came back null', async () => {
    mockedGet.mockResolvedValue(pageOf([{ id: 'g1', name: 'Size', attributes: null }]));

    const groups = await fetchProductConfiguration(CONFIG_ID);

    expect(groups[0].attributes).toEqual([]);
  });

  it('drops a group with no id — the screen keys selections by it', async () => {
    mockedGet.mockResolvedValue(pageOf([{ name: 'Nameless' }, group('g1', 'Size')]));

    const groups = await fetchProductConfiguration(CONFIG_ID);

    expect(groups.map((each) => each.id)).toEqual(['g1']);
  });

  it('propagates a failure instead of reporting a dish that asks nothing', async () => {
    // "No required choices" and "we could not find out" are opposite
    // instructions to the screen — the first lets the dish into the cart.
    mockedGet.mockRejectedValue(new ApiError('Internal Server Error', 500));

    await expect(fetchProductConfiguration(CONFIG_ID)).rejects.toThrow(ApiError);
  });

  it('throws an ApiError naming the path when the page does not match', async () => {
    mockedGet.mockResolvedValue({ data: { content: 'not a list' } });

    await expect(fetchProductConfiguration(CONFIG_ID)).rejects.toThrow(/content/);
  });
});
