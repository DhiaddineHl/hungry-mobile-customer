import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Search, Crosshair, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { Fonts } from '@/constants/theme';
import { AddressType, LocationCoords } from '@/types/location';
import { AddressTypeSelector } from '@/components/location/address-type-selector';
import { MapPlaceholder } from '@/components/location/map-placeholder';
import {
  PlaceSuggestion,
  autocompletePlaces,
  getPlaceLocation,
  newPlacesSessionToken,
} from '@/services/api/places-service';
import { describeCoordinates } from '@/services/location/delivery-point';

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

  /**
   * Set when checkout sent the customer here to pick a delivery point for an
   * order in progress. It changes what "Deliver to this point" means: the point
   * goes BACK to that checkout for confirmation, instead of starting the
   * add-an-address flow, which ends on the tabs and would strand a half-placed
   * order.
   */
  const { checkoutRestaurantId } = useLocalSearchParams<{ checkoutRestaurantId?: string }>();

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
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);

  // Reverse geocodes race when the user moves the map quickly — only the
  // latest request may write its result.
  const geocodeIdRef = useRef(0);
  // One Places session token per typing burst — autocomplete calls share it
  // and the follow-up details call closes it, so Google bills one session.
  const sessionTokenRef = useRef<string | null>(null);
  const autocompleteIdRef = useRef(0);
  // Selecting a suggestion writes its text back into the input; that change
  // must not re-trigger autocomplete.
  const suppressAutocompleteRef = useRef(false);

  const reverseGeocode = async (lat: number, lng: number) => {
    const requestId = ++geocodeIdRef.current;
    setIsLoadingAddress(true);
    // Naming and the coordinate fallback live in `describeCoordinates`, which
    // the checkout card resolves its own dragged points through — one answer to
    // "what is this point called" for both maps. The race guard stays here:
    // only this screen knows which request is still the current one.
    const described = await describeCoordinates({ latitude: lat, longitude: lng });
    if (requestId !== geocodeIdRef.current) return;
    setAddressText(described);
    setIsLoadingAddress(false);
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

  // Debounced Places autocomplete while the user types.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (suppressAutocompleteRef.current) {
      suppressAutocompleteRef.current = false;
      return;
    }
    const query = searchQuery.trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    const requestId = ++autocompleteIdRef.current;
    const timeout = setTimeout(async () => {
      try {
        sessionTokenRef.current ??= newPlacesSessionToken();
        const results = await autocompletePlaces(query, {
          sessionToken: sessionTokenRef.current,
          near: selectedCoords,
        });
        if (requestId === autocompleteIdRef.current) setSuggestions(results);
      } catch {
        if (requestId === autocompleteIdRef.current) setSuggestions([]);
      }
    }, 350);
    return () => clearTimeout(timeout);
    // selectedCoords only biases results — not worth re-querying when it moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    Keyboard.dismiss();
    suppressAutocompleteRef.current = true;
    setSearchQuery(suggestion.description);
    setSuggestions([]);
    setHint(null);
    // The details call ends the billing session — start fresh on next typing.
    const sessionToken = sessionTokenRef.current;
    sessionTokenRef.current = null;
    setIsSearching(true);
    try {
      const coords = await getPlaceLocation(suggestion.placeId, sessionToken ?? undefined);
      animateTo(coords.latitude, coords.longitude);
    } catch {
      setHint('Could not load that place. Try another result.');
    } finally {
      setIsSearching(false);
    }
  };

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
    // Submitting with suggestions open picks the top one — the common intent.
    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0]);
      return;
    }
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
    if (checkoutRestaurantId) {
      // `replace`, not `push`: this screen was opened FROM that checkout, so
      // returning to it must not leave a map underneath for Back to fall into.
      router.replace({
        pathname: '/order-details/[id]',
        params: {
          id: checkoutRestaurantId,
          pickedLatitude: selectedCoords.latitude.toString(),
          pickedLongitude: selectedCoords.longitude.toString(),
          pickedAddress: addressText,
        },
      });
      return;
    }
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
    if (suggestions.length > 0) {
      setSuggestions([]);
    } else if (bottomSheet === 'address-type') {
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
        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={suggestion.placeId}
                style={[styles.suggestionRow, index > 0 && styles.suggestionRowBorder]}
                onPress={() => handleSelectSuggestion(suggestion)}
              >
                <MapPin size={16} color="#AAAAAA" />
                <View style={styles.suggestionTextGroup}>
                  <Text style={styles.suggestionPrimary} numberOfLines={1}>
                    {suggestion.primaryText}
                  </Text>
                  {!!suggestion.secondaryText && (
                    <Text style={styles.suggestionSecondary} numberOfLines={1}>
                      {suggestion.secondaryText}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
  suggestions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  suggestionTextGroup: {
    flex: 1,
  },
  suggestionPrimary: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
  },
  suggestionSecondary: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#AAAAAA',
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
