import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { Card, Divider, IconButton, IconWell, InfoRow, PillButton, Text, TextLink, Touchable } from '@/components/ds';
import { coordinatesDiffer } from '@/services/location/delivery-point';
import type { LocationCoords } from '@/types/location';
import { createStyles } from '@/theme';

/**
 * Where this order is going — a map preview the customer can move, over the
 * "Deliver to" row (C2).
 *
 * Three ways to change the delivery point, in rising order of effort:
 *   - DRAG the map. The pin is fixed to the centre, so wherever the map settles
 *     is reported through `onPointChange` and offered for confirmation.
 *     Nothing is saved by a gesture alone — a pan is not an instruction.
 *   - TAP the map. Opens the full-screen picker (search, locate-me).
 *   - TAP THE DELIVER-TO ROW. The address flow, a different question from
 *     where the pin sits.
 *
 * The map is UNCONTROLLED (`initialRegion` plus ref animations), because a
 * controlled `region` prop fights the gesture being made. Keeping the props and
 * the camera in step is therefore this component's job.
 */

/** Zoom of the inline map. Tight enough to see a street, wide enough to orient. */
const CARD_DELTA = 0.006;

interface PendingPoint {
  /** The point's name, once the geocoder has answered. */
  text: string | null;
  isResolving: boolean;
  /** Kept for the confirm control; checkout confirms locally, never saving. */
  isSaving: boolean;
}

interface DeliveryLocationCardProps {
  addressLabel: string;
  addressText: string;
  latitude?: number;
  longitude?: number;
  /** The Deliver-to row: the address flow. */
  onPress?: () => void;
  /** Opens the full-screen picker. */
  onOpenMap?: () => void;
  /** The map settled somewhere after the customer moved it. */
  onPointChange?: (coords: LocationCoords) => void;
  /** A moved, not yet confirmed point — shows the confirm row. */
  pending?: PendingPoint | null;
  onConfirmPending?: () => void;
  onCancelPending?: () => void;
}

export function DeliveryLocationCard({
  addressLabel,
  addressText,
  latitude,
  longitude,
  onPress,
  onOpenMap,
  onPointChange,
  pending,
  onConfirmPending,
  onCancelPending,
}: DeliveryLocationCardProps) {
  const styles = useStyles();
  const mapRef = useRef<MapView | null>(null);
  // The centre the map itself last reported. The camera is only driven when a
  // change came from OUTSIDE the map — animating in response to the map's own
  // drag would yank it back under the finger.
  const lastCenterRef = useRef<LocationCoords | null>(null);

  const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number';

  useEffect(() => {
    if (!hasCoordinates) return;
    const target = { latitude: latitude!, longitude: longitude! };
    if (!coordinatesDiffer(target, lastCenterRef.current)) return;
    lastCenterRef.current = target;
    mapRef.current?.animateToRegion({ ...target, latitudeDelta: CARD_DELTA, longitudeDelta: CARD_DELTA }, 350);
  }, [hasCoordinates, latitude, longitude]);

  const handleRegionChangeComplete = (region: Region) => {
    const coords = { latitude: region.latitude, longitude: region.longitude };
    lastCenterRef.current = coords;
    onPointChange?.(coords);
  };

  const renderMap = () => {
    // An address with no coordinates cannot be delivered to and cannot seed a
    // map — offer the picker instead of a map centred on a guess.
    if (!hasCoordinates) {
      return (
        <Touchable onPress={onOpenMap} scaleTo={1} accessibilityLabel="Pin this address on the map" style={styles.fallback}>
          <IconWell icon="pin" tone="warm" size={40} round />
          <Text variant="meta" align="center">
            Pin this address on the map so a driver can find it.
          </Text>
        </Touchable>
      );
    }
    if (Platform.OS === 'web') return <View style={styles.webMap} />;

    // Required lazily: `react-native-maps` has no web build.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeMapView } = require('@/components/location/map-view-native');
    return (
      <NativeMapView
        mapRef={mapRef}
        initialRegion={{ latitude: latitude!, longitude: longitude!, latitudeDelta: CARD_DELTA, longitudeDelta: CARD_DELTA }}
        addressText={pending ? (pending.text ?? '') : addressText}
        isLoadingAddress={!!pending?.isResolving}
        hideLabel={!pending}
        onRegionChangeComplete={handleRegionChangeComplete}
        // A tap means "open the big map"; dragging keeps working in place.
        onPress={onOpenMap}
        // No blue dot: it would ask for location permission the moment the
        // checkout opens. The picker still offers locate-me.
        showsUserLocation={false}
      />
    );
  };

  return (
    <Card>
      <View style={styles.map}>
        {renderMap()}
        {hasCoordinates && onOpenMap ? (
          <IconButton icon="navigate" variant="add" onPress={onOpenMap} accessibilityLabel="Open the full map" style={styles.expand} />
        ) : null}
      </View>

      {/* Shown only once the pin has moved. A confirmed point goes on THIS
          order only — it takes an explicit tap, never a gesture. */}
      {pending ? (
        <>
          <View style={styles.pending}>
            <View style={styles.flex}>
              <Text variant="itemTitle">Deliver to this point?</Text>
              <Text variant="meta" color="inkMuted" numberOfLines={1}>
                {pending.isResolving || !pending.text ? 'Finding the address…' : pending.text}
              </Text>
            </View>
            <TextLink label="Cancel" onPress={onCancelPending ?? (() => {})} disabled={pending.isSaving} accessibilityLabel="Keep the current address" />
            <PillButton
              label="Deliver here"
              onPress={onConfirmPending}
              disabled={pending.isSaving || pending.isResolving}
              accessibilityLabel="Deliver to this point"
            />
          </View>
          <Divider />
        </>
      ) : null}

      <InfoRow icon="pin" caption="Deliver to" value={`${addressLabel}${addressText ? ` · ${addressText}` : ''}`} onPress={onPress} />
    </Card>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  map: { height: 120, backgroundColor: t.colors.surfaceSunken },
  webMap: { flex: 1, backgroundColor: t.colors.surfaceSunken },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[8], paddingHorizontal: t.space[24] },
  expand: { position: 'absolute', right: t.space[10], bottom: t.space[10] },
  pending: { flexDirection: 'row', alignItems: 'center', gap: t.space[12], padding: t.space[14] },
}));
