# Plan — Fetching & Displaying Restaurants

**Status:** Ready for implementation
**Task file:** [`docs/tasks/restaurants-catalog-RESTO-01.md`](../tasks/restaurants-catalog-RESTO-01.md) — trigger with `/task "RESTO-01"`
**Date:** 2026-08-23
**Backend studied:** `C:\projects\hungry-web\hungry-backend` @ `1e167ed`
**Revised:** 2026-08-24 — restaurant cover image (`coverImageUrl`) folded into the fetch flow; see §2.5

---

## 1. Goal

Replace the hard-coded restaurant arrays in the home and restaurant-detail screens with
live data from the Hungry backend, fetched through the jfwk-gateway with the customer's
Keycloak token, in a way that is **type-safe end to end** — meaning not just TypeScript
interfaces, but runtime validation at the network boundary so a backend shape change
surfaces as a caught, reported error rather than an `undefined` crash deep in a component.

## 2. Ground truth — what the backend actually serves

Everything in this section was **verified against the running backend** (`hungry-app` on
`:8080`, Keycloak on `:8081`), not inferred from source. Where behaviour is surprising it
is called out, because several of these quirks dictate the client design.

### 2.1 Endpoints

Both reachable only through the gateway (`EXPO_PUBLIC_API_URL`, `:8082`) and both require
a bearer token — `SecurityConfig` ends with `anyRequest().authenticated()` and
`GatewaySecurityConfig` with `anyExchange().authenticated()`.

| Endpoint | Returns | Notes |
| --- | --- | --- |
| `GET /restaurants/all` | `Page<RestaurantOutputData>` | Query params `filter`, `page`, `size`, `sort` |
| `GET /restaurants/{id}` | `RestaurantOutputData` | **Resolves by UUID `id` only, never `code`** |

There is **no role restriction**: no `@PreAuthorize` anywhere in the backend and no
`@EnableMethodSecurity`, so any authenticated principal — including a `CUSTOMER` — can
read restaurants. No backend change is needed for the customer app to see this data.

### 2.2 `RestaurantOutputData` (from the live OpenAPI document)

```
id                 string            (UUID)
code               string
name               string
establishmentDate  string            (ISO date, "2019-04-01")
foundedYear        int32
cuisines           string[]          (Java Set — order is NOT stable)
dishes             string[]          (Java Set — order is NOT stable)
seatingCapacity    int32
indoorCapacity     int32
hasIndoorSeating   boolean
outdoorCapacity    int32
hasOutdoorSeating  boolean
accessibility      { wheelchairAccessible: boolean }
policy             { petFriendly: boolean, familyFriendly: boolean }
address            Address
contact            { phones: string[], email: string }
logoUrl            string            (relative path — see §2.5)
coverImageUrl      string            (relative path — see §2.5)
days               WorkingDay[]
enabled            boolean
```

`Address` — `streetNumber, streetName, streetType (enum), streetDirection (enum),
buildingName, floor, state, municipality, postalCode, country, coordinates
{latitude, longitude, altitude}, plusCode, geohash, formattedAddress`.

`WorkingDay` — `dayOfWeek` (**ISO: 1 = Monday … 7 = Sunday**), `isBusinessDay`,
`open` / `close` as `"HH:mm"` strings. A day with two shifts appears as **two entries
sharing the same `dayOfWeek`**; a closed day has `isBusinessDay: false` and no times.

**Nothing is marked `required` in the schema.** Every field must be treated as nullable
on the client. This is the single most important typing decision in this plan.

### 2.3 The page envelope

Verified live — it is the **legacy flat `PageImpl` serialization**, not the newer
`{content, page:{…}}` form:

```json
{ "content": [...], "totalPages": 0, "totalElements": 0, "size": 10, "number": 0,
  "first": true, "last": true, "numberOfElements": 0, "empty": true,
  "sort": {...}, "pageable": {...} }
```

Only `content`, `number`, `totalPages`, `totalElements` and `last` matter to the client;
the rest should be ignored rather than modelled, so a future Boot upgrade that changes
the envelope breaks in one adapter instead of everywhere.

### 2.4 Sharp edges (all verified by live request)

These are the reason the client needs a deliberate adapter layer:

| Request | Result | Consequence for the app |
| --- | --- | --- |
| `GET /restaurants/{unknown-uuid}` | **500**, `NoSuchElementException` | A missing restaurant is *not* a 404. `queryClient`'s retry policy retries ≥500 twice, so a dead link costs 3 round-trips and shows a generic error. Must be special-cased. |
| `GET /restaurants/abc` | **400** `"Invalid UUID string: abc"` | Route params must be UUIDs. The current mock ids (`"1"`, `"2"`, `"3"`) will 400 — every navigation source must be migrated together. |
| `filter={"cuisines":[…]}` | **500** `UnsupportedOperationException` | `cuisines`/`dishes` are `@ElementCollection`s; `addFilterPredicate` cannot handle them. **Cuisine filtering must be client-side.** |
| `filter={"brandNames":[…]}` | 200, filter silently ignored | `RestaurantSpecification` applies `legalNames` twice and never applies `brandNames`. Do not offer it. |
| `sort=[{"field":"notAField",…}]` | **500** `PropertyReferenceException` | Sort fields must come from a fixed whitelist, never from user input. |
| `filter=not-json` | 400 ProblemDetail | Well-formed; the existing `ApiError` extractor already surfaces `detail`. |

Working filter keys: `ids`, `codes`, `names`, `legalNames`, `taxIdentificationNumbers`,
`establishmentDates`, `foundedYears`, `seatingCapacities`, `indoorCapacities`,
`outdoorCapacities`, `hasIndoorSeating`, `hasOutdoorSeating`. Each is a set of
`{operator, fieldValue, fieldType}` with `operator ∈ {EQUALS, NOT_EQUALS, GREATER_THAN,
LESS_THAN, GREATER_THAN_OR_EQUALS, LESS_THAN_OR_EQUALS, LIKE}` and
`fieldType ∈ {STRING, NUMBER, DATE, BOOLEAN}`.

Sortable fields are **entity** properties, not DTO properties: `name`, `code`,
`createdAt`, `modifiedAt`, `legalName`, `brandName`, `foundedYear`, `establishmentDate`,
`seatingCapacity`. Note `createdAt` sorts fine but is never returned in the payload.

`enabled` is **not** filterable — open/closed and enabled/disabled must be resolved
client-side.

### 2.5 Image URLs — relative, and behind auth

`coverImageUrl` landed in the backend at `1e167ed`. Unlike several fields elsewhere in
this system, it is **wired end to end**: it exists on the `Restaurant` entity, on
`RestaurantInputData` and on `RestaurantOutputData`, and is copied by **both** the direct
and the inverse populator (`RestaurantBasePopulator.java:43` and `:66`). It round-trips
correctly. No backend change is needed here, and none should be attempted.

Two properties of the value do dictate client work.

**It is a relative path, not an absolute URL.** `S3FileStorageService.buildPublicUrl`
returns `"/files/" + entityName + "/" + entityId + "/" + fileName`, so a cover arrives as:

```
/files/restaurants/8f3c.../cover-banner.jpg
```

The same is true of `logoUrl`. An earlier revision of this plan described `logoUrl` as an
absolute MinIO/S3 URL — that was wrong, and the correction matters: the MinIO endpoint
(`jfwk.storage.s3.endpoint`, `:9000`) never appears in the payload, and even if it did it
would be a `localhost` address unreachable from a device or emulator. Handing either
string straight to `expo-image` produces a request to a relative URI that React Native
cannot resolve. Both must be joined onto `EXPO_PUBLIC_API_URL`.

Cover files are stored beside logos under the same key prefix and kept apart by a
`cover-` filename prefix (`RestaurantController.COVER_IMAGE_PREFIX`), so the two never
collide despite sharing a folder.

**`/files/**` requires a bearer token.** It appears in no permitAll list: the gateway
opens only `OPTIONS /**`, `/actuator/health/**`, `/fallback/**`, `POST /customers`,
`POST /drivers` and a dev-only swagger list, and `public-paths` is `""` in prod.
`<Image source={{ uri }} />` does not go through `apiClient` and therefore carries no
`Authorization` header — the request 401s and the image renders as nothing, with no error
surfacing anywhere. `expo-image` accepts `source={{ uri, headers }}`, so the token has to
be attached deliberately, read from `getTokens()` in
`services/keycloak/token-storage.ts`.

That pairing — one join and one header, both failing invisibly when omitted, both needed
again by product images later — is why §5 adds a small `services/api/image-url.ts` rather
than inlining a template string at each call site.

`coverImageUrl` is **not filterable and not sortable**: it is absent from
`RestaurantFilter`, from `RestaurantSpecification` and from the entity's sortable
properties. It is display data only.

The write side (`POST /restaurants/{identifier}/cover-image`, multipart, form field
`file`) exists but belongs to the restaurant-facing app. The customer app is read-only
here — see §8.

## 3. The core problem: the UI model and the backend model barely overlap

`components/home/open-restaurants.tsx` renders a card needing:

```
name, categories, rating, deliveryTime, deliveryFee, isFreeDelivery,
discount, isNew, isSponsored, bannerImage, isFavorite
```

Of those, the backend supplies **`name`** and — since `1e167ed` — **the card image**:
`coverImageUrl` is precisely the `bannerImage` the card wants, with `logoUrl` covering the
smaller mark. Everything else on that list is still unbacked. Meanwhile the backend
supplies address, coordinates, contact, opening hours, cuisines and accessibility that the
UI never shows.

The temptation is to widen the UI types to `rating?: string` and let the cards render
blanks. That is the wrong call: it silently degrades every card and hides the fact that
whole product features have no data source. The plan instead makes the gap **explicit and
typed**, in one place:

- **Backed directly** — `bannerImage` from `coverImageUrl`, and the header mark from
  `logoUrl`. Both are relative paths behind auth and must go through §2.5's resolution
  before they reach `expo-image`.
- **Derivable now** — `categories` (join `cuisines`), `isOpen` (compute from `days`),
  `distance` (Haversine from `address.coordinates` against the customer's saved delivery
  address — `hooks/use-delivery-address.ts` already provides it).
- **Not backed by any backend field** — `rating`, `reviewCount`, `deliveryTime`,
  `deliveryFee`, `isFreeDelivery`, `minOrder`, `discount`, `isNew`, `isSponsored`,
  `isTopRated`. These become **optional** on the view-model with a single documented
  constant listing them, so the day an orders/ratings service ships, the compiler points
  at every site to fill in.

Cards must render correctly with those absent — badges omitted entirely, not shown empty.

Backed is not the same as present: `coverImageUrl` is nullable like every other field, and
a restaurant that never uploaded one returns nothing. The card still needs a placeholder
path — a neutral fill, not a broken-image box, and specifically not one of the bundled
`restaurant-banner-*.jpg` assets, which would dress a real restaurant in another's photo.

## 4. Architecture

Layering follows what the customer feature already established, so there is one shape of
thing to learn in this codebase:

```
services/api/restaurant-service.ts     ← axios calls + zod parse at the boundary
        │  returns validated RestaurantOutputData
        ▼
services/api/restaurant-view-model.ts  ← backend DTO → UI shape (pure, no React)
        │  returns RestaurantSummary / RestaurantDetail
        ▼
hooks/use-restaurants.ts               ← TanStack Query hooks (queryOptions colocated)
        ▼
components/home/*, app/restaurant/[id]/*
```

### 4.1 Why zod at the boundary

`strict: true` is on, but TypeScript alone is a compile-time promise about a runtime
payload it never sees. Given that **no field in the backend schema is required**, an
interface-only approach means every optional access is a lie the compiler happily
accepts. Parsing with zod (already a dependency, already used in `schemas/auth.ts`) at
the one place data enters gives:

- a single failure point with a clear message when the backend shape drifts,
- types **inferred from the schema** (`z.infer`), so schema and type cannot diverge,
- `.catch()` / `.default()` for the fields that are structurally optional, so downstream
  code deals in resolved values rather than four-deep optional chains.

Schemas go in `schemas/restaurant.ts` next to `schemas/auth.ts`. Types are inferred, never
hand-written in parallel.

### 4.2 Open/closed computation

The one genuinely non-trivial piece of logic, and where the unit tests earn their keep:

- Group `days` by `dayOfWeek` (1 = Monday … 7 = Sunday); JS `Date.getDay()` is
  0 = Sunday, so a conversion is required — an easy off-by-one that tests must pin.
- A restaurant is open if **any** shift for today has `isBusinessDay` and now falls in
  `[open, close)`.
- A shift where `close <= open` crosses midnight (the backend's own docs show
  `"00:00 AM - 6:00 AM"` style days) and must be handled.
- `enabled: false` overrides everything → closed.
- No `days` at all → treat as unknown, not as open.

Compare `"HH:mm"` strings as minutes-since-midnight integers, not lexically or as `Date`s,
and take "now" as an injected parameter so tests are deterministic.

## 5. Files

**New**

| File | Purpose |
| --- | --- |
| `schemas/restaurant.ts` | zod schemas + inferred DTO types |
| `services/api/image-url.ts` | Resolve relative `/files/…` paths to absolute URLs, plus auth headers (§2.5) |
| `services/api/restaurant-service.ts` | `fetchRestaurants`, `fetchRestaurantById` |
| `services/api/restaurant-view-model.ts` | DTO → `RestaurantSummary` / `RestaurantDetail`, opening-hours logic |
| `hooks/use-restaurants.ts` | `useRestaurants`, `useRestaurant`, query options |
| `components/home/restaurant-card-skeleton.tsx` | Loading placeholder matching card geometry |
| `components/ui/query-state.tsx` | Shared loading / error / empty rendering |

**Modified**

| File | Change |
| --- | --- |
| `services/api/query-keys.ts` | Add `restaurantKeys` factory alongside `customerKeys` |
| `services/api/types.ts` | Re-export restaurant DTO types; add `Page<T>` |
| `components/home/open-restaurants.tsx` | Drop `RESTAURANTS` (and its `require`d banner assets), accept data via props |
| `components/home/popular-restaurants.tsx` | Drop `POPULAR_RESTAURANTS`, accept data via props |
| `app/(tabs)/index.tsx` | Own the query, pass data down, handle states |
| `app/restaurant/[id]/index.tsx` | Drop `RESTAURANT_DATA`/`TIMINGS`, fetch by id |
| `app/restaurant/[id]/info.tsx` | Drop `RESTAURANT_INFO`, use real address/contact/coords |
| `components/restaurant/restaurant-header.tsx` | Make unbacked props optional; render the resolved cover as the banner |
| `store/favorites-store.ts` | Narrow `image: any` to `image: FavoriteImage` |

### 5.1 A note on `favorites-store`

`FavoriteItem.image` is `any` and today receives `require(...)`, which on native is a
**numeric module id** that is persisted to AsyncStorage and is not stable across builds —
a stale favorite can resolve to the wrong asset or none. Moving restaurants to remote
`logoUrl` strings is the moment to narrow this to
`type FavoriteImage = string | number` and prefer the URL. This is in scope because the
migration touches every restaurant `toggleFavorite` call anyway.

Persist the **relative** path, not the resolved absolute URL, and resolve at render time.
A stored absolute URL bakes in whatever `EXPO_PUBLIC_API_URL` happened to be when the
favorite was saved, so moving between a LAN address and a deployed host silently breaks
the image on every previously favorited restaurant.

## 6. Testing

The repo has **no test framework at all** — no jest, no jest-expo, no testing-library.
Setting it up is part of this work, and is why the task file sequences it first: tests
written against a harness that does not exist cannot be verified.

Harness: `jest-expo` preset + `@testing-library/react-native`, installed via
`npx expo install --dev` so versions match Expo SDK 56.

Priority is the **pure logic**, which is where real bugs live and which needs no
renderer:

1. `isRestaurantOpen` — closed day, inside/outside a shift, exact boundaries,
   multi-shift days, midnight-crossing shifts, `enabled: false`, empty `days`,
   the Sunday index conversion.
2. Zod parsing — a full payload, a minimal payload (`{id}` only), a payload with
   `null` where objects are expected, and a malformed payload rejected with a useful path.
3. View-model mapping — cuisines joined and stably ordered, missing `logoUrl`, absent
   unbacked fields staying absent rather than becoming `""`, and `coverImageUrl` mapped
   onto `bannerImage`.
4. Image URL resolution — a relative `/files/…` path joined to the base exactly once (no
   doubled and no missing slash, whether or not the base ends in `/`), an already-absolute
   `http(s)` value passed through untouched, and `null` / `undefined` / `""` returning
   `undefined` so callers reach the placeholder instead of requesting the bare base URL.
5. Service layer — query-string construction for filter/sort/page, and 500-on-missing-id
   mapped to a not-found result.
6. Component smoke tests — cards render with sparse data, omit unbacked badges, and fall
   back to the placeholder when `coverImageUrl` is absent.

## 7. Sequencing

1. Test harness (nothing else is verifiable without it)
2. Schemas + inferred types
3. Image URL resolution (+ tests) — small, and the view model depends on it
4. View model + opening hours (+ their tests — the bulk of the value)
5. Service layer (+ tests)
6. Query keys + hooks
7. Home screen wiring
8. Detail + info screens
9. Favorites store narrowing
10. Full verification pass

## 8. Out of scope

Explicitly **not** part of this task, to keep it reviewable:

- Search, category and filter chips on the home screen — they need the client-side
  filtering decision from §2.4 and deserve their own task.
- Infinite scroll / "See All" — `useInfiniteQuery` over the same service, separate task.
- Menu, products and add-ons on the detail screen — a different backend module.
- **Uploading** a logo or cover image. `POST /restaurants/{identifier}/logo` and
  `…/cover-image` exist, but the customer app never writes restaurant media — that is
  the restaurant-facing app's job.
- Backend fixes for the `brandNames` bug, the collection-filter 500, and the missing-id
  500-instead-of-404. These are **backend** changes; this task works around them and
  documents them. Worth raising separately with that team.
