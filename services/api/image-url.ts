import { getTokens } from '@/services/keycloak/token-storage';
import { apiClient } from './client';

/**
 * Restaurant media (`logoUrl`, `coverImageUrl`) arrives from the backend as a
 * **relative** path — `S3FileStorageService.buildPublicUrl` returns
 * `/files/{entity}/{id}/{file}` — and `/files/**` sits behind the same bearer
 * auth as every other gateway route.
 *
 * Handing such a value straight to `expo-image` therefore fails twice, both
 * times silently: React Native cannot resolve a relative URI, and even once
 * joined the request 401s because `<Image>` does not pass through
 * `apiClient`'s interceptor. This module exists so the join and the header are
 * done in one place rather than re-derived at every call site.
 */

const ABSOLUTE_URL = /^https?:\/\//i;

/**
 * Joins a backend-relative `/files/...` path onto `EXPO_PUBLIC_API_URL`.
 *
 * Returns `undefined` — never the bare base URL — for a missing value, so a
 * caller falls through to {@link RESTAURANT_IMAGE_PLACEHOLDER} instead of
 * rendering the API root as an image.
 */
export function resolveImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;

  // Already absolute: pass through untouched, so this keeps working if the
  // backend ever starts serving fully-qualified URLs.
  if (ABSOLUTE_URL.test(path)) return path;

  const base = apiClient.defaults.baseURL;
  if (!base) return undefined;

  // Exactly one slash, whether or not either side already carries one.
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * Auth headers for an image request. Images bypass `apiClient`'s request
 * interceptor, so the token has to be attached deliberately.
 *
 * Deliberately does NOT repeat the interceptor's refresh logic: any screen
 * rendering an image has already fetched the restaurant through an
 * authenticated endpoint, so the stored token was valid moments ago.
 */
export async function imageAuthHeaders(): Promise<Record<string, string>> {
  const tokens = await getTokens();
  if (!tokens?.accessToken) return {};
  return { Authorization: `Bearer ${tokens.accessToken}` };
}
