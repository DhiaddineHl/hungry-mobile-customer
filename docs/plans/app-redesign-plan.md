# Plan — Full customer-app redesign on the Hungry design system

**Status:** In progress
**Date:** 2026-10-08
**Source of truth:** [`design system/handoff/DESIGN_SYSTEM.md`](../../design%20system/handoff/DESIGN_SYSTEM.md)
(spec), `design system/handoff/tokens.json` (values), `design system/Hungry Home Search (offline).html`
(the board — screen IDs `H1`, `R2`, `S-C2`… match the spec's §9 inventory).

---

## 1. Goal

Re-skin every screen of the customer app onto the new design system — navy acts, orange
signals, Montserrat, Lucide icons, one set of primitives — **without changing behaviour**.
Data fetching, Keycloak, cart sync, checkout, push and live tracking stay exactly as they are;
only the presentation layer moves.

## 2. Ground rules (apply to every task)

1. **Tokens only.** Components read colours, type, spacing, radii, sizes and shadows from
   `useTheme()` (or the static `lightTheme` export inside `StyleSheet.create`). No hex, font
   size or radius literals in a migrated file.
2. **Icons through `<Icon name=… />`** (`theme/icons.tsx`, Lucide, stroke 2). No
   `@expo/vector-icons`, no bespoke SVG icons, no direct `lucide-react-native` imports in screens.
3. **Primitives before screens.** Screens are composed from `components/ds/*` (spec §6). If a
   screen needs a variant, extend the primitive — never fork a screen-specific copy (principle 5).
4. **Navy acts, orange signals.** No orange button, ever. Orange only for the tab indicator,
   counters, caret, focus ring, progress, unread dots, discount badges and headline accents.
5. **Four states per screen** (spec §7): skeleton loading in the page's own layout (never a
   full-screen spinner), spinner-in-button for actions, local errors (field / banner / StateView),
   toast or SuccessScreen for success.
6. **Copy** per spec §10: sentence case, verbs on buttons, amount on the right of buttons that
   charge, `14 DT` / `9,68 DT`, `25–40 min`, middle-dot counts. EN/FR keys of the profile i18n
   layer keep working.
7. **Accessibility** per spec §11: `accessibilityLabel` on every icon-only button, disabled state
   exposed, touch targets ≥ 44, Reduce Motion respected.
8. **No behaviour regressions.** `npx tsc --noEmit` clean and `npm test` green at the end of every
   task. Tests that assert on old copy/styles are updated to the new design, never deleted to pass.
9. Hero buttons over photos have **no shadow**; the hero cart button routes to the Cart tab.

## 3. Branching

Each task below is one branch, cut **from the previous task's branch** (stacked), because every
group depends on the foundation and on the primitives that earlier groups introduce or extend:

```
redesign/customer-app  (base: design-system export + this plan)
 └─ redesign/00-foundation
     └─ redesign/01-auth
         └─ redesign/02-address
             └─ redesign/03-home-search
                 └─ redesign/04-restaurant-dish
                     └─ redesign/05-cart-checkout
                         └─ redesign/06-orders
                             └─ redesign/07-profile
                                 └─ redesign/08-notifications-favourites
                                     └─ redesign/09-cleanup
```

Each branch is committed and pushed to `origin` when its task is verified. Merge them in order
(or merge `redesign/09-cleanup`, which contains everything).

---

## 4. Tasks

### RD-00 — Foundation: theme, fonts, icons, primitives, chrome
**Branch:** `redesign/00-foundation`

- Copy `design system/handoff/theme/` → `theme/` (`@/theme`). Keep the files' API
  (`ThemeProvider`, `useTheme`, `lightTheme`, `Icon`, `typography`, `fontFamily`).
- Load Montserrat 400/500/600/700/800 + JetBrains Mono 500 under the exact `fontFamily` names in
  `theme/typography.ts`; drop Poppins from the root layout. Wrap the app in `ThemeProvider`.
- **Bridge the legacy tokens:** re-point `constants/theme.ts` (`Palette`, `Fonts`, `Radius`) at the
  new values so screens not migrated yet already read navy/orange/Montserrat. Deleted in RD-09.
- Build the primitives of spec §6 in `components/ds/`:
  `Text` (typography token prop), `PrimaryButton`, `SecondaryButton`, `TextLink`, `IconButton`
  (outlined / floating / filled / add), `PillButton`, `TextField` (+ `SearchField`, `TextArea`,
  focus ring, error, helper, trailing slot), `Checkbox`, `Radio`, `Toggle`, `FilterChip`,
  `SegmentedControl` (+ small), `Stepper` (large / compact, trash at 1), `Badge`, `PromoTag`,
  `InfoTag`, `StatusPill`, `Counter`, `UnreadDot`, `MetaRow`, `Card`, `InfoRow`, `SummaryLine`,
  `ListGroup` / `ListRow`, `Avatar`, `TopBar`, `BottomBar`, `Spinner`, `Skeleton`, `InfoNote`,
  `ErrorBanner`, `Toast` (+ `useToast` host), `StateView`, `SuccessScreen`.
  Primitives used by only one group (OTP, PhoneField, EmailChip, TypeTile, MapPin, ProgressSteps,
  OrderCard, NotificationRow…) are built in that group's task, still under `components/ds/`.
- **TabBar** (spec Chrome): Home · Favourites · Cart · Profile, Lucide 22, `tabLabel`, 24×3 orange
  indicator, inactive icon .45, cart `Counter`.
- Unit tests for the stateful primitives (Stepper trash-at-1, TextField error/announce,
  SegmentedControl, PrimaryButton loading/disabled).

### RD-01 — Auth: A1–A5, S-A1–S-A4
**Branch:** `redesign/01-auth`
**Routes:** `login` (A1 Welcome), `password` (A2), `signup` (A3), `verification` (A5),
`forgot-password` (A4), `reset-code`, `new-password`, `complete-profile`, `auth/callback`.

- `AuthHeader` (ink block 300 / compact 180, `food-pattern.svg`, white `logo-hungry.svg`) +
  `AuthSheet` (radius 28, overlap 28). Replaces the old full-bleed backdrop + orange CTAs.
- `EmailChip`, `PhoneField` (+216 country segment), `OtpInput` (6 boxes, countdown /
  `Resend code`), Google button as `SecondaryButton` with the official G.
- States: S-A1 spinner + "Logging in…", S-A2 red field `Wrong password. Try again or reset it.`,
  S-A3 all OTP boxes red, S-A4 SuccessScreen "Password updated" → Log in.
- Keycloak calls, routing guards and validation schemas unchanged.

### RD-02 — Address flow: L1–L4, S-L1–S-L3
**Branch:** `redesign/02-address`
**Routes:** `location`, `map-select` (L1/L2/L3), `address-info` (L4), plus the Home address popover.

- Light map, `MapSearchPill`, labelled `MapPin` (street + JetBrains Mono coords), `LocateButton`,
  map `BottomSheet` with "Deliver to" + `Deliver to this point`.
- L2 search overlay: scrim, typing pill, results with matched letters bold.
- L3 `TypeTile` grid (Apartment / Office / House / Other) in a sheet → Continue.
- L4 address card with Edit, Floor / Door, Additional information `TextArea`, Label `FilterChip`s,
  default `Checkbox`, `Save address`.
- States: S-L1 locating halo, S-L2 out-of-zone (danger pin + StateView `MapPinOff`), S-L3 toast.

### RD-03 — Home & Search: H1–H3, S1–S5, S-H1–S-H3
**Branch:** `redesign/03-home-search`
**Routes:** `(tabs)/index`, new `search` screen.

- H1 header: "Deliver to · Home · Sahloul ⌄" + filled bell with `Counter`; greeting
  `Hungry, {first name}?` (orange `?`); SearchField button → Search.
- Categories rail, `FilterChip` filters (selected = navy with ×), "Popular near you" tiles,
  "Open now · N places" `RestaurantCard`s (172 image, navy `PromoTag`, `MetaRow`).
- H2 sticky address + search on scroll; H3 filtered results line + `Clear all`.
- Search S1–S5: recent (local) + popular, typing suggestions grouped (cuisine / restaurants),
  results with `SegmentedControl` `Restaurants · N / Dishes · N`, closed rows greyed with
  `Closed · Opens at …`, S4 no-results StateView with "Try instead" chips, S5 skeleton rows.
  *Data:* the Solr search API (`home-search-migration-plan.md`) is not wired yet, so search runs
  client-side over the loaded restaurants; the Dishes tab is shown only when dish data exists.
- States: S-H1 skeleton, S-H2 offline StateView (`WifiOff`, Try again), S-H3 = S4.

### RD-04 — Restaurant & Dish: R1–R3, F1–F3, S-R1–S-R3
**Branch:** `redesign/04-restaurant-dish`
**Routes:** `restaurant/[id]/index`, `restaurant/[id]/info`, `food/[id]`.

- R1 `HeroHeader` 220 (floating back · favourite · cart, no shadow), 80 logo overlapping −40,
  name + Open, `MetaRow`, `PromoTag` + `InfoTag`, menu `SearchField`, category chips,
  "Picked for you" `DishCard` grid.
- R2 sticky `TopBar` + pinned chips, `MenuRow`s (96 thumb, add / quantity marker),
  `BottomBar` `View cart · N items` + amount.
- R3 closed: `Closed · Opens at …` badge, `InfoNote`, disabled DishCards (grayscale, no add).
- F1–F3 dish page: hero 194 with discount badge, title + price/old price + liked %,
  `OptionGroup`/`OptionRow` (checkbox / radio, Required / Optional / Done badges), special
  instructions `TextArea`, Frequently bought together rows with compact Stepper, `BottomBar`
  large Stepper + `Add to cart  {amount}`, disabled button naming what is missing.
- States: S-R1 skeleton, S-R2 toast "Added to cart" + Undo, S-R3 ErrorBanner + Try again.

### RD-05 — Cart & Checkout: C1–C2, S-C1–S-C3
**Branch:** `redesign/05-cart-checkout`
**Routes:** `(tabs)/cart`, `cart/review`, `order-details` (checkout), checkout fee/payment sheets.

- C1 `TopBar` "Your cart" + `Clear`; split-orders `InfoNote`; `RestaurantGroupHeader` per
  restaurant (+ `Add items` outline pill); `CartItem` rows (64 thumb, compact Stepper, line total);
  `BottomBar` `Continue  {total}`.
- C2 map preview + "Deliver to" `InfoRow`, contact and payment InfoRows in a `Card`,
  "N orders · Prepared and delivered separately", one summary `Card` per order (collapsible),
  `Place N orders  {total}`. Backend fee rules stay the only source of every amount.
- States: S-C1 "Placing 2 orders…" with dimmed page, S-C2 closed restaurant flagged only on its
  card → `Place 1 order`, S-C3 SuccessScreen "Orders placed" → My orders. Empty cart StateView.

### RD-06 — Orders: O1–O2, S-O1 (+ order detail & live tracking)
**Branch:** `redesign/06-orders`
**Routes:** `orders/index`, `orders/[id]/index`, `orders/[id]/track`.

- `SegmentedControl` `In progress · N / Completed · N`.
- `OrderCard` (header with `#01A6-0D27 · 29 Sept 2026` + status Badge, `ProgressSteps` 5
  segments + icon row, `Step 3 of 5`, item list box); `CompletedOrderCard` (140 image,
  `StatusPill` Delivered, `Order again` PillButton).
- Order detail and tracking screens (not on the board) recomposed from TopBar, Card, InfoRow,
  ProgressSteps, SummaryLine, BottomSheet; status mapping stays `orderStage(order + delivery)`.
- States: S-O1 skeleton cards, empty StateView per tab.

### RD-07 — Profile & account: P1–P3, S-P1–S-P2
**Branch:** `redesign/07-profile`
**Routes:** `(tabs)/profile`, `account-settings`, `help/support`, `help/report`, `legal/terms`,
`legal/privacy`, `delete-account`.

- P1/P2: `display` title, `ProfileCard`, `ListGroup`s (Account: Account settings, My orders with
  `N in progress` badge; Preferences: Language small segment, Order notifications Toggle; Help and
  legal; Session: Log out; Danger zone: Delete account), version label.
- P3 account settings: 2-column names, email, phone `TextField` with helper, `Save changes`
  (disabled until something changes). S-P1 invalid phone field error, S-P2 toast "Changes saved".
- Help / report / legal / delete-account recomposed from TopBar, TextField/TextArea, ListRow,
  ErrorBanner, SuccessScreen. EN/FR keys preserved.

### RD-08 — Notifications & Favourites: N1, V1, S-N1, S-V1
**Branch:** `redesign/08-notifications-favourites`
**Routes:** `notifications`, `(tabs)/favorites`.

- N1 `TopBar` + `Mark all read`; `NotificationRow`s grouped by overline (Today / This week /
  dates), wells by status (placed neutral, in progress orange, done green), `UnreadDot`.
  Existing delete-notification behaviour kept.
- V1 `display` title, "Restaurants · N saved", `RestaurantRow` + filled orange heart.
- States: S-N1 `BellOff` StateView, S-V1 `primarySoft` heart StateView + `Browse restaurants`.

### RD-09 — Cleanup & hardening
**Branch:** `redesign/09-cleanup`

- Delete `constants/theme.ts` legacy tokens, Poppins, `@expo/vector-icons` usage, `IconSymbol`,
  `themed-text`/`themed-view`/`hello-wave`/`parallax-scroll-view`/`collapsible` and other
  components orphaned by the redesign.
- Lint guard: no `#rrggbb` literals outside `theme/` (spec §13).
- Run spec §13 integration checklist; final tsc / lint / test pass; update project memory.

---

## 5. Verification per task

```bash
npx tsc --noEmit
npm test
npx expo lint   # no new warnings in touched files
```
Plus a visual pass against the board screen IDs listed in the task.
