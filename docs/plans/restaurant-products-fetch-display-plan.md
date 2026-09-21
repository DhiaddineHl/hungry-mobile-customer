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
   capacities, accessibility, policy, address, contact, `logoUrl`, `coverImageUrl`, `days`,
   `keycloakUserId`.
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

**Do not** work around the gap by fetching all products and guessing ownership by name,
keyword or category. That produces a menu that is silently wrong.

### 2.3 UPDATE — the scope is resolvable today, without the backend change

§2.1 remains the right fix, but it is no longer what the feature waits on. The back-office
dashboard has the same missing relation and works around it with a **deterministic code
convention**, which the mobile client can simply read back:

```
catalog          RESTAURANT-MENU-<restaurantId>
catalog version  RESTAURANT-MENU-<restaurantId>-V1
```

(`hungry-frontend/src/hooks/useRestaurantMenu.ts` — `menuCatalogCode` / `menuVersionCode`.)
This is not the guessing §2.2 forbids. The dashboard's `createMenuProduct` **creates** the
catalog, version and category under exactly these codes the first time a restaurant is given
a dish, so every menu that exists was filed under them. The codes resolve through the list
endpoint's `codes` filter, because `read(identifier)` parses its argument as a UUID and
cannot look anything up by code.

`{ status: 'unavailable', reason: 'no-menu' }` therefore now means what it says — the
menu was never created — rather than "the backend cannot tell us yet".

### 2.3.1 SUPERSEDED — a menu is a CATEGORY, not a catalog

The back-office changed the convention, and the client follows it
(`hungry-frontend/src/hooks/useRestaurantMenu.ts`, `menuCategoryCode` /
`ensureMenuSection` / `loadRestaurantMenu`). The whole platform now stages its products in
ONE catalog and ONE catalog version — resolved from `VITE_DEFAULT_CATALOG_VERSION_CODE` —
and a restaurant's menu is a category inside them:

```
menu category            RESTAURANT-MENU-<restaurantId>   (one per restaurant)
  └── section categories Pizzas, Drinks, …                (supercategory = the menu)
        └── products
```

Two consequences for the client, both implemented in `services/api/menu-service.ts` and
`fetchMenu`:

- **The catalog scope is no longer a scope.** Every restaurant shares that catalog version,
  so `filter={"catalogVersionId":"…"}` returns the whole platform's dishes. The client no
  longer sends either catalog field, and `menuScopeOf` — the §2.1 fast path — is gone along
  with `catalogId` / `catalogVersionId` on `RestaurantDetail`: a restaurant-level catalog
  link could not identify a menu even if the backend served one.
- **Products are read section by section.** `ProductFilter.categoryId` takes one category,
  so a menu costs one request per section, run in parallel and merged (a dish filed under
  two sections is kept once). Sections come from `supercategoryId` = the menu category.

`RESTAURANT-MENU-<restaurantId>` survives as the code, but it now names the menu CATEGORY.
A menu category with no section is an EMPTY menu, not a missing one — only a missing
category is `unavailable`.

### 2.4 Both product subtypes must be fetched

`Product` is SINGLE_TABLE with `@DiscriminatorColumn(product_type)`: `StandardProduct` is 1,
`ConfigurableProduct` is 2. A menu holds both, and the difference is an ordering one —
a standard dish is added to the cart directly, a configurable one asks for choices first.

Reading only `/configurable-products/all` therefore drops every standard dish. But
`/products/all`, which is polymorphic and returns both, exposes neither `configuration` nor
the discriminator itself — `ProductOutputData` carries no `productType` field. Neither
endpoint alone is enough, so `fetchMenu` issues both over the same filter and matches on
id: the base call is the menu, the configurable call is the lookup that labels it and
supplies the addons.

Adding `productType` to `ProductOutputData` would collapse this into one request. The
back-office frontend already declares the field and renders a "Configurable" badge on it,
which is dead code until the backend sends it.

#### RESOLVED — `productType` now ships

`ProductOutputData` carries `private Integer productType`, and
`ProductBaseInversePopulator.resolveProductType` derives it from the runtime subtype
(`ConfigurableProduct` → 2, `StandardProduct` → 1, anything else → `null`). Because the
base populator is what the configurable populator delegates to, the field is present on
`/products/**` and `/configurable-products/**` alike.

Two things follow, both implemented:

- **`fetchMenu` is one request.** `/products/all` returns every dish already labelled.
  The parallel `/configurable-products/all` lookup existed only to recover the subtype by
  id membership and is gone. Nothing was lost with it — see §2.5, a list endpoint never
  carried usable addons in the first place.
- **`fetchProductById` asks the discriminator instead of guessing.** It reads
  `/products/{id}` first (polymorphic, so it answers for every dish) and only then, for
  discriminator 2, `/configurable-products/{id}` — whose sole remaining value is the
  configuration id. The previous order tried the configurable route first and read its
  **500** as "then it must be standard", which cost two requests for every standard dish
  and, worse, could not tell a real fault on a configurable dish from a standard one: the
  dish would silently render without the choices it requires.

`isConfigurableType` in `services/api/product-service.ts` is the single place the numbers
are read. Anything that is not exactly 2 — `null` included — is standard, which is the
safe direction: a dish mislabelled standard is still orderable at its base price, whereas
one mislabelled configurable opens a sheet with nothing in it.

### 2.5 Addon groups — RESOLVED, one request

Displaying a configurable dish's choices needs the groups and their options.
`AttributeGroupController` on `/attribute-groups` now serves both, and the mobile client
reads a whole dish's configuration in ONE request:

```
GET /attribute-groups/all
    ?filter={"productConfigurationId":"<uuid>"}
    &sort=[{"field":"createdAt","direction":"ASC"}]
```

Each group comes back with `required` set and its options nested, every option carrying
its own prices. `services/api/configuration-service.ts` is the whole client side of it.

The routes nearby are dead ends for this, worth recording so nobody tries to save the
round-trip through them:

| Read | Returns | Missing |
| --- | --- | --- |
| `/configurable-products/{id}` | `configuration` with id/code/name/description | its `attributes` — `ConfigurableProductBaseInversePopulator` builds a fresh output object and never copies the groups across. Its one use is supplying the configuration id |
| `/product-configurations/{id}` | the groups, `required` included | each group's `attributes` — `ProductConfigurationBaseInversePopulator` stops at the group's own fields |
| `/attributes/all` | the options, with prices | nothing, but `AttributeFilter` narrows by `attributeGroupId` only — one group at a time |

Before the controller existed the client walked the last two: a configuration read plus a
request per group. It was also moot — the back-office POSTs to `/attribute-groups` to
create a group, so with no controller its `tryPersistAttributeGroups` failed on every save
and no configurable dish had any groups at all.

Two details of the backend work that the client depends on:

- **Options are ordered server-side.** `AttributeGroup.attribute` carries
  `@OrderBy("createdAt ASC")`. A `List` with no `@OrderBy` comes back in whatever order the
  database returns, so a customer could watch a dish's options reshuffle between loads.
  The client orders the GROUPS itself, via the `sort` above.
- **There is no PUT on `/attribute-groups`.** `DefaultCrudService.update` returns `null`
  without touching the repository — only `CustomerCrudService` and `DriverCrudService`
  implement it — so a mapped PUT would answer 200, an empty body, and no write. The
  mapping is omitted so callers get a 405 instead. This is framework-wide: every other
  controller's PUT has the same no-op behaviour, they just expose it.

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

`ProductOutputData` has no `imageUrl` and no `logoUrl` — restaurants got `logoUrl` and, as
of backend `1e167ed`, `coverImageUrl` as well; products got nothing. Two options, both documented rather than silently chosen:

- **`GET /files/products/{productId}`** returns `FileMetadata[]`, each with a `url`. Verified
  live: an unknown id returns `200 []`, so it is safe to call speculatively. But it is
  **one request per product**, an N+1 across a menu grid. Note that each `url` is a
  **relative** `/files/…` path and that `/files/**` is authenticated — see §2.5 of the
  restaurant catalog plan. RESTO-01 ships `services/api/image-url.ts` for exactly this;
  reuse it rather than rebuilding the join and the auth header here.
- **A placeholder asset**, with the real image wired when the backend adds an image field
  or a batch files endpoint.

**Original recommendation: placeholder for list views, and the files call only on the
food-detail screen.**

**Revised (menu artwork).** A menu of neutral grey squares is not a menu, and neither of
the two cheaper shapes exists yet — `ProductOutputData` still has no image field, and
`/files` still offers no batch read. So the fan-out is paid, deliberately, and confined to
one hook: `useProductImageSources` in `hooks/use-products.ts`. What keeps it bounded is
that the screen passes only the ids it is rendering (a tab filter narrows them), the hook
de-duplicates a dish that appears in two sections, and every answer shares the cache entry
the food-detail screen reads — so opening a dish costs no image request, and returning to
the menu costs none for 30 minutes. The placeholder still fills the gap while a request is
in flight and permanently for a dish with no photo. **When the backend grows a product
image field or a batch files endpoint, that hook is the only place that changes.**

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

The groups do NOT arrive with the product — see §2.5 for where each piece is read from.
`toAddonGroups` therefore takes the resolved groups, not a product.

`AttributeGroup` → the UI's `AddonGroupData`, `Attribute` → `AddonOption`:

| UI field | Backend source |
| --- | --- |
| `id`, `title` | `AttributeGroup.id`, `.name` |
| `subtitle` | `AttributeGroup.description` |
| `required` | `AttributeGroup.required` ✅ |
| `options[].id`, `.name` | `Attribute.id`, `.name` |
| `options[].price` | `Attribute.prices` via §3.6, rendered as `"+2 DT"` |
| `type` (`checkbox`\|`radio`) | `AttributeGroup.selectionType` ✅ — see the update below |
| `maxSelect` | ❌ **no backend field** |
| `options[].isPopular` | ❌ **no backend field** |

Leave `maxSelect`/`isPopular` undefined, collected in an `UNBACKED_ADDON_FIELDS` constant
mirroring RESTO-01's `UNBACKED_FIELDS`.

#### UPDATE — `selectionType` ships, so `type` is backed

`AttributeGroupOutputData` carries `selectionType` (`SINGLE` | `MULTIPLE`), and the
back-office writes it on every group it creates (`selectionType ?? 'SINGLE'`). `SINGLE`
maps to a radio group, everything else to a checkbox group (`addonGroupType`), and the
tap rule that follows from it — replace vs. toggle — is `toggleAddonSelection`, which the
food screen applies.

An unspecified value renders as a CHECKBOX. `null` does not mean "the restaurant did not
choose", since the back-office always sends one; it means the value never reached us. That
silence must not cap every topping group at one choice, whereas the opposite error only
permits a second choice the group should not take. There is still no `maxSelect`, so a
multi-select group remains uncapped.

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
| `components/restaurant/menu-unavailable.tsx` | The §2.3.1 "no menu category" state |

**Modified**

| File | Change |
| --- | --- |
| `schemas/restaurant.ts` | No catalog link — see §2.3.1; the menu is found through its category |
| `services/api/menu-service.ts` | Resolve the menu category + its sections (§2.3.1) |
| `services/api/query-keys.ts` | Add `productKeys` and `menuKeys` |
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
4. **Menu scope** — `fetchMenuScope` returns `null` when the restaurant has no menu
   category, and a scope (sections included, possibly empty) when it does.
5. **Service layer** — filter JSON for `categoryId` and nothing else that scopes; one
   request per section, merged and de-duplicated; that no `keyword` filter is ever emitted;
   500-on-valid-UUID → not-found; schema-invalid response throws.
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
