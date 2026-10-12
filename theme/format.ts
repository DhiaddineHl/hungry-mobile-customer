// Hungry customer app — copy formatters (design system §10).
//   formatDecimal(9.68)  → "9,68"     formatDecimal(59.9) → "59,9"    formatDecimal(14) → "14"
//   formatDT(2.5)        → "2,5 DT"   formatTimeRange(25, 40) → "25–40 min"
//   formatShortDate(d)   → "29 Sept 2026"
//   withCount('In progress', 3) → "In progress · 3"

/** Comma decimal, trailing zeros dropped, at most `maxPlaces` decimals. */
export function formatDecimal(amount: number, maxPlaces = 2): string {
  const fixed = amount.toFixed(maxPlaces);
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  // `-0` after rounding a tiny negative float reads as a bug on a receipt.
  return (trimmed === '-0' ? '0' : trimmed).replace('.', ',');
}

/** Tunisian dinar amount as the board prints it: `14 DT`, `9,68 DT`. */
export function formatDT(amount: number): string {
  return `${formatDecimal(amount)} DT`;
}

/** Option surcharge: `+1 DT`, `+3,5 DT`. */
export function formatSurcharge(amount: number): string {
  return `+${formatDT(amount)}`;
}

/** Time range with an en dash: `25–40 min`. Equal bounds collapse to `30 min`. */
export function formatTimeRange(min: number, max?: number | null): string {
  if (max == null || max === min) return `${min} min`;
  return `${min}–${max} min`;
}

/** Counts carry a middle dot: `Restaurants · 24`. */
export function withCount(label: string, count: number | null | undefined): string {
  return count == null ? label : `${label} · ${count}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/** `29 Sept 2026`. Locale-independent on purpose: the board fixes this form. */
export function formatShortDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** `29 Sept` — for dates in the current year (notification groups, timestamps). */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
