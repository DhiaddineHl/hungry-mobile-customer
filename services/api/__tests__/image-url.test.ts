import { apiClient } from '@/services/api/client';
import { imageAuthHeaders, resolveImageUrl } from '@/services/api/image-url';
import { getTokens } from '@/services/keycloak/token-storage';

jest.mock('@/services/keycloak/token-storage', () => ({
  getTokens: jest.fn(),
}));

const mockedGetTokens = getTokens as jest.MockedFunction<typeof getTokens>;

const ORIGINAL_BASE_URL = apiClient.defaults.baseURL;

afterEach(() => {
  apiClient.defaults.baseURL = ORIGINAL_BASE_URL;
  jest.resetAllMocks();
});

describe('resolveImageUrl', () => {
  it('joins a relative path onto a base with no trailing slash', () => {
    apiClient.defaults.baseURL = 'http://192.168.1.10:8082';
    expect(resolveImageUrl('/files/restaurants/abc/cover-banner.jpg')).toBe(
      'http://192.168.1.10:8082/files/restaurants/abc/cover-banner.jpg'
    );
  });

  it('joins a relative path onto a base WITH a trailing slash without doubling it', () => {
    apiClient.defaults.baseURL = 'http://192.168.1.10:8082/';
    expect(resolveImageUrl('/files/restaurants/abc/cover-banner.jpg')).toBe(
      'http://192.168.1.10:8082/files/restaurants/abc/cover-banner.jpg'
    );
  });

  it('adds the separating slash when the path has no leading one', () => {
    apiClient.defaults.baseURL = 'http://192.168.1.10:8082';
    expect(resolveImageUrl('files/restaurants/abc/logo.png')).toBe(
      'http://192.168.1.10:8082/files/restaurants/abc/logo.png'
    );
  });

  it('still produces one slash when neither side carries one', () => {
    apiClient.defaults.baseURL = 'http://192.168.1.10:8082/';
    expect(resolveImageUrl('files/restaurants/abc/logo.png')).toBe(
      'http://192.168.1.10:8082/files/restaurants/abc/logo.png'
    );
  });

  it('passes an already-absolute https value through untouched', () => {
    apiClient.defaults.baseURL = 'http://192.168.1.10:8082';
    expect(resolveImageUrl('https://cdn.example.com/a.jpg')).toBe(
      'https://cdn.example.com/a.jpg'
    );
  });

  it('passes an already-absolute http value through untouched', () => {
    apiClient.defaults.baseURL = 'http://192.168.1.10:8082';
    expect(resolveImageUrl('http://cdn.example.com/a.jpg')).toBe(
      'http://cdn.example.com/a.jpg'
    );
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
  ])('returns undefined — never the bare base URL — for %s', (_label, value) => {
    apiClient.defaults.baseURL = 'http://192.168.1.10:8082';
    expect(resolveImageUrl(value)).toBeUndefined();
  });
});

describe('imageAuthHeaders', () => {
  it('returns no headers when there is no session', async () => {
    mockedGetTokens.mockResolvedValue(null);
    await expect(imageAuthHeaders()).resolves.toEqual({});
  });

  it('returns a Bearer header when a token is stored', async () => {
    mockedGetTokens.mockResolvedValue({
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
    });
    await expect(imageAuthHeaders()).resolves.toEqual({
      Authorization: 'Bearer access-123',
    });
  });
});
