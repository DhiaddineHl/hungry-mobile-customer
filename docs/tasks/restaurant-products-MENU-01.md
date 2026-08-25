---
suffix: MENU-01
title: Fetch and display restaurant products (menu)
status: done
plan: docs/plans/restaurant-products-fetch-display-plan.md
depends_on: RESTO-01
---

# MENU-01 — Fetch and display restaurant products

Replace the hard-coded product arrays on the restaurant-detail and food-detail screens with
live, runtime-validated menu data from the Hungry backend.

Read [`docs/plans/restaurant-products-fetch-display-plan.md`](../plans/restaurant-products-fetch-display-plan.md)
in full before starting. §2 documents a **backend gap** that shaped the whole client
design; §2.3 documents how the gap was subsequently worked around without a backend change.
Read both — the design follows from the first, the behaviour from the second.

## Dependency — RESTO-01 must be done first

This task builds directly on [`RESTO-01`](./restaurants-catalog-RESTO-01.md) and reuses:

- the **jest harness** (RESTO-01 Phase 1) — do NOT reinstall it,
- the `pageSchema` helper and zod-at-the-boundary convention from `schemas/restaurant.ts`,
- the `RestaurantDetail` view model, which this task extends with `menuScopeOf()`,
- the `restaurantKeys` factory style in `services/api/query-keys.ts`,
- `ApiError` handling in `services/api/client.ts`.

**Before starting**, verify RESTO-01 is complete:

```bash
grep "^status:" docs/tasks/restaurants-catalog-RESTO-01.md
ls schemas/restaurant.ts services/api/restaurant-view-model.ts hooks/use-restaurants.ts
npm test
```

If `status:` is not `done`, or those files do not exist, **STOP** and report that MENU-01 is
blocked on RESTO-01. Do NOT implement RESTO-01's scope as part of this task, and do NOT
recreate its files.

## The blocker you must understand (plan §2)

**There is no link between a restaurant and its products in the backend.** Verified three
ways: `ProductOutputData` has no restaurant field; the `Restaurant` entity has no
catalog/tenant/product field; and grepping the product and catalog modules for "restaurant"
returns zero matches.

The client is therefore built against a **menu scope** the restaurant will eventually carry:

```ts
function menuScopeOf(restaurant: RestaurantDetail): MenuScope | null
```

Until the backend exposes `catalogVersionId` on `RestaurantOutputData`, this returns `null`.

- **DO NOT** fetch all products and guess ownership by name, keyword or category.
- **DO NOT** invent a restaurant→catalog mapping table in the app.
- **DO NOT** modify the backend to add the link — that is out of scope (plan §8).

### RESOLVED — the scope no longer waits on the backend (plan §2.3)

`menuScopeOf` returning `null` used to end the story, which left every restaurant showing
"menu coming soon". It no longer does: `services/api/catalog-service.ts` resolves the
catalog from the deterministic code the back-office files it under
(`RESTAURANT-MENU-<restaurantId>-V1`), and `menuScopeOf` is kept as the fast path for the
day §2.1 lands.

This does not relax the three DO NOTs above — the code convention is read back from the
tool that creates the menus, not guessed from product names.

Two further corrections landed with it, both in plan §2.3–2.4:

- **Both product subtypes are fetched.** Reading only `/configurable-products/all` dropped
  every standard dish. `fetchMenu` now reads `/products/all` for the menu and
  `/configurable-products/all` as the lookup that labels it, since neither endpoint alone
  carries both the full list and the subtype.
- **`catalog` / `catalogVersion` are objects on the wire**, not strings — the schema said
  strings, which would have failed the whole page at the parse boundary.

## Backend contract (verified — do not re-derive)

`GET /configurable-products/all?filter=<json>&page=&size=&sort=` → flat `PageImpl` envelope,
same shape RESTO-01 already models.

**Use `/configurable-products/all`, not `/products/all`**: `Product` uses SINGLE_TABLE
inheritance and the base endpoint returns a projection with **no `configuration`**, so
addons are invisible there.

Shapes (**every field nullable** — nothing is `required`):

```
ConfigurableProductOutputData
  id, code, name, description, catalog, catalogVersion,
  subcategories: Category[], subclassifications: Classification[],
  keywords: string[], prices: Price[],
  configuration: { id, code, name, description, attributes: AttributeGroup[] }

AttributeGroup  { id, code, name, description, required: boolean, attributes: Attribute[] }
Attribute       { id, code, name, description, prices: Price[] }
Price           { id, code, name, amount: number, currency: Currency,
                  category: PriceCategory, restriction: TimeRestriction }
Currency        { id, code, name, isoCode, symbol, decimalPlaces: int,
                  displayFormat: 'PREFIX' | 'SUFFIX', active: boolean }
TimeRestriction { id, code, name, effectiveFrom: date-time, effectiveTo: date-time }
Category        { id, code, name, description, keywords: string[],
                  active: boolean, visible: boolean }
```

Filter keys — **note the mixed shapes**:

| Key | Shape | Status |
| --- | --- | --- |
| `ids`, `codes`, `names` | `FilterSpecification[]` | works |
| `catalogId`, `catalogVersionId`, `categoryId` | plain UUID **string** | works |
| `keyword` | plain string | **500 — never send it** |

Verified failures to code around:

- `GET /products/{unknown-uuid}` → **500**, not 404.
- `GET /products/abc` → **500**, not 400. `ProductControllerAdvice` has no exception
  handlers, so malformed ids are worse here than on `/restaurants/abc`.
- `filter={"keyword":…}` → **500** `Operand of 'member of' operator must be a plural path`.
- Unknown `sort` field → **500**.
- Products have **no image field at all**. `GET /files/products/{id}` returns
  `FileMetadata[]` (`200 []` for unknown ids) but costs one request per product.

## Phases

Use TodoWrite with one todo per phase. Mark each complete immediately on finishing it,
never batched.

### Phase 1 — Schemas

Create `schemas/product.ts` in the style of `schemas/restaurant.ts`.

- `currencySchema`, `timeRestrictionSchema`, `priceCategorySchema`, `priceSchema`,
  `attributeSchema`, `attributeGroupSchema`, `productConfigurationSchema`,
  `categorySchema`, `productOutputSchema`, `configurableProductOutputSchema`.
- Everything `.nullish()` except `id`.
- `.catch([])` on `prices`, `attributes`, `subcategories`, `keywords`.
- `displayFormat` as `z.enum(['PREFIX','SUFFIX']).nullish()`.
- **Reuse** `pageSchema` from RESTO-01. If it lives inside `schemas/restaurant.ts`, move it
  to `schemas/page.ts` and update the RESTO-01 import — do NOT copy it.
- Export types via `z.infer` only.

Add optional `catalogId` / `catalogVersionId` to `restaurantOutputSchema` so the app is
ready for the §2.1 backend change without another schema edit.

**Tests** (`schemas/__tests__/product.test.ts`): a full configurable product parses; `{id}`
alone parses with collections defaulting to `[]`; a null `configuration` parses; a product
missing `id` fails with `id` in the issue path.

### Phase 2 — Price selection and currency formatting

Create `services/api/product-view-model.ts`. Pure functions — no React.

```ts
export interface AppliedPrice { amount: number; formatted: string; original?: string; discountLabel?: string }
export function selectPrice(prices: Price[], now: Date): AppliedPrice | null
export function formatAmount(amount: number, currency: Currency | null | undefined): string
```

Rules (plan §3.6):

- A price applies when `restriction` is absent, or `now` is within
  `[effectiveFrom, effectiveTo]`. **Either bound may be null = open-ended.**
- Among applicable prices the **lowest `amount` wins**. When a strictly higher applicable
  price exists, expose it as `original` and derive `discountLabel` (e.g. `"-25%"`).
  Equal amounts must NOT produce a discount badge.
- **No applicable price → return `null`**, meaning unorderable. Never fall back to `0` —
  that would let a customer order at no charge.
- Format with `decimalPlaces`, `symbol` and `displayFormat` (`PREFIX` → `"DT 9.68"`,
  `SUFFIX` → `"9.68 DT"`). Never hardcode `"DT"`.
- Missing currency → format the bare number rather than crashing.
- `now` is an injected parameter, never `new Date()` inside the function.

**Tests** — at minimum: empty list → `null`; one unrestricted price; `now` before / inside /
after a window; exactly on `effectiveFrom` (applies) and exactly on `effectiveTo` (applies);
null `effectiveFrom`; null `effectiveTo`; two applicable prices (lowest wins, higher becomes
`original`); two equal prices (no discount label); `PREFIX` vs `SUFFIX`; `decimalPlaces` of
0, 2 and 3; missing currency.

### Phase 3 — Addon mapping and section grouping

In the same file:

```ts
export function toAddonGroups(product: ConfigurableProduct, now: Date): AddonGroupData[]
export function groupBySection(products: Product[]): { title: string; products: MenuProduct[] }[]
```

- `AttributeGroup` → `AddonGroupData`: `id`, `title` ← `name`, `subtitle` ← `description`,
  `required` ← `required`, `options` ← `attributes` with prices via `selectPrice`, rendered
  as `"+2 DT"`.
- `type` has **no backend field** — default `'checkbox'` and add a comment saying a
  single-select group is indistinguishable today. `maxSelect` and `isPopular` stay
  `undefined`.
- Collect the gaps in an exported constant mirroring RESTO-01's `UNBACKED_FIELDS`:
  ```ts
  export const UNBACKED_ADDON_FIELDS = ['type', 'maxSelect', 'isPopular'] as const;
  ```
- `groupBySection` groups by `subcategories`, skipping categories with `active === false` or
  `visible === false`, sorting group titles stably (the backend serializes Java collections;
  order is not guaranteed). Products with no category go into a single trailing untitled
  group.

**Tests**: group with `required: true`; empty attribute list; an attribute whose prices are
all restricted out (option renders with no price, not a crash); `type` defaults to
`checkbox`; invisible and inactive categories excluded; uncategorised products grouped last;
stable ordering across two calls with shuffled input.

### Phase 4 — Menu scope and the unavailable state

In `services/api/restaurant-view-model.ts` add:

```ts
export type MenuScope = { catalogVersionId: string } | { catalogId: string };
export function menuScopeOf(restaurant: RestaurantDetail): MenuScope | null;
```

Return `null` when the restaurant carries neither id. Document with a comment that this is
expected until the backend change in plan §2.1 lands.

Create `components/restaurant/menu-unavailable.tsx` — a calm, themed empty state using
`constants/theme` tokens. It must NOT read as an error; the restaurant is fine, its menu
just is not connected yet.

**Tests**: `menuScopeOf` returns `null` for a restaurant with no catalog fields, and a scope
when `catalogVersionId` is present.

### Phase 5 — Service layer

Create `services/api/product-service.ts` using the existing `apiClient`.

```ts
export async function fetchMenu(scope: MenuScope, params?: { categoryId?: string; nameLike?: string; page?: number; size?: number }): Promise<Page<ConfigurableProduct>>
export async function fetchProductById(id: string): Promise<ConfigurableProduct | null>
export async function fetchProductImageUrl(id: string): Promise<string | null>
```

- Hit `/configurable-products/all`, never `/products/all` (addons).
- Parse every response through the Phase 1 schemas; on parse failure throw an `ApiError`
  naming the offending field path.
- Build `filter` from the scope (`catalogVersionId` or `catalogId` as a **plain string**,
  not a `FilterSpecification`) plus `categoryId`, plus `names` + `LIKE` for `nameLike`.
- **NEVER emit a `keyword` filter** — it 500s.
- `sort` restricted to a whitelist union `'name' | 'code' | 'createdAt'`.
- `fetchProductById` returns `null` for missing/malformed ids. On this resource both a
  missing id and a malformed id return **500**, so treat 500 as not-found when the id was a
  well-formed UUID, and add a comment noting a genuine server fault is indistinguishable.
  Treat 400 and 404 as `null` too.
- `fetchProductImageUrl` calls `GET /files/products/{id}` and returns the first entry's
  `url`, or `null`. (Superseded: the menu grid now shows real dish photos, so the fan-out
  IS paid — there is no batch endpoint that would avoid it. It is confined to
  `useProductImageSources`, which resolves only the sections on screen, de-duplicates ids
  and caches each answer for 30 minutes. See plan §3.5.)

**Tests** (`services/api/__tests__/product-service.test.ts`): mock `apiClient`. Assert the
scope filter JSON; assert `nameLike` produces a `names`/`LIKE` filter; assert no request
ever contains `keyword`; assert 500 on a valid UUID → `null`; assert a schema-invalid
response throws `ApiError`.

### Phase 6 — Query keys and hooks

Add a `productKeys` factory to `services/api/query-keys.ts` mirroring `restaurantKeys`
(`all` / `lists()` / `list(scope, params)` / `details()` / `detail(id)`). The scope must be
part of the list key so two restaurants never share a cache entry.

Create `hooks/use-products.ts` following `hooks/use-restaurants.ts`:

- `useRestaurantMenu(restaurant)` — derives the scope, and when it is `null` returns a
  discriminated result `{ status: 'unavailable' }` **without firing a request**
  (`enabled: false`).
- `useProduct(id)` — `enabled: !!id`.
- `staleTime: 5 * 60 * 1000` with a one-line comment: menus change far less often than
  availability.
- Map to view models in `select` so mapping is memoized by TanStack Query.

### Phase 7 — Restaurant detail menu

In `app/restaurant/[id]/index.tsx` delete `PROMOTIONS_PRODUCTS`, `PICKED_FOR_YOU`,
`CLASSIQUES`, `SIGNATURES` and `BOWLS`, and render sections from `groupBySection`.

`components/restaurant/menu-filter-tabs.tsx`: replace the hardcoded `promotions` /
`special` / `top` tabs with categories from the menu. **None of those three exist in the
backend** — do not map them onto categories that mean something else. When there are no
categories, hide the tab strip entirely rather than showing an empty bar.

`components/restaurant/product-card.tsx` and `menu-section.tsx`: replace `image: any` with a
typed union, make `price`, `rating` and `reviewCount` optional, and render a placeholder
asset when no image exists. A product with no applicable price shows no price and no
add-to-cart affordance.

Handle loading (`menu-section-skeleton.tsx`), error, empty, and the Phase 4 unavailable
state. Preserve the existing scroll-driven logo animation and its geometry constants.

### Phase 8 — Food detail

In `app/food/[id].tsx` delete `FOOD_DATA`, `FREQUENTLY_BOUGHT`, `RESTAURANT_ID`,
`RESTAURANT_NAME` and `RESTAURANT_LOGO`. Fetch via `useProduct(id)`, build addon groups with
`toAddonGroups`, and resolve the restaurant from the route rather than a constant.

"Frequently bought together" has **no backend source** — remove the section entirely rather
than shipping mock recommendations (plan §8).

Compute the running total from the selected addons using `selectPrice` amounts, not parsed
display strings.

### Phase 9 — Cart store typing

In `store/cart-store.ts` replace `image: any` and `restaurantLogo?: any` with the same union
RESTO-01 introduced for favorites (`string | number`). Feed real `basePrice` / `unitPrice`
numbers from `selectPrice`. Fix every resulting type error in `components/cart/*` and
`app/(tabs)/cart.tsx`.

### Phase 10 — Verification

```bash
npx tsc --noEmit          # must be 0 errors
npm test                  # all tests pass
npx eslint .              # no new errors
```

Confirm no product mock data survives:

```bash
grep -rn "PROMOTIONS_PRODUCTS\|PICKED_FOR_YOU\|CLASSIQUES\|SIGNATURES\|const BOWLS\|FOOD_DATA\|FREQUENTLY_BOUGHT" \
  app components --include=*.tsx
```

Must return **no matches**.

Confirm the forbidden filter is never sent:

```bash
grep -rn "keyword" services/api/product-service.ts
```

Must return **no matches**.

If the gateway is reachable, verify live. If not, say so plainly rather than claiming the
check passed. Note that with no catalog link on restaurants (plan §2), the expected live
result today is the **unavailable state**, not a populated menu — that is success, not
failure.

## Definition of done

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm test` → all pass, including every `selectPrice` case in Phase 2
- [ ] `npx eslint .` → no new errors
- [ ] Both Phase 10 greps return no matches
- [ ] No `any` introduced; no hand-written type duplicating a zod schema
- [ ] `pageSchema` is shared with RESTO-01, not duplicated
- [ ] Menu renders loading, error, empty **and** unavailable states
- [ ] A product with no applicable price shows no price and cannot be added to cart
- [ ] `UNBACKED_ADDON_FIELDS` documents `type`, `maxSelect`, `isPopular`

## Constraints

- **DO NOT** modify anything under `C:\projects\hungry-web\hungry-backend`.
- **DO NOT** implement RESTO-01's scope, or recreate its files. If it is not done, STOP.
- **DO NOT** send a `keyword` filter — it returns 500.
- **DO NOT** use `/products/all` where addons are needed — it omits `configuration`.
  (Superseded: NO list endpoint carries addons. See plan §2.5 — the groups and their
  options are read from `/product-configurations/{id}` and `/attributes/all`, on the
  food screen only.)
- **DO NOT** call `/files/products/{id}` directly from a list view. (Revised: list views
  DO show artwork now, but only through `useProductImageSources`, which scopes and caches
  the per-product requests — see plan §3.5.)
- **DO NOT** fall back to a price of `0` when no price applies.
- **DO NOT** guess restaurant→product ownership by name, keyword or category.
- **DO NOT** implement cart mutations, ordering, checkout, or menu search — out of scope.
- **DO NOT** commit or push unless explicitly asked.
- Match surrounding code: double-quoted JSX imports in `components/`, `constants/theme`
  tokens over literal colours, `PressableScale` over `TouchableOpacity` in new code.

## Report

On completion, report: files created and modified; the exact output of the three
verification commands; the state the menu renders in today and why; the list of unbacked
addon fields; and a clear restatement of the backend change from plan §2.1 that unblocks
real menu data.

---

## UPDATE — the discriminator now ships, and the addon read path is in

`ProductOutputData.productType` is live (plan §2.4 → RESOLVED). Two things changed on the
mobile side as a result:

- `fetchMenu` is **one** request; the `/configurable-products/all` labelling lookup is gone.
- `fetchProductById` reads `/products/{id}` for the discriminator and only asks
  `/configurable-products/{id}` for discriminator 2. The old try-and-read-the-500 fallback
  is gone with it — it could not distinguish a real fault from a standard dish, and would
  drop a configurable dish's required choices when it guessed wrong.

The food screen now resolves and renders a configurable dish's choices:
`services/api/configuration-service.ts` reads `/product-configurations/{id}` for the
groups and one `/attributes/all` per group for its options. Required groups gate
add-to-cart, optional ones do not, and the gate is held while the groups are still in
flight — an unresolved configuration reads as an empty list, which would otherwise let a
dish be ordered without the choices it requires.

**No longer blocked.** `AttributeGroupController` has been added to the backend, so the
back-office can persist groups and the client reads a dish's whole configuration in one
request — `GET /attribute-groups/all?filter={"productConfigurationId":...}`, groups with
`required` and options with prices nested. See plan §2.5.

Verified live against the running stack: create a configuration, a group and its options,
then read them back through the gateway in the exact shape
`services/api/configuration-service.ts` sends. Ordering holds in both directions (groups by
the client's `sort`, options by `@OrderBy` on the association), and the test rows were
deleted afterwards.

The one thing that remains true of the whole framework: PUT persists nothing
(`DefaultCrudService.update` returns null), so `/attribute-groups` deliberately maps no PUT
and answers 405 rather than a silent 200. Edit a group by delete-and-recreate.
