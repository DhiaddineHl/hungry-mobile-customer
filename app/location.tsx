import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { AccentHeadline, ErrorBanner, IconWell, PrimaryButton, Screen, SecondaryButton, Text } from '@/components/ds';
import { useAddressDraftStore } from '@/store/address-draft-store';
import { createStyles } from '@/theme';

/**
 * Entry of the address onboarding (not drawn on the board — composed from
 * StateView parts): use the device position, or pick a point on the map.
 * Address first — it decides what is available.
 */
export default function LocationScreen() {
  const styles = useStyles();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearDrafts = useAddressDraftStore((s) => s.clear);

  // This screen is the entry point of the address onboarding — drop any
  // drafts left behind by an abandoned earlier run.
  useEffect(() => {
    clearDrafts();
  }, [clearDrafts]);

  const handleAllowLocation = async () => {
    if (Platform.OS === 'web') {
      router.push('/address-info?addressType=apartment&addressText=Your+Location');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const results = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        let addressText = `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`;
        if (results.length > 0) {
          const r = results[0];
          const parts = [r.name, r.city, r.country].filter(Boolean);
          if (parts.length > 0) addressText = parts.join(', ');
        }
        router.push({
          pathname: '/address-info',
          params: {
            addressType: 'apartment',
            addressText,
            latitude: location.coords.latitude.toString(),
            longitude: location.coords.longitude.toString(),
          },
        });
      } else {
        setError('Location access is off. You can choose your address on the map instead.');
      }
    } catch {
      setError("Couldn't find your location. Try again or choose on the map.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.body}>
        <IconWell icon="pin" tone="warm" size={72} round iconSize={30} />
        <AccentHeadline text="Where should we deliver" accent="?" variant="display" align="center" />
        <Text variant="bodySmall" color="inkMuted" align="center" style={styles.copy}>
          Your address decides which restaurants can reach you. Hungry only uses your location while
          you use the app.
        </Text>
      </View>
      <View style={styles.actions}>
        {error ? <ErrorBanner title={error} /> : null}
        <PrimaryButton
          label="Use my location"
          loadingLabel="Finding you…"
          onPress={handleAllowLocation}
          loading={isLoading}
        />
        <SecondaryButton
          label="Choose on the map"
          icon="pin"
          onPress={() => router.push('/map-select')}
          disabled={isLoading}
        />
      </View>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: t.space[14] },
  copy: { maxWidth: 300 },
  actions: { paddingHorizontal: t.screenPadding, paddingBottom: t.space[16], gap: t.space[12] },
}));
