# Push notifications — order confirmations

How the customer learns that a restaurant accepted their order, whether or not
the app is open.

## Why push and not the WebSocket

The platform already has `jfwk-notification` (STOMP over WebSocket), and
`AssignmentPersistenceListener` uses it to announce driver assignments. It is
the wrong tool here: a socket only exists while the app is running, so an order
confirmed after the customer locked their phone would produce a frame with
nobody listening, and nothing would be retried. A push token is registered with
the OS, so APNs/FCM deliver to the notification tray with the app backgrounded
or killed, and `expo-notifications` surfaces the same message through its
foreground handler when the app *is* open. One mechanism covers both states,
which is why no STOMP client was added to the app.

## The path an order confirmation takes

```
Dashboard "Confirm"                 hungry-frontend
  POST /orders/{id}/confirm         → gateway → hungry-app
    OrderCrudService.confirm()      CREATED → CONFIRMED, publishes
      OrderConfirmedEvent           (inside the transaction, entity still attached)
        ↓ AFTER_COMMIT, on a virtual thread
    OrderNotificationListener       looks up the customer's device tokens
      PushNotificationPort          → ExpoPushNotificationAdapter
        POST exp.host/--/api/v2/push/send
          ↓
    APNs / FCM → the phone
      expo-notifications            foreground: banner via the handler
                                    background/closed: OS notification tray
      use-push-notifications.ts     invalidates the order queries; a tap opens
                                    /orders/{orderId}
```

The event is published **inside** the transaction so the entity's associations
can still be read, and consumed **after commit** so a rolled-back confirmation
never produces a notification that cannot be un-sent. Delivery runs off the
request thread: it is an HTTPS round trip to Expo with a 10-second ceiling, and
the dashboard's Confirm button must not wait on it.

## Files

**Backend** (`hungry-web/hungry-backend/hungry-platform/hungry-core`)

| File | Role |
| --- | --- |
| `core/application/port/PushNotificationPort.java` | Outbound port — framework-free, like `VerificationEmailPort` |
| `core/infrastructure/adapter/push/ExpoPushNotificationAdapter.java` | Expo HTTP adapter; chunks at 100 tokens, reads per-token tickets |
| `core/infrastructure/config/PushNotificationConfig.java` | Wiring + the `enabled` switch |
| `customer/application/model/CustomerDevice.java` | One registered installation |
| `customer/application/service/CustomerDeviceService.java` | Register / unregister / look up / prune |
| `customer/infrastructure/adapter/rest/CustomerDeviceController.java` | `POST` and `DELETE /customers/me/devices` |
| `order/application/event/OrderConfirmedEvent.java` | Carries order id, code, customer id, restaurant name |
| `order/infrastructure/listener/OrderNotificationListener.java` | `AFTER_COMMIT` → push |

**App** (`hungry-delivery-mobile/hungry-customer`)

| File | Role |
| --- | --- |
| `services/notifications/push-service.ts` | Permission, Android channel, token, register/unregister |
| `services/api/device-service.ts` | The two backend calls |
| `hooks/use-push-notifications.ts` | Registration, query invalidation, tap routing |

## The contract between the two halves

Two strings must agree, and nothing will fail loudly if they stop agreeing:

- **Android channel id `orders`** — `ANDROID_CHANNEL_ID` in
  `ExpoPushNotificationAdapter` and `ORDERS_CHANNEL_ID` in `push-service.ts`.
  From Android 8, a notification naming a channel the app never created is
  dropped by the OS, silently.
- **The `data` payload** — the backend writes `type: "ORDER_CONFIRMED"`,
  `orderId`, `orderCode`; `use-push-notifications.ts` branches on `type` and
  routes on `orderId`. A mismatch breaks tap-to-open with no error.

## Setup required before this works on a device

The code is complete. What follows is project configuration; the state of each
item as of 2026-09-13 is noted.

1. **An EAS project id — DONE.** `eas init` wrote
   `extra.eas.projectId = eb77a000-b8ff-4398-83c3-90b0cfb4f5b5` into `app.json`,
   which `getExpoPushTokenAsync` needs. Without it `ensurePushRegistration`
   returns `{ status: 'unsupported' }` and logs exactly that.

2. **Firebase app config — DONE.** `google-services.json` (Firebase project
   `hungry-delivery-app-869c6`) sits at the repo root and is referenced by
   `expo.android.googleServicesFile`. Its Android client is registered under
   the package **`com.hungry.customer`**, so `expo.android.package` was changed
   to that (it was `com.dhiaddinehlaoui.hungrycustomer`, which the Google
   Services Gradle plugin would have refused with *"No matching client found
   for package name"*). It matches the sibling apps (`com.hungry.deliverer`).

   The file is not tracked by git. An **EAS cloud build** therefore cannot see
   it: either commit it (Firebase does not treat it as a secret — the keys in
   it are restricted by package + certificate) or upload it as an EAS file
   environment variable and point `googleServicesFile` at that path.

3. **FCM V1 server credential on EAS — STILL TO DO, and it is the last one.**
   `google-services.json` lets the *app* obtain an FCM device token; it does
   NOT let *Expo's push service* talk to FCM on the backend's behalf. That needs
   the Firebase service-account key uploaded to the EAS project:

   ```
   eas credentials --platform android
   # → select the build profile → "Push Notifications: Manage your FCM V1 API key"
   #   → upload the JSON from Firebase console:
   #     Project settings → Service accounts → Generate new private key
   ```

   Until this is done every send answers a `DeviceNotRegistered` /
   `InvalidCredentials` ticket from exp.host and the backend logs it as a
   failed push — nothing arrives on the phone, nothing else looks wrong.

   iOS needs an Apple push key instead; EAS generates one during `eas build`
   if you let it.

4. **Rebuild the native app.** `expo-notifications` and Firebase are native, so
   Metro alone will not pick any of this up. `android/` is gitignored and is
   regenerated from `app.json`:

   ```
   npx expo prebuild --platform android --clean
   npx expo run:android      # or: eas build --profile development
   ```

   A correct prebuild leaves `android/app/google-services.json` in place,
   `apply plugin: 'com.google.gms.google-services'` in `android/app/build.gradle`,
   `applicationId 'com.hungry.customer'`, and the `orders` channel as
   `com.google.firebase.messaging.default_notification_channel_id` in the
   manifest.

5. **Emulator vs. device.** An **Android emulator works**, provided the AVD uses
   a system image labelled *Google Play* or *Google APIs* — FCM needs Google Play
   services, not real hardware. A bare AOSP image has none and fails at
   `getExpoPushTokenAsync`. The **iOS Simulator never works**: it has no APNs
   connection, and `ensurePushRegistration` rejects it up front rather than
   throwing.

No backend credential is needed: Expo's send endpoint is public.
`hungry.push.expo.access-token` is only required if the Expo account turns on
"enhanced security for push notifications", and `hungry.push.expo.enabled=false`
makes the adapter log what it would have sent — useful for an environment with
no outbound internet.

## Behaviour worth knowing

- **Registration runs on every launch**, not once at sign-up. The OS can rotate
  a push token at any time (reinstall, restore onto a new phone), and a customer
  whose token moved would otherwise go permanently silent with no signal. The
  backend's register is idempotent.
- **A token moves between accounts.** Sign in as A, sign out, sign in as B on
  the same handset and the OS hands back the same token. `register` re-points
  the existing row at whoever is signed in rather than inserting a second one,
  and sign-out unregisters *before* clearing the session — otherwise A's order
  updates would land on B's lock screen.
- **Dead tokens are pruned, not retried.** Expo answers `DeviceNotRegistered`
  for an uninstalled app; those rows are deleted after the send.
- **Only confirmation is pushed.** PREPARING, READY and the delivery statuses
  still reach the customer through the 20-second poll in `use-customer-orders.ts`.
  Extending this means publishing a comparable event from the other transitions
  and adding a branch to the listener.

## Schema

`CustomerDevice` adds one table. Dev creates it automatically
(`spring.jpa.hibernate.ddl-auto=create`), but **prod is `validate` and the
project has no migration tool**, so the table must exist before hungry-app will
start there — the same manual step `customer_email_verification` needed:

```sql
CREATE TABLE customer_device (
    id               UUID         NOT NULL PRIMARY KEY,
    customer_id      UUID         NOT NULL,
    keycloak_user_id VARCHAR(255),
    push_token       VARCHAR(512) NOT NULL UNIQUE,
    platform         VARCHAR(255),
    device_name      VARCHAR(255),
    created_at       TIMESTAMP    NOT NULL,
    last_seen_at     TIMESTAMP    NOT NULL
);
CREATE INDEX idx_customer_device_customer ON customer_device (customer_id);
```
