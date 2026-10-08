import { RefObject, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, {
  MapPressEvent,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { MapPin, PIN_TIP_OFFSET, StateView } from '@/components/ds';
import { createStyles, useTheme } from '@/theme';

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

interface NativeMapViewProps {
  mapRef: RefObject<MapView | null>;
  initialRegion: Region;
  addressText: string;
  isLoadingAddress: boolean;
  /** Fires when the map settles — after a drag, a tap, or a programmatic animation. */
  onRegionChangeComplete: (region: Region) => void;
  /**
   * Replaces the default tap behaviour (recentre on the tapped point).
   *
   * The inline card on checkout uses this to OPEN the full picker instead:
   * there, a tap means "I want the big map", while dragging still moves the
   * pin in place.
   */
  onPress?: () => void;
  /**
   * Shows the blue user dot. Off by default for embedded maps: switching it on
   * asks iOS for location permission the moment the map mounts, and a checkout
   * screen is not where that prompt belongs.
   */
  showsUserLocation?: boolean;
  /** Shown under the street on the pin label (JetBrains Mono). */
  coords?: { latitude: number; longitude: number } | null;
  /** Searching halo while the device position is being found (S-L1). */
  locating?: boolean;
  /** Hide the label bubble (small embedded maps). */
  hideLabel?: boolean;
}

// The pin's tip must sit on the map's visual center: shift the whole column
// up by half its height minus half the dot, so the dot lands on the center.
const PIN_LIFT = 10;

/**
 * "Pick a location" map: the map is uncontrolled (initialRegion + ref
 * animations only, never a controlled `region` — that fights user gestures)
 * and the pin is a fixed overlay at the center, so whatever the map settles
 * on is the selection. The pin lifts while the camera moves and drops when
 * it settles, mirroring the drag → geocode lifecycle.
 */
export function NativeMapView({
  mapRef,
  initialRegion,
  addressText,
  isLoadingAddress,
  onRegionChangeComplete,
  onPress,
  showsUserLocation = true,
  coords,
  locating,
  hideLabel,
}: NativeMapViewProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isMovingRef = useRef(false);
  const lift = useSharedValue(0);
  const [moving, setMoving] = useState(false);

  // Android maps are always Google-backed, and since SDK 53 Expo Go ships
  // without a Google Maps key — the map renders as a black rectangle there.
  // Explain instead of failing silently. iOS uses Apple Maps (works
  // everywhere, no key); Google stays the provider for Android dev builds.
  const isUnsupported = Platform.OS === 'android' && IS_EXPO_GO;

  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: PIN_TIP_OFFSET - PIN_LIFT * lift.get() }],
  }));

  if (isUnsupported) {
    return (
      <View style={styles.unsupported}>
        <StateView
          icon="pin"
          title="The map needs a development build"
          body="Google Maps can't render inside Expo Go on Android. Build the app once with npx expo run:android and open that build instead."
        />
      </View>
    );
  }


  const handleRegionChange = () => {
    // Fires every frame of a camera move — only animate on the first one.
    if (isMovingRef.current) return;
    isMovingRef.current = true;
    setMoving(true);
    lift.set(withTiming(1, { duration: 150 }));
  };

  const handleRegionChangeComplete = (region: Region) => {
    isMovingRef.current = false;
    setMoving(false);
    lift.set(withTiming(0, { duration: 150 }));
    onRegionChangeComplete(region);
  };

  // Tapping recenters on the tapped point (keeping zoom); selection itself
  // happens in onRegionChangeComplete once the animation settles. A caller that
  // passes `onPress` means the tap for something else entirely.
  const handlePress = (e: MapPressEvent) => {
    if (onPress) {
      onPress();
      return;
    }
    mapRef.current?.animateCamera({ center: e.nativeEvent.coordinate }, { duration: 350 });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        onPress={handlePress}
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        loadingEnabled
        loadingIndicatorColor={colors.ink}
        loadingBackgroundColor={colors.surfaceSunken}
      />
      <View style={styles.pinOverlay} pointerEvents="none">
        <Animated.View style={pinStyle}>
          <MapPin
            choosing={moving}
            halo={locating}
            label={hideLabel || moving ? null : isLoadingAddress || !addressText ? 'Finding the address…' : addressText}
            coords={hideLabel || moving || isLoadingAddress ? null : coords}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: { flex: 1, backgroundColor: t.colors.surfaceSunken },
  unsupported: { flex: 1, backgroundColor: t.colors.background },
  pinOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
