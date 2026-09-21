---
suffix: RESTO-01
title: Fetch and display restaurants from the backend
status: done
plan: docs/plans/restaurants-fetch-display-plan.md
---

# RESTO-01 — Fetch and display restaurants

Replace the hard-coded restaurant arrays in the home and restaurant-detail screens with
live, runtime-validated data from the Hungry backend.

Read [`docs/plans/restaurants-fetch-display-plan.md`](../plans/restaurants-fetch-display-plan.md)
in full before starting — it contains the verified backend contract, and several
behaviours there are counter-intuitive (a missing restaurant returns **500**, not 404).

## Prerequisites

Verify before writing code:

- `.env` has `EXPO_PUBLIC_API_URL` pointing at the **gateway** (port `8082`).
- The gateway is reachable, or accept that live verification in Phase 10 will be skipped
  and say so explicitly in the final report.

Do NOT start the backend, Keycloak, or Docker containers. If they are down, complete
every phase and report which verifications could not run.

## Backend contract (verified — do not re-derive)

`GET /restaurants/all?filter=<json>&page=0&size=10&sort=<json>` → flat `PageImpl` envelope:
`{ content, number, totalPages, totalElements, last, size, first, numberOfElements, empty, sort, pageable }`

`GET /restaurants/{id}` → one `RestaurantOutputData`. **`id` must be a UUID.**

`RestaurantOutputData` fields — **every one is nullable**, nothing is `required`:

```
id, code, name, establishmentDate (ISO date), foundedYear,
cuisines: string[], dishes: string[],
seatingCapacity, indoorCapacity, hasIndoorSeating, outdoorCapacity, hasOutdoorSeating,
accessibility: { wheelchairAccessible },
policy: { petFriendly, familyFriendly },
address: { streetNumber, streetName, streetType, streetDirection, buildingName, floor,
           state, municipality, postalCode, country,
           coordinates: { latitude, longitude, altitude },
           plusCode, geohash, formattedAddress },
contact: { phones: string[], email },
logoUrl, coverImageUrl, days: WorkingDay[], enabled
```

`WorkingDay` — `{ dayOfWeek (1=Mon…7=Sun), isBusinessDay, open "HH:mm", close "HH:mm" }`.
Two shifts on one day = two entries with the same `dayOfWeek`.

Known backend behaviours to code around (all verified live):

- Unknown restaurant id → **500** `NoSuchElementException`, not 404.
- Non-UUID id → **400** `"Invalid UUID string: abc"`.
- `filter={"cuisines":…}` or `{"dishes":…}` → **500**. Filter these client-side.
- Unknown `sort` field → **500**. Use a whitelist only.
- `enabled` is not filterable.
- `logoUrl` and `coverImageUrl` are **relative paths** (`/files/restaurants/{id}/{file}`),
  not absolute URLs, and `/files/**` is **authenticated**. Both facts are load-bearing —
  read §2.5 of the plan before touching an image. Neither field is filterable or sortable.

## Phases

Work through these in order. Use TodoWrite with one todo per phase; mark each complete
immediately on finishing it, never batched.

### Phase 1 — Test harness

Nothing later is verifiable without this, so do it first.

Install with `npx expo install --dev jest-expo jest @testing-library/react-native @types/jest`
so versions match Expo SDK 56. Do NOT use a bare `npm install` for Expo-managed packages.

Add to `package.json`:

```json
"scripts": { "test": "jest", "test:ci": "jest --ci --runInBand" },
"jest": { "preset": "jest-expo" }
```

Add `jest.setup.ts` only if a mock is actually needed — do not add empty scaffolding.

**Verify:** write `services/api/__tests__/harness.test.ts` containing a single
`expect(1 + 1).toBe(2)`, run `npm test`, confirm it passes, then delete that file.

### Phase 2 — Schemas and inferred types

Create `schemas/restaurant.ts` following the style of `schemas/auth.ts`.

- Define `geoCoordinatesSchema`, `backendAddressSchema`, `businessContactSchema`,
  `workingDaySchema`, `accessibilitySchema`, `policySchema`, `restaurantOutputSchema`.
- Every field `.nullish()` except `id`, which is `z.string()`.
- Use `.catch([])` on `cuisines`, `dishes`, `days`, `phones` so a null collection
  resolves to an empty array and callers never optional-chain an array.
- Export a generic `pageSchema(itemSchema)` modelling ONLY `content`, `number`,
  `totalPages`, `totalElements`, `last`. Ignore the rest of the envelope.
- Export types via `z.infer` — **never** hand-write a parallel interface.

In `services/api/types.ts`, re-export the inferred restaurant types with a comment
pointing at `schemas/restaurant.ts` as the source of truth. Keep the existing
customer interfaces untouched.

**Tests** (`schemas/__tests__/restaurant.test.ts`): a full payload parses; `{id:"..."}`
alone parses with collections defaulting to `[]`; `null` collections become `[]`; a
payload missing `id` fails with `id` in the issue path.

### Phase 3 — Image URL resolution

Create `services/api/image-url.ts`. Pure module — no React, no TanStack Query.

The backend returns `logoUrl` and `coverImageUrl` as **relative** paths
(`/files/restaurants/{id}/cover-banner.jpg`), and `/files/**` sits behind the same bearer
auth as every other endpoint. Plan §2.5 has the evidence; the consequence is that a raw
`<Image source={{ uri: restaurant.coverImageUrl }} />` fails twice over — unresolvable URI,
then 401 — and both failures are silent.

Export:

```ts
/** Joins a backend-relative `/files/...` path onto EXPO_PUBLIC_API_URL. */
export function resolveImageUrl(path: string | null | undefined): string | undefined;

/** Auth headers for an image request; images bypass apiClient's interceptor. */
export async function imageAuthHeaders(): Promise<Record<string, string>>;
```

Rules for `resolveImageUrl`:

- `null`, `undefined` or `""` → `undefined`. Never return the bare base URL; a caller that
  gets one renders the API root as an image and shows a broken box.
- A value already starting `http://` or `https://` → returned unchanged, so the module
  keeps working if the backend later switches to absolute URLs.
- Otherwise join onto `apiClient.defaults.baseURL` with **exactly one** slash, whether or
  not the base has a trailing one and whether or not the path has a leading one.

`imageAuthHeaders` reads `getTokens()` from `services/keycloak/token-storage.ts` and
returns `{ Authorization: 'Bearer <accessToken>' }`, or `{}` when there is no session.
Do NOT duplicate `apiClient`'s refresh logic here — the screens that render images have
already called an authenticated endpoint to get the data, so the token is fresh.

Add `constants/images.ts` (or extend the existing constants module if one fits) with a
single `RESTAURANT_IMAGE_PLACEHOLDER` used everywhere a cover or logo is missing. Do NOT
fall back to the bundled `assets/restaurants-images/restaurant-banner-*.jpg` files — those
are another restaurant's photography.

**Tests** (`services/api/__tests__/image-url.test.ts`): relative path joined with a base
ending in `/` and one not ending in `/` — both produce exactly one slash; a path with no
leading slash; an `https://` value passed through untouched; `null`, `undefined` and `""`
each returning `undefined`; `imageAuthHeaders` returning `{}` with no stored token and a
`Bearer` header with one.

### Phase 4 — View model and opening hours

Create `services/api/restaurant-view-model.ts`. Pure functions only — no React, no imports
from `hooks/` or `components/`.

Export:

```ts
export interface RestaurantSummary {
  id: string;
  name: string;
  categories: string;        // cuisines joined with " - ", "" when none
  logoUrl?: string;          // resolved absolute URL, or undefined
  bannerImage?: string;      // resolved from coverImageUrl, or undefined
  isOpen: boolean | null;    // null = unknown (no days data)
  coordinates?: { latitude: number; longitude: number };
  // Unbacked by the API today — see UNBACKED_FIELDS below.
  rating?: string;
  deliveryTime?: string;
  deliveryFee?: string;
  isFreeDelivery?: boolean;
  discount?: string;
  isNew?: boolean;
  isSponsored?: boolean;
}
```

Map `coverImageUrl` → `bannerImage` and `logoUrl` → `logoUrl` through Phase 3's
`resolveImageUrl`, so no component ever sees a relative path. Both stay `undefined` when
the backend omits them — do not substitute a placeholder here; that is the component's
decision, and burying it in the view model hides which restaurants actually have artwork.

Add a `RestaurantDetail` extending it with `address`, `phones`, `email`, `days`,
`accessibility`, `policy`, plus optional `reviewCount`, `minOrder`, `isTopRated`.

Document the gap in one place:

```ts
/**
 * Fields the UI wants that NO backend field currently supplies. When a ratings or
 * orders service ships, populate them here — every consumer is already optional-safe.
 */
export const UNBACKED_FIELDS = [
  'rating', 'reviewCount', 'deliveryTime', 'deliveryFee', 'isFreeDelivery',
  'minOrder', 'discount', 'isNew', 'isSponsored', 'isTopRated',
] as const;
```

Implement `isRestaurantOpen(restaurant, now: Date): boolean | null`:

- Return `false` immediately when `enabled === false`.
- Return `null` when `days` is empty.
- Convert `now.getDay()` (0 = Sunday) to ISO (1 = Monday … 7 = Sunday). **This conversion
  is the most likely bug in the whole task — test it explicitly for Sunday.**
- Parse `"HH:mm"` to minutes-since-midnight integers. Compare integers, never strings
  and never `Date` objects.
- A shift is open when `open <= nowMinutes < close`.
- When `close <= open` the shift crosses midnight: open when
  `nowMinutes >= open || nowMinutes < close`.
- Any shift matching → open. Skip entries with `isBusinessDay === false` or missing times.

Sort `cuisines` before joining — the backend serializes a Java `Set`, so order is not
stable and unsorted output makes card text flicker between fetches.

**Tests** (`services/api/__tests__/restaurant-view-model.test.ts`) — at minimum:
closed day; before opening; exactly at `open` (open); exactly at `close` (closed);
inside a shift; two shifts where only the second matches; a midnight-crossing shift tested
at 23:30 and 02:00; `enabled: false` beating an open shift; empty `days` → `null`;
**a Sunday case**; cuisines joined and sorted; missing `logoUrl` stays `undefined`;
unbacked fields absent, not `""`; `coverImageUrl` mapped to a resolved `bannerImage`, and
a missing `coverImageUrl` leaving `bannerImage` `undefined`.

### Phase 5 — Service layer

Create `services/api/restaurant-service.ts` using the existing `apiClient`.

```ts
export async function fetchRestaurants(params?: {
  page?: number; size?: number; nameLike?: string; sort?: RestaurantSortField;
}): Promise<Page<RestaurantOutput>>
export async function fetchRestaurantById(id: string): Promise<RestaurantOutput | null>
```

Requirements:

- Parse every response through the zod schemas. On parse failure throw an `ApiError`
  naming the offending field path — do not return partial data.
- `sort` accepts only a whitelisted union type
  `'name' | 'createdAt' | 'modifiedAt' | 'foundedYear'`. Never interpolate caller input.
- Build `filter` with `names` + `LIKE` + `STRING` for `nameLike`. **Never** emit a
  `cuisines` or `dishes` filter — it 500s.
- `fetchRestaurantById` returns `null` for a missing restaurant. The backend sends 500 for
  this, so detect it: catch `ApiError`, and treat status 500 as not-found only when the
  requested id was a well-formed UUID (a genuine server fault on a valid id is
  indistinguishable, so add a comment saying so and re-throw non-500s). Treat 400 and 404
  as `null` too.
- Pass query params via axios `params` so encoding is handled once.

**Tests** (`services/api/__tests__/restaurant-service.test.ts`): mock `apiClient` with
`jest.mock('@/services/api/client')`. Assert the filter JSON for `nameLike`; assert an
invalid sort value is rejected at the type level (a `@ts-expect-error` line is enough);
assert 500 on a valid UUID → `null`; assert 400 → `null`; assert a schema-invalid
response throws `ApiError`.

### Phase 6 — Query keys and hooks

Extend `services/api/query-keys.ts` with a `restaurantKeys` factory mirroring
`customerKeys` (`all` / `lists()` / `list(params)` / `details()` / `detail(id)`).

Create `hooks/use-restaurants.ts` following `hooks/use-customer.ts` exactly: colocated
exported `queryOptions` functions plus thin `useRestaurants` / `useRestaurant` wrappers.

- `staleTime: 2 * 60 * 1000` — restaurant data changes more often than a profile but not
  per-second. Add a one-line comment giving that reason.
- `useRestaurant(id)` must be `enabled: !!id` and must not run for a non-UUID param.
- Map to view models with `select` so the mapping is memoized by TanStack Query rather
  than re-running on every render.

### Phase 7 — Home screen

Change `components/home/open-restaurants.tsx` and `popular-restaurants.tsx` to be
**presentational**: delete the module-level arrays, accept
`restaurants: RestaurantSummary[]`, `isLoading`, `error` as props.

In the card body, render a badge **only when its value is present** — no empty pills, no
`"—"` placeholders. The rating, delivery-time and delivery-fee badges will therefore not
render at all until those fields have a backend source. That is intended.

Wire `app/(tabs)/index.tsx` to `useRestaurants()` and pass data down. Handle:

- **loading** → `RestaurantCardSkeleton` (create it; match existing card geometry and
  `constants/theme` tokens),
- **error** → retry affordance using the message from `ApiError`,
- **empty** → a short empty state, not a blank screen.

Put the shared loading/error/empty rendering in `components/ui/query-state.tsx`.

"Popular" has no backend concept — take the first N of the same list and add a comment
saying it is a placeholder ordering, not a popularity signal. Do NOT invent a sort that
implies real popularity.

Preserve `AnimatedEntrance` staggering and the existing `PressableScale` usage. Export new
components from `components/home/index.ts`.

### Phase 8 — Detail and info screens

`app/restaurant/[id]/index.tsx`: delete `RESTAURANT_DATA` and `TIMINGS`, fetch via
`useRestaurant(id)`. Build the `TimingsModal` rows from `days` — group by `dayOfWeek`,
join multi-shift days with `" && "` to match the existing display, mark today, and label
non-business days closed.

`app/restaurant/[id]/info.tsx`: delete `RESTAURANT_INFO`. Use `address.formattedAddress`,
`contact.phones[0]`, `contact.email`, and real `address.coordinates` for the `MapView`.
When coordinates are missing, render `MapPlaceholder` instead of a map at 0,0.

Make the unbacked props on `components/restaurant/restaurant-header.tsx` optional and
guard their render sites.

`bannerImage` is now backed — change its type from `any` to `string | undefined` and pass
the resolved cover through, with `RESTAURANT_IMAGE_PLACEHOLDER` when it is absent. Supply
the auth headers from `imageAuthHeaders()`: `source={{ uri, headers }}`. The same applies
to the card banners in `components/home/open-restaurants.tsx` and
`components/home/popular-restaurants.tsx`, whose `bannerImage: any` currently receives a
`require(...)` id.

Keep the existing scroll-driven logo animation working — it depends on the geometry
constants at the top of the file; do not change them.

### Phase 9 — Favorites store

In `store/favorites-store.ts` replace `image: any` with
`export type FavoriteImage = string | number` (`string` = remote URL, `number` = bundled
`require` id) and update `FavoriteItem.image` to `FavoriteImage`.

Pass the restaurant's **relative** `logoUrl` when adding a favorite — the raw backend
value, not the resolved absolute URL — and call `resolveImageUrl` at render time. A stored
absolute URL bakes in whatever `EXPO_PUBLIC_API_URL` was set to when the favorite was
saved, so switching between a LAN address and a deployed host silently breaks the image on
every previously favorited restaurant.

Fix every resulting type error in `components/favorites/*` and `app/(tabs)/favorites.tsx`.
`expo-image` accepts both a URL string and a `require` id, so the render sites need only
the resolve call and the auth headers.

### Phase 10 — Verification

Run all of these and report actual output:

```bash
npx tsc --noEmit          # must be 0 errors
npm test                  # all tests pass
npx eslint .              # no new errors
```

Then confirm no mock data survives:

```bash
grep -rn "RESTAURANT_DATA\|RESTAURANT_INFO\|POPULAR_RESTAURANTS\|const RESTAURANTS" \
  app components --include=*.tsx
```

This must return **no matches**.

If the gateway is reachable, also verify live: start the app, open the home screen,
confirm cards render from the API and that a restaurant detail screen loads by UUID.
If it is not reachable, say so plainly rather than claiming the check passed.

## Definition of done

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm test` → all pass, including every `isRestaurantOpen` case in Phase 4
- [ ] `npx eslint .` → no new errors
- [ ] The Phase 10 grep returns no matches
- [ ] No `any` introduced anywhere; no hand-written type duplicating a zod schema
- [ ] Loading, error and empty states all render on the home screen
- [ ] Cards omit unbacked badges entirely rather than rendering empty ones
- [ ] `UNBACKED_FIELDS` documents every UI field with no backend source, and no longer
      lists `bannerImage`
- [ ] Every rendered cover and logo goes through `resolveImageUrl` — no relative path
      reaches `expo-image`, and no image request omits its auth header
- [ ] A restaurant with no `coverImageUrl` renders the shared placeholder, not a
      bundled `restaurant-banner-*.jpg`

## Constraints

- **DO NOT** modify anything under `C:\projects\hungry-web\hungry-backend`. Backend bugs
  found here are documented in §8 of the plan, not fixed in this task.
- **DO NOT** add a filter on `cuisines` or `dishes` — it returns 500.
- **DO NOT** send a `sort` field outside the Phase 5 whitelist — it returns 500.
- **DO NOT** widen types with `any` or `as` to silence the compiler. If a type fights you,
  the schema is wrong; fix the schema.
- **DO NOT** implement search, category filtering, infinite scroll, or menu/product
  fetching — all out of scope per §8 of the plan.
- **DO NOT** call `POST /restaurants/{id}/logo` or `…/cover-image`. Uploading restaurant
  media belongs to the restaurant-facing app; this app is read-only there.
- **DO NOT** commit or push unless explicitly asked.
- Match the surrounding code: double-quoted JSX imports in `components/`, `constants/theme`
  tokens over literal colours, `PressableScale` over `TouchableOpacity` in new code.

## Report

On completion, report: files created and modified; the exact output of the three
verification commands; the list of unbacked UI fields; anything deferred and why.
