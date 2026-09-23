/**
 * Money as the customer reads it.
 *
 * Amounts come from the server already rounded to the currency, and the
 * Tunisian dinar has three decimals (millimes) — a service fee split across
 * two orders is `0.501` and `0.500`, and showing both as `0,50` would make the
 * printed lines fail to add up to the printed total. So three decimals is the
 * default here, and a caller with a currency that has fewer says so.
 */
export function formatDT(value: number, decimals = 3): string {
  return `${value.toFixed(decimals).replace('.', ',')} DT`;
}
