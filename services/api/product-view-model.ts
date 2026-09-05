import type { AddonGroupData, AddonOption } from '@/components/food';
import type { AttributeGroup, Category, Currency, Price } from '@/schemas/product';
import type { MenuProductOutput } from './product-service';

/**
 * Adapts the product DTOs to what the menu and food-detail screens render.
 *
 * Pure module: no React, no TanStack Query, no imports from `hooks/`, so the
 * price selection below can be unit-tested without a renderer. The one
 * component import is `import type` only and is erased at compile time — the
 * UI owns the addon shape, and re-declaring it here would let the two drift.
 */

// --- Prices ----------------------------------------------------------------

export interface AppliedPrice {
  /** The amount actually charged, in major units. */
  amount: number;
  /** `amount` rendered with the price's own currency, e.g. "9.68 DT". */
  formatted: string;
  /** A strictly higher applicable price, for a struck-through comparison. */
  original?: string;
  /** e.g. "-25%". Absent when there is nothing to compare against. */
  discountLabel?: string;
  /**
   * The currency `formatted` was rendered with.
   *
   * Carried because a running total (base + addons × quantity) has to be
   * formatted in the SAME currency as the price it was derived from, and
   * nothing else in the payload identifies which of a product's prices won.
   */
  currency?: Currency | null;
}

/** Decimal places to assume when the currency does not say. */
const DEFAULT_DECIMAL_PLACES = 2;

function decimalPlacesOf(currency: Currency | null | undefined): number {
  const places = currency?.decimalPlaces;
  if (typeof places !== 'number' || !Number.isFinite(places)) {
    return DEFAULT_DECIMAL_PLACES;
  }
  // Guard the exponent: `toFixed` throws above 100 places, and a huge power of
  // ten would push the minor-unit comparison below into Infinity.
  return Math.min(Math.max(Math.trunc(places), 0), 10);
}

/**
 * Renders an amount against its currency.
 *
 * `PREFIX` puts the symbol first ("DT 9.68"), `SUFFIX` last ("9.68 DT"). A
 * missing currency formats the bare number rather than crashing or assuming a
 * symbol — the mock data this replaced hardcoded "DT", and real data must not.
 */
export function formatAmount(amount: number, currency: Currency | null | undefined): string {
  const rendered = amount.toFixed(decimalPlacesOf(currency));

  const symbol = currency?.symbol?.trim();
  if (!symbol) return rendered;

  return currency?.displayFormat === 'PREFIX'
    ? `${symbol} ${rendered}`
    : `${rendered} ${symbol}`;
}

/**
 * `amount` as an integer count of the currency's smallest unit.
 *
 * Money arrives as a JSON number, so two prices that should be equal can
 * differ by a float epsilon. The comparison that decides whether a discount
 * badge appears runs on these integers, never on the raw doubles.
 */
function minorUnits(amount: number, currency: Currency | null | undefined): number {
  return Math.round(amount * 10 ** decimalPlacesOf(currency));
}

/**
 * Whether `price` is in force at `now`.
 *
 * No restriction means always. Either bound may be null, meaning open-ended in
 * that direction. A bound that is present but unparseable makes the price NOT
 * apply: the window cannot be evaluated, and silently treating a garbled date
 * as open-ended could put an expired promotion back on sale.
 */
function applies(price: Price, now: Date): boolean {
  if (typeof price.amount !== 'number' || !Number.isFinite(price.amount)) return false;

  const restriction = price.restriction;
  if (!restriction) return true;

  const at = now.getTime();

  if (restriction.effectiveFrom != null) {
    const from = Date.parse(restriction.effectiveFrom);
    if (Number.isNaN(from) || at < from) return false;
  }

  if (restriction.effectiveTo != null) {
    const to = Date.parse(restriction.effectiveTo);
    if (Number.isNaN(to) || at > to) return false;
  }

  // Both bounds are inclusive: a promotion that runs "to" a given instant is
  // still valid at that instant.
  return true;
}

/**
 * The price a customer pays right now, or `null` when none applies.
 *
 * `prices` is a list, not a scalar — several can be in force at once (a base
 * price and a promotion, say). The **lowest applicable amount wins**, which is
 * both the customer-friendly choice and a deterministic one; the highest
 * applicable amount becomes `original` so the card can strike it through.
 *
 * `null` means unorderable, NOT free. There is deliberately no `0` fallback: a
 * product whose promotion has expired and whose base price was never set must
 * not become orderable at no charge.
 *
 * `now` is injected rather than read inside so the windows are testable.
 */
export function selectPrice(prices: Price[], now: Date): AppliedPrice | null {
  const applicable = prices.filter((price) => applies(price, now));
  if (applicable.length === 0) return null;

  // `applies` has already rejected every non-numeric amount, so the assertions
  // below are narrowing what the filter guarantees rather than assuming it.
  let lowest = applicable[0];
  let highest = applicable[0];
  for (const price of applicable) {
    if (price.amount! < lowest.amount!) lowest = price;
    if (price.amount! > highest.amount!) highest = price;
  }

  const amount = lowest.amount!;
  const result: AppliedPrice = {
    amount,
    formatted: formatAmount(amount, lowest.currency),
    currency: lowest.currency,
  };

  // Equal amounts must not produce a badge, so the comparison runs on integer
  // minor units rather than on the doubles themselves.
  const lowestMinor = minorUnits(amount, lowest.currency);
  const highestMinor = minorUnits(highest.amount!, highest.currency);
  if (highestMinor > lowestMinor) {
    result.original = formatAmount(highest.amount!, highest.currency);

    const percentOff = Math.round(((highestMinor - lowestMinor) / highestMinor) * 100);
    // A difference too small to round to a whole percent still gets the
    // struck-through comparison, but "-0%" would read as a bug.
    if (percentOff > 0) result.discountLabel = `-${percentOff}%`;
  }

  return result;
}

// --- Addons ----------------------------------------------------------------

/**
 * Addon fields the UI wants that NO backend field currently supplies.
 *
 * `type` is no longer among them: `AttributeGroup.selectionType` says whether a
 * group is single- or multi-select, and {@link addonGroupType} maps it. What is
 * still missing is a CAP on a multi-select group — nothing anywhere says "pick
 * up to three" — and any notion of a popular option.
 */
export const UNBACKED_ADDON_FIELDS = ['maxSelect', 'isPopular'] as const;

/**
 * How a group is rendered and how selecting inside it behaves.
 *
 * `SINGLE` is a radio group: one option at a time, a new pick replacing the
 * last. Everything else is a checkbox group.
 *
 * **An unspecified `selectionType` renders as a checkbox**, which is the
 * deliberate direction to be wrong in. The back-office writes the field on
 * every group it creates, so `null` here does not mean "the restaurant did not
 * choose" — it means the value did not reach us at all (a projection that
 * omits it, a member this app does not know). Reading that silence as SINGLE
 * would cap every topping group in the app at one choice; reading it as
 * MULTIPLE keeps the group behaving as it did before the field existed, and the
 * cost is a group that permits a second choice it should not.
 */
export function addonGroupType(group: AttributeGroup): 'checkbox' | 'radio' {
  return group.selectionType === 'SINGLE' ? 'radio' : 'checkbox';
}

/**
 * A configurable product's attribute groups become the addon groups the food
 * screen renders, each carrying whether it is a single- or multi-select group
 * (see {@link addonGroupType}).
 *
 * Takes the GROUPS rather than the product: no product payload carries them
 * (see `attributeGroupSchema`), so they are assembled by
 * `fetchProductConfiguration` and arrive on their own. Passing the product
 * here would mean passing one whose `configuration.attributes` is always
 * empty.
 *
 * A group or option with no id is dropped: the screen keys selections by id,
 * and an option that cannot be identified cannot be selected or priced.
 */
export function toAddonGroups(groups: AttributeGroup[], now: Date): AddonGroupData[] {
  return groups
    .filter((group) => !!group.id)
    .map((group) => {
      const options: AddonOption[] = group.attributes
        .filter((attribute) => !!attribute.id)
        .map((attribute) => {
          const option: AddonOption = {
            id: attribute.id!,
            name: attribute.name ?? '',
          };
          // An addon whose prices are all restricted out renders with no
          // surcharge rather than disappearing — it is still selectable.
          const price = selectPrice(attribute.prices, now);
          if (price) option.price = `+${price.formatted}`;
          return option;
        });

      return {
        id: group.id!,
        title: group.name ?? '',
        subtitle: group.description ?? undefined,
        type: addonGroupType(group),
        // See UNBACKED_ADDON_FIELDS: `maxSelect` and `isPopular` have no
        // backend source and stay undefined.
        required: group.required === true,
        options,
      };
    });
}

/**
 * Every addon option's surcharge, keyed by option id, as a NUMBER.
 *
 * The running total on the food screen is built from this rather than from the
 * `"+2.00 DT"` strings `toAddonGroups` produces: re-parsing a formatted price
 * back into a number means guessing the decimal separator and the symbol
 * position, and it silently rounds. An option with no applicable price is
 * absent from the map, not zero — the caller reads a missing key as "no
 * surcharge", which is what an unpriced addon means.
 */
export function addonAmounts(groups: AttributeGroup[], now: Date): Map<string, number> {
  const amounts = new Map<string, number>();

  for (const group of groups) {
    for (const attribute of group.attributes) {
      if (!attribute.id) continue;
      const price = selectPrice(attribute.prices, now);
      if (price) amounts.set(attribute.id, price.amount);
    }
  }

  return amounts;
}

/**
 * The selection a group holds after the customer taps one of its options.
 *
 * Pure, and the single place the single/multi rule lives — the food screen
 * applies it, and it is unit-tested here rather than through a rendered sheet.
 *
 *   MULTIPLE  toggles: tapping an unselected option adds it, tapping a
 *             selected one removes it.
 *   SINGLE    replaces: tapping an option makes it the only selection.
 *
 * The one subtlety is tapping the option a SINGLE group already holds. In a
 * REQUIRED group that is a no-op — an answer is owed, and clearing it could
 * only put the customer back in front of the validation error they just
 * cleared. In an OPTIONAL group it clears the selection, because there is
 * otherwise no way back to "no thanks" once an option (and its surcharge) has
 * been picked.
 *
 * Returns the array unchanged when nothing changes, so a caller storing it in
 * state does not re-render for a no-op tap.
 */
export function toggleAddonSelection(
  group: Pick<AddonGroupData, 'type' | 'required'>,
  selectedIds: string[],
  optionId: string
): string[] {
  const isSelected = selectedIds.includes(optionId);

  if (group.type === 'radio') {
    if (!isSelected) return [optionId];
    return group.required ? selectedIds : [];
  }

  return isSelected
    ? selectedIds.filter((each) => each !== optionId)
    : [...selectedIds, optionId];
}

// --- Menu sections ---------------------------------------------------------

/** One product as the menu grid renders it. */
export interface MenuProduct {
  id: string;
  name: string;
  description?: string;
  /**
   * `null` when nothing applies right now — the card then shows no price and
   * no add-to-cart affordance. See {@link selectPrice}.
   */
  price: AppliedPrice | null;
  /**
   * Whether ordering this dish means answering something first, i.e. whether
   * the customer must go through the food screen rather than adding it
   * straight to the cart.
   *
   * This is the SUBTYPE (`product_type` 2) and nothing more. Whether the dish
   * actually has groups to show cannot be answered from a menu payload — no
   * list endpoint projects them, and finding out costs a request per dish,
   * which is exactly the N+1 a menu grid must not do. Reading the
   * discriminator is also the answer that stays right: a configurable dish
   * with no groups yet is a dish whose groups have not been ENTERED, not a
   * dish that is really standard, and it must not become one-tap orderable the
   * moment its configuration is incomplete.
   */
  requiresConfiguration: boolean;
}

export interface MenuSectionData {
  /** The category name; "" for the trailing group of uncategorised products. */
  title: string;
  products: MenuProduct[];
}

export function toMenuProduct(product: MenuProductOutput, now: Date): MenuProduct {
  return {
    id: product.id,
    name: product.name ?? '',
    description: product.description ?? undefined,
    price: selectPrice(product.prices, now),
    requiresConfiguration: product.isConfigurable,
  };
}

/** A category is shown unless it is explicitly switched off. */
function isDisplayable(category: Category): boolean {
  return category.active !== false && category.visible !== false;
}

/**
 * Groups products into the menu's sections.
 *
 * `subcategories` is serialized from a Java collection, so neither its order
 * nor the order of the products themselves is guaranteed between fetches.
 * Section titles AND the products inside them are therefore sorted, so the
 * menu does not reshuffle under the user on a refetch — there is no
 * backend-intended ordering being discarded, only an arbitrary one. A product
 * listed under two visible categories appears in both, which is what a menu
 * section means.
 *
 * Products with no displayable category collect into a single untitled group
 * placed last, so a miscategorised dish is still orderable rather than
 * invisible. Standard and configurable dishes sit side by side in a section —
 * the subtype changes how a dish is ordered, not where it belongs on the menu.
 *
 * `sectionIds`, when given, is the menu's OWN sections (`MenuScope.sections`),
 * and any other category a product names is ignored. Dishes are fetched one
 * section at a time, so a product's `subcategories` is normally exactly the
 * sections it was fetched under — but the categories live in a catalog shared
 * by every restaurant, and a dish filed into a foreign one must not open a
 * section on this restaurant's menu. Omitting it groups by whatever the
 * products name, which is what the unit tests do.
 *
 * `now` is threaded through for price selection, for the same testability
 * reason as {@link selectPrice}.
 */
export function groupBySection(
  products: MenuProductOutput[],
  now: Date,
  sectionIds?: readonly string[]
): MenuSectionData[] {
  const sections = new Map<string, MenuSectionData>();
  const uncategorised: MenuProduct[] = [];
  const menuSections = sectionIds ? new Set(sectionIds) : null;

  for (const product of products) {
    const menuProduct = toMenuProduct(product, now);

    const categories = product.subcategories.filter(
      (category) =>
        isDisplayable(category) &&
        (category.id ?? category.name) &&
        // A category with no id cannot be one of the menu's sections, so it is
        // only groupable when the caller did not name them.
        (!menuSections || (!!category.id && menuSections.has(category.id)))
    );

    if (categories.length === 0) {
      uncategorised.push(menuProduct);
      continue;
    }

    for (const category of categories) {
      const key = category.id ?? category.name!;
      let section = sections.get(key);
      if (!section) {
        section = { title: category.name ?? '', products: [] };
        sections.set(key, section);
      }
      section.products.push(menuProduct);
    }
  }

  const byName = (a: MenuProduct, b: MenuProduct) =>
    a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

  // Two distinct categories can share a name, so the key breaks the tie — an
  // input-order tiebreak would reintroduce exactly the instability being
  // sorted away.
  const ordered = Array.from(sections.entries())
    .sort(([keyA, a], [keyB, b]) => a.title.localeCompare(b.title) || keyA.localeCompare(keyB))
    .map(([, section]) => section);
  for (const section of ordered) section.products.sort(byName);

  if (uncategorised.length > 0) {
    ordered.push({ title: '', products: uncategorised.sort(byName) });
  }

  return ordered;
}
