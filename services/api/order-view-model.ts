/**
 * Reading an order's free-text `comment`.
 *
 * Pure module: no React, no TanStack Query, no network.
 *
 * Orders are no longer built on the device: `POST /checkout` turns the
 * server cart into orders (see `hooks/use-orders.ts`), and the backend writes
 * each order's comment itself (`DefaultCheckoutService.comment`) in the format
 * this app has always used — `Payment: <label>` on the first line, the
 * customer's note after it. There is no payment column on `Order`, so that
 * comment is still the only record of the chosen method.
 */

/**
 * The two halves of an order `comment`.
 *
 * A comment written by anything else parses as a plain note, never as a
 * payment claim.
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
