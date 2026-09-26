# Live driver tracking — plan

**Goal.** On the order details screen, tapping the driver section opens a modal
with a map that shows the driver moving in real time, plus the restaurant and
the delivery address.

**Status.** Plan only. Needs backend work first: today the backend throws away
the position of a driver who is on a delivery (§1).

**Decisions (2026-09-26).**
- A **new feed**, `/topic/orders/{orderId}/driver-location`, separate from
  `/topic/customers/{orderId}/notifications`.
- Tracking **starts when the driver accepts** the delivery (`ACCEPTED`): the
  customer sees the driver on the way to the restaurant, then on the way to
  them after `PICKED_UP`. It ends at `DELIVERED` / `RETURNED` / `FAILED`.
- **Background location** on the deliverer app is designed here (§3.6) but
  **deferred, not implemented in this pass**. v1 tracks only while the
  deliverer app is in the foreground.

---

## 1. What exists today

### The driver side already sends positions
- `hungry-deliverer/src/hooks/use-driver-location.ts`: `watchPositionAsync`
  (every 5 s / 20 m, **foreground only**). It publishes on every fix while
  `phase !== 'offline'`, so also during a delivery.
- `driver-location-service.ts` sends STOMP `SEND /app/drivers/{driverId}/location`
  with `{ latitude, longitude }`.

### The backend drops those positions for a busy driver
- `LocationController` (`delivery.hungry.location…ws`) passes the position to
  `LocationService.reportPosition`, then to `DriverRegistry.updatePosition`.
- `redis/update_driver_position.lua` returns early when the driver is not a
  member of the GEO set (`ZSCORE`). `markUnavailable` removes a driver from that
  set **the moment they are assigned**. So from `ACCEPTED` to `DELIVERED`, every
  position ping is silently dropped. The customer app's `DriverInfoCard` comment
  already notes this gap.

### Transport for the customer
- One shared STOMP connection: `services/realtime/stomp-client.ts`, with
  `subscribeToTopic`.
- `/topic/customers/{orderId}/notifications` carries `DRIVER_ASSIGNED` only.
  `useOrderDelivery` treats any frame on it as "refetch".
- `StompAuthChannelInterceptor` authenticates CONNECT only. **SUBSCRIBE
  destinations are not authorized**, so any logged-in user can subscribe to any
  order's topic. That is acceptable for "a driver was assigned". It is **not**
  acceptable for a live GPS stream (§3.4).

### Map stack on the customer side
- `react-native-maps` 1.27.2 with a Google key configured (`app.config.ts`). It
  is already used by `map-select.tsx`, `restaurant/[id]/info.tsx` and
  `DeliveryLocationCard`. Maps don't render in Expo Go (`IS_EXPO_GO` fallback in
  `map-view-native.tsx`).
- `OrderOutput` already has `pickupLatitude/Longitude` (restaurant) and
  `dropoffLatitude/Longitude` + `dropoffAddress` (customer).
- `components/ui/bottom-sheet.tsx` exists. A full-screen modal route is the
  better fit for a map (§4.2).

---

## 2. Target flow

```
deliverer app ──SEND /app/drivers/{driverId}/location──▶ LocationController
                                                          │
                              ┌───────────────────────────┴───────────────────┐
                    driver AVAILABLE?                               driver has an active delivery?
                    → DriverRegistry (unchanged)                    → LiveDeliveryLocationStore (Redis, TTL)
                                                                    → broadcast /topic/orders/{orderId}/driver-location
                                                                                    │
customer app ◀── STOMP subscribe (authorized to the order's owner) ─────────────────┘
customer app ── GET /orders/{id}/delivery/location (last known fix, on open) ──▶ backend
```

---

## 3. Backend (hungry-backend) changes

### 3.1 Keep the position of a busy driver
In `RedisDriverLocationPersistenceAdapter.reportPosition` (or a new
`LiveTrackingService` it delegates to):
1. `driverRegistry.updatePosition(...)`: unchanged. It stays a no-op for a busy
   driver, and that is correct for matching.
2. Look up the driver's **active delivery**: status `ACCEPTED` or `PICKED_UP`.
   Cache `driverId → {deliveryId, orderId}` in Redis when `accept()` runs, and
   delete it on `deliver/returnDelivery/fail`. That avoids a DB query on every
   5-second ping.
3. If there is an active delivery, write
   `live:delivery:{deliveryId} = {lat, lng, capturedAtMs, heading?, speed?}`
   with a short TTL (~2 min, so a dead phone stops showing a stale position).
   Then publish (§3.2).

### 3.2 Broadcast to the customer
- New topic: **`/topic/orders/{orderId}/driver-location`**. It is separate from
  `/notifications` on purpose: `useOrderDelivery` invalidates on *every* frame
  of `/notifications`, and a position every 5 s would turn into a refetch every
  5 s.
- Payload: `{ orderId, deliveryId, latitude, longitude, capturedAt, deliveryStatus }`.
- Throttle server-side to ~1 message every 3–5 s per delivery. The driver app's
  20 m/5 s watch already mostly does this.

### 3.3 Snapshot endpoint
`GET /orders/{id}/delivery/location` (in `OrderDeliveryController`, same
ownership check as `getDelivery`):
- `200 {latitude, longitude, capturedAt}` from `live:delivery:{id}`;
- `204` or `404` when there is no fix yet or the delivery isn't live.

The map then has a position the moment it opens, instead of waiting for the
next ping.

### 3.4 Authorize SUBSCRIBE (required before shipping a live location)
Extend `StompAuthChannelInterceptor` to handle `StompCommand.SUBSCRIBE`:
- `/topic/orders/{orderId}/**` and `/topic/customers/{orderId}/**`: allowed only
  if the principal's Keycloak id maps to the order's customer (same check as
  `OrderDeliveryController.assertOwnOrder`). Cache the result per
  session+order.
- `/topic/drivers/{driverId}/**`: the principal must own `driverId`.
- Anything else: deny.

### 3.5 Stop streaming at drop-off
In `deliver()`, `returnDelivery()` and `fail()`: delete the `driverId → delivery`
cache entry and `live:delivery:{id}`, and publish one last frame with
`deliveryStatus` set so open maps can close or freeze.

### 3.6 Deliverer app (hungry-deliverer)
- It already publishes during a delivery, so no change is needed for the
  foreground case. That is all v1 relies on.

#### Background location: designed, deferred (not in this pass)
Without it, tracking freezes whenever the driver switches to the navigation
app or locks the phone, which is the normal case during a delivery. The
customer app already handles this gracefully through `isStale` ("Last seen
2 min ago", §4.1). The design, for when it is picked up:

- **Task.** `expo-task-manager` `defineTask(DRIVER_LOCATION_TASK, …)` at
  module scope (it must be registered before the app mounts, in the entry
  file), plus `Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
  accuracy: Balanced, timeInterval: 5_000, distanceInterval: 20,
  foregroundService: { notificationTitle: 'Delivering an order',
  notificationBody: 'Sharing your location with the customer' },
  pausesUpdatesAutomatically: false, activityType: AutomotiveNavigation })`.
- **Start and stop.** Start the task on delivery accept, stop it at
  deliver/return/fail and when the driver goes offline. It must **not** run
  while the driver is merely idle and online, for battery and privacy reasons.
  The foreground `watchPositionAsync` keeps covering availability matching.
- **Transport.** The STOMP socket is not guaranteed to be alive in a
  background task (the OS suspends JS timers and sockets). The task should
  therefore POST to a small REST endpoint instead,
  `POST /api/drivers/{driverId}/location` (the REST route that was deleted
  when ingestion moved to WS, restored for this use only), with the stored
  access token. Refresh the token if it has expired, and drop the fix if
  refresh fails. Both endpoints end in the same `LocationService`.
- **Permissions.** Android: `ACCESS_BACKGROUND_LOCATION` and
  `FOREGROUND_SERVICE_LOCATION` (via the `expo-location` config plugin,
  `isAndroidBackgroundLocationEnabled: true`), plus Play Store background-location
  declaration. iOS: `UIBackgroundModes: [location]`, the
  `NSLocationAlwaysAndWhenInUseUsageDescription` string, and "Always"
  permission requested at first delivery accept, not at sign-in.
- **Dev build only.** Background tasks don't run in Expo Go.
- **Testing.** Physical devices only: lock the screen and switch to Google
  Maps mid-delivery, and check that the customer's map keeps moving.

---

## 4. Customer app (hungry-customer) changes

### 4.1 Data layer
- `schemas/delivery.ts`: `driverLocationSchema`
  (`latitude`, `longitude`, `capturedAt`, optional `deliveryStatus`).
- `services/api/delivery-service.ts`: `getDriverLocation(orderId)`, which maps
  204/404 to `null`.
- `hooks/use-driver-location.ts`: `useDriverLocation(orderId, enabled)`.
  - The initial fix comes from the snapshot query (TanStack, key
    `deliveryKeys.location(orderId)`).
  - It subscribes to `/topic/orders/{orderId}/driver-location` only while
    `enabled`, which means the modal is open. Each frame is written straight
    into the query cache with `setQueryData`, not `invalidateQueries`.
  - Frames with an older `capturedAt` than the cached one are ignored.
  - It exposes `{ position, capturedAt, isStale }`, where `isStale` means no
    update for more than 60 s. The UI then says "Last seen 2 min ago" instead of
    presenting an old position as live.
  - Fallback: poll the snapshot every 10 s while the socket is disconnected,
    the same way the existing hooks use polling as a backstop.

### 4.2 UI
- **Entry point.** In `app/orders/[id].tsx`, wrap the `DriverInfoCard` block in a
  `PressableScale`. It is enabled only when the delivery status is `ACCEPTED`
  or `PICKED_UP` (`orderStage` of `READY` or `ON_THE_WAY` with a driver). Add a
  chevron or a "Track" affordance to the card so it looks tappable.
- **Modal.** A new route, `app/orders/[id]/track.tsx`, registered with
  `presentation: 'modal'` (or `fullScreenModal` on iOS) in the stack layout.
  A route is better than an in-screen `<Modal>`: it gets a back gesture, it can
  be deep-linked from the `DRIVER_PICKED_UP` push, and it unmounts the map (and
  the subscription) when it closes.
- **`components/order/driver-tracking-map.tsx`**:
  - `MapView` with a restaurant marker (pickup coords), a home marker (dropoff
    coords), and a driver marker (bike icon) animated between fixes with
    `AnimatedRegion`/`MarkerAnimated`, so it glides instead of jumping every 5 s.
  - Camera: `fitToCoordinates` on driver+restaurant while `ACCEPTED` (the
    driver heading to pick up), then on driver+dropoff after `PICKED_UP`. Stop auto-fitting once the user pans, and
    add a "recenter" button.
  - A bottom panel reuses `DriverInfoCard` content: name, rating, stage label
    from `orderStatusLabel`, and a "last updated" line.
  - Empty states: "Waiting for the driver's location…" when there is no fix
    yet; "Location unavailable — last seen …" when stale. For Expo Go, reuse
    the `map-placeholder.tsx` fallback.
- **Auto-close.** When the delivery reaches `DELIVERED`/`FINISHED` (from
  `useOrderDelivery` or the last frame), show "Delivered" and close the modal.
  The details screen already moves to its delivered state through feature 1.

### 4.3 Not in scope for v1
- ETA and route polyline. There is no routing source on the customer side; the
  backend's OSM routing (`assignment.routing`) could provide one later through
  the same snapshot endpoint.
- Tracking from the order *card* in My Orders. The details screen is the only
  entry point.

---

## 5. Order of work

| # | Where | Task | Depends on |
|---|---|---|---|
| 1 | backend | `driverId → active delivery` cache on accept/deliver/return/fail | — |
| 2 | backend | Live position store + `/topic/orders/{orderId}/driver-location` broadcast | 1 |
| 3 | backend | SUBSCRIBE authorization in `StompAuthChannelInterceptor` | — |
| 4 | backend | `GET /orders/{id}/delivery/location` | 2 |
| 5 | customer | schema, service, `useDriverLocation` hook, unit tests (frame ordering, staleness) | 2, 4 |
| 6 | customer | `track` modal route + `DriverTrackingMap` + tappable driver card | 5 |
| 7 | deliverer | Background location reporting (§3.6) — **deferred, not in this pass** | — |
| 8 | all | End-to-end on two devices, deliverer app in the foreground: accept → pickup → drive → deliver; check that the modal closes and the order moves to Completed | 1–7 |

## 6. Resolved questions
1. **Feed:** a new `/topic/orders/{orderId}/driver-location`.
2. **When tracking starts:** at `ACCEPTED`. The customer sees the driver on the
   way to the restaurant, then to them.
3. **Background location:** designed in §3.6, deferred to a later pass.
