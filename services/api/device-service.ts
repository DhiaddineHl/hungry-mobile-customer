import { apiClient } from './client';

/**
 * Push-device registration against the gateway.
 *
 * Both routes act on the CALLER's account: the backend takes the Keycloak user
 * id from the token's `sub`, never from the body, so there is no customer id to
 * pass and no way to register a device against somebody else's identity. They
 * are authenticated — unlike `POST /customers` and the verification exchange,
 * a device only ever registers once a session exists.
 *
 * Unusually for this folder there is no zod schema here. Nothing downstream
 * reads the response: registration is a write whose only interesting outcome is
 * "did it throw", and unregister answers 204 with no body at all. Parsing a
 * shape no caller consumes would be ceremony, not safety.
 */

const DEVICES = '/customers/me/devices';

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface DeviceRegistration {
  /** The Expo push token, `ExponentPushToken[...]`. */
  pushToken: string;
  platform: DevicePlatform;
  /** Human-readable device name, for support. Optional. */
  deviceName?: string | null;
}

/**
 * Registers this device so order updates reach it while the app is
 * backgrounded or closed.
 *
 * Idempotent: re-posting the same token refreshes it, and a token the backend
 * holds for another account is moved to this one — which is what the app relies
 * on when a second user signs in on the same handset, because the OS hands back
 * the same token for both.
 *
 * Throws `ApiError` 404 when the account has no customer record yet. The caller
 * treats that as "not ready", not as a failure: `ensureCustomerForAccount` runs
 * at login and creates one, so a 404 here means registration simply raced it.
 */
export async function registerDevice(registration: DeviceRegistration): Promise<void> {
  await apiClient.post(DEVICES, {
    pushToken: registration.pushToken,
    platform: registration.platform,
    deviceName: registration.deviceName ?? null,
  });
}

/**
 * Stops push delivery to one token — called on sign-out, before the session is
 * torn down, because the request needs the token that is about to be cleared.
 *
 * The backend answers 204 whether or not it held the token, so this never
 * distinguishes "removed" from "was not there".
 */
export async function unregisterDevice(pushToken: string): Promise<void> {
  // DELETE with a body: axios needs it under `data`, and the backend reads it
  // as @RequestBody. The token is deliberately not in the path — it contains
  // brackets, and a path segment would have to survive two layers of encoding
  // through the gateway.
  await apiClient.delete(DEVICES, { data: { pushToken } });
}
