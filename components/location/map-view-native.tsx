import { RefObject, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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
import { MapPinned } from 'lucide-react-native';
import { Duration, Fonts, FontSize, Palette, Radius, Shadows, Spacing } from '@/constants/theme';

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

interface NativeMapViewProps {
  mapRef: RefObject<MapView | null>;
  initialRegion: Region;
  addressText: string;
  isLoadingAddress: boolean;
  /** Fires when the map settles — after a drag, a tap, or a programmatic animation. */
  onRegionChangeComplete: (region: Region) => void;
}

// The pin's tip must sit on the map's visual center: shift the whole column
// up by half its height minus half the dot, so the dot lands on the center.
const PIN_DOT = 12;
const PIN_STEM = 12;
const PIN_BUBBLE = 36;
const PIN_ANCHOR_OFFSET = -((PIN_BUBBLE + PIN_STEM + PIN_DOT) / 2 - PIN_DOT / 2);
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
}: NativeMapViewProps) {
  const isMovingRef = useRef(false);
  const lift = useSharedValue(0);

  // Android maps are always Google-backed, and since SDK 53 Expo Go ships
  // without a Google Maps key — the map renders as a black rectangle there.
  // Explain instead of failing silently. iOS uses Apple Maps (works
  // everywhere, no key); Google stays the provider for Android dev builds.
  const isUnsupported = Platform.OS === 'android' && IS_EXPO_GO;

  if (isUnsupported) {
    return (
      <View style={styles.unsupported}>
        <MapPinned size={48} color={Palette.textMuted} strokeWidth={1.5} />
        <Text style={styles.unsupportedTitle}>The map needs a development build</Text>
        <Text style={styles.unsupportedText}>
          Google Maps can’t render inside Expo Go on Android. Build the app once with{' '}
          <Text style={styles.unsupportedCommand}>npx expo run:android</Text> and open that build
          instead.
        </Text>
      </View>
    );
  }

  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: PIN_ANCHOR_OFFSET - PIN_LIFT * lift.get() }],
  }));

  const handleRegionChange = () => {
    // Fires every frame of a camera move — only animate on the first one.
    if (isMovingRef.current) return;
    isMovingRef.current = true;
    lift.set(withTiming(1, { duration: Duration.fast }));
  };

  const handleRegionChangeComplete = (region: Region) => {
    isMovingRef.current = false;
    lift.set(withTiming(0, { duration: Duration.fast }));
    onRegionChangeComplete(region);
  };

  // Tapping recenters on the tapped point (keeping zoom); selection itself
  // happens in onRegionChangeComplete once the animation settles.
  const handlePress = (e: MapPressEvent) => {
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
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        loadingEnabled
        loadingIndicatorColor={Palette.primary}
        loadingBackgroundColor={Palette.background}
      />
      <View style={styles.pinOverlay} pointerEvents="none">
        <Animated.View style={[styles.pin, pinStyle]}>
          <View style={[styles.markerBubble, Shadows.md]}>
            <Text style={styles.markerText} numberOfLines={1}>
              {isLoadingAddress || !addressText ? 'Locating…' : addressText}
            </Text>
          </View>
          <View style={styles.markerStem} />
          <View style={styles.markerDot} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  unsupported: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
    backgroundColor: Palette.background,
  },
  unsupportedTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.ink,
    textAlign: 'center',
  },
  unsupportedText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  unsupportedCommand: {
    fontFamily: Fonts.semiBold,
    color: Palette.ink,
  },
  pinOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    alignItems: 'center',
  },
  markerBubble: {
    height: PIN_BUBBLE,
    justifyContent: 'center',
    backgroundColor: Palette.ink,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    maxWidth: 220,
  },
  markerText: {
    color: Palette.textInverse,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
  },
  markerStem: {
    width: 2,
    height: PIN_STEM,
    backgroundColor: Palette.ink,
  },
  markerDot: {
    width: PIN_DOT,
    height: PIN_DOT,
    borderRadius: PIN_DOT / 2,
    backgroundColor: Palette.ink,
    borderWidth: 2,
    borderColor: Palette.textInverse,
  },
});
