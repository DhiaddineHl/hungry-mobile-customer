/**
 * The backend endpoints, in one place. Keycloak is addressed DIRECTLY (:8081),
 * the API and its WebSocket through the jfwk-gateway (:8082) — see
 * services/keycloak/config.ts and services/api/client.ts for why.
 *
 * The LAN fallbacks below exist for a developer's first `expo start` without a
 * `.env`. They are deliberately `__DEV__`-only: a release build must never
 * ship internal addresses, nor talk to Keycloak in plaintext.
 */
const DEV_KEYCLOAK_URL = 'http://192.168.242.25:8081';
const DEV_API_URL = 'http://192.168.100.93:8082';

function resolve(name: string, value: string | undefined, devFallback: string): string {
  const url = value || (__DEV__ ? devFallback : '');
  if (!__DEV__ && !url.startsWith('https://')) {
    // Logged rather than thrown while the backend has no TLS endpoint yet, so
    // internal `preview` builds keep working. Once it does, make this throw.
    console.error(
      `[Config] ${name} is ${url ? `not HTTPS (${url})` : 'not set'} in a release build — ` +
        'credentials and tokens would travel in plaintext.'
    );
  }
  return url;
}

export const KEYCLOAK_URL = resolve(
  'EXPO_PUBLIC_KEYCLOAK_URL',
  process.env.EXPO_PUBLIC_KEYCLOAK_URL,
  DEV_KEYCLOAK_URL
);

export const API_URL = resolve('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL, DEV_API_URL);

/** The origin `/files/**` images are served from — the only one that gets a bearer token. */
export function isApiOrigin(url: string): boolean {
  const origin = (u: string) => u.match(/^https?:\/\/[^/?#]+/i)?.[0]?.toLowerCase();
  const api = origin(API_URL);
  return !!api && origin(url) === api;
}
