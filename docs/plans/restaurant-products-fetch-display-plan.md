# Plan — Fetching & Displaying Restaurant Products (Menu)

**Status:** Ready for implementation — with one backend dependency, see §2
**Task file:** [`docs/tasks/restaurant-products-MENU-01.md`](../tasks/restaurant-products-MENU-01.md) — trigger with `/task "MENU-01"`
**Depends on:** [`RESTO-01`](../tasks/restaurants-catalog-RESTO-01.md) — must be `status: done` first
**Date:** 2026-08-23
**Backend studied:** `C:\projects\hungry-web\hungry-backend` @ `0e5bb3c`

---

## 1. Goal

Replace the hard-coded product arrays on the restaurant-detail and food-detail screens
(`PROMOTIONS_PRODUCTS`, `PICKED_FOR_YOU`, `CLASSIQUES`, `SIGNATURES`, `BOWLS`, `FOOD_DATA`,
`FREQUENTLY_BOUGHT`) with live menu data, reusing the boundary conventions RESTO-01
establishes: zod parsing at the network edge, pure view-model mapping, colocated query
options, and unit tests on the logic that matters.

## 2. The blocker you must know about first

**The backend has no link between a restaurant and its products.** This was verified three
independent ways, and it is the single fact that shapes this entire plan:

1. `ProductOutputData` has no `restaurantId` and no `restaurant` field — its only ownership
   chain is `product → catalog → tenant`.
2. The `Restaurant` entity has no `catalog`, `catalogVersion`, `tenant`, `product` or `menu`
   field. Its full field list is legal/brand name, tax id, dates, cuisines, dishes,
   capacities, accessibility, policy, address, contact, `logoUrl`, `days`, `keycloakUserId`.
3. Grepping the entire product and catalog module tree for "restaurant" returns **zero
   matches**, in either direction.

So `GET /products?restaurant=X` is not merely missing an endpoint — the relationship does
not exist in the data model. No amount of client work can conjure it.

### 2.1 The fix is small, and belongs to the backend team

`ProductFilter` **already** carries `catalogId`, `catalogVersionId` and `categoryId`, and
`ProductSpecification` **already** implements all three as real JPA predicates (verified
live: `filter={"catalogId":"…"}` returns 200). The only missing piece is telling the client
*which* catalog a restaurant owns.

The minimal backend change is therefore:

> Add `catalogVersionId` (or `catalogId`) to the `Restaurant` entity and expose it on
> `RestaurantOutputData`.

That is one field and one getter. Every query this feature needs then works with no new
backend query code. Raise this with the backend team as the unblocking dependency; do not
attempt it from this repository.

### 2.2 How this task ships anyway

The client is built against a **catalog scope** that the restaurant will carry, so the work
is real, tested and type-safe today and switches on with a one-line change:

```ts
// Reads restaurant.catalogVersionId once the backend exposes it; null until then.
function menuScopeOf(restaurant: RestaurantDetail): MenuScope | null
```

When the scope is `null`, `useRestaurantMenu` resolves to an explicit
`{ status: 'unavailable', reason: 'no-catalog-link' }` and the screens render a clear
"menu coming soon" state. That is honest, it is testable, and it does not fake data.

**Do not** work around the gap by fetching all products and guessing ownership by name,
keyword or category. That produces a menu that is silently wrong.

## 3. Ground truth — verified against the running backend

### 3.1 Endpoints

All require a bearer token and are reached through the gateway (`:8082`).

| Endpoint | Returns | Notes |
| --- | --- | --- |
| `GET /products/all` | `Page<ProductOutputData>` | Base type — **no `configuration`** |
| `GET /configurable-products/all` | `Page<ConfigurableProductOutputData>` | Base fields **plus `configuration`** |
| `GET /standard-products/all` | `Page<StandardProductOutputData>` | Identical to base |
| `GET /products/{id}` | `ProductOutputData` | UUID only |
| `GET /categories/all` | `Page<CategoryOutputData>` | Menu sections |
| `GET /files/products/{id}` | `FileMetadata[]` | Product images — see §3.5 |

`Product` uses `@Inheritance(SINGLE_TABLE)` with a `product_type` discriminator.
**Addons exist only on the configurable-products endpoint** — `/products/all` returns the
base projection and silently omits `configuration`. Any screen that needs addons must query
`/configurable-products/…`, not `/products/…`.

### 3.2 Shapes

```
ProductOutputData      id, code, name, description, catalog, catalogVersion,
                       subcategories: Category[], subclassifications: Classification[],
                       keywords: string[], prices: Price[]
ConfigurableProduct…   ...all of the above, plus configuration: ProductConfiguration
ProductConfiguration…  id, code, name, description, attributes: AttributeGroup[]
AttributeGroup…        id, code, name, description, required: boolean, attributes: Attribute[]
Attribute…             id, code, name, description, prices: Price[]
Price…                 id, code, name, amount: number, currency: Currency,
                       category: PriceCategory, restriction: TimeRestriction
Currency…              id, code, name, isoCode, symbol, decimalPlaces: int,
                       displayFormat: 'PREFIX' | 'SUFFIX', active: boolean
TimeRestriction…       id, code, name, effectiveFrom: date-time, effectiveTo: date-time
Category…              id, code, name, description, catalog, catalogVersion,
                       keywords: string[], active: boolean, visible: boolean
```

As with restaurants, **nothing is marked `required`** — every field is nullable on the wire.

The page envelope is the same flat legacy `PageImpl` shape RESTO-01 already models; reuse
that `pageSchema` helper rather than writing a second one.

### 3.3 Filters — note the shape change

`ProductFilter` mixes two different styles, unlike `RestaurantFilter`:

| Key | Shape | Status |
| --- | --- | --- |
| `ids`, `codes`, `names` | `FilterSpecification[]` (`{operator, fieldValue, fieldType}`) | works |
| `catalogId`, `catalogVersionId`, `categoryId` | **plain UUID string** | works |
| `keyword` | plain string | **500** |

`filter={"keyword":"pizza"}` fails with
`InvalidDataAccessResourceUsageException: Operand of 'member of' operator must be a plural
path` — `isMember` is applied to an `@ElementCollection` of basic strings. Product search
must therefore go through `names` + `LIKE`, exactly as restaurant search does.

### 3.4 Sharp edges (all verified live)

| Request | Result | Consequence |
| --- | --- | --- |
| `GET /products/{unknown-uuid}` | **500** `NoSuchElementException` | Missing product is not a 404 |
| `GET /products/abc` | **500** `IllegalArgumentException: Invalid UUID string` | **Worse than restaurants** — `ProductControllerAdvice` registers only the filter editor and has no exception handlers, so a malformed id is a 500 here where `/restaurants/abc` correctly gives 400 |
| `filter={"keyword":…}` | **500** | Use `names` + `LIKE` |
| unknown `sort` field | **500** | Whitelist only |
| configurable product with a dangling config id | **500** | `ConfigurableProductBasePopulator:35` calls `.orElseThrow()` |

The consequence for the client is the same as RESTO-01 but broader: **on this resource a
500 carries almost no information**. The service layer must translate 500-on-a-known-id
into a not-found result rather than surfacing "Internal Server Error" to a customer, and
must avoid the retry storm that `query-client.ts` applies to 5xx.

### 3.5 Products have no image field

`ProductOutputData` has no `imageUrl` and no `logoUrl` — restaurants got `logoUrl`, products
got nothing. Two options, both documented rather than silently chosen:

- **`GET /files/products/{productId}`** returns `FileMetadata[]`, each with a `url`. Verified
  live: an unknown id returns `200 []`, so it is safe to call speculatively. But it is
  **one request per product**, an N+1 across a menu grid.
- **A placeholder asset**, with the real image wired when the backend adds an image field
  or a batch files endpoint.

**Recommendation: placeholder for list views, and the files call only on the food-detail
screen**, where it is a single request for a single product. Do not fan out `/files/` calls
across a menu grid.

### 3.6 Price selection — the core logic of this task

`prices` is a **list**, not a scalar. Choosing and formatting the right one is to this task
what `isRestaurantOpen` was to RESTO-01: the piece with real edge cases, and the reason the
unit tests earn their keep.

- A price applies when `restriction` is absent, or when `now` falls within
  `[effectiveFrom, effectiveTo]`. Either bound may be null, meaning open-ended.
- Several prices can apply at once (different `category` — e.g. a base price and a promo).
  Pick deterministically: **lowest `amount` among applicable prices wins**, and expose the
  highest applicable as `originalPrice` when it differs, which is exactly what the existing
  `ProductCard` renders as a struck-through price with a discount badge.
- No applicable price → the product is **unorderable**, not free. Render it without a price
  and disable add-to-cart. A `0` fallback would let customers order at no charge.
- Format from `currency`: `decimalPlaces`, `symbol`, and `displayFormat` (`PREFIX` →
  `"DT 9.68"`, `SUFFIX` → `"9.68 DT"`). Do not hardcode `"DT"` — the mock data does, the
  real data must not.
- `amount` is a JSON number. Compute in integer minor units where possible and never compare
  floats for equality.

Take `now` as an injected parameter so tests are deterministic.

### 3.7 Addon mapping and what is missing

`AttributeGroup` → the UI's `AddonGroupData`, `Attribute` → `AddonOption`:

| UI field | Backend source |
| --- | --- |
| `id`, `title` | `AttributeGroup.id`, `.name` |
| `subtitle` | `AttributeGroup.description` |
| `required` | `AttributeGroup.required` ✅ |
| `options[].id`, `.name` | `Attribute.id`, `.name` |
| `options[].price` | `Attribute.prices` via §3.6, rendered as `"+2 DT"` |
| `type` (`checkbox`\|`radio`) | ❌ **no backend field** |
| `maxSelect` | ❌ **no backend field** |
| `options[].isPopular` | ❌ **no backend field** |

Default `type: 'checkbox'` and leave `maxSelect`/`isPopular` undefined, collected in an
`UNBACKED_ADDON_FIELDS` constant mirroring RESTO-01's `UNBACKED_FIELDS`. A single-select
group cannot be distinguished from a multi-select one today — say so in a comment rather
than guessing from the group name.

### 3.8 Menu sections

`menu-filter-tabs.tsx` hardcodes `promotions` / `special` / `top`. **None of these exist in
the backend** — there is no promotion, featured or best-seller concept anywhere in the
product model. Real sections come from `subcategories` (`CategoryOutputData`, which has
`active` and `visible` flags to respect). Group products by category and drop the invented
tabs rather than mapping them onto categories that do not mean the same thing.

## 4. Architecture

Identical layering to RESTO-01 — the point is that there is one shape to learn:

```
services/api/product-service.ts        ← axios + zod parse at the boundary
        ▼
services/api/product-view-model.ts     ← DTO → UI shape; price selection; addon mapping
        ▼
hooks/use-products.ts                  ← query options + hooks
        ▼
app/restaurant/[id]/index.tsx, app/food/[id].tsx, components/restaurant/*
```

Reuse, do not duplicate: `pageSchema` from `schemas/restaurant.ts` (move it to
`schemas/page.ts` if that reads better — a shared helper, not a copy), the `ApiError`
handling in `services/api/client.ts`, and the query-key factory style in `query-keys.ts`.

## 5. Files

**New**

| File | Purpose |
| --- | --- |
| `schemas/product.ts` | zod schemas + inferred types for product, price, currency, attribute, category |
| `services/api/product-service.ts` | `fetchMenu`, `fetchProductById`, `fetchProductImage` |
| `services/api/product-view-model.ts` | Price selection, currency formatting, addon mapping, section grouping |
| `hooks/use-products.ts` | `useRestaurantMenu`, `useProduct` |
| `components/restaurant/menu-section-skeleton.tsx` | Loading placeholder |
| `components/restaurant/menu-unavailable.tsx` | The §2.2 "no catalog link" state |

**Modified**

| File | Change |
| --- | --- |
| `schemas/restaurant.ts` | Add the optional `catalogVersionId` / `catalogId` the backend will expose |
| `services/api/restaurant-view-model.ts` | Add `menuScopeOf()` |
| `services/api/query-keys.ts` | Add `productKeys` |
| `components/restaurant/product-card.tsx` | `image: any` → typed; price/rating props optional |
| `components/restaurant/menu-section.tsx` | Accept the view-model product type |
| `components/restaurant/menu-filter-tabs.tsx` | Tabs from categories, not hardcoded |
| `app/restaurant/[id]/index.tsx` | Delete the five product arrays; fetch the menu |
| `app/food/[id].tsx` | Delete `FOOD_DATA`, `FREQUENTLY_BOUGHT`, `RESTAURANT_*` constants |
| `store/cart-store.ts` | `image: any` → `FavoriteImage`-style union; real `unitPrice`/`basePrice` |

## 6. Testing

The harness exists after RESTO-01 Phase 1 — do not reinstall it. Priorities:

1. **Price selection** — no prices; one unrestricted price; a restriction window with `now`
   inside, before, after, and exactly on each bound; null `effectiveFrom`; null
   `effectiveTo`; two applicable prices (lowest wins, higher becomes `originalPrice`); two
   equal prices (no false discount badge).
2. **Currency formatting** — `PREFIX` vs `SUFFIX`, `decimalPlaces` of 0, 2 and 3, missing
   currency falling back safely.
3. **Addon mapping** — group with `required: true`; empty attribute list; an attribute whose
   prices are all restricted out; `type` defaulting to `checkbox`.
4. **Menu scope** — `menuScopeOf` returns `null` when the restaurant carries no catalog
   link, and a scope when it does.
5. **Service layer** — filter JSON for `catalogVersionId` + `categoryId`; that no `keyword`
   filter is ever emitted; 500-on-valid-UUID → not-found; schema-invalid response throws.
6. **Component smoke tests** — a product card with no price renders without crashing and
   without an add-to-cart affordance.

## 7. Sequencing

1. Schemas (products, prices, currency, attributes, categories)
2. Price selection + currency formatting (+ tests — the bulk of the value)
3. Addon mapping + section grouping (+ tests)
4. `menuScopeOf` + the unavailable state (+ tests)
5. Service layer (+ tests)
6. Query keys + hooks
7. Restaurant detail menu wiring
8. Food detail wiring
9. Cart store typing
10. Full verification pass

## 8. Out of scope

- **The backend change in §2.1.** This task consumes the link; it does not create it.
- Cart mutations against `/carts` — a separate task; this one only reads.
- Ordering, `/orders`, and checkout.
- Search within a menu, and `frequently bought together` (no backend concept — the existing
  mock stays until a recommendations source exists; delete the mock, render nothing).
- Backend fixes for the `keyword` 500, the missing `IllegalArgumentException` handler on
  `ProductControllerAdvice`, and the `.orElseThrow()` in `ConfigurableProductBasePopulator`.
  Document and work around; raise separately.
