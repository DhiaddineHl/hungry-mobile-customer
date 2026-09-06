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

The code is complete, but a push token cannot be minted without two pieces of
project configuration that are not in the repo:

1. **An EAS project id.** Run `eas init` in `hungry-customer`. It writes
   `extra.eas.projectId` into `app.json`, which `getExpoPushTokenAsync` needs.
   Until then `ensurePushRegistration` returns
   `{ status: 'unsupported' }` and logs exactly that.

2. **Android FCM credentials.** Create a Firebase project, download
   `google-services.json`, and either place it at `android/app/` +
   `expo.android.googleServicesFile` in `app.json`, or upload the FCM v1 service
   account key with `eas credentials`. iOS needs an Apple push key, which EAS
   generates during `eas build` if you let it.

3. **Rebuild the native app.** `expo-notifications` is a native module and this
   project has a committed `android/` directory, so Metro alone will not pick it
   up:

   ```
   npx expo prebuild --clean
   npx expo run:android      # or: eas build --profile development
   ```

4. **Emulator vs. device.** An **Android emulator works**, provided the AVD uses
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
