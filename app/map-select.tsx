import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import {
  ErrorBanner,
  IconWell,
  LocateButton,
  MapSearchPill,
  MapSheet,
  PrimaryButton,
  Separated,
  Skeleton,
  Spinner,
  Text,
  Touchable,
  TypeTile,
} from '@/components/ds';
import { MapPlaceholder } from '@/components/location/map-placeholder';
import { AddressType, LocationCoords } from '@/types/location';
import {
  PlaceSuggestion,
  autocompletePlaces,
  getPlaceLocation,
  newPlacesSessionToken,
} from '@/services/api/places-service';
import { describeCoordinates } from '@/services/location/delivery-point';
import { createStyles, type IconName } from '@/theme';

const DEFAULT_REGION: Region = {
  latitude: 35.8256,
  longitude: 10.6369,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const ADDRESS_TYPES: { type: AddressType; label: string; icon: IconName }[] = [
  { type: 'apartment', label: 'Apartment', icon: 'apartment' },
  { type: 'office', label: 'Office', icon: 'office' },
  { type: 'house', label: 'House', icon: 'house' },
  { type: 'other', label: 'Other', icon: 'pin' },
];

type BottomSheetState = 'deliver' | 'address-type';

/** "Yasser Arafat Avenue, Sahloul, Sousse, Tunisia" → title + the rest. */
function splitAddress(text: string): { title: string; sub: string } {
  const parts = text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 2) return { title: parts.join(', '), sub: '' };
  return { title: parts.slice(0, 2).join(', '), sub: parts.slice(2).join(', ') };
}

/** The suggestion's primary text with the typed letters in bold (L2). */
function HighlightedMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) {
    return (
      <Text variant="itemLabel" numberOfLines={1}>
        {text}
      </Text>
    );
  }
  return (
    <Text variant="itemLabel" numberOfLines={1}>
      {text.slice(0, at)}
      <Text variant="itemTitle">{text.slice(at, at + q.length)}</Text>
      {text.slice(at + q.length)}
    </Text>
  );
}

/**
 * L1–L3 — drop the pin, search for a place, say what kind of place it is.
 * The map is the selection: whatever it settles on under the fixed centre pin
 * is reverse-geocoded into the sheet.
 */
export default function MapSelectScreen() {
  const styles = useStyles();
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
  const { returnToCheckout } = useLocalSearchParams<{ returnToCheckout?: string }>();

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
  // L2: the search takes over the screen while the pill is focused.
  const [searchFocused, setSearchFocused] = useState(false);
  // L3: the tile is chosen first, then confirmed with Continue.
  const [selectedType, setSelectedType] = useState<AddressType | null>(null);

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
    // "what is this point called" for both maps.
    const described = await describeCoordinates({ latitude: lat, longitude: lng });
    if (requestId !== geocodeIdRef.current) return;
    setAddressText(described);
    setIsLoadingAddress(false);
  };

  // Resolve the starting point: the default region's address right away, and
  // — when permission was already granted on the previous screen — jump to
  // the user's position. Never prompts; that stays behind the locate button.
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

  const animateTo = (latitude: number, longitude: number) => {
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: DEFAULT_REGION.latitudeDelta,
        longitudeDelta: DEFAULT_REGION.longitudeDelta,
      },
      400,
    );
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    Keyboard.dismiss();
    setSearchFocused(false);
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
      setHint("Couldn't load that place. Try another result.");
    } finally {
      setIsSearching(false);
    }
  };

  // The map settled (drag, tap, or animation) — the centre is the selection.
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
      Keyboard.dismiss();
      setSearchFocused(false);
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
        setHint('Location access is off. Search or move the map instead.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      animateTo(location.coords.latitude, location.coords.longitude);
    } catch {
      setHint("Couldn't find your location. Try again.");
    } finally {
      setIsLocating(false);
    }
  };

  const handleDeliverHere = () => {
    if (returnToCheckout) {
      // `replace`, not `push`: this screen was opened FROM the checkout, so
      // returning to it must not leave a map underneath for Back to fall into.
      router.replace({
        pathname: '/order-details',
        params: {
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
    if (searchFocused || suggestions.length > 0) {
      Keyboard.dismiss();
      setSuggestions([]);
      setSearchFocused(false);
    } else if (bottomSheet === 'address-type') {
      setBottomSheet('deliver');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      // Reached by a `replace` with nothing beneath it — the profile-completion
      // screen hands over that way. Fall back to the address onboarding's own
      // entry point rather than leaving a dead button.
      router.replace('/location');
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
        coords={selectedCoords}
        locating={isLocating}
        onRegionChangeComplete={handleRegionChangeComplete}
      />
    );
  };

  const searching = searchFocused || suggestions.length > 0;
  const { title, sub } = splitAddress(addressText);
  const pillTop = insets.top + 8;

  return (
    <View style={styles.container}>
      {renderMap()}

      {searching ? <View style={styles.searchPanel} /> : null}

      <View style={[styles.top, { top: pillTop }]}>
        <MapSearchPill
          placeholder="Search for a location"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          onSearch={handleSearch}
          onClear={() => {
            setSearchQuery('');
            setSuggestions([]);
          }}
          onFocus={() => setSearchFocused(true)}
          onBack={handleBack}
          busy={isSearching}
        />
        {hint ? <ErrorBanner title={hint} /> : null}
      </View>

      {searching ? (
        <ScrollView
          style={[styles.results, { top: pillTop + 56 + 16 }]}
          contentContainerStyle={styles.resultsContent}
          keyboardShouldPersistTaps="handled"
        >
          {suggestions.length > 0 ? (
            <>
              <Text variant="overline" color="inkMuted" style={styles.overline}>
                Results
              </Text>
              <Separated>
                {suggestions.map((suggestion) => (
                  <Touchable
                    key={suggestion.placeId}
                    onPress={() => handleSelectSuggestion(suggestion)}
                    scaleTo={1}
                    accessibilityLabel={suggestion.description}
                    style={styles.result}
                  >
                    <IconWell icon="pin" size={36} round />
                    <View style={styles.flex}>
                      <HighlightedMatch text={suggestion.primaryText} query={searchQuery} />
                      {suggestion.secondaryText ? (
                        <Text variant="meta" color="inkMuted" numberOfLines={1}>
                          {suggestion.secondaryText}
                        </Text>
                      ) : null}
                    </View>
                  </Touchable>
                ))}
              </Separated>
            </>
          ) : (
            <Text variant="meta" color="inkMuted" style={styles.overline}>
              {searchQuery.trim().length < 3 ? 'Type a street, a place or a city.' : 'Searching…'}
            </Text>
          )}
        </ScrollView>
      ) : null}

      {!searching && bottomSheet === 'deliver' ? (
        <View style={styles.bottom}>
          <LocateButton onPress={handleCenterOnUser} busy={isLocating} style={styles.locate} />
          <MapSheet bottomInset={insets.bottom}>
            <View style={styles.deliverRow}>
              {isLoadingAddress || !addressText ? (
                <>
                  <View style={styles.loadingWell}>
                    <Spinner />
                  </View>
                  <View style={[styles.flex, styles.skeletons]}>
                    <Text variant="caption" color="inkMuted">
                      Finding the address…
                    </Text>
                    <Skeleton width="70%" height={16} />
                    <Skeleton width="45%" height={12} />
                  </View>
                </>
              ) : (
                <>
                  <IconWell icon="pin" tone="warm" size={40} />
                  <View style={styles.flex}>
                    <Text variant="caption" color="inkMuted">
                      Deliver to
                    </Text>
                    <Text variant="rowTitle" numberOfLines={2}>
                      {title}
                    </Text>
                    {sub ? (
                      <Text variant="meta" color="inkMuted" numberOfLines={1}>
                        {sub}
                      </Text>
                    ) : null}
                  </View>
                </>
              )}
            </View>
            <PrimaryButton
              label="Deliver to this point"
              onPress={handleDeliverHere}
              disabled={!addressText || isLoadingAddress}
            />
          </MapSheet>
        </View>
      ) : null}

      {!searching && bottomSheet === 'address-type' ? (
        <View style={styles.bottom}>
          <MapSheet bottomInset={insets.bottom}>
            <View>
              <Text variant="heading" accessibilityRole="header">
                What kind of place is it?
              </Text>
              <Text variant="meta" color="inkMuted" numberOfLines={1}>
                {title}
              </Text>
            </View>
            <View style={styles.tiles} accessibilityRole="radiogroup">
              {ADDRESS_TYPES.map((option) => (
                <TypeTile
                  key={option.type}
                  icon={option.icon}
                  label={option.label}
                  selected={selectedType === option.type}
                  onPress={() => setSelectedType(option.type)}
                />
              ))}
            </View>
            <PrimaryButton
              label={selectedType ? 'Continue' : 'Choose a type'}
              disabled={!selectedType}
              onPress={() => selectedType && handleAddressTypeSelect(selectedType)}
            />
          </MapSheet>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: { flex: 1, backgroundColor: t.colors.surfaceSunken },
  flex: { flex: 1 },
  top: { position: 'absolute', left: t.chromePadding, right: t.chromePadding, gap: t.space[10] },
  searchPanel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.surface },
  results: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  resultsContent: { paddingHorizontal: t.screenPadding, paddingBottom: 40 },
  overline: { marginBottom: t.space[8] },
  result: { flexDirection: 'row', alignItems: 'center', gap: t.space[14], paddingVertical: t.space[12] },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  locate: { alignSelf: 'flex-end', marginRight: t.chromePadding, marginBottom: t.space[16] },
  deliverRow: { flexDirection: 'row', alignItems: 'center', gap: t.space[14] },
  loadingWell: {
    width: 40,
    height: 40,
    borderRadius: t.radius.control,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletons: { gap: t.space[6] },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[10] },
}));
