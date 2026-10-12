import { apiClient } from '@/services/api/client';
import { registerDevice, unregisterDevice } from '@/services/api/device-service';

jest.mock('@/services/api/client', () => {
  const actual = jest.requireActual('@/services/api/client');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      put: jest.fn(),
      defaults: { baseURL: 'http://192.168.1.10:8082' },
    },
  };
});

const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockedDelete = apiClient.delete as jest.MockedFunction<typeof apiClient.delete>;

const TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('registerDevice', () => {
  it('posts the token to the caller-scoped route', async () => {
    mockedPost.mockResolvedValue({ data: { id: 'd1', platform: 'android' } });

    await registerDevice({ pushToken: TOKEN, platform: 'android', deviceName: 'Pixel 8' });

    expect(mockedPost).toHaveBeenCalledWith('/customers/me/devices', {
      pushToken: TOKEN,
      platform: 'android',
      deviceName: 'Pixel 8',
    });
  });

  // The route carries no customer id anywhere: the backend reads the account
  // from the token's `sub`. A body that grew one would be a way to register a
  // device against somebody else's identity.
  it('sends no customer identifier of any kind', async () => {
    mockedPost.mockResolvedValue({ data: {} });

    await registerDevice({ pushToken: TOKEN, platform: 'ios' });

    const [url, body] = mockedPost.mock.calls[0];
    expect(url).not.toMatch(/customers\/[0-9a-f-]{36}/i);
    expect(Object.keys(body as object).sort()).toEqual(['deviceName', 'platform', 'pushToken']);
  });

  it('sends an explicit null when the device has no name', async () => {
    mockedPost.mockResolvedValue({ data: {} });

    await registerDevice({ pushToken: TOKEN, platform: 'ios' });

    expect(mockedPost).toHaveBeenCalledWith(
      '/customers/me/devices',
      expect.objectContaining({ deviceName: null })
    );
  });

  it('propagates a failure so the caller can tell registration did not happen', async () => {
    mockedPost.mockRejectedValue(new Error('offline'));

    await expect(
      registerDevice({ pushToken: TOKEN, platform: 'android' })
    ).rejects.toThrow('offline');
  });
});

describe('unregisterDevice', () => {
  // A DELETE with a body, not a path segment: the token contains brackets and
  // would have to survive two rounds of encoding through the gateway.
  it('sends the token in the request body', async () => {
    mockedDelete.mockResolvedValue({ data: '' });

    await unregisterDevice(TOKEN);

    expect(mockedDelete).toHaveBeenCalledWith('/customers/me/devices', {
      data: { pushToken: TOKEN },
    });
  });
});
