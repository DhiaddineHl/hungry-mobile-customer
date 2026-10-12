import { pageSchema } from '@/schemas/page';
import { orderOutputSchema, type OrderOutput } from '@/schemas/order';
import { z } from 'zod';
import { ApiError, apiClient, isApiError } from './client';

/**
 * Order reads against the gateway. Orders are CREATED by `POST /checkout`
 * (`services/api/cart-service.ts`), never from here.
 *
 * Every response is parsed through the zod schemas before it leaves this
 * module, so a backend shape change surfaces here as a named `ApiError`
 * instead of an `undefined` several components downstream.
 *
 * Two constraints shape everything below (plan §3.5,
 * `docs/plans/checkout-order-creation-plan.md`):
 *
 *   1. **The order LIST endpoint is not scoped to the caller.** No filter is
 *      sent: {@link fetchCustomerOrders} narrows the response to one customer
 *      on the device. (The `codes` key used to be sent with this app's
 *      `ho:<customer>:` prefix; orders now get their code from the backend,
 *      so that prefix would hide them the day the key starts working.)
 *   2. **A missing or malformed id answers 500, not 404 or 400.**
 *      `DefaultCrudRepository.find` is `findById(...).orElseThrow()` and no
 *      exception handler is registered.
 */

const ORDERS = '/orders';

const orderPageSchema = pageSchema(orderOutputSchema);

/**
 * Rows per page when walking the order list.
 *
 * Large on purpose: the customer filter is applied on the device, so a page is
 * a slice of EVERY customer's orders and a small page could contain none of
 * this customer's. Bounded by {@link MAX_ORDER_PAGES} so a big table can never
 * turn one screen into an unbounded crawl.
 */
export const ORDER_LIST_PAGE_SIZE = 50;

/** How many pages `fetchCustomerOrders` will walk before giving up. */
export const MAX_ORDER_PAGES = 5;

/**
 * Entity properties the backend can sort orders by. A closed union, like
 * `RestaurantSortField`: an unknown sort field answers 500.
 */
export type OrderSortField = 'createdAt' | 'modifiedAt' | 'code';

/** Turns a zod failure into an ApiError naming the offending field path. */
function parseOrThrow<T extends z.ZodType>(
  schema: T,
  data: unknown,
  what: string
): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  throw new ApiError(
    `Unexpected ${what} from the server: ${path} — ${issue.message}. ` +
      `The app may need updating to match the backend.`
  );
}

// Fourth copy in this folder, alongside cart-, restaurant- and product-service:
// each service module is self-contained against its own routes, and an order
// read must not drag the cart module in to validate an id.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `id` is shaped like a UUID — the only form the id routes accept. */
export function isUuid(id: string): boolean {
  return UUID.test(id);
}

/**
 * One order by UUID, or `null` when it does not exist.
 *
 * A missing id answers **500 NoSuchElementException** rather than 404, so a
 * 500 on a well-formed UUID is read as not-found. A genuine server fault on a
 * valid id is INDISTINGUISHABLE from a missing record at this layer — the same
 * deliberate trade `fetchCartById`, `fetchRestaurantById` and
 * `fetchProductById` make.
 *
 * A malformed id is rejected before the request: `IdResolver` calls
 * `UUID.fromString(...)` with no handler behind it, so it would answer 500 too
 * and there would be nothing in the response to tell the two cases apart.
 *
 * Note that a freshly created order can read back with `items: []` even though
 * the create response showed them — `OrderItemsDirectPopulator` never sets the
 * back-reference, so `order_item.order_id` stays NULL (plan §2.2). That is a
 * backend defect; nothing here can repair it, and the app must not present an
 * empty re-read as "the order has no items".
 */
export async function fetchOrderById(id: string): Promise<OrderOutput | null> {
  if (!isUuid(id)) return null;

  try {
    const { data } = await apiClient.get(`${ORDERS}/${encodeURIComponent(id)}`);
    if (data === null || data === undefined || data === '') return null;
    return parseOrThrow(orderOutputSchema, data, 'order');
  } catch (error) {
    if (isApiError(error, 404) || isApiError(error, 400)) return null;
    if (isApiError(error, 500)) return null;
    throw error;
  }
}

/**
 * Every order belonging to one customer, newest first.
 *
 * **The list endpoint returns other customers' orders**, because no filter on
 * it works and the backend enforces no ownership anywhere in the request path.
 * The `customerId` pass below is what makes the result correct — it is *query
 * correctness, not a security measure*. The real fix belongs in `OrderSpecificationPopulator`.
 *
 * Walking pages is likewise forced by that: sorted newest-first, this
 * customer's orders can sit anywhere in a table shared with every other
 * customer, so the reader keeps paging until it runs out of pages or hits
 * {@link MAX_ORDER_PAGES}. A page that fails to parse throws — a half-read
 * order history is worse than a visible error.
 *
 * Note what an order read back does NOT carry: its `items` can come back empty
 * even when the create response showed them, because the backend never sets the
 * `order_item.order_id` back-reference (plan §2.2). Callers must present that as
 * "no line detail available", never as "an order with no items".
 */
export async function fetchCustomerOrders(
  customerId: string,
  params: { sort?: OrderSortField; maxPages?: number } = {}
): Promise<OrderOutput[]> {
  const { sort = 'createdAt', maxPages = MAX_ORDER_PAGES } = params;

  const mine: OrderOutput[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const { data } = await apiClient.get(`${ORDERS}/all`, {
      params: {
        page,
        size: ORDER_LIST_PAGE_SIZE,
        sort: JSON.stringify([{ field: sort, direction: 'DESC' }]),
      },
    });

    const parsed = parseOrThrow(orderPageSchema, data, 'order list');

    mine.push(...parsed.content.filter((order) => order.customerId === customerId));

    if (parsed.last !== false || parsed.content.length === 0) break;
  }

  return mine;
}
