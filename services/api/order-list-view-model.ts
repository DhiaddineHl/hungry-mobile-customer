import {
  DELIVERED_STATUSES,
  UNDELIVERED_STATUSES,
  type DeliveryStatus,
} from '@/schemas/delivery';
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
 * What an order does NOT carry (plan §3.3,
 * `docs/plans/checkout-order-creation-plan.md`):
 *
 *   - **any money.** `Order` and `OrderItem` have no price, fee, amount,
 *     subtotal or total column, and there is no pricing endpoint. Nothing in
 *     THIS module invents one. Prices reach the order screens from two sources
 *     that know their own provenance — the receipt this device captured at
 *     checkout, and today's menu prices, labelled as such — assembled by
 *     `services/api/order-price-view-model.ts`;
 *   - **a delivery ETA**, for the same reason the checkout screen dropped one;
 *   - **the addons and the per-line note** that were sent — the attribute
 *     populator never persists them and `comment` is per-order, not per-line.
 */

// --- The view type -------------------------------------------------------

export interface CustomerOrderLine {
  /** The order item's own id, or the product id when the item has none. */
  id: string;
  /**
   * The item's `code`, which is the cart line id this app sent on create
   * (`toOrderInput`). Carried because it is the only EXACT handle back to the
   * line's price: the same dish ordered twice with different addons shares a
   * product id but not a code — see `priceOrder`.
   */
  code?: string;
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
  /**
   * The status of the delivery attached to this order, read separately from
   * `GET /orders/{id}/delivery` and folded in with `withDeliveryStatus`.
   *
   *   - `undefined` — not read (yet): nothing is known about the delivery;
   *   - `null` — read, and there is none (no driver has accepted yet), or the
   *     backend sent a member this app does not know.
   *
   * It matters most for `FINISHED`, which the backend sets at PICKUP: only the
   * delivery says whether the food has arrived since.
   */
  deliveryStatus?: DeliveryStatus | null;
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
        code: item.code ?? undefined,
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

// --- Delivery ------------------------------------------------------------

/** Folds a delivery read into an order. `undefined` keeps it unread. */
export function withDeliveryStatus(
  order: CustomerOrder,
  deliveryStatus: DeliveryStatus | null | undefined
): CustomerOrder {
  if (deliveryStatus === undefined || deliveryStatus === order.deliveryStatus) {
    return order;
  }
  return { ...order, deliveryStatus };
}

/**
 * How long after it was placed a `FINISHED` order is still worth asking about
 * its delivery.
 *
 * `FINISHED` arrives at pickup, so a recent one may still be on its way — but
 * an old one cannot be, and reading the delivery of every order in a
 * customer's history on each launch would cost a request per order. Wide on
 * purpose: `createdAt` is the SERVER's local time with no offset (plan §3.7),
 * so against this device's clock it can be off by a timezone difference.
 */
export const FINISHED_TRACKING_WINDOW_MS = 48 * 60 * 60 * 1000;

function isRecent(createdAt: string | undefined, now: number): boolean {
  if (!createdAt) return false;
  const placed = new Date(createdAt).getTime();
  if (Number.isNaN(placed)) return false;
  return now - placed < FINISHED_TRACKING_WINDOW_MS;
}

/**
 * Whether the delivery of this order has to be read to know where it stands.
 *
 * From `PREPARING` (dispatch starts there, so a driver can be matched before
 * the food is ready) until the food has arrived. A `FINISHED` order only
 * while recent — see `FINISHED_TRACKING_WINDOW_MS`.
 */
export function needsDeliveryRead(
  order: Pick<CustomerOrder, 'status' | 'createdAt'>,
  now: number = Date.now()
): boolean {
  switch (order.status) {
    case 'PREPARING':
    case 'READY':
      return true;
    case 'FINISHED':
      return isRecent(order.createdAt, now);
    default:
      return false;
  }
}

// --- Stage ---------------------------------------------------------------

/**
 * Where an order stands for the customer — the order status and the delivery
 * status read together.
 *
 * Neither is enough alone: the backend closes the ORDER (`FINISHED`) when the
 * driver picks the food up, and only the DELIVERY moves on to `DELIVERED`.
 *
 *   - `READY`           — cooked, waiting for the driver to pick it up;
 *   - `ON_THE_WAY`      — the driver has it (delivery `PICKED_UP`);
 *   - `DELIVERED`       — the driver confirmed the drop-off (delivery
 *                         `DELIVERED`/`FINISHED`);
 *   - `DELIVERY_FAILED` — picked up, then returned or failed;
 *   - `COMPLETED`       — `FINISHED` long ago and the delivery not read:
 *                         closed, but this app will not claim it was delivered;
 *   - `UNKNOWN`         — a status the app cannot read.
 */
export type OrderStage =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'ON_THE_WAY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'UNKNOWN';

type StagedOrder = Pick<CustomerOrder, 'status' | 'deliveryStatus' | 'createdAt'>;

export function orderStage(order: StagedOrder, now: number = Date.now()): OrderStage {
  const { status, deliveryStatus } = order;

  if (!status) return 'UNKNOWN';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'REJECTED') return 'REJECTED';

  if (deliveryStatus && DELIVERED_STATUSES.includes(deliveryStatus)) {
    return 'DELIVERED';
  }

  if (status === 'FINISHED') {
    // FINISHED is written at pickup, so the driver has had the food.
    if (deliveryStatus && UNDELIVERED_STATUSES.includes(deliveryStatus)) {
      return 'DELIVERY_FAILED';
    }
    if (deliveryStatus) return 'ON_THE_WAY';
    // Not read yet while recent: still on its way as far as anyone knows.
    // Otherwise (old, or no delivery at all) closed, without a claim.
    return deliveryStatus === undefined && isRecent(order.createdAt, now)
      ? 'ON_THE_WAY'
      : 'COMPLETED';
  }

  // The two statuses are separate requests, so the delivery can be seen
  // picked up while the order still reads READY.
  if (deliveryStatus === 'PICKED_UP') return 'ON_THE_WAY';

  switch (status) {
    case 'CREATED':
      return 'PLACED';
    case 'CONFIRMED':
      return 'CONFIRMED';
    case 'PREPARING':
      return 'PREPARING';
    case 'READY':
      return 'READY';
    default:
      return 'UNKNOWN';
  }
}

// --- Status --------------------------------------------------------------

/** What each stage means to a customer, in full. */
export const ORDER_STAGE_LABELS: Record<OrderStage, string> = {
  PLACED: 'Order placed',
  CONFIRMED: 'Confirmed by the restaurant',
  PREPARING: 'Preparing your food…',
  READY: 'Ready — waiting for the driver',
  ON_THE_WAY: 'Your driver is on the way',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'The delivery couldn’t be completed',
  COMPLETED: 'Completed',
  REJECTED: 'Declined by the restaurant',
  CANCELLED: 'Cancelled',
  UNKNOWN: 'Status unavailable',
};

/** The short form, for a chip. */
export const ORDER_STAGE_SHORT_LABELS: Record<OrderStage, string> = {
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  ON_THE_WAY: 'On the way',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'Not delivered',
  COMPLETED: 'Completed',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
  UNKNOWN: 'Unknown',
};

/**
 * The label an order carries, read from both of its statuses.
 *
 * A status the app cannot read renders as "Status unavailable" rather than
 * defaulting to a cheerful one: an order the backend will not describe must not
 * be presented as progressing.
 */
export function orderStatusLabel(order: StagedOrder, short = false): string {
  const stage = orderStage(order);
  return short ? ORDER_STAGE_SHORT_LABELS[stage] : ORDER_STAGE_LABELS[stage];
}

// --- Buckets -------------------------------------------------------------

export type OrderBucket = 'active' | 'completed';

/**
 * The stages after which nothing more will happen to an order.
 *
 * `FINISHED` alone is not one of them: that is the pickup, and the order stays
 * in progress until its delivery says the food arrived.
 */
const COMPLETED_STAGES: readonly OrderStage[] = [
  'DELIVERED',
  'DELIVERY_FAILED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];

/**
 * Which tab an order belongs in.
 *
 * An order whose status could not be read stays in progress: one that might
 * still be coming must not be filed away as finished.
 */
export function orderBucket(order: StagedOrder, now: number = Date.now()): OrderBucket {
  return COMPLETED_STAGES.includes(orderStage(order, now)) ? 'completed' : 'active';
}

/** Splits a customer's orders into the two tabs in one pass. */
export function splitOrders(orders: CustomerOrder[]): {
  active: CustomerOrder[];
  completed: CustomerOrder[];
} {
  const now = Date.now();
  const active: CustomerOrder[] = [];
  const completed: CustomerOrder[] = [];
  for (const order of orders) {
    (orderBucket(order, now) === 'active' ? active : completed).push(order);
  }
  return { active, completed };
}

// --- Progress ------------------------------------------------------------

/**
 * The stages the tracker shows, in order. The first three move with the
 * order status (the restaurant), the last two with the delivery status (the
 * driver).
 */
export const ORDER_PROGRESS_STEPS = [
  'Placed',
  'Confirmed',
  'Preparing',
  'On the way',
  'Delivered',
] as const;

export const ORDER_STEP_COUNT = ORDER_PROGRESS_STEPS.length;

/**
 * How many stages are done, 0–5, straight from the two backend statuses.
 *
 * Nothing is inferred from elapsed time, and there is no stage the app
 * advances on its own. `READY` stays on "Preparing": the food is done, but
 * "On the way" lights only once the driver has actually picked it up, and
 * "Delivered" only once they confirm the drop-off. A declined or cancelled
 * order has no progress and returns 0.
 */
export function orderProgressStep(order: StagedOrder): number {
  switch (orderStage(order)) {
    case 'CANCELLED':
    case 'REJECTED':
      return 0;
    case 'DELIVERED':
      return 5;
    case 'ON_THE_WAY':
    case 'DELIVERY_FAILED':
    case 'COMPLETED':
      return 4;
    case 'PREPARING':
    case 'READY':
      return 3;
    case 'CONFIRMED':
      return 2;
    default:
      // PLACED — and an unknown status: it was placed, that much is certain.
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
