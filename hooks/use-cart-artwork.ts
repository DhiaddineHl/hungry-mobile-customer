import type { CartOutput } from '@/schemas/cart';
import type { ImageSource } from 'expo-image';
import { useQueries } from '@tanstack/react-query';
import { productImageQueryOptions } from './use-products';
import { useRestaurantImageSourceFromPath } from './use-restaurant-image';
import { restaurantQueryOptions } from './use-restaurants';

/**
 * The pictures a cart shows: each dish's artwork and each restaurant's logo.
 *
 * The server's cart carries prices and names but no images (a product's
 * artwork is a separate request per dish, a restaurant's logo lives on the
 * restaurant), so the screens resolve them here from the ids the cart already
 * has. Both are cached queries, shared with the menu and restaurant screens,
 * so a dish the customer just added from its menu is usually already there.
 */
export interface CartArtwork {
  /** The dish's picture, or `undefined` while it loads or when it has none. */
  imageOf: (productId: string | null | undefined) => ImageSource | undefined;
  /** The restaurant's logo, or `undefined` while it loads or when it has none. */
  logoOf: (restaurantId: string | null | undefined) => ImageSource | undefined;
}

function uniqueIds(ids: (string | null | undefined)[]): string[] {
  return Array.from(new Set(ids.filter((id): id is string => !!id)));
}

export function useCartArtwork(cart: CartOutput | null | undefined): CartArtwork {
  const toSource = useRestaurantImageSourceFromPath();

  const productIds = uniqueIds((cart?.items ?? []).map((item) => item.productId));
  const restaurantIds = uniqueIds((cart?.items ?? []).map((item) => item.restaurantId));

  const images = useQueries({ queries: productIds.map((id) => productImageQueryOptions(id)) });
  const restaurants = useQueries({ queries: restaurantIds.map((id) => restaurantQueryOptions(id)) });

  const imagePathByProduct = new Map<string, string | null | undefined>();
  productIds.forEach((id, index) => imagePathByProduct.set(id, images[index]?.data));

  const logoPathByRestaurant = new Map<string, string | undefined>();
  restaurantIds.forEach((id, index) => logoPathByRestaurant.set(id, restaurants[index]?.data?.logoPath));

  return {
    imageOf: (productId) => {
      const path = productId ? imagePathByProduct.get(productId) : undefined;
      return path ? toSource(path) : undefined;
    },
    logoOf: (restaurantId) => {
      const path = restaurantId ? logoPathByRestaurant.get(restaurantId) : undefined;
      return path ? toSource(path) : undefined;
    },
  };
}
