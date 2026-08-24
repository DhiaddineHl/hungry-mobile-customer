import { RESTAURANT_IMAGE_PLACEHOLDER } from '@/constants/images';
import { imageAuthHeaders, resolveImageUrl } from '@/services/api/image-url';
import type { ImageSource } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';

/**
 * Builds `expo-image` sources for restaurant media.
 *
 * `<Image>` does not go through `apiClient`'s interceptor, so the bearer token
 * `/files/**` requires has to be attached by hand — and reading it is async.
 * Until it resolves, a remote URL would produce a guaranteed 401 that fails
 * silently, so remote sources fall back to the placeholder for that first
 * frame rather than firing a request that cannot succeed.
 */
export function useRestaurantImageSource() {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let active = true;
    imageAuthHeaders().then((resolved) => {
      if (active) setHeaders(resolved);
    });
    return () => {
      active = false;
    };
  }, []);

  /** An absolute, already-resolved URL → an authenticated source. */
  return useCallback(
    (url: string | null | undefined): ImageSource => {
      if (!url || headers === null) return { uri: RESTAURANT_IMAGE_PLACEHOLDER };
      return { uri: url, headers };
    },
    [headers]
  );
}

/**
 * The same thing for a **relative** backend path — the form the favorites
 * store persists, resolved against the current API base at render time.
 */
export function useRestaurantImageSourceFromPath() {
  const toSource = useRestaurantImageSource();
  return useCallback(
    (path: string | null | undefined): ImageSource => toSource(resolveImageUrl(path)),
    [toSource]
  );
}

/**
 * A source for artwork that came out of a persisted store, where the value is
 * either a backend path (`string`) or a bundled `require(...)` module id
 * (`number`) — see `FavoriteImage` / `CartImage`.
 *
 * A module id is already an `expo-image` source and must NOT be run through
 * the URL join; a path must be. Doing that discrimination once here keeps
 * every render site from re-deriving it.
 */
export function useStoredImageSource() {
  const fromPath = useRestaurantImageSourceFromPath();
  return useCallback(
    (image: string | number | null | undefined): ImageSource | number =>
      typeof image === 'number' ? image : fromPath(image),
    [fromPath]
  );
}
