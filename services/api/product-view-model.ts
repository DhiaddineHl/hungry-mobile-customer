import type { AddonGroupData, AddonOption } from '@/components/food';
import type {
  Category,
  ConfigurableProductOutput,
  Currency,
  Price,
  ProductOutput,
} from '@/schemas/product';

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
 * `type` in particular: `AttributeGroup` carries `required`, but nothing that
 * says whether the group is single- or multi-select, so a radio group is
 * indistinguishable from a checkbox group today. Guessing from the group name
 * would be wrong more often than right, so every group renders as a checkbox
 * until the backend models the distinction.
 */
export const UNBACKED_ADDON_FIELDS = ['type', 'maxSelect', 'isPopular'] as const;

/**
 * `ProductConfiguration.attributes` becomes the addon groups the food screen
 * renders.
 *
 * A group or option with no id is dropped: the screen keys selections by id,
 * and an option that cannot be identified cannot be selected or priced.
 */
export function toAddonGroups(
  product: ConfigurableProductOutput,
  now: Date
): AddonGroupData[] {
  const groups = product.configuration?.attributes ?? [];

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
        // See UNBACKED_ADDON_FIELDS: `type` has no backend source, and
        // `maxSelect` / `isPopular` stay undefined for the same reason.
        type: 'checkbox' as const,
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
export function addonAmounts(
  product: ConfigurableProductOutput,
  now: Date
): Map<string, number> {
  const amounts = new Map<string, number>();

  for (const group of product.configuration?.attributes ?? []) {
    for (const attribute of group.attributes) {
      if (!attribute.id) continue;
      const price = selectPrice(attribute.prices, now);
      if (price) amounts.set(attribute.id, price.amount);
    }
  }

  return amounts;
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
}

export interface MenuSectionData {
  /** The category name; "" for the trailing group of uncategorised products. */
  title: string;
  products: MenuProduct[];
}

export function toMenuProduct(product: ProductOutput, now: Date): MenuProduct {
  return {
    id: product.id,
    name: product.name ?? '',
    description: product.description ?? undefined,
    price: selectPrice(product.prices, now),
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
 * invisible.
 *
 * `now` is threaded through for price selection, for the same testability
 * reason as {@link selectPrice}.
 */
export function groupBySection(products: ProductOutput[], now: Date): MenuSectionData[] {
  const sections = new Map<string, MenuSectionData>();
  const uncategorised: MenuProduct[] = [];

  for (const product of products) {
    const menuProduct = toMenuProduct(product, now);

    const categories = product.subcategories.filter(
      (category) => isDisplayable(category) && (category.id ?? category.name)
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
