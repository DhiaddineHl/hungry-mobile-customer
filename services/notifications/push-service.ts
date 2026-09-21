import { Palette } from '@/constants/theme';
import { registerDevice, unregisterDevice, type DevicePlatform } from '@/services/api/device-service';
import { isApiError } from '@/services/api/client';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Everything between "the OS will let us notify this user" and "the backend
 * knows where to send it".
 *
 * The delivery path this sets up is a real push, not an in-app socket, and that
 * is the point: a WebSocket only exists while the app is running, so an order
 * confirmed after the customer locked their phone would be lost. A push token
 * is registered with the OS, so APNs/FCM deliver whether the process is alive,
 * backgrounded, or killed — the app is not involved until the customer taps.
 *
 * Three environment constraints are checked before a token is ever requested,
 * because each fails in a way worth telling apart in the logs:
 *
 *   1. **The iOS Simulator has no push token.** It has no APNs connection, so
 *      asking throws. An Android emulator is NOT in this category — see the
 *      guard in {@link ensurePushRegistration}.
 *   2. **The web build has none either.** Web push needs a VAPID key pair and a
 *      service worker this app does not ship.
 *   3. **A project id is required.** Since SDK 49 `getExpoPushTokenAsync` needs
 *      the EAS project id to mint a token, and it is not inferable — a project
 *      that never ran `eas init` cannot get one. See {@link projectId}.
 */

/**
 * Android notification channel. Its id must match `ANDROID_CHANNEL_ID` in the
 * backend's `ExpoPushNotificationAdapter`: from Android 8 a notification naming
 * a channel the app never created is dropped by the OS with no error anywhere.
 */
const ORDERS_CHANNEL_ID = 'orders';

/**
 * How a delivered push is presented while the app is in the FOREGROUND.
 *
 * Set at module scope so it is installed before any listener can fire. Without
 * it, a push that arrives with the app open is delivered to the JS listeners but
 * shows nothing — the customer looking at the menu would never see that their
 * order was accepted.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** What `ensurePushRegistration` did, so the caller can log something useful. */
export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'denied' }
  | { status: 'unsupported'; reason: string }
  | { status: 'failed'; reason: string };

/**
 * The EAS project id Expo mints push tokens against.
 *
 * Read from the resolved config rather than hardcoded: `eas init` writes it to
 * `app.json` under `extra.eas.projectId`, and both shapes below are the ones
 * Expo has used for it.
 */
function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function currentPlatform(): DevicePlatform {
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
}

/**
 * Creates the Android channel the backend addresses. No-op on other platforms.
 *
 * Safe to call repeatedly — Android treats a repeat create as an update, and the
 * user's own overrides of importance or sound are preserved.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL_ID, {
    name: 'Order updates',
    description: 'Tells you when a restaurant accepts your order and how the delivery is going.',
    // MAX rather than DEFAULT: this is the notification that turns a placed
    // order into a confirmed one, and it should surface as a heads-up banner.
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: Palette.primary,
  });
}

/**
 * Asks for permission if it has not been decided yet, and reports whether we
 * have it.
 *
 * Never re-prompts: once the user has denied, iOS silently resolves the request
 * without showing anything and Android only re-shows it under its own rules, so
 * asking again is at best a no-op. Re-enabling is a trip to system settings.
 */
async function ensurePermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Gets this device's push token and tells the backend about it.
 *
 * Called on every launch with a session, not once at sign-up: the OS can rotate
 * a push token at any time (a reinstall, a restore onto a new phone), and a
 * customer whose token moved would otherwise go permanently silent with nothing
 * to indicate it. Registration is idempotent on the backend, so repeating it is
 * free.
 *
 * Returns rather than throws. A customer who declined notifications, or is on a
 * simulator, must still be able to use the app.
 */
export async function ensurePushRegistration(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { status: 'unsupported', reason: 'Web push is not configured for this app.' };
  }

  // iOS only. The iOS Simulator has no APNs connection at all, so a token can
  // never be minted there. An ANDROID EMULATOR is a different case and is
  // deliberately let through: FCM needs Google Play services, not real hardware,
  // so an image labelled "Google Play" or "Google APIs" registers and receives
  // pushes exactly like a handset. Rejecting it on `!Device.isDevice` — as this
  // did at first — would rule out the emulator most Android work is tested on.
  // A bare AOSP image has no Play services and fails at
  // `getExpoPushTokenAsync` below, which reports the real reason.
  if (Platform.OS === 'ios' && !Device.isDevice) {
    return {
      status: 'unsupported',
      reason: 'The iOS Simulator cannot register with APNs — push needs a physical iPhone.',
    };
  }

  const id = projectId();
  if (!id) {
    return {
      status: 'unsupported',
      reason:
        'No EAS project id in the app config. Run `eas init` (it writes extra.eas.projectId ' +
        'into app.json) and rebuild — Expo cannot mint a push token without it.',
    };
  }

  try {
    // Before the permission prompt: the channel decides how Android presents
    // the permission and the notifications that follow it.
    await ensureAndroidChannel();

    if (!(await ensurePermission())) {
      return { status: 'denied' };
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });

    await registerDevice({
      pushToken: token,
      platform: currentPlatform(),
      deviceName: Device.deviceName ?? Device.modelName,
    });

    return { status: 'registered', token };
  } catch (error) {
    // A 404 means the account has no customer record yet — the login flow
    // creates one, so this registration merely raced it and the next launch
    // will succeed. Called out separately so it is not read as a push fault.
    if (isApiError(error, 404)) {
      return {
        status: 'failed',
        reason: 'The account has no customer record yet; registration will retry on the next launch.',
      };
    }
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Stops push delivery to this device.
 *
 * Must run BEFORE the session is cleared: the request is authenticated, so once
 * the tokens are gone the backend can no longer tell whose device this is. The
 * cost of skipping it is concrete — the next person to sign in on this handset
 * gets the same OS token, and until they register it the previous account's
 * order updates would land on their lock screen.
 *
 * Swallows failures: a sign-out must not be blocked by an unreachable backend.
 * The stale row is corrected on the next registration, which re-points the token
 * at whoever signed in.
 */
export async function clearPushRegistration(): Promise<void> {
  // Mirrors the guard in ensurePushRegistration: anything that could not have
  // registered has nothing to unregister.
  if (Platform.OS === 'web' || (Platform.OS === 'ios' && !Device.isDevice)) return;

  const id = projectId();
  if (!id) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await unregisterDevice(token);
  } catch (error) {
    console.warn('[Push] Could not unregister this device on sign-out:', error);
  }
}
