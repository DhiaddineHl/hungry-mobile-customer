# Hungry Customer App — Design System

Implementation spec for the Hungry customer app (React Native, TypeScript). It covers every screen on the board `Hungry Home Search.dc.html` (sections 1a–4a).

**How to use this document (for coding agents)**
1. Copy `theme/` to `src/theme/`. Wrap the app in `<ThemeProvider>`. Components read every value from `useTheme()`. Never write a hex value, font size or radius inline in a component.
2. Install `lucide-react-native` and `react-native-svg`. Render icons through `theme/icons.tsx` (`<Icon name="search" />`) so names, sizes and stroke stay consistent. §5 lists every icon.
3. Build the primitives in §6 before the screens. Every screen in §9 is composed only from these primitives.
4. Match the board by screen ID (`H1`, `R2`, `S-C2`…). The ID appears above each phone on the board and in its `data-screen-label`.
5. If a value is missing here, take it from `tokens.json`. If it is missing there too, measure it on the board and add it to the tokens instead of hard-coding it.

Reference frame: **390×844 pt** portrait. Widths are fluid; the fixed values below are heights, paddings and icon sizes. **Light theme only.** Currency is TND: `14 DT`, `59,9 DT` (comma decimal, trailing zeros dropped).

---

## 1. Principles
1. **Address first.** "Deliver to" sits at the top of Home, Checkout and the address flow because it decides what is available.
2. **Navy acts, orange signals.** Every primary action is navy (`ink`). Orange (`primary`) is only used for signals: the active tab indicator, counters, the text cursor, the focus ring, progress, unread dots, discount badges, and the `?`/`.` accent at the end of headlines. Never make a button orange.
3. **One idea per element.** Rating, time and fee share one meta row. A promo is one navy tag. The delivery fee is highlighted (green) only when it is free.
4. **Errors are local.** An error appears on the field or above the content it affects, and always says what to do next.
5. **Same parts everywhere.** Chips, fields, segmented control, meta row, dish card and list rows are reused across all flows. Do not create screen-specific variants.
6. Touch targets ≥ 44 pt. No gradients, no emoji, no all-caps buttons (only overlines are uppercase).

---

## 2. Color
Use semantic tokens only. Hex lives in `tokens.json` → `theme/colors.ts`.

### 2.1 Brand palette
| Name | Hex | Notes |
|---|---|---|
| navy | `#003049` | Brand ink. Text, icons, buttons. |
| orange | `#EA8608` | Brand signal. Never as a large fill behind text other than counters/badges. |
| orangeSoft | `#FCE9D2` | Tint of orange for badges, wells, focus ring. |
| slate | `#5B6B75` | Secondary text. |
| slateLight | `#8A969C` | Placeholder, inactive tab label. |
| green | `#2E7A3D` | Success. |
| red | `#C2412D` | Danger. Added for error states and destructive actions. |
| white | `#FFFFFF` | |

### 2.2 Semantic tokens
| Token | Value | Use |
|---|---|---|
| `background` | `#FFFFFF` | Screen background |
| `surface` | `#FFFFFF` | Cards, sheets, tab bar, bottom bar, floating buttons |
| `surfaceMuted` | `#F4F3F1` | Inputs at rest, info note, search field, OTP boxes, item list inside order card |
| `surfaceSunken` | `#F2F1EE` | Segment track, image placeholders, Closed badge, neutral icon wells, Change pill, disabled button |
| `skeleton` | `#EFEDEA` | Loading blocks (the board's state screens draw them in `surfaceSunken`; use this token) |
| `divider` | `#EEF0F1` | 1 pt separators, card borders, logo tile borders, tab bar top border |
| `outline` | `#D9DDE0` | 1.5 pt borders: chips, steppers, secondary button, checkbox/radio off, sheet grabber |
| `outlineSubtle` | `#E3E6E8` | 1.5 pt border of the outlined back / top-bar icon buttons |
| `iconWell` | `#EEF0F1` | 28 pt meta icon circles (time, paid fee) |
| `ink` | `#003049` | Primary text and icons, primary button, selected chip, promo tag, bell button, checkbox on, toggle on |
| `inkMuted` | `#5B6B75` | Secondary text, meta, captions, inactive segment label |
| `inkSubtle` | `#8A969C` | Placeholders, inactive tab label, version label |
| `onInk` | `#FFFFFF` | Text/icons on `ink` |
| `primary` | `#EA8608` | Tab indicator, counters, caret, progress fill, unread dot, headline accent |
| `onPrimary` | `#003049` | Text on `primary` (counters) |
| `primarySoft` | `#FCE9D2` | Discount and status badges, liked well, focus ring, avatar, favourite button, Required badge |
| `success` | `#2E7A3D` | Free delivery, Open, Popular, Delivered, success icon |
| `successSoft` | `rgba(58,151,76,0.14)` | Free-delivery well, Delivered pill, success well |
| `danger` | `#C2412D` | Error text, error field border, error pin, Log out, Delete account |
| `dangerSoft` | `#FBEAE7` | Error banner, destructive icon wells |
| `focusRing` | `#FCE9D2` | 4 pt ring outside focused inputs |
| `scrim` | `rgba(0,48,73,0.28)` | Dims the map under sheets and search |
| `toast` | `#003049` | Toast background |

### 2.3 Rules
- Text on white: `ink` for primary text, `inkMuted` for secondary text, `inkSubtle` only for placeholders and inactive tab labels.
- Text on `primarySoft`, `surfaceSunken` and `successSoft` is `ink`, `inkMuted` or `success` respectively, never white.
- Prices are always `ink`. Old prices are `inkMuted` with a strikethrough.
- Red appears only for errors, Log out and Delete account (plus the Danger zone overline).
- Board-only colours (do not use in the app): `#F4F1EC` canvas, JetBrains Mono annotations.

---

## 3. Typography
**Montserrat** 400 / 500 / 600 / 700 / 800. Load each weight as its own file and select it by `fontFamily` (Android does not synthesize weights). Use `fontVariant: ['tabular-nums']` for prices, quantities, times, countdowns and order numbers. **JetBrains Mono 500** is used only for map coordinates (11 pt).

| Token | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 28/34 | 700 | -0.6 | Greeting, page titles (Profile, Favourites), restaurant name, auth headings |
| `title` | 24/30 | 700 | -0.4 | Dish name, success screen title |
| `heading` | 20/26 | 700 | -0.3 | State view title, bottom-sheet title |
| `sectionTitle` | 18/24 | 700 | -0.2 | Section headers, option group titles, top bar title |
| `cardTitle` | 18/24 | 700 | -0.2 | RestaurantCard name |
| `rowTitle` | 16/22 | 700 | 0 | Row titles, restaurant name in cart/orders, address line |
| `button` | 16/20 | 700 | 0 | Primary button label |
| `buttonSecondary` | 16/20 | 600 | 0 | Secondary button label |
| `input` | 16/22 | 400 | 0 | Input text and placeholder |
| `body` | 16/24 | 400 | 0 | Long body text |
| `bodySmall` | 15/22 | 400 | 0 | Auth subtitles, success body |
| `itemTitle` | 15/20 | 700 | 0 | Dish card name, cart item name, notification title |
| `itemLabel` | 15/20 | 600 | 0 | Option name, list row label, info row value |
| `price` | 15/20 | 700 | 0 | Prices (18/24 700 on the dish page) |
| `chip` | 14/18 | 600 | 0 | Chips, segments, toast text |
| `link` | 14/18 | 600 | 0 | Underlined, offset 3 |
| `description` | 14/20 | 400 | 0 | Dish description, state view body (14/21) |
| `meta` | 13/18 | 500 | 0 | Cuisine, meta line, helper under group titles, notification body (13/19) |
| `label` | 13/18 | 600 | 0 | Field labels |
| `caption` | 12/16 | 500 | 0 | "Deliver to", info row captions, time stamps, strikethrough price |
| `fieldMessage` | 12/16 | 600 | 0 | Error message under a field (`danger`); helper text uses `caption` in `inkMuted` |
| `badge` | 12/16 | 700 | 0 | `-25%`, `Required`, `Placed`, `Ready` |
| `overline` | 11/14 | 600 | 1, UPPERCASE | List group headers (Account, Today, Results…) |
| `tabLabel` | 11/14 | 600 | 0 | Tab bar labels |
| `counter` | 11/16 | 700 | 0 | Cart / bell counters |
| `coords` | 11/14 | JetBrains Mono 500 | 0 | Map coordinates |

Headlines may end with an orange `?` or `.` in `primary`. Use it on board-level titles and the greeting only, never on body text or buttons.

---

## 4. Layout, spacing, radius, elevation

### 4.1 Spacing
Scale: `2 4 6 8 10 12 14 16 20 22 24 28 32`.
- Screen horizontal padding **24**. Top bars and floating hero buttons use **16**.
- Section rhythm: **28** above a section title, **14** title → content, **16** between header blocks, **20–24** between form groups.
- Rows: list row vertical padding 10–16; separators are 1 pt `divider` between rows (never after the last row).
- Grids: 2 columns, row gap 20, column gap 14. Rails: 24 leading/trailing inset.

### 4.2 Radius
| Token | Value | Use |
|---|---|---|
| `badge` | 6 | Badges, checkbox |
| `segmentInner` | 9 | Selected segment, small language segment track |
| `control` | 12 | Segment track, icon wells (36), logo tiles (40), pin label |
| `field` | 14 | Inputs, buttons, notes, banners, toasts, OTP boxes, list thumbs (64 in cart: 16) |
| `thumb` | 16 | Dish images, menu row image, address-type tile |
| `card` | 20 | Restaurant card image, bordered cards, list groups, order cards |
| `logo` | 22 | Restaurant logo on hero (80 pt) |
| `sheet` | 28 | Bottom sheets, auth sheet (top corners only) |
| `pill` | 999 | Chips, steppers, icon buttons, toggle, tags |

### 4.3 Sizes
Touch 44 · icon button 44 · input 52 · primary button 52 · stepper large 52 / compact 32 · chip 40 · segment 44 · tab bar 88 (row 48) · home indicator 34 · map search pill 56 · option row ≥ 56 · list row ≥ 60 · info row icon well 36 · meta well 28 · notification well 40 · state well 72 · avatar 56 · restaurant logo 80 · logo tile 40 · cart thumb 64 · menu thumb 96 · dish card image 132 · restaurant card image 172 · restaurant hero 220 · dish hero 194 · auth header 300 (compact 180).

### 4.4 Elevation
| Token | RN style | Use |
|---|---|---|
| `segmentSelected` | ink, opacity .14, y 1, r 2, elevation 1 | Selected segment |
| `floatingButton` | ink, opacity .18, y 2, r 8, elevation 3 | Add (+) buttons on images, map search pill, map locate button, pin label |
| `logo` | ink, opacity .12, y 2, r 8, elevation 2 | Restaurant logo over hero |
| `sheet` | ink, opacity .12, y -4, r 24, elevation 8 | Map bottom sheet |
| `toast` | ink, opacity .45, y 8, r 24, spread -8, elevation 6 | Toast |
| `phone` | — | Board only |

**No shadow** on the back / favourite / cart buttons that float over hero photos (restaurant and dish pages). They are plain white 44 pt circles.

---

## 5. Iconography
**Library:** [Lucide](https://lucide.dev) via `lucide-react-native` (+ `react-native-svg`). Stroke width **2**, `strokeLinecap/Join = round`, `absoluteStrokeWidth = false`. Always render through `theme/icons.tsx`. SVGs of every icon/colour pair used on the board are in `assets/icons/` for reference.

**Sizes:** 12 clear-x · 14 inline (meta, chip ×, pills, field error) · 16 compact stepper, small buttons · 18 rows, chevrons, info rows, well icons · 20 field icons, large stepper, floating buttons, tab badges, toast · 22 back chevron, tab bar · 30 state well.

**Colour:** `ink` by default; `onInk` on navy; `inkMuted` for chevrons in list rows, eye, mail and upcoming progress steps; `success` / `primary` / `danger` only for status. The favourite heart when saved is filled `primary` (`fill={colors.primary}`, `color={colors.primary}`).

| Semantic name | Lucide | Where |
|---|---|---|
| `back` | `ChevronLeft` | Top bars, hero, map search |
| `chevronDown` | `ChevronDown` | Address switcher, country code, collapsed order |
| `chevronRight` | `ChevronRight` | List rows (`inkMuted`, 18) |
| `close` | `X` | Clear search, selected chip × (white) |
| `search` | `Search` | Search fields, top bar search |
| `bell` | `Bell` | Home header (white on ink), notification setting |
| `bellOff` | `BellOff` | Empty notifications |
| `home` | `House` | Tab bar, address type House |
| `favourite` | `Heart` | Tab bar, card / hero favourite, empty favourites |
| `cart` | `ShoppingCart` | Tab bar, hero cart button (navigates to Cart) |
| `profile` | `User` | Tab bar |
| `liked` | `ThumbsUp` | Meta row liked % |
| `time` | `Clock` | Meta row |
| `delivery` | `Motorbike` | Meta row fee, progress step "on the way", notification "driver" |
| `add` | `Plus` | Add buttons, steppers, Add items |
| `remove` | `Minus` | Steppers |
| `delete` | `Trash2` | Stepper at quantity 1, Delete account |
| `check` | `Check` | Checkbox, progress "confirmed", notification "confirmed" |
| `success` | `CircleCheck` | Toast, success screens |
| `error` | `CircleAlert` | Banners, field messages |
| `info` | `Info` | Info note |
| `offline` | `WifiOff` | Offline state |
| `noResults` | `SearchX` | No search results |
| `pin` | `MapPin` | Address rows, address type Other |
| `pinOff` | `MapPinOff` | Out of delivery zone |
| `locate` | `LocateFixed` | Map locate button |
| `apartment` | `Building2` | Address type |
| `office` | `Briefcase` | Address type, address card |
| `phone` | `Phone` | Contact row |
| `cash` | `Banknote` | Payment row |
| `mail` | `Mail` | Email chip |
| `showPassword` | `Eye` | Password fields |
| `receipt` | `Receipt` | Progress "placed", My orders, notification "placed" |
| `preparing` | `ChefHat` | Progress "preparing" |
| `ready` | `ShoppingBag` | Notification "order ready" |
| `delivered` | `Package` | Progress "delivered", Delivered pill |
| `reorder` | `RotateCcw` | Order again |
| `star` | `Star` | Top rated pill |
| `more` | — | Removed; the hero uses the cart button instead |
| `accountSettings` | `UserCog` | Profile |
| `language` | `Languages` | Profile |
| `help` | `CircleHelp` | Profile |
| `report` | `Flag` | Profile |
| `terms` | `FileText` | Profile |
| `privacy` | `ShieldCheck` | Profile |
| `logout` | `LogOut` | Profile (danger) |

Non-Lucide assets: `assets/brand/logo-hungry.svg` (white wordmark, auth header), `assets/brand/food-pattern.svg` (auth header pattern), Google "G" (official multicolour mark, sign in), category illustrations (Figma component "Categories", node 1318:25233).

---

## 6. Primitives
Each maps to `src/components/<Name>.tsx`. Values in pt.

### Buttons
- **PrimaryButton** — height 52, radius 14, `ink` bg, `onInk` `button` text, padding 0×20, centered. With an amount (`right` prop): label left, amount right (`tabular-nums`), `space-between`.
  - Disabled: `surfaceSunken` bg, `inkMuted` text. Disabled buttons may carry the reason as the label ("Choose a sauce").
  - Loading: spinner 18 (2.5 stroke, `onInk` arc on 35 % white track) + progressive label ("Logging in…", "Placing 2 orders…"); not pressable.
- **SecondaryButton** — height 52, radius 14, 1.5 `outline` border, `buttonSecondary`, optional 20 leading icon, gap 10.
- **TextLink** — `link` style, `ink`, underline offset 3.
- **IconButton**
  - `outlined`: 44 circle, 1.5 `outlineSubtle`, 22 chevron (top bars) / 20 icon.
  - `floating`: 44 white circle, no border, **no shadow**, 20 icon (hero photos). Group gap 10.
  - `filled`: 44 circle `ink` with white icon (Home bell).
  - `add`: 40 (cards) / 32 (rows) white circle + `floatingButton` shadow, plus icon half the size.
- **PillButton** — 40 pill `ink`, 14/600 white, padding 0×16, gap 8, 16 icon ("Order again"). Outline version 36 h, 13/600 ("Add items").

### Inputs
- **TextField** — label (`label`, gap 6 above) + box 52, radius 14, padding 16, `input`.
  - Rest: `surfaceMuted` bg, no border; placeholder `inkSubtle`.
  - Focused: white bg, 2 `ink` border, padding 14, 4 pt `focusRing` drawn as a wrapping view (radius 18). Caret 2×22 `primary` (`cursorColor`/`selectionColor`).
  - Error: white bg, 2 `danger` border; message below (`fieldMessage`, `danger`, 14 `error` icon, gap 6).
  - Helper text: `caption`, `inkMuted`, 6 below.
  - Trailing slot: 20 icon (eye, clear).
  - Disabled/locked (while submitting): opacity 0.6.
- **SearchField** — TextField with 20 leading search icon, gap 12. On Home it is a button that opens Search.
- **TextArea** — as TextField, height 72–88, padding 14×16, top-aligned.
- **PhoneField** — country segment (52 h, `surfaceMuted`, flag 20×14 + `+216` + 14 chevron-down) + TextField, gap 8.
- **OtpInput** — 6 boxes, flex 1, gap 8, height 56, radius 14, `surfaceMuted`, digits 22/700 `tabular-nums`. Focused box: white, 2 `ink`, 4 `focusRing`, caret. Error: all boxes white with 2 `danger`. Below: countdown `Resend code in 0:58` (13, `inkMuted`, right) or `Resend code` link.
- **EmailChip** — 48 h, 1 `divider` border, radius 14, padding 0 8 0 14; 18 mail `inkMuted`; email 15/600 ellipsis; `Change` 32 pill `surfaceSunken` 13/600.

### Selection
- **Checkbox** 22, radius 6. Off: 1.5 `outline`. On: `ink` fill + 14 white check.
- **Radio** 22 circle. Off: 1.5 `outline`. On: 7 `ink` border.
- **Toggle** 44×26 pill. On: `ink` track, 22 white knob 2 from the edge. Off: `outline` track.
- **FilterChip** 40 pill, padding 0×16, `chip`. Default: 1.5 `outline`. Selected: `ink` bg, white text, optional trailing 14 white ×.
- **SegmentedControl** 44, `surfaceSunken` track, radius 12, padding 4, gap 4; selected white, radius 9, `segmentSelected` shadow, `ink` 14/600; unselected `inkMuted`. Labels carry counts when known: `In progress · 3`.
- **SegmentedControl small** (language) 32, padding 3, inner radius 7, 12/600.
- **TypeTile** (address type) — 2-column grid, gap 10; 64 h, radius 16, padding 0×14, gap 12, 15/600. Rest: `surfaceMuted`, 2 transparent border, white 36 well with navy icon. Selected: white, 2 `ink` border, `ink` well with white icon.
- **Stepper** — pill, 1.5 `outline`.
  - Large: 52 h, padding 0×14, gap 14, 20 icons, value 16/700.
  - Compact: 32 h, padding 0×8, gap 10, 16 icons, value 14/700. At quantity 1 the minus becomes `Trash2`.

### Badges and tags
- **Badge** — `badge` type, radius 6, padding 3×7. Variants: `discount` / `status` / `required` (`primarySoft` + `ink`); `neutral` / `optional` / `done` (`surfaceSunken` + `inkMuted`); `closed` (`surfaceSunken` + `ink`, 600, padding 3×8: `Closed · Opens at 10:00`).
- **PromoTag** — 30 pill `ink`, white 13/600, padding 0×12.
- **InfoTag** — 30 pill `surfaceSunken`, 13/600, 14 icon, gap 6 (`Top rated`).
- **StatusPill** — 30 pill `successSoft`, `success` 13/600 + 14 icon (`Delivered`).
- **Counter** — 18 pill `primary`, `counter` text `onPrimary`; on the bell 20 with a 2 white border.
- **UnreadDot** — 8 circle `primary`.

### Content
- **MetaRow** — single line, gap 16, `meta`: [28 `primarySoft` well + 14 thumbs-up] liked % (600) · [28 `iconWell` + 13 clock] time · fee = [28 `successSoft` well + motorbike `success`] **Free delivery** (`success` 600) or [`iconWell` + motorbike] `2,5 DT`.
- **RestaurantCard**, **RestaurantRow** — unchanged from the Home & Search spec (see §6 of the original doc / `RestaurantCard.dc.html`, `RestaurantRow.dc.html`). Closed row: thumb opacity .45 + grayscale, title `inkMuted`, `closed` badge.
- **DishCard** (grid) — image 132, radius 16, `cover`; discount badge top-left 8/8; add button 40 bottom-right 8/8. Name `itemTitle` 1 line; meta `caption` `inkMuted`; price + old price, gap 6. Disabled (closed restaurant): image opacity .5 + grayscale, name `inkMuted`, no add button.
- **MenuRow** — padding 16×0, gap 14, divider between. Left: name 16/22 700, description `meta` `inkMuted` clamped to 2 lines, price + old price. Right: 96 image radius 16 with a 32 add button bottom-right 6/6, or a 32 `ink` quantity marker showing the count in the cart.
- **OptionGroup** — header: title `sectionTitle` + rule (`Choose up to 6`, `Choose 1 to 3`) `meta` `inkMuted`; right badge `Required` / `Optional` / `Done`. Rows: **OptionRow** min 56, padding 8×0, gap 14, divider between; name `itemLabel`; sub line 13/18 `inkMuted` with price (`+1 DT`, no wrap) and `Popular` (`success` 600); trailing Checkbox or Radio.
- **CartItem** — padding 14×0, gap 14, divider between; 64 thumb radius 16; name `itemTitle`, options `meta` `inkMuted`; bottom line: compact Stepper left, line total right (15/700).
- **RestaurantGroupHeader** (cart, checkout, orders) — 40 logo tile radius 12 + name `rowTitle` + meta `meta` `inkMuted`, gap 12; trailing `Add items` outline pill or total.
- **Card** — 1 `divider` border, radius 20, overflow hidden. Used for info rows, order summaries, list groups.
- **InfoRow** — padding 12×16, gap 14, 36 well (`surfaceSunken`, radius 12, 18 icon); caption (`caption` `inkMuted`) above value (`itemLabel`); trailing chevron.
- **SummaryLine** — 14/20 `inkMuted` label, `ink` value right; total 15/700.
- **ListGroup** (profile) — overline header (margin 28 top, 8 bottom, `inkMuted`; `danger` for Danger zone) + Card. **ListRow** min 60, padding 12×16, gap 14, 36 well, label `itemLabel`, optional sub `meta` `inkMuted`, trailing chevron / Toggle / small segment / Badge. Inset divider starts at 66. Destructive rows: `dangerSoft` well, red icon, `danger` label.
- **Avatar** 56 circle `primarySoft`, initials 18/700 `ink`.
- **ProfileCard** — Card with padding 16: Avatar + name `rowTitle` + email `meta`.
- **ProgressSteps** (orders) — 5 segments (Placed · Confirmed · Preparing · On the way · Delivered), each 4 h, radius 2, gap 4; done/current `primary`, upcoming `surfaceSunken`. Icon row below, 18: receipt, check, chef-hat, motorbike, package — done/current `ink`, upcoming `inkMuted` at 50 %. Above: step name 15/700 + `Step 3 of 5` 13 `inkMuted`.
- **OrderCard** — Card, padding 16, gap 14: RestaurantGroupHeader with `#01A6-0D27 · 29 Sept 2026` + status Badge; ProgressSteps; optional item list in a `surfaceMuted` box (radius 12, padding 10×12, `1×` bold).
- **CompletedOrderCard** — Card, padding 12: 140 image radius 14; name + date; `6 items · #3EB8-EF96`; StatusPill + `Order again` PillButton.
- **NotificationRow** — padding 14×0, gap 14, divider between; 40 round well by status: placed = `surfaceSunken` + `ink`, in progress = `primarySoft` + `primary`, done = `successSoft` + `success`; title `itemTitle`; time `caption` + UnreadDot; body 13/19 `inkMuted`. Grouped by overline: `Today`, `This week`, then dates.

### Chrome
- **StatusBar / safe area** — top 50 on the board.
- **TopBar** — margin 4×16; outlined back IconButton + title `sectionTitle` (1 line, ellipsis) + optional trailing (link, outlined IconButton). Scrolling pages add a 1 `divider` line below.
- **HeroHeader** (restaurant 220, dish 194) — full-bleed photo, white status bar; floating IconButtons at top 54 (dish 42), left 16 / right 16: back left; favourite + cart right (gap 10). The cart button navigates to the Cart tab. Restaurant logo 80, radius 22, 3 white border, `logo` shadow, overlapping −40, left 24. Dish discount badge bottom-left 16/12 on the photo.
- **BottomBar** — absolute bottom, `surface`, 1 `divider` top, padding 12×24 0, content row gap 12, then the 34 home indicator. Holds PrimaryButton (with amount) and optionally a large Stepper on its left. Scroll content gets bottom padding equal to the bar height.
- **TabBar** — 88 incl. home indicator, `surface`, 1 `divider` top, padding 8×12. Items Home · Favourites · Cart · Profile; 22 icon; `tabLabel`. Active: icon opacity 1, label `ink`, 24×3 `primary` indicator at top −9 (radius 0 0 3 3). Inactive: icon opacity .45, label `inkSubtle`. Cart counter offset −6/−10.
- **AuthHeader** — `ink` block 300 (compact 180 on Sign up), `food-pattern.svg` 520×372 at x −65 / y −30 (compact y −104), white logo 176 w at top 120 (compact 120 w at top 66), centred. **AuthSheet** overlaps by −28: white, top radius 28, padding 28×24, gap 20.
- **BottomSheet** (map) — `surface`, top radius 28, `sheet` shadow, padding 10×24, gap 16, grabber 36×4 `outline` radius 2.
- **MapSearchPill** — absolute top 58, left/right 16; 56 h, radius 28, white, `floatingButton` shadow; inner back button 44 `surfaceMuted` circle; text 16; trailing search (or clear while typing).
- **MapPin** — 40 teardrop (`border-radius 20 20 20 4`, rotated −45°) `ink`, 12 inner dot (`primary` while choosing, white otherwise), 10×4 ground shadow. Optional label bubble above: white, radius 12, `floatingButton` shadow, padding 8×12, street `13/18 700` + `coords`. Error variant: `danger` pin. Searching: 96 `primary` @16 % halo.
- **LocateButton** — floating 44 white circle with shadow, 20 locate icon, right 16, above the sheet.

### Feedback
- **Spinner** — 18 ring, 2.5 stroke; on buttons `onInk` over 35 % white; on light surfaces `ink` over `ink` @18 %. Rotate 0.8 s linear.
- **Skeleton** — `skeleton` blocks in the exact layout of the content they replace (text bars 12–18 h radius 6, images with the real radius). Opacity pulse 0.6 ↔ 1, 1.2 s. Real chrome (status bar, top bar buttons, tab bar) stays interactive.
- **InfoNote** — `surfaceMuted`, radius 14, padding 12×14, gap 10, 18 info icon, 13/18 `ink`.
- **ErrorBanner** — `dangerSoft`, radius 14, padding 12×14, gap 10, 18 `CircleAlert` `danger`; title 14/20 700 `danger`; body 13/18 `ink`; optional link.
- **Toast** — absolute, left/right 16, 104 from the bottom when a bottom/tab bar is shown (otherwise 16 + safe area); `toast` bg, radius 14, padding 12×14, gap 12, `toast` shadow; 20 `CircleCheck` white; text `chip` white; optional action (white, 14/700, underlined). Auto-dismiss 4 s; 6 s when it has Undo.
- **StateView** (empty / error / offline) — fills the content area, centred, padding 0×40, gap 14: 72 circle well (30 icon) → `heading` → body 14/21 `inkMuted` (max 280) → optional actions full width (PrimaryButton or SecondaryButton). Wells: neutral `surfaceSunken`; favourites `primarySoft`; success `successSoft`.
- **SuccessScreen** — StateView with `successSoft` well + `CircleCheck` `success`, `title` type, then a summary Card and actions pinned to the bottom (PrimaryButton + TextLink).

---

## 7. State patterns (section 4a)
Every screen implements four states. Use these patterns; do not invent new ones.

| State | Pattern | Rules |
|---|---|---|
| **Loading — content** | Skeleton in the page's own layout | Never a full-screen spinner. Chrome stays (back, favourite, cart, tab bar). |
| **Loading — action** | Spinner inside the button + progressive label; inputs locked at 0.6 opacity; page content may dim to 0.55 | Button not pressable while loading. |
| **Error — field** | Red field + message under it | Validate on submit, then live while the user fixes it. Message states the expected format. |
| **Error — request** | ErrorBanner above the affected content, button becomes `Try again` | Keep the user's input and choices. |
| **Error — page** | StateView (`WifiOff`, `SearchX`, `MapPinOff`…) with one action | Keep header/tab bar. |
| **Empty** | StateView with a reason and, where useful, one action | e.g. `No favourites yet` + `Browse restaurants`. |
| **Success — inline** | Toast (+ Undo when reversible) | Cart add, address saved, profile saved. Disable Save again until something changes. |
| **Success — end of flow** | SuccessScreen | Orders placed, password updated. |
| **Partial failure** | Flag only the affected item; let the rest proceed | e.g. one restaurant closed at checkout → `Place 1 order`. |

---

## 8. Navigation
- Tabs: Home · Favourites · Cart · Profile.
- Home → Search → Results → Restaurant → Dish → (add) → Cart → Checkout → Orders placed → My orders.
- The **cart button on the restaurant and dish hero** opens the Cart tab (C1).
- Profile → Account settings / My orders / Language / Notifications / Help / Reports / Terms / Privacy / Log out / Delete account.
- Home bell → Notifications. Home "Deliver to" → Address flow (L1 → L2 search → L3 type → L4 details → back to Home with a toast).
- Auth: Welcome (email) → existing account: Password → Home; new email: Sign up → Verification code → Home. Forgot password → code → new password → Password updated → Log in.

---

## 9. Screen inventory
IDs match the board labels.

**1a Home & Search** — H1 Home · H2 Home scrolled · H3 Home filtered · S1 Search idle · S2 Search typing · S3 Results (restaurants) · S3b Results (dishes) · S4 No results · S5 Results loading.

**2a Ordering**
| ID | Screen | Notes |
|---|---|---|
| R1 | Restaurant — top | HeroHeader, logo, name + Open, MetaRow, promo + Top rated tags, menu SearchField, category chips, Picked for you DishCard grid |
| R2 | Restaurant — scrolled | Sticky TopBar + search; chips pinned with divider; MenuRows; BottomBar `View cart · 2 items` + amount |
| R3 | Restaurant — closed | Closed badge, InfoNote, disabled DishCards |
| F1 | Dish — options | HeroHeader (back · favourite · cart), name, price + old price, liked, description, OptionGroup (checkboxes), BottomBar Stepper + `Add to cart` amount |
| F2 | Dish — required | Required group with radios/checkboxes, Done badge, TextArea, disabled button naming what is missing |
| F3 | Dish — bottom | Special instructions, Frequently bought together rows with compact Stepper |
| C1 | Cart | InfoNote about split orders; one RestaurantGroupHeader per restaurant; CartItems; `Continue` + total |
| C2 | Checkout | Map preview + Deliver to, contact, payment InfoRows; one summary Card per order; `Place 2 orders` + total |
| O1 | My orders — in progress | Segmented `In progress · 3 / Completed · 1`; OrderCards with ProgressSteps |
| O2 | My orders — completed | CompletedOrderCard |
| P1 | Profile — top | Title, ProfileCard, ListGroups, language segment, notifications Toggle, TabBar |
| P2 | Profile — bottom | Help and legal, Log out, Danger zone, version |
| P3 | Account settings | 2-column names, email, focused phone field with helper, `Save changes` |

**3a Getting in and setting up**
| ID | Screen | Notes |
|---|---|---|
| A1 | Welcome | AuthHeader, `Welcome` / `Hungry? We got you.`, Email, Continue, "or", Continue with Google, terms |
| A2 | Log in — password | EmailChip, focused password with eye, Forgot password?, Log in |
| A3 | Sign up | Compact header, left heading, names, PhoneField, password, confirm + helper, BottomBar Create account |
| A4 | Forgot password | Email, Send code, Go back |
| A5 | Verification code | OtpInput mid-typing, countdown, disabled Continue |
| L1 | Address — drop the pin | Map, MapSearchPill, labelled pin, LocateButton, BottomSheet with address + `Deliver to this point` |
| L2 | Address — search | Scrim, typing pill, results list with matched letters bold |
| L3 | Address — type | Sheet with TypeTile grid, Continue |
| L4 | Address — details | Address card with Edit, Floor / Door, Additional information, Label chips, default Checkbox, Save address |
| N1 | Notifications | Grouped NotificationRows, `Mark all read` |
| V1 | Favourites | RestaurantRow + saved heart, TabBar |

**4a States** — S-H1 Home loading · S-H2 Home offline · S-H3 Search no results · S-R1 Restaurant loading · S-R2 Added to cart · S-R3 Add failed · S-A1 Logging in · S-A2 Wrong password · S-A3 Wrong code · S-A4 Password updated · S-L1 Locating · S-L2 Out of delivery zone · S-L3 Address saved · S-C1 Placing orders · S-C2 Restaurant closed at checkout · S-C3 Orders placed · S-O1 Orders loading · S-N1 No notifications · S-V1 No favourites · S-P1 Invalid phone · S-P2 Changes saved.

Screens without a tab bar show only the 34 home-indicator area. Keep the keyboard open on S1/S2 (`keyboardShouldPersistTaps="handled"`).

---

## 10. Copy
- English, sentence case everywhere except overlines. Buttons are verbs: `Add to cart`, `Place 2 orders`, `Save address`, `Try again`.
- Buttons that charge money show the amount on the right.
- Prices `19 DT`, `9,68 DT`; option surcharges `+1 DT`; discounts `-25%`; old price struck through.
- Times as ranges with an en dash: `25–40 min`. Ratings as liked %: `92%`, with count `(22)` where known.
- Counts with a middle dot: `Restaurants · 24`, `View cart · 2 items`, `In progress · 3`.
- Addresses `{label} · {area}` (`Home · Sahloul`, `Work · Sahloul`).
- Closed: `Closed · Opens at 10:00`. Order numbers `#01A6-0D27`. Dates `29 Sept 2026`.
- Errors say what happened and what to do: `Wrong password. Try again or reset it.`, `Enter an 8-digit Tunisian number.`
- Empty states: `No favourites yet` / `Tap the heart on a restaurant to save it here.`

---

## 11. Accessibility
- Contrast: `ink` and `inkMuted` on white pass AA; `inkSubtle` is for placeholders only. White on `ink` and `ink` on `primarySoft` pass AA. Never put white text on `primary`.
- Every icon-only button has an `accessibilityLabel` (`Back`, `Favourite`, `Go to cart`, `Clear search`).
- Disabled buttons expose `accessibilityState={{ disabled: true }}`; the label explains why when possible.
- Field errors are announced (`accessibilityLiveRegion="polite"` / `AccessibilityInfo.announceForAccessibility`). Toasts are announced.
- Respect Dynamic Type up to 1.3× without clipping: no fixed heights on text containers except buttons, inputs and chips.
- Respect Reduce Motion: skeleton pulse and spinner rotation fall back to static.

---

## 12. Assets
- `assets/icons/*.svg` — reference SVGs for every Lucide icon/colour used (use `lucide-react-native` in code).
- `assets/brand/logo-hungry.svg`, `assets/brand/food-pattern.svg` — auth header.
- Food photos, logos and the map image on the board are cropped from the current app's screenshots for demonstration. Load real images from the API (`resizeMode="cover"` for dishes and banners, `contain` for logos on white).

## 13. Integration checklist
- [ ] Fonts loaded (Montserrat ×5, JetBrains Mono 500) before first render.
- [ ] `ThemeProvider` at the root; no hex/size literals in components (lint for `#[0-9a-f]{6}`).
- [ ] `Icon` wrapper used for every icon; strokeWidth 2.
- [ ] Primitives from §6 built and shown in a Storybook / dev screen.
- [ ] Each screen in §9 implements loading, error, empty and success per §7.
- [ ] Hero buttons have no shadow; the cart button routes to the Cart tab.
- [ ] Orange is never used for a button or body text.
- [ ] Prices and counters use `tabular-nums`.
