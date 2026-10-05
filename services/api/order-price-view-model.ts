import type { OrderPriceLine, OrderPriceSnapshot } from '@/store/order-price-store';
import type { CustomerOrderLine, OrderCharges } from './order-list-view-model';

/**
 * What a placed order cost, from the best source that can answer.
 *
 * Pure module: no React, no network, and every store import is `import type`.
 *
 *   `server`   — the order's own price block from the backend: line prices,
 *                and the delivery/service/additional fees it was PLACED with
 *                (its adjustments, computed from the fee rules at checkout).
 *                Every order placed through `POST /checkout` has this.
 *   `checkout` — the receipt this device captured when it placed an order
 *                BEFORE checkout moved to the backend
 *                (`store/order-price-store.ts`). Those orders carry no fees
 *                on the server, so the receipt is the only record of them.
 *   `menu`     — line prices without any fees: the backend's line prices for
 *                a legacy order with no receipt, or today's catalogue prices
 *                when even those are missing. Prices carry no history, so a
 *                dish repriced since shows its new price. Screens label it.
 *
 * `none` is the honest last answer, and it is a real state, not an error.
 */

/** What one line cost, in major units. `null` means unknown, never free. */
export interface OrderLinePrice {
  unit: number | null;
  /** `unit × quantity`, or `null` when the unit price is unknown. */
  total: number | null;
}

/** The full price block of an order, fees included. */
export interface OrderTotals {
  subtotal: number;
  discount: number;
  serviceFee: number;
  /** 0 when delivery was free. */
  deliveryFee: number;
  /** Night, weather… surcharges together. */
  additionalFees: number;
  total: number;
}

export type OrderPriceSource = 'server' | 'checkout' | 'menu' | 'none';

export interface OrderPricing {
  source: OrderPriceSource;
  /** Keyed by `CustomerOrderLine.id`. A line with no price is absent. */
  byLine: Map<string, OrderLinePrice>;
  /** The full price block — only from `server` or a `checkout` receipt. */
  totals: OrderTotals | null;
  /**
   * The items total of a `menu` pricing — present ONLY when every line
   * resolved. A partial sum presented as a total would understate the order.
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
  /** The order's price block from the backend, when the response carries one. */
  charges?: OrderCharges | null;
  /** This device's legacy receipt for the order, when it placed it. */
  snapshot?: OrderPriceSnapshot | null;
  /** Today's unit price per product id, for the last fallback. `null` = unresolved. */
  menuUnitPrices?: Map<string, number | null>;
}

/** The lines priced by the backend itself. */
function serverLinePrices(lines: CustomerOrderLine[]): Map<string, OrderLinePrice> {
  const byLine = new Map<string, OrderLinePrice>();
  for (const line of lines) {
    if (line.unitPrice == null) continue;
    byLine.set(line.id, {
      unit: line.unitPrice,
      total: line.total ?? line.unitPrice * line.quantity,
    });
  }
  return byLine;
}

/**
 * Matches a returned line to the receipt line it was created from.
 *
 * By `code` first, which on a legacy order IS the cart line id the app sent as
 * the item's code — an exact identity. Only then by product, because the same
 * dish ordered twice with different addons is two lines that share a product
 * id. Each receipt line is consumed once.
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

function fromSnapshot(lines: CustomerOrderLine[], snapshot: OrderPriceSnapshot): OrderPricing {
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
      discount: 0,
      serviceFee: snapshot.serviceFee,
      deliveryFee: snapshot.deliveryFee,
      additionalFees: 0,
      total: snapshot.total,
    },
    itemsTotal: null,
  };
}

/**
 * Prices an order from the best source available.
 *
 * A backend price block with fee lines wins outright. A legacy receipt wins
 * next, WHOLE: its totals are shown even when the server returned no lines at
 * all (plan §2.2), because "you paid 24.68 DT" is still true and useful.
 * Quantities always come from the SERVER's line — the order is the record of
 * what was placed.
 */
export function priceOrder({
  lines,
  charges,
  snapshot,
  menuUnitPrices,
}: PriceOrderArgs): OrderPricing {
  if (charges?.itemized) {
    return {
      source: 'server',
      byLine: serverLinePrices(lines),
      totals: {
        subtotal: charges.subtotal,
        discount: charges.discount,
        serviceFee: charges.serviceFee,
        deliveryFee: charges.deliveryFee,
        additionalFees: charges.additionalFees,
        total: charges.total,
      },
      itemsTotal: null,
    };
  }

  if (snapshot) return fromSnapshot(lines, snapshot);

  // A legacy order with no receipt: the backend prices its lines, but has no
  // fees for it — so these are item prices, not what was paid.
  const server = serverLinePrices(lines);
  if (server.size > 0) {
    return {
      source: 'menu',
      byLine: server,
      totals: null,
      itemsTotal: server.size === lines.length && charges ? charges.subtotal : null,
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
