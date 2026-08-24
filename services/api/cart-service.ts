import { cartOutputSchema, type CartInput, type CartOutput } from '@/schemas/cart';
import { pageSchema } from '@/schemas/page';
import { z } from 'zod';
import { ApiError, apiClient, isApiError } from './client';
import { customerCartCodePrefix, parseCartCode } from './cart-view-model';

/**
 * Cart reads and writes against the gateway.
 *
 * Every response is parsed through the zod schemas before it leaves this
 * module, so a backend shape change surfaces here as a named `ApiError`
 * instead of an `undefined` several components downstream.
 *
 * Three constraints shape everything below (plan §2, §3.5). None of them is a
 * preference:
 *
 *   1. **`PUT /carts` does not write.** `CartCrudService` never overrides
 *      `DefaultCrudService.update()`, which is literally `return null;`, and
 *      `DefaultCrudController` wraps that in `ResponseEntity.ok(null)`. The
 *      call answers 200 OK with an empty body and persists nothing — it does
 *      not error, so a client trusting the status code silently loses every
 *      mutation. This module therefore never calls it: every change is
 *      DELETE-then-POST (see {@link replaceCart}).
 *   2. **The customer-id and status filter keys answer 500.**
 *      `CartSpecification` reads `root.get("customerId")` on an entity whose
 *      field is the `customer` association, and compares the bare ORDINAL
 *      `status` enum against a String literal. Only `codes` and `names` map to
 *      real String columns. Plan §3.5 names both broken keys exactly; neither
 *      is emitted anywhere here, and the filter type below cannot express
 *      them.
 *   3. **A missing or malformed id answers 500, not 404 or 400.**
 *      `DefaultCrudRepository.find` is `findById(...).orElseThrow()` and
 *      `CartControllerAdvice` registers no exception handler at all.
 *
 * Carts are scoped by the `code` scheme in `cart-view-model.ts` rather than by
 * customer, because `Cart` has no restaurant field and the customer-id filter
 * key is one of the broken ones.
 */

const CARTS = '/carts';

/**
 * Entity properties the backend can actually sort by. Deliberately a closed
 * union rather than a string: an unknown field is a 500, so caller input must
 * never reach the query.
 */
export type CartSortField = 'createdAt' | 'code' | 'name';

/** One page is plenty: a customer has one cart per restaurant, not hundreds. */
const CUSTOMER_CARTS_PAGE_SIZE = 50;

const cartPageSchema = pageSchema(cartOutputSchema);

/** Turns a zod failure into an ApiError naming the offending field path. */
function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown, what: string): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  throw new ApiError(
    `Unexpected ${what} from the server: ${path} — ${issue.message}. ` +
      `The app may need updating to match the backend.`
  );
}

// Third copy in this folder, alongside restaurant-service and product-service:
// each service module is self-contained against its own routes, and cart reads
// must not drag a product or restaurant module in to validate an id.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `id` is shaped like a UUID — the only form the id routes accept. */
export function isUuid(id: string): boolean {
  return UUID.test(id);
}

/**
 * The only filter shape this module emits.
 *
 * `codes` is the sole key here for a reason: it is the one `CartFilter`
 * property backed by a real String column that also identifies a cart. Adding
 * either broken key from plan §3.5 to this interface would make a 500
 * expressible — the type is the guard.
 */
interface CartFilter {
  codes: { operator: 'EQUALS' | 'LIKE'; fieldValue: string; fieldType: 'STRING' }[];
}

async function fetchCartsByCodeFilter(
  operator: 'EQUALS' | 'LIKE',
  fieldValue: string,
  sort: CartSortField
): Promise<CartOutput[]> {
  const filter: CartFilter = {
    codes: [{ operator, fieldValue, fieldType: 'STRING' }],
  };

  // axios handles the encoding once, so no call site hand-builds a query string.
  const { data } = await apiClient.get(`${CARTS}/all`, {
    params: {
      page: 0,
      size: CUSTOMER_CARTS_PAGE_SIZE,
      filter: JSON.stringify(filter),
      sort: JSON.stringify([{ field: sort, direction: 'DESC' }]),
    },
  });

  return parseOrThrow(cartPageSchema, data, 'cart list').content;
}

/**
 * Creates a cart. **201 Created**, body = `CartOutputData`.
 *
 * `input.code` is always populated by `toCartInput`; `code` has no unique
 * constraint on the backend, so two creates with the same code produce two
 * rows. Preventing that is {@link replaceCart}'s delete-first ordering, not
 * anything the backend enforces.
 */
export async function createCart(input: CartInput): Promise<CartOutput> {
  const { data } = await apiClient.post(CARTS, input);
  return parseOrThrow(cartOutputSchema, data, 'cart');
}

/**
 * The cart stored under an exact `code`, or `null` when there is none.
 *
 * Duplicates are possible (see {@link createCart}), so the newest by
 * `createdAt` wins and the collision is logged rather than silently resolved.
 * `createdAt` is a local wall-clock string with no offset, which is fine here:
 * every row being compared came from the same server clock.
 */
export async function fetchCartByCode(code: string): Promise<CartOutput | null> {
  const carts = await fetchCartsByCodeFilter('EQUALS', code, 'createdAt');
  if (carts.length === 0) return null;

  if (carts.length > 1) {
    console.warn(
      `[cart-service] ${carts.length} carts share the code "${code}" — ` +
        `the backend has no unique constraint on it. Using the newest.`
    );
  }

  return carts.reduce((newest, cart) =>
    (cart.createdAt ?? '') > (newest.createdAt ?? '') ? cart : newest
  );
}

/**
 * Every cart this app wrote for one customer.
 *
 * `LIKE` is rendered as `%value%` by `SpecificationUtils` — a SUBSTRING match,
 * not a prefix one — and `/carts/all` is not scoped to the caller in any case,
 * so the response can contain rows belonging to other customers. They are
 * dropped here.
 *
 * That client-side pass is **query correctness, not a security measure**: the
 * backend enforces no cart ownership whatsoever, so nothing about this
 * protects anyone's data. It only stops a foreign row from being rendered as
 * one of this customer's carts. The real fix belongs in `CartFilter`
 * (plan §3.6).
 */
export async function fetchCustomerCarts(
  customerId: string,
  params: { sort?: CartSortField } = {}
): Promise<CartOutput[]> {
  const carts = await fetchCartsByCodeFilter(
    'LIKE',
    customerCartCodePrefix(customerId),
    params.sort ?? 'createdAt'
  );

  return carts.filter((cart) => parseCartCode(cart.code)?.customerId === customerId);
}

/**
 * One cart by UUID, or `null` when it does not exist.
 *
 * A missing id answers **500 NoSuchElementException** rather than 404, so a
 * 500 on a well-formed UUID is read as not-found. A genuine server fault on a
 * valid id is INDISTINGUISHABLE from a missing record at this layer — the same
 * deliberate trade `fetchRestaurantById` and `fetchProductById` make.
 *
 * A malformed id is rejected before the request: it would answer 500 too, so
 * there would be nothing in the response to tell the two cases apart.
 */
export async function fetchCartById(cartId: string): Promise<CartOutput | null> {
  if (!isUuid(cartId)) return null;

  try {
    const { data } = await apiClient.get(`${CARTS}/${encodeURIComponent(cartId)}`);
    return parseOrThrow(cartOutputSchema, data, 'cart');
  } catch (error) {
    if (isApiError(error, 404) || isApiError(error, 400)) return null;
    if (isApiError(error, 500)) return null;
    throw error;
  }
}

/**
 * Deletes a cart. **204 No Content.**
 *
 * The UUID guard is not cosmetic: `IdResolver` calls `UUID.fromString(...)`
 * with no handler behind it, so a malformed id leaves the device only to come
 * back as a 500 that says nothing.
 */
export async function deleteCart(cartId: string): Promise<void> {
  if (!isUuid(cartId)) return;

  await apiClient.delete(`${CARTS}/${encodeURIComponent(cartId)}`);
}

/**
 * Makes the server's copy of a cart match `input`, and returns it — or `null`
 * when the cart was emptied.
 *
 * This is the ONLY write path for an existing cart, because `PUT /carts` does
 * not write (see the module header). The sequence is:
 *
 *   1. resolve the remote id — from `knownCartId`, else by `code`;
 *   2. DELETE it if one exists;
 *   3. POST the full item list, **strictly after** the delete.
 *
 * The ordering matters and is asserted by test. `code` has no unique
 * constraint, so create-then-delete leaves a window in which a crash duplicates
 * the cart; delete-then-create at worst loses a server copy the local store —
 * which stays authoritative — rebuilds on the next sync.
 *
 * A failed delete does not abort the create. The overwhelmingly likely cause is
 * that the row is already gone (a 500 on a well-formed UUID IS not-found here),
 * and refusing to create would leave the customer with no server cart at all.
 */
export async function replaceCart(
  input: CartInput,
  knownCartId?: string
): Promise<CartOutput | null> {
  const cartId = knownCartId ?? (await fetchCartByCode(input.code))?.id;

  if (cartId) {
    try {
      await deleteCart(cartId);
    } catch {
      // Already gone, or a transient fault on a row we are replacing anyway.
    }
  }

  // An empty cart is a deleted cart: posting `items: []` would leave an empty
  // row behind that the next hydration would have to recognise and discard.
  if (input.items.length === 0) return null;

  return createCart(input);
}
