import { parseOrderComment } from '@/services/api/order-view-model';

/**
 * The server writes every order's `comment` (`DefaultCheckoutService.comment`):
 * `"Payment: <label>"`, then the customer's note on the next line. The order
 * screens read the payment method back out of it, because the backend has no
 * payment concept and this is the only record of the choice.
 */
describe('parseOrderComment', () => {
  it('reads the payment method and the note the server wrote', () => {
    expect(parseOrderComment('Payment: Cash\nRing twice')).toEqual({
      payment: 'Cash',
      note: 'Ring twice',
    });
  });

  it('reads a payment-only comment', () => {
    expect(parseOrderComment('Payment: Bank')).toEqual({ payment: 'Bank', note: null });
  });

  it('reads every label the checkout can write', () => {
    for (const label of ['Cash', 'Hungry Points', 'Bank', 'SIM Credits']) {
      expect(parseOrderComment(`Payment: ${label}`).payment).toBe(label);
    }
  });

  it('keeps a multi-line note intact', () => {
    expect(parseOrderComment('Payment: Cash\nGate code 4821\nSecond floor')).toEqual({
      payment: 'Cash',
      note: 'Gate code 4821\nSecond floor',
    });
  });

  it('treats a comment written by anything else as a plain note', () => {
    // Never present a foreign comment as a payment the customer chose.
    expect(parseOrderComment('Leave at the door')).toEqual({
      payment: null,
      note: 'Leave at the door',
    });
  });

  it('is empty for no comment at all', () => {
    expect(parseOrderComment(null)).toEqual({ payment: null, note: null });
    expect(parseOrderComment(undefined)).toEqual({ payment: null, note: null });
    expect(parseOrderComment('')).toEqual({ payment: null, note: null });
  });
});
