import { formatDT } from '@/services/api/money';

describe('formatDT', () => {
  it('shows the three decimals the dinar has, with a comma', () => {
    expect(formatDT(14.5)).toBe('14,500 DT');
    expect(formatDT(0)).toBe('0,000 DT');
  });

  it('keeps a split service fee\'s halves distinguishable so the lines add up to the total', () => {
    // 1.001 shared over two orders is 0.501 and 0.500.
    expect(formatDT(0.501)).toBe('0,501 DT');
    expect(formatDT(0.5)).toBe('0,500 DT');
  });

  it('lets a currency with fewer decimals say so', () => {
    expect(formatDT(12.5, 2)).toBe('12,50 DT');
  });
});
