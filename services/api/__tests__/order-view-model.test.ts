import { parseOrderComment } from '@/services/api/order-view-model';

describe('parseOrderComment', () => {
  it('reads the comment the backend writes at checkout', () => {
    // `DefaultCheckoutService.comment`: payment line, then the note.
    const parsed = parseOrderComment('Payment: Cash\nRing twice');
    expect(parsed).toEqual({ payment: 'Cash', note: 'Ring twice' });
  });

  it('reads a payment-only comment', () => {
    expect(parseOrderComment('Payment: Bank')).toEqual({
      payment: 'Bank',
      note: null,
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
  });
});
