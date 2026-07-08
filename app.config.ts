import { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic config layered on top of app.json. Expo CLI loads .env before
 * evaluating this file, so the Google Maps key is injected at build time
 * from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY instead of being committed to git.
 * Changing it requires a new native build (expo run / EAS), not just Metro.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!googleMapsApiKey) {
    console.warn(
      '[app.config] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set — the map will render blank tiles on device.'
    );
  }

  return {
    ...config,
    name: config.name ?? 'hungry-customer',
    slug: config.slug ?? 'hungry-customer',
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey,
      },
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: googleMapsApiKey },
      },
    },
  };
};
