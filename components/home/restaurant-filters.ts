import type { RestaurantSummary } from '@/services/api/restaurant-view-model';
import { CATEGORIES } from './categories-slider';

/**
 * Filters the catalog can actually answer. The board's Free delivery /
 * Promotions / Under 30 min / Top rated chips need fields the backend does not
 * serve yet (`UNBACKED_FIELDS`), so they are not offered: a chip that empties
 * the list for want of data would read as "no restaurants".
 */
export const FILTERS = [{ id: 'open', label: 'Open now' }] as const;
export type FilterId = (typeof FILTERS)[number]['id'];

export function matchesCategory(restaurant: RestaurantSummary, categoryId: string | null): boolean {
  if (!categoryId) return true;
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return true;
  return restaurant.categories.toLowerCase().includes(category.match);
}

export function matchesFilters(restaurant: RestaurantSummary, filters: readonly FilterId[]): boolean {
  return filters.every((f) => (f === 'open' ? restaurant.isOpen !== false : true));
}

/** Open (or unknown) first, closed last — closed places stay listed but greyed. */
export function openFirst(a: RestaurantSummary, b: RestaurantSummary): number {
  return Number(a.isOpen === false) - Number(b.isOpen === false);
}

/** Case- and accent-insensitive "contains". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function matchesQuery(restaurant: RestaurantSummary, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  return normalize(restaurant.name).includes(q) || normalize(restaurant.categories).includes(q);
}

/** Distinct cuisines across the catalog with how many places serve each. */
export function cuisineCounts(restaurants: RestaurantSummary[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of restaurants) {
    for (const cuisine of r.categories.split(' - ').map((c) => c.trim()).filter(Boolean)) {
      counts.set(cuisine, (counts.get(cuisine) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
