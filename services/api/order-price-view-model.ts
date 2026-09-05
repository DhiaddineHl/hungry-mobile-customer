import type { OrderPriceLine, OrderPriceSnapshot } from '@/store/order-price-store';
import type { CustomerOrderLine } from './order-list-view-model';
import type { OrderTotals } from './order-view-model';

/**
 * What a placed order cost, assembled from the only two sources that can
 * answer.
 *
 * Pure module: no React, no network, and every store import is `import type`.
 *
 * ## Why this is not simply read off the order
 *
 * The backend keeps NO prices. `Order` and `OrderItem` have no price, fee or
 * total column (plan §3.3), so `GET /orders/{id}` can say a customer ordered
 * two of something and never what they paid. Two sources are left, and they do
 * not mean the same thing:
 *
 *   `checkout` — the receipt this device captured when it placed the order
 *                (`store/order-price-store.ts`). These are the numbers the
 *                customer actually agreed to, fees included.
 *   `menu`     — today's menu price of each product, looked up from the
 *                catalogue. NOT what was paid: prices carry no history, so a
 *                dish repriced since is shown at its new price. Screens must
 *                label it as a menu price.
 *
 * `none` is the honest third answer — an order placed on another device whose
 * products no longer resolve — and it is a real state, not an error.
 */

/** What one line cost, in major units. `null` means unknown, never free. */
export interface OrderLinePrice {
  unit: number | null;
  /** `unit × quantity`, or `null` when the unit price is unknown. */
  total: number | null;
}

export type OrderPriceSource = 'checkout' | 'menu' | 'none';

export interface OrderPricing {
  source: OrderPriceSource;
  /** Keyed by `CustomerOrderLine.id`. A line with no price is absent. */
  byLine: Map<string, OrderLinePrice>;
  /**
   * The full price block, fees included. Only ever from a `checkout` receipt:
   * menu prices cannot produce a total, because the fees of a past order were
   * never recorded anywhere.
   */
  totals: OrderTotals | null;
  /**
   * The items total from menu prices — present ONLY when every line resolved.
   * A partial sum presented as a total would understate the order.
   */
  itemsTotal: number | null;
}

const EMPTY: OrderPricing = {
  source: 'none',
  byLine: new Map(),
  totals: null,
  itemsTotal: null,
};

export interface PriceOrderArgs {
  /** The lines as the server returned them — the authority on WHAT was ordered. */
  lines: CustomerOrderLine[];
  /** This device's receipt for the order, when it placed it. */
  snapshot?: OrderPriceSnapshot | null;
  /** Today's unit price per product id, for the fallback. `null` = unresolved. */
  menuUnitPrices?: Map<string, number | null>;
}

/**
 * Matches a returned line to the receipt line it was created from.
 *
 * By `code` first, which IS the cart line id this app sent as the item's code
 * (`toOrderInput`) — an exact identity. Only then by product, because the same
 * dish ordered twice with different addons is two lines that share a product
 * id, and matching those by product alone would price one of them with the
 * other's addons. Each receipt line is consumed once, so two same-product lines
 * take one each rather than both taking the first.
 */
function matchLine(
  line: CustomerOrderLine,
  remaining: OrderPriceLine[]
): OrderPriceLine | null {
  const byCode = line.code
    ? remaining.findIndex((candidate) => candidate.lineId === line.code)
    : -1;

  const index =
    byCode >= 0
      ? byCode
      : line.productId
        ? remaining.findIndex((candidate) => candidate.foodId === line.productId)
        : -1;

  if (index < 0) return null;
  return remaining.splice(index, 1)[0];
}

/**
 * Prices an order from the best source available.
 *
 * A receipt wins whenever there is one, and it wins WHOLE: its totals are shown
 * even when the server returned no lines at all (the plan §2.2 defect, where a
 * perfectly good order re-reads with `items: []`), because "you paid 24.68 DT"
 * is still true and still useful when the item list is missing.
 *
 * Quantities come from the SERVER's line, not the receipt's: the order is the
 * record of what was placed. The receipt only supplies the price per unit.
 */
export function priceOrder({
  lines,
  snapshot,
  menuUnitPrices,
}: PriceOrderArgs): OrderPricing {
  if (snapshot) {
    const remaining = [...snapshot.lines];
    const byLine = new Map<string, OrderLinePrice>();

    for (const line of lines) {
      const matched = matchLine(line, remaining);
      if (!matched) continue;
      byLine.set(line.id, {
        unit: matched.unitPrice,
        total: matched.unitPrice * line.quantity,
      });
    }

    return {
      source: 'checkout',
      byLine,
      totals: {
        subtotal: snapshot.subtotal,
        serviceFee: snapshot.serviceFee,
        deliveryFee: snapshot.deliveryFee,
        total: snapshot.total,
      },
      itemsTotal: null,
    };
  }

  if (!menuUnitPrices || menuUnitPrices.size === 0 || lines.length === 0) {
    return EMPTY;
  }

  const byLine = new Map<string, OrderLinePrice>();
  let resolvedAll = true;
  let itemsTotal = 0;

  for (const line of lines) {
    const unit = line.productId ? (menuUnitPrices.get(line.productId) ?? null) : null;
    if (unit === null) {
      resolvedAll = false;
      continue;
    }
    const total = unit * line.quantity;
    byLine.set(line.id, { unit, total });
    itemsTotal += total;
  }

  if (byLine.size === 0) return EMPTY;

  return {
    source: 'menu',
    byLine,
    totals: null,
    // Only a total that covers every line is a total.
    itemsTotal: resolvedAll ? itemsTotal : null,
  };
}
