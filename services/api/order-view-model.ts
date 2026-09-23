/**
 * Reading what the server wrote into an order.
 *
 * Pure module: no React, no TanStack Query, no network.
 *
 * Orders are created by the server now (`POST /checkout` turns the cart into
 * them), so nothing here builds an order, prices one or decides whether one can
 * be placed — the server does all three. What is left is reading the free-text
 * `comment` the server writes on every order: there is no payment concept on the
 * backend, so `"Payment: <method>"` followed by the customer's note is the only
 * record of what the customer chose.
 */

/**
 * The two halves of an order `comment`: `"Payment: <method>"` on the first line,
 * then the customer's note.
 *
 * Reading it back is how the order screens show a payment method at all. A
 * comment written by anything else parses as a plain note, never as a payment
 * claim.
 */
export function parseOrderComment(comment: string | null | undefined): {
  payment: string | null;
  note: string | null;
} {
  if (!comment) return { payment: null, note: null };

  const [first, ...rest] = comment.split('\n');
  const match = /^Payment:\s*(.+)$/.exec(first.trim());
  if (!match) return { payment: null, note: comment.trim() || null };

  const note = rest.join('\n').trim();
  return { payment: match[1].trim(), note: note || null };
}
