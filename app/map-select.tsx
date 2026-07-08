import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search, Crosshair } from 'lucide-react-native';
import * as Location from 'expo-location';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { Fonts } from '@/constants/theme';
import { AddressType, LocationCoords } from '@/types/location';
import { AddressTypeSelector } from '@/components/location/address-type-selector';
import { MapPlaceholder } from '@/components/location/map-placeholder';

const DEFAULT_REGION: Region = {
  latitude: 35.8256,
  longitude: 10.6369,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

type BottomSheetState = 'deliver' | 'address-type';

export default function MapSelectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [bottomSheet, setBottomSheet] = useState<BottomSheetState>('deliver');
  const [selectedCoords, setSelectedCoords] = useState<LocationCoords>({
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude,
  });
  const [addressText, setAddressText] = useState('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  // Reverse geocodes race when the user moves the map quickly — only the
  // latest request may write its result.
  const geocodeIdRef = useRef(0);

  const reverseGeocode = async (lat: number, lng: number) => {
    const requestId = ++geocodeIdRef.current;
    setIsLoadingAddress(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (requestId !== geocodeIdRef.current) return;
      const r = results[0];
      const parts = r ? [r.name, r.city, r.country].filter(Boolean) : [];
      setAddressText(parts.length > 0 ? parts.join(', ') : `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } catch {
      if (requestId !== geocodeIdRef.current) return;
      setAddressText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } finally {
      if (requestId === geocodeIdRef.current) setIsLoadingAddress(false);
    }
  };

  // Resolve the starting point: the default region's address right away, and
  // — when permission was already granted on the previous screen — jump to
  // the user's position. Never prompts; that stays behind the crosshair button.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    reverseGeocode(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude);
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const position =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        animateTo(position.coords.latitude, position.coords.longitude);
      } catch {
        // Stay on the default region — the user can still search or drag.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateTo = (latitude: number, longitude: number) => {
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: DEFAULT_REGION.latitudeDelta,
        longitudeDelta: DEFAULT_REGION.longitudeDelta,
      },
      400
    );
  };

  // The map settled (drag, tap, or animation) — the center is the selection.
  const handleRegionChangeComplete = (region: Region) => {
    setSelectedCoords({ latitude: region.latitude, longitude: region.longitude });
    reverseGeocode(region.latitude, region.longitude);
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query || isSearching) return;
    setIsSearching(true);
    setHint(null);
    try {
      const results = await Location.geocodeAsync(query);
      if (results.length === 0) {
        setHint(`No results for "${query}". Try a street or city name.`);
        return;
      }
      animateTo(results[0].latitude, results[0].longitude);
    } catch {
      setHint('Search failed. Check your connection and try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCenterOnUser = async () => {
    if (isLocating) return;
    setIsLocating(true);
    setHint(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setHint('Location permission denied — search or drag the map instead.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      animateTo(location.coords.latitude, location.coords.longitude);
    } catch {
      setHint('Could not get your location. Try again.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleDeliverHere = () => {
    setBottomSheet('address-type');
  };

  const handleAddressTypeSelect = (type: AddressType) => {
    router.push({
      pathname: '/address-info',
      params: {
        addressType: type,
        addressText,
        latitude: selectedCoords.latitude.toString(),
        longitude: selectedCoords.longitude.toString(),
      },
    });
  };

  const handleBack = () => {
    if (bottomSheet === 'address-type') {
      setBottomSheet('deliver');
    } else {
      router.back();
    }
  };

  const renderMap = () => {
    if (Platform.OS === 'web') {
      return <MapPlaceholder />;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeMapView } = require('@/components/location/map-view-native');
    return (
      <NativeMapView
        mapRef={mapRef}
        initialRegion={DEFAULT_REGION}
        addressText={addressText}
        isLoadingAddress={isLoadingAddress}
        onRegionChangeComplete={handleRegionChangeComplete}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderMap()}

      <View style={[styles.topOverlay, { top: insets.top + 12 }]}>
        <View style={styles.searchBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={18} color="#1A2B3D" />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for location"
            placeholderTextColor="#AAAAAA"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.searchIcon} onPress={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <ActivityIndicator size="small" color="#F5A623" />
            ) : (
              <Search size={18} color="#AAAAAA" />
            )}
          </TouchableOpacity>
        </View>
        {hint && (
          <View style={styles.hintPill}>
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        )}
      </View>

      {bottomSheet === 'deliver' && (
        <View style={[styles.deliverContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={styles.centerButton} onPress={handleCenterOnUser}>
            {isLocating ? (
              <ActivityIndicator size="small" color="#F5A623" />
            ) : (
              <Crosshair size={20} color="#F5A623" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deliverButton, !addressText && styles.deliverButtonDisabled]}
            onPress={handleDeliverHere}
            activeOpacity={0.9}
            disabled={!addressText}
          >
            <Text style={styles.deliverButtonText}>Deliver to this point</Text>
          </TouchableOpacity>
        </View>
      )}

      {bottomSheet === 'address-type' && (
        <View style={[styles.addressTypeSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <AddressTypeSelector onSelect={handleAddressTypeSelect} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  topOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    gap: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1A2B3D',
    padding: 0,
  },
  searchIcon: {
    padding: 4,
  },
  hintPill: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  hintText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#856404',
    textAlign: 'center',
  },
  deliverContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  centerButton: {
    position: 'absolute',
    right: 20,
    bottom: 72,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  deliverButton: {
    backgroundColor: '#1A2B3D',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  deliverButtonDisabled: {
    opacity: 0.6,
  },
  deliverButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
  addressTypeSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
});
