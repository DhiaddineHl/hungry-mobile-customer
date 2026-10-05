# Plan — Home Page on the Search API

**Status:** Draft, awaiting review
**Date:** 2026-10-05
**Backend studied:** `C:\projects\hungry-web\hungry-backend` @ `d69cbdd` (`hungry-core/.../search`,
indexing side in `hungry-workflow/.../search`, schema in `jfwk-solr`)
**Verification:** from source only. Docker was down, so no request was made against a running
Solr or gateway. Every "sharp edge" below is a reading of the code, and the first phase checks
the important ones against a live stack.

---

## 1. Goal

Move the customer home screen (`app/(tabs)/index.tsx`) off `GET /restaurants/all` (JPA) and
onto the Solr-backed `/search/**` endpoints, so that it shows:

- **Popular restaurants**: ranked by order volume and rating, personalized to the customer.
- **Restaurants near you**: nearest first, from the selected delivery address.
- **Popular dishes**: a new rail of products.
- **Open restaurants / browse**: the general list, filterable by category chip and promotion.

When the customer types in the search bar, those rails are **replaced in place** by search
results (restaurants and dishes). Clearing the bar brings the rails back. There is no
separate search screen.

## 2. Ground truth: what the search module serves

All endpoints sit behind `anyRequest().authenticated()` (no role check), so the customer token
is enough. They are reached through the gateway like every other call.

### 2.1 Endpoints

| Endpoint | Params | Envelope | Solr behaviour |
| --- | --- | --- | --- |
| `GET /search` | `q?`, `customerId?`, `page=0`, `size=10` | `CombinedSearchResult` `{ restaurants: {numFound, documents}, products: {numFound, documents} }` | Restaurants: `text_search:(q)` OR'd with top-cuisine boosts, `fq=enabled:true`. Products: `text_search:(q)`, `fq=available:true`. Both use the same `page`/`size` |
| `GET /search/popular-restaurants` | `customerId?`, `page`, `size=10` | **raw** `{numFound, documents}` | No history: `*:*` sorted by indexed `score`. With history: edismax, cuisine boosts plus `bf=field(score)` |
| `GET /search/nearby-restaurants` | `lat`, `lon`, `radiusKm=10`, `customerId?`, `page`, `size=20` | `SearchPage` | `{!geofilt}` on `location`, sorted `geodist() asc` |
| `GET /search/restaurants` | `cuisine?`, `q?`, `openNow?`, `hasPromotion?`, `page`, `size=20` | `SearchPage` | `cuisine` and `q` are **OR'd**; `openNow` is filtered in memory after paging |
| `GET /search/products` | `vendorId?`, `categoryId?`, `q?`, `sort?`, `page`, `size=20` | `SearchPage` | `sort` ∈ `price_asc`, `price_desc`, `name_asc`, `newest`; no popularity sort |

So there are **two envelopes**:
- `SolrQueryResult`: `{ numFound, documents }`, used by `/search` (one per group) and `/popular-restaurants`.
- `SearchPage`: `{ content, number, totalPages, totalElements, last }`. This is a trimmed `Page`, not the full Spring `PageImpl` that `schemas/page.ts` parses today.

### 2.2 Documents (flat maps, every field nullable)

**Restaurant** (`VendorSolrDocument`, schema in `SolrSchemaInitializer`):

```
id, code, name, brandName, cuisines[], dishes[],
latitude, longitude, location ("lat,lon"), formattedAddress, municipality, country,
logoUrl, coverImageUrl, enabled,
ratingAverage, ratingCount, priceRangeMin, priceRangeMax,
currencyIsoCode, currencySymbol, currencyDecimalPlaces, currencyDisplayFormat,
days[]  ("<isoDow>|<isBusinessDay 1/0>|<HH:mm open>|<HH:mm close>"),
hasActivePromotion, promotionHeadline, score, rank, createdAt, modifiedAt, text_search
```

**Product** (`ProductSolrDocument`):

```
id, vendorId, vendorName, code, name, description,
price, effectivePrice, currencyCode, currencySymbol, currencyDecimalPlaces, currencyDisplayFormat,
promotionLabel, hasActivePromotion, promotionCode, tags[], categoryIds[],
available, popularityScore, vendorRating, vendorMunicipality,
vendorLatitude, vendorLongitude, vendorEnabled, createdAt, modifiedAt, text_search
```

Compared with the JPA `RestaurantOutput` the app maps today:
- The restaurant document has **more** of what a card needs: rating, price range, promotion headline.
- It has **less** structure: `days` are pipe strings rather than `WorkingDay` objects, and there is no `address` object.
- A product document has **no image**. Artwork keeps coming from `GET /files/products/{id}`, as
  `schemas/product.ts` already documents, and a search hit's `id` is the product id.

### 2.3 Sharp edges (from source)

| # | Edge | Effect on the home page |
| --- | --- | --- |
| E1 | **No "popular products".** `popularityScore` is always written as `0` ("no product-level order-quantity aggregation yet") and `/search/products` has no popularity sort | The "Popular dishes" rail cannot exist without a backend change (B1) |
| E2 | **Keyword search is polluted by personalization.** `buildRestaurantQuery` OR's the boosts: `text_search:(burger) OR cuisines:(Italian)^5`. A customer with Italian history searching "burger" also gets **every Italian restaurant** | Search results are wrong for any customer with order history. Must fix (B2) |
| E3 | **Popular score is reset by every restaurant edit.** Only the nightly `SolrReindexJob` (03:00) sets `score`/`rank`. `partialIndex` on restaurant update, product change or promotion change re-converts with `score = 0` | An edited restaurant drops to the bottom of "Popular" until 03:00 (B3) |
| E4 | **`openNow` is filtered after paging, in the server's timezone.** A page can come back short or empty while `totalElements` still counts closed ones, and `LocalDateTime.now()` is the container's clock (probably UTC, but Tunisia is UTC+1) | Don't use `openNow` for the rail. Compute open/closed on the client from `days` (it already does this for the JPA shape) |
| E5 | **`customerId` is a query parameter**, not taken from the token. Any signed-in user can ask for anyone's cuisine affinity | Works for us (we send our own id), but it is a small data leak (B4) |
| E6 | **`cuisines` is an exact, case-sensitive `string` field.** `cuisine=pizza` will not match `"Pizza"` | Category chips should search with `q` (case-insensitive `text_general` over name, cuisines and dishes), not `cuisine` |
| E7 | **No prefix matching.** `text_search` is `text_general`, which matches whole words only. "piz" finds nothing until "pizza" is typed | Search-as-you-type feels dead until a word is complete. Debounce helps; a real fix is an edge-ngram field (B5) |
| E8 | **Envelope mismatch.** `/search` and `/popular-restaurants` answer `SolrQueryResult`; the others answer `SearchPage` | Two zod schemas. No backend change needed |
| E9 | **Products from a disabled restaurant.** `available` already folds in `vendor.isEnabled()`, so `fq=available:true` handles it | Nothing to do |
| E10 | **Nearby needs coordinates.** Restaurants without them are never indexed with a `location`, so they never appear in "near you" | Accept. They still show in popular and browse |

## 3. Backend changes

| ID | Change | Needed for | Priority |
| --- | --- | --- | --- |
| **B1** | Product popularity: in `SolrReindexJob`, set `popularityScore` from order-item quantities over a window (for example 30 days), the same way restaurants get `score`. Add `sort=popular` → `popularityScore desc` to `DefaultSearchService.productSort` | "Popular dishes" rail | Required for that rail. **Interim:** the rail shows promoted dishes (B1-interim below) |
| **B2** | Make personalization a **boost, not a match**. Put the cuisine clauses in edismax `bq` (or make the text clause required: `+text_search:(q) cuisines:(…)^5`) whenever `q` is present, in both `search()` and `restaurants()` | Correct keyword search | **Required** |
| **B3** | Keep `score`/`rank` on partial reindex: either compute the score in the incremental path (it's the same `ScoringStrategy`) or use Solr atomic updates that don't touch `score`/`rank` | A stable "Popular" rail | Recommended |
| **B4** | Resolve the customer from the `Principal` (`findByKeycloakUserId`) and drop the `customerId` parameter. Accept it during the transition and ignore it | Privacy | Recommended |
| **B5** | Add a `text_prefix` field (edge-ngram, minimum 2) copied from `text_search`, and query `text_search OR text_prefix^0.5` | Search-as-you-type | Nice to have |
| **B6** | `/search` returns two `SolrQueryResult`s that share one `page`/`size`. For the home page that's fine (only the first page per group is shown). If "see all" is needed later, use `/search/restaurants?q=` and `/search/products?q=`, which page independently | Paging | No change |

**B1-interim (no backend work):** until B1 ships, the dish rail is titled "Deals on dishes" and
fed by `/search/products?q=` plus a client filter on `hasActivePromotion`. That is wasteful,
because promotions aren't a Solr filter on that endpoint. A one-line backend addition
(`hasPromotion` → `fq=hasActivePromotion:true` on `/search/products`) makes it exact. If neither
change happens, the rail stays hidden.

## 4. Home page design

### 4.1 Two modes, one screen

```
                 query.trim().length >= 2 (after a 300 ms debounce)
   ┌───────────┐ ───────────────────────────────────────────────▶ ┌────────────┐
   │  BROWSE   │                                                   │   SEARCH   │
   │  rails    │ ◀─────────────────────────────────────────────────│  results   │
   └───────────┘   query cleared (X button, back gesture, < 2 ch)  └────────────┘
```

- **Browse** shows the rails below. Their queries keep their cache entries, so coming back from
  search is instant (no refetch inside `staleTime`).
- **Search** hides the category, filter and rail sections and renders two result groups,
  "Restaurants" and "Dishes", from one `GET /search?q=` call. It shows a skeleton on the first
  load. While typing, the previous results stay visible (`placeholderData: keepPreviousData`)
  rather than flashing a spinner on every keystroke. There is an empty state ("No results for
  'xyz'") and an error state with a retry.
- The search bar becomes **controlled**: `value` is the raw text and the debounced value drives
  the query. It gains a clear (X) button. On Android, the back gesture clears the search before
  it leaves the tab.

### 4.2 Browse rails → endpoints

| Rail | Endpoint | Params | Notes |
| --- | --- | --- | --- |
| Popular restaurants | `/search/popular-restaurants` | `customerId`, `size=10` | Horizontal cards, as today |
| Near you | `/search/nearby-restaurants` | `lat`/`lon` from the **selected delivery address** (`useDeliveryAddress().selected.details.coordinates`), `radiusKm=10`, `size=10` | Hidden when there are no coordinates. Re-keyed when the address changes |
| Popular dishes | `/search/products` | `sort=popular` (after B1), `size=10` | See B1-interim. Product card: image from `/files/products/{id}`, name, vendor name, effective price with the original struck through when promoted. Tapping opens `/restaurant/{vendorId}` |
| Open restaurants | `/search/restaurants` | `q` from the category chip, `hasPromotion` from the "Promotions" chip, `size=20` | Open/closed is computed on the client from `days` and sorted open-first (E4). Infinite scroll via `useInfiniteQuery` on `last`/`number` |

**Category chips** (`categories-slider.tsx`, currently `console.log`) set `q=<chip name>` on the
browse list (E6). Tapping the selected chip again clears it.

**Filter chips** (`filters-slider.tsx`, currently local state with no effect):

| Chip | Backed by | Plan |
| --- | --- | --- |
| Promotions | `hasPromotion=true` | Wire it |
| Rating 4.5+ | `ratingAverage` is in the document | Client-side filter on the loaded page (can show short pages). Server-side `fq` is a follow-up |
| New | `createdAt` is in the document | Client-side: the last 30 days |
| Free Delivery, Fast Delivery, This Month Top | Nothing in the index (delivery fees live in fee rules, not on the restaurant) | **Hide** until backed |

## 5. Client architecture

The layering follows the existing catalog work (`restaurants-fetch-display-plan.md`): zod at the
boundary, view models mapped in `select`, query options exported next to their hooks.

### 5.1 Schemas: `schemas/search.ts`

- `solrQueryResultSchema(doc)`: `{ numFound: number, documents: doc[] }`
- `searchPageSchema(doc)`: `{ content: doc[], number, totalPages, totalElements, last }`
- `restaurantSearchDocSchema` and `productSearchDocSchema`: every field `.nullish()`, unknown
  keys passed through (`.passthrough()`), because the index adds fields without notice.
- `combinedSearchResultSchema`: `{ restaurants, products }`

### 5.2 View models: `services/api/search-view-model.ts`

- `restaurantSummaryFromSearch(doc, now)` → the **existing** `RestaurantSummary`, so
  `PopularRestaurants`/`OpenRestaurants` and their cards are reused unchanged. It fills
  `rating` from `ratingAverage`, `discount` from `promotionHeadline`, and `isOpen` from `days`.
- `parseSearchDays(days: string[])` → `WorkingDay[]`, then reuse `isRestaurantOpen` /
  `toTimingRows` from `restaurant-view-model.ts`. This mirrors the backend's
  `WorkingHoursEvaluator`, overnight shifts included.
- `productSummaryFromSearch(doc)` → a new `ProductSummary { id, vendorId, vendorName, name,
  price, effectivePrice, currency, promotionLabel, isPromoted }`. Prices are formatted through
  the same currency helper the menu uses.

### 5.3 Service: `services/api/search-service.ts`

One function per endpoint: `searchAll`, `fetchPopularRestaurants`, `fetchNearbyRestaurants`,
`searchRestaurants`, `searchProducts`. Each parses its response with the schemas in §5.1.

### 5.4 Keys and hooks

- `searchKeys` in `query-keys.ts`: `all`, `combined(q, customerId)`, `popular(customerId)`,
  `nearby(lat, lon, radius)` (coordinates rounded to 3 decimals so GPS jitter doesn't
  fragment the cache), `restaurants(params)`, `products(params)`.
- `hooks/use-search.ts`: `useHomeSearch(q)`, `usePopularRestaurants()`,
  `useNearbyRestaurants(coords)`, `useBrowseRestaurants(params)` (infinite),
  `usePopularProducts()`. `customerId` comes from `useCurrentCustomer()`, and the hooks stay
  disabled until it resolves so the personalized query isn't fetched twice. After B4 that
  dependency goes away.
- `hooks/use-debounced-value.ts` (300 ms), unless one already exists.
- `staleTime`: 2 minutes for the rails, matching `RESTAURANT_STALE_TIME`, and 30 seconds for
  search results.

### 5.5 Components

- `components/home/search-bar.tsx`: a clear button, and an `onSubmitEditing` that skips the debounce.
- `components/home/popular-products.tsx`: the new horizontal dish rail with a skeleton.
- `components/home/search-results.tsx`: the two groups, with empty and error states.
- `components/home/nearby-restaurants.tsx`: a thin wrapper reusing the popular-restaurants card layout.
- `app/(tabs)/index.tsx`: owns `query`, `selectedCategory`, `selectedFilters` and the mode switch.

### 5.6 What stays on JPA

`/restaurants/{id}` (restaurant detail) and the menu screens are unchanged. Search documents are
for lists only. `useRestaurants` stays until nothing imports it.

## 6. Files

| File | Change |
| --- | --- |
| `schemas/search.ts` | new |
| `services/api/search-service.ts` | new |
| `services/api/search-view-model.ts` | new |
| `services/api/query-keys.ts` | add `searchKeys` |
| `hooks/use-search.ts`, `hooks/use-debounced-value.ts` | new |
| `components/home/search-bar.tsx` | controlled input with a clear button |
| `components/home/popular-products.tsx`, `search-results.tsx`, `nearby-restaurants.tsx` | new |
| `components/home/categories-slider.tsx`, `filters-slider.tsx` | selected state; hide unbacked filters |
| `components/home/index.ts` | exports |
| `app/(tabs)/index.tsx` | rewire |
| backend `DefaultSearchService`, `SolrReindexJob`, `SearchController` | B1–B4 |

## 7. Testing

- **Schemas:** fixtures for each envelope, a document with every field null, and unknown extra keys.
- **View model:** `parseSearchDays` with a normal shift, an overnight shift (`18:00–02:00`), a
  closed day and malformed entries, checked against the same cases as `WorkingHoursEvaluator`.
  Also cover rating and promotion mapping and product price formatting.
- **Hooks:** the debounce (no request under 2 characters; one request after 300 ms of quiet),
  `keepPreviousData` while the query changes, the nearby hook disabled without coordinates, and
  the mode switch clearing back to browse.
- **Backend:**
  - B2: a customer with Italian history searching "burger" gets no Italian-only restaurant, and Italian burger places rank first.
  - B1: products ordered more rank higher after the reindex.
  - B3: a restaurant update keeps its `score`.
- **Live check (first phase):** with the stack up, call every endpoint once through the gateway
  and compare against §2. In particular, confirm E2, E3 and E4 actually behave as read.

## 8. Sequencing

1. **Live verification** of §2 (a short `curl` pass). Adjust this plan if anything differs.
2. **Backend B2** (search correctness) and the one-line `hasPromotion` on `/search/products`.
3. **Client foundation:** schemas, view models, service, keys, hooks, all with tests.
4. **Browse mode:** popular, nearby and the open/browse list with chips, replacing `useRestaurants` on home.
5. **Search mode:** the controlled bar, debounce, results and the mode switch.
6. **Backend B1** (product popularity), then switch the dish rail to `sort=popular`.
7. **B3, B4, B5** as follow-ups; none of them blocks the client.

## 9. Out of scope / open questions

- **A "See all" screen** for each rail. The endpoints already page, so this is easy later.
- **Search history and suggestions.** There is no backend endpoint for either.
- **Cuisine chips from data.** The category slider is a hard-coded list of 12 icons. A facet
  query on `cuisines` would make it data-driven, but the icons are hand-drawn.
- **Open question:** should "Near you" use the device GPS when the customer has no saved
  address, or simply hide? This plan proposes hiding it, because the app's location permission
  is only requested during address onboarding today.
