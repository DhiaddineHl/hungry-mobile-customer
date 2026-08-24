/**
 * Shared image fallbacks.
 *
 * Restaurant media is optional on the backend — a restaurant that never
 * uploaded a cover or a logo simply returns nothing — so every render site
 * needs somewhere to fall through to.
 *
 * The fallback is deliberately a neutral fill and NOT one of the bundled
 * `assets/restaurants-images/restaurant-banner-*.jpg` photographs: those are a
 * specific (fictional) restaurant's artwork, and dressing a real restaurant in
 * them misrepresents the venue rather than admitting the image is missing.
 *
 * An 8×8 solid `Palette.surfaceMuted` PNG, inlined as a data URI so it costs
 * no bundled asset and no network request. `contentFit="cover"` scales it to
 * whatever the card geometry needs.
 */
export const RESTAURANT_IMAGE_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR42mP49PkrVsQwtCQATjG2gdYWgx4AAAAASUVORK5CYII=';
