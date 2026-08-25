import {
  orderOutputSchema,
  type OrderInput,
  type OrderOutput,
} from '@/schemas/order';
import { z } from 'zod';
import { ApiError, apiClient, isApiError } from './client';

/**
 * Order reads and writes against the gateway.
 *
 * Every response is parsed through the zod schemas before it leaves this
 * module, so a backend shape change surfaces here as a named `ApiError`
 * instead of an `undefined` several components downstream.
 *
 * Four constraints shape everything below (plan §2, §3.5,
 * `docs/plans/checkout-order-creation-plan.md`). None of them is a preference:
 *
 *   1. **`PUT /orders` does not write.** `OrderCrudService` never overrides
 *      `DefaultCrudService.update()`, which is literally `return null;`, and
 *      `DefaultCrudController` wraps that in `ResponseEntity.ok(null)`. The
 *      call answers 200 OK with an empty body and persists nothing. It is
 *      never called here — an order is created once and never amended by this
 *      app. {@link assertBody} exists so that if any 2xx ever arrives empty,
 *      it is treated as the failure it is rather than as a silent success.
 *   2. **Every filter on the order LIST endpoint is broken or ignored.** The
 *      restaurant-id and customer-id keys answer 500 (the specification reads
 *      a scalar property on an entity whose field is an association), the
 *      status key compares a bare ORDINAL enum to a String, and the id, code
 *      and name keys are silently dropped by `OrderSpecificationPopulator` — a
 *      200 with UNFILTERED results, which is worse than an error. Plan §3.5
 *      names all of them exactly. This module never calls that endpoint and
 *      declares no filter type that could express one, which is also why
 *      `orderKeys` has no `list`.
 *   3. **A missing or malformed id answers 500, not 404 or 400.**
 *      `DefaultCrudRepository.find` is `findById(...).orElseThrow()` and no
 *      exception handler is registered.
 *   4. **A failure body says only "A populator has failed (N errors
 *      occurred)".** It names no field and means nothing to a customer, so it
 *      is never relayed — callers get this app's own wording.
 *
 * A successful create also ENQUEUES the order for driver assignment
 * (`OrderConsumer`), which is why nothing in this module or its callers retries
 * automatically: a duplicate order is a duplicate delivery, not a duplicate row
 * (plan §3.6).
 */

const ORDERS = '/orders';

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
 * Guards against the `PUT` no-op signature: a 2xx carrying no body.
 *
 * `DefaultCrudService.update()` returns null and the controller answers
 * `ResponseEntity.ok(null)`, so "success with an empty body" is a shape this
 * backend genuinely produces. Treating it as success would report a written
 * order the server does not have — the single worst outcome available at this
 * layer, because the customer would be told a delivery is coming.
 */
function assertBody(data: unknown, what: string): unknown {
  if (data === null || data === undefined || data === '') {
    throw new ApiError(
      `The server accepted the ${what} but returned nothing, so it was not saved.`
    );
  }
  return data;
}

/**
 * Creates an order. **201 Created + Location**, body = `OrderOutputData`.
 *
 * Expected to fail with 500 while the plan §2 persistence defects stand: the
 * populator builds a transient `OrderedProduct` that nothing cascades, so any
 * order with a non-empty `items` list trips `TransientPropertyValueException`.
 *
 * That failure is surfaced, not worked around. Retrying with `items: []` would
 * write a real, unfulfillable order and enqueue a driver for it; retrying the
 * same payload risks a second delivery. Callers keep the cart and offer a
 * MANUAL retry only.
 */
export async function createOrder(input: OrderInput): Promise<OrderOutput> {
  const { data } = await apiClient.post(ORDERS, input);
  return parseOrThrow(orderOutputSchema, assertBody(data, 'order'), 'order');
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
