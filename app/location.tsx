import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';

export default function LocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError('Location permission was denied. You can choose your location on the map.');
      }
    } catch {
      setError('Could not get your location. Please try again or choose on the map.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChooseOnMap = () => {
    router.push('/map-select');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.imageContainer}>
          <Image
            source={require('@/assets/localisation-logo.svg')}
            style={styles.image}
            contentFit="contain"
          />
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.allowButton, isLoading && styles.allowButtonDisabled]}
          onPress={handleAllowLocation}
          disabled={isLoading}
          activeOpacity={0.9}
        >
          <Text style={styles.allowButtonText}>
            {isLoading ? 'Getting location...' : 'Allow Location Access'}
          </Text>
          <MapPin size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.description}>
          Hungry Will Access Your Location{'\n'}Only When Using The App
        </Text>

        <TouchableOpacity onPress={handleChooseOnMap} disabled={isLoading}>
          <Text style={styles.mapLink}>Choose On The Maps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  imageContainer: {
    width: 240,
    height: 240,
    marginBottom: 48,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 20,
  },
  allowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F5A623',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    marginBottom: 24,
    width: '100%',
  },
  allowButtonDisabled: {
    opacity: 0.7,
  },
  allowButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
  description: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  mapLink: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: '#F5A623',
    textDecorationLine: 'underline',
  },
});
