import { Icon, lightTheme } from '@/theme';
import type { Coordinates } from '@/services/api/driver-location-view-model';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, {
  AnimatedRegion,
  Marker,
  MarkerAnimated,
  type LatLng,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
} from 'react-native-maps';

/**
 * The live map on the tracking screen: the restaurant, the drop-off, and the
 * driver moving between them.
 *
 * The driver's marker GLIDES to each new position (`AnimatedRegion`) instead of
 * jumping every few seconds. The camera frames the leg that matters — driver
 * and restaurant before pickup, driver and drop-off after — until the customer
 * moves the map themselves; from then on it stays where they put it, and
 * `recenterSignal` (the screen's "recenter" button) brings the framing back.
 */

/** Glide time between two fixes — a little under the driver app's report interval. */
const GLIDE_MS = 1_500;

const EDGE_PADDING = { top: 120, right: 60, bottom: 320, left: 60 };

interface DriverTrackingMapProps {
  driver: Coordinates | null;
  pickup?: Coordinates;
  dropoff?: Coordinates;
  /** Before pickup the driver is heading to the restaurant, after it to the drop-off. */
  leg: 'pickup' | 'dropoff';
  /** Dims the driver marker — the position is old ("last seen"). */
  driverStale: boolean;
  /** Increment to re-frame the map after the customer moved it. */
  recenterSignal: number;
  onUserMove: () => void;
  following: boolean;
}

export function DriverTrackingMap({
  driver,
  pickup,
  dropoff,
  leg,
  driverStale,
  recenterSignal,
  onUserMove,
  following,
}: DriverTrackingMapProps) {
  const mapRef = useRef<MapView>(null);
  const hasDriver = driver != null;

  // Created once, at the first known position; every later one is animated to.
  const driverRegion = useMemo(
    () =>
      new AnimatedRegion({
        latitude: driver?.latitude ?? 0,
        longitude: driver?.longitude ?? 0,
        latitudeDelta: 0,
        longitudeDelta: 0,
      }),
    // Recreated only when the driver first appears — see the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasDriver]
  );

  useEffect(() => {
    if (!driver) return;
    // react-native-maps types `timing` as also requiring Animated's `toValue`,
    // which AnimatedRegion never reads (it animates each field to the region
    // given) — hence the cast. Same for `coordinate` on `MarkerAnimated` below,
    // whose type omits the AnimatedRegion it is documented to take.
    driverRegion
      .timing({
        latitude: driver.latitude,
        longitude: driver.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
        duration: GLIDE_MS,
        useNativeDriver: false,
      } as Parameters<AnimatedRegion['timing']>[0])
      .start();
  }, [driver, driverRegion]);

  // Frame the current leg while following; the target stop plus the driver.
  const target = leg === 'pickup' ? pickup : dropoff;
  useEffect(() => {
    if (!following) return;
    const points = [driver, target].filter((p): p is Coordinates => p != null);
    if (points.length === 0) return;
    if (points.length === 1) {
      mapRef.current?.animateCamera({ center: points[0], zoom: 15 }, { duration: 600 });
      return;
    }
    mapRef.current?.fitToCoordinates(points, { edgePadding: EDGE_PADDING, animated: true });
  }, [driver, target, following, recenterSignal]);

  const initialCenter = driver ?? target ?? pickup ?? dropoff;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
      initialRegion={
        initialCenter
          ? { ...initialCenter, latitudeDelta: 0.04, longitudeDelta: 0.04 }
          : undefined
      }
      onPanDrag={onUserMove}
      showsUserLocation={false}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      loadingEnabled
      loadingIndicatorColor={lightTheme.colors.ink}
      loadingBackgroundColor={lightTheme.colors.surfaceSunken}
    >
      {pickup ? (
        <Marker coordinate={pickup} anchor={{ x: 0.5, y: 0.5 }} title="Restaurant">
          <Pin background={lightTheme.colors.surface}>
            <Icon name="store" size="small" />
          </Pin>
        </Marker>
      ) : null}

      {dropoff ? (
        <Marker coordinate={dropoff} anchor={{ x: 0.5, y: 0.5 }} title="Delivery address">
          <Pin background={lightTheme.colors.ink}>
            <Icon name="home" size="small" color="onInk" />
          </Pin>
        </Marker>
      ) : null}

      {hasDriver ? (
        <MarkerAnimated
          coordinate={driverRegion as unknown as LatLng}
          anchor={{ x: 0.5, y: 0.5 }} title="Your driver">
          <View style={[styles.driverHalo, driverStale && styles.stale]}>
            <Pin background={lightTheme.colors.ink} large>
              <Icon name="delivery" color="onInk" />
            </Pin>
          </View>
        </MarkerAnimated>
      ) : null}
    </MapView>
  );
}

function Pin({
  background,
  large = false,
  children,
}: {
  background: string;
  large?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.pin, large && styles.pinLarge, { backgroundColor: background }, lightTheme.shadow.floatingButton]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 32,
    height: 32,
    borderRadius: lightTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: lightTheme.colors.surface,
  },
  pinLarge: {
    width: 40,
    height: 40,
  },
  driverHalo: {
    padding: 6,
    borderRadius: lightTheme.radius.pill,
    // The orange halo is the signal: this pin is the one that moves.
    backgroundColor: lightTheme.colors.pinHalo,
  },
  stale: {
    opacity: 0.45,
  },
});
