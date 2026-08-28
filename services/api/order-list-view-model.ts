import type { OrderOutput, OrderStatus } from '@/schemas/order';
import { parseOrderComment } from './order-view-model';

/**
 * Adapts an order as the backend returns it to what the My Orders screens
 * render.
 *
 * Pure module, like `order-view-model.ts`: no React, no TanStack Query, no
 * network, no store import at all.
 *
 * The customer app is **read-only over orders**. Status is owned by the
 * restaurant, the delivery agent and the back-office; nothing here — and
 * nothing rendering it — offers a way to change one. `PUT /orders` does not
 * write anyway (it answers 200 with an empty body and persists nothing) and
 * `updateStatus` is exposed by no endpoint at all.
 *
 * What an order does NOT carry, and must therefore never appear on these
 * screens (plan §3.3, `docs/plans/checkout-order-creation-plan.md`):
 *
 *   - **any money.** `Order` and `OrderItem` have no price, fee, amount,
 *     subtotal or total column, and there is no pricing endpoint. A total on an
 *     order screen would be a number the app made up;
 *   - **a delivery ETA**, for the same reason the checkout screen dropped one;
 *   - **the addons and the per-line note** that were sent — the attribute
 *     populator never persists them and `comment` is per-order, not per-line.
 */

// --- The view type -------------------------------------------------------

export interface CustomerOrderLine {
  /** The order item's own id, or the product id when the item has none. */
  id: string;
  name: string;
  quantity: number;
  /** The product this line was placed for, when the response carries one. */
  productId?: string;
}

export interface CustomerOrder {
  id: string;
  /** "#9A7B-6C5D" — derived from the id, the value support can look up. */
  reference: string;
  restaurantId?: string;
  restaurantName: string;
  status: OrderStatus | null;
  /** The backend's `createdAt`: a LOCAL date-time with no offset (plan §3.7). */
  createdAt?: string;
  lines: CustomerOrderLine[];
  /**
   * True when the response carried no lines.
   *
   * This is NOT "the order is empty": the backend never sets the
   * `order_item.order_id` back-reference, so a perfectly good order re-reads
   * with `items: []` (plan §2.2). The screens say the detail is unavailable
   * rather than showing an order with nothing in it.
   */
  hasLineDetail: boolean;
  /** The payment method recorded in `comment` by this app, when there is one. */
  paymentLabel: string | null;
  /** Anything else the comment carried. */
  note: string | null;
}

/** Adapts one `OrderOutputData` for the screens. */
export function toCustomerOrder(order: OrderOutput): CustomerOrder {
  const { payment, note } = parseOrderComment(order.comment);

  const lines: CustomerOrderLine[] = (order.items ?? [])
    .map((item, index) => {
      const product = item.product;
      const name =
        item.name ?? product?.name ?? product?.productName ?? 'Item';
      return {
        // `OrderedProductOutputData.id` is the PRODUCT's id, not the ordered
        // product row's — so the item's own id is preferred as the key.
        id: item.id ?? product?.productId ?? `${order.id}-${index}`,
        name,
        quantity: item.quantity ?? 1,
        productId: product?.productId ?? product?.id ?? undefined,
      };
    });

  return {
    id: order.id,
    reference: orderReference(order.id),
    restaurantId: order.restaurantId ?? undefined,
    // `name` is the restaurant name this app sends on create, so it is the
    // sensible fallback when the association is not expanded in the response.
    restaurantName: order.restaurantName ?? order.name ?? 'Restaurant',
    status: order.status ?? null,
    createdAt: order.createdAt ?? undefined,
    lines,
    hasLineDetail: lines.length > 0,
    paymentLabel: payment,
    note,
  };
}

// --- Status --------------------------------------------------------------

/** What each backend status means to a customer, in full. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: 'Order placed',
  CONFIRMED: 'Confirmed by the restaurant',
  PREPARING: 'Preparing your food…',
  READY: 'Ready — on its way to you',
  CANCELLED: 'Cancelled',
};

/** The short form, for a chip. */
export const ORDER_STATUS_SHORT_LABELS: Record<OrderStatus, string> = {
  CREATED: 'Placed',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'On the way',
  CANCELLED: 'Cancelled',
};

/**
 * The label an order carries, unknown statuses included.
 *
 * A status the app cannot read renders as "Status unavailable" rather than
 * defaulting to a cheerful one: an order the backend will not describe must not
 * be presented as progressing.
 */
export function orderStatusLabel(
  status: OrderStatus | null,
  short = false
): string {
  if (!status) return short ? 'Unknown' : 'Status unavailable';
  return short ? ORDER_STATUS_SHORT_LABELS[status] : ORDER_STATUS_LABELS[status];
}

// --- Buckets -------------------------------------------------------------

export type OrderBucket = 'active' | 'completed';

/**
 * The statuses that mean the order is still running.
 *
 * `READY` is in this set deliberately. It is the LAST status the backend can
 * report — there is no `DELIVERED` or `COMPLETED` member and no endpoint moves
 * an order past it — so treating it as finished would tell a customer their
 * food has arrived while it is still with the driver. When the backend gains a
 * delivered status, removing it from this set is the whole change.
 */
export const IN_PROGRESS_STATUSES: OrderStatus[] = [
  'CREATED',
  'CONFIRMED',
  'PREPARING',
  'READY',
];

/**
 * Which tab an order belongs in, decided by the backend's status alone.
 *
 * An order whose status could not be read stays in progress: one that might
 * still be coming must not be filed away as finished.
 */
export function orderBucket(order: Pick<CustomerOrder, 'status'>): OrderBucket {
  if (!order.status) return 'active';
  return IN_PROGRESS_STATUSES.includes(order.status) ? 'active' : 'completed';
}

/** Splits a customer's orders into the two tabs in one pass. */
export function splitOrders(orders: CustomerOrder[]): {
  active: CustomerOrder[];
  completed: CustomerOrder[];
} {
  const active: CustomerOrder[] = [];
  const completed: CustomerOrder[] = [];
  for (const order of orders) {
    (orderBucket(order) === 'active' ? active : completed).push(order);
  }
  return { active, completed };
}

// --- Progress ------------------------------------------------------------

/** The stages the tracker shows, in the order the backend moves through them. */
export const ORDER_PROGRESS_STEPS = [
  'Placed',
  'Confirmed',
  'Preparing',
  'On the way',
] as const;

export const ORDER_STEP_COUNT = ORDER_PROGRESS_STEPS.length;

/**
 * How many stages are done, 0–4, straight from the backend status.
 *
 * The four stages are exactly the four statuses the backend reports on the way
 * through — nothing is inferred from elapsed time, and there is no stage the
 * app advances on its own. A cancelled order has no progress and returns 0.
 */
export function orderProgressStep(order: Pick<CustomerOrder, 'status'>): number {
  switch (order.status) {
    case 'CANCELLED':
      return 0;
    case 'READY':
      return 4;
    case 'PREPARING':
      return 3;
    case 'CONFIRMED':
      return 2;
    case 'CREATED':
      return 1;
    default:
      // Unknown status: it was placed, and that much is certain.
      return 1;
  }
}

// --- Identity and formatting --------------------------------------------

/**
 * The human-facing reference, derived from the order id.
 *
 * The id is the only value both the customer and support can look the order up
 * by: `code` is client-minted and the `codes` filter is silently ignored
 * (plan §3.5), so nothing can be found by it.
 */
export function orderReference(id: string): string {
  const head = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `#${head.slice(0, 4)}-${head.slice(4)}`;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

/**
 * Parses the backend's `createdAt`.
 *
 * It is an ISO-8601 LOCAL date-time with NO offset, so it is read as local wall
 * time — which is what `new Date('2026-08-28T18:00:00')` already does. It must
 * never be compared against a UTC instant (plan §3.7); these helpers only
 * format and order it for display.
 */
function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Oct 12, 2025", or an em dash when the server sent nothing readable. */
export function formatOrderDate(value: string | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString(undefined, DATE_FORMAT) : '—';
}

/** "Oct 12, 2025 at 8:45 PM". */
export function formatOrderDateTime(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const day = date.toLocaleDateString(undefined, DATE_FORMAT);
  const time = date.toLocaleTimeString(undefined, TIME_FORMAT);
  return `${day} at ${time}`;
}

/** Total units across an order's lines. */
export function orderItemCount(order: Pick<CustomerOrder, 'lines'>): number {
  return order.lines.reduce((total, line) => total + line.quantity, 0);
}

/**
 * Newest first, by `createdAt`.
 *
 * String comparison is correct here and cheaper than parsing: every value comes
 * from the same server clock in the same offset-less format, so lexical order
 * IS chronological order. An order with no `createdAt` sorts last rather than
 * disappearing.
 */
export function sortByNewest(orders: CustomerOrder[]): CustomerOrder[] {
  return [...orders].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}
