import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { coordinatesDiffer } from '@/services/location/delivery-point';
import type { LocationCoords } from '@/types/location';
import { ChevronRight, MapPin, Maximize2 } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';

/**
 * Where this order is going — and, now, a map the customer can actually move.
 *
 * Three ways to change the delivery point, in rising order of effort:
 *   - DRAG the map. The pin is fixed to the centre, so the map moving under it
 *     is the pin moving; wherever it settles is reported through
 *     `onPointChange` and offered for confirmation. Nothing is saved by a
 *     gesture alone — a pan is not an instruction.
 *   - TAP the map. Opens the full-screen picker, which has search and
 *     locate-me, for a point that is not a small nudge away.
 *   - TAP THE LABEL ROW. Switches between saved addresses, which is a
 *     different question from where the pin sits.
 *
 * The map is UNCONTROLLED (`initialRegion` plus ref animations), because a
 * controlled `region` prop fights the gesture that is being made — the same
 * reason `NativeMapView` documents. Keeping the props and the camera in step is
 * therefore this component's job: see `syncToProps` below.
 */

/** Zoom of the inline map. Tight enough to see a street, wide enough to orient. */
const CARD_DELTA = 0.006;

interface PendingPoint {
  /** The resolved label, or `null` while it is still being looked up. */
  text: string | null;
  isResolving: boolean;
  /** The confirmation is in flight — the point is being written to the record. */
  isSaving: boolean;
}

interface DeliveryLocationCardProps {
  addressLabel: string;
  addressText: string;
  latitude?: number;
  longitude?: number;
  /** The label row — switch to another saved address. */
  onPress?: () => void;
  /** A tap on the map — open the full-screen picker. */
  onOpenMap?: () => void;
  /** The map settled somewhere new after a drag. */
  onPointChange?: (coords: LocationCoords) => void;
  /**
   * Set while the pin sits somewhere other than the saved address. Its
   * presence is what shows the confirm row — the card holds no such state of
   * its own, so the screen and the card can never disagree about whether there
   * is something to save.
   */
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
  const mapRef = useRef<MapView | null>(null);
  // The centre the map itself last reported. Compared against incoming props so
  // the camera is only driven when the change came from OUTSIDE the map — a
  // saved address being switched, or a pending point cancelled. Animating in
  // response to the map's own drag would yank it back under the finger.
  const lastCenterRef = useRef<LocationCoords | null>(null);

  const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number';

  useEffect(() => {
    if (!hasCoordinates) return;
    const target = { latitude: latitude!, longitude: longitude! };
    if (!coordinatesDiffer(target, lastCenterRef.current)) return;

    lastCenterRef.current = target;
    mapRef.current?.animateToRegion(
      { ...target, latitudeDelta: CARD_DELTA, longitudeDelta: CARD_DELTA },
      350
    );
  }, [hasCoordinates, latitude, longitude]);

  const handleRegionChangeComplete = (region: Region) => {
    const coords = { latitude: region.latitude, longitude: region.longitude };
    lastCenterRef.current = coords;
    onPointChange?.(coords);
  };

  const bubbleText = pending ? (pending.text ?? '') : addressText;

  const renderMap = () => {
    // An address with no coordinates cannot be delivered to and cannot seed a
    // map either — `initialRegion` has to be right at mount. Offer the picker
    // instead of a map centred on a guess.
    if (!hasCoordinates) {
      return (
        <TouchableOpacity
          style={styles.mapFallback}
          onPress={onOpenMap}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Pin this address on the map"
        >
          <MapPin size={22} color={Palette.primary} />
          <Text style={styles.mapFallbackText}>
            Pin this address on the map so a driver can find it
          </Text>
        </TouchableOpacity>
      );
    }

    if (Platform.OS === 'web') {
      return <View style={styles.mapPlaceholder} />;
    }

    // Required lazily for the same reason the screens do it: `react-native-maps`
    // has no web build, and importing it at module scope would break every
    // consumer of this card there.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeMapView } = require('@/components/location/map-view-native');

    return (
      <NativeMapView
        mapRef={mapRef}
        initialRegion={{
          latitude: latitude!,
          longitude: longitude!,
          latitudeDelta: CARD_DELTA,
          longitudeDelta: CARD_DELTA,
        }}
        addressText={bubbleText}
        isLoadingAddress={!!pending?.isResolving}
        onRegionChangeComplete={handleRegionChangeComplete}
        // A tap means "open the big map"; dragging keeps working in place.
        onPress={onOpenMap}
        // No blue dot: it would ask for location permission the moment this
        // checkout screen opens, which is not a question to spring on someone
        // mid-order. The picker still offers locate-me.
        showsUserLocation={false}
      />
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.mapContainer}>
        {renderMap()}

        {hasCoordinates && onOpenMap ? (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={onOpenMap}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open the full map"
          >
            <Maximize2 size={16} color={Palette.ink} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/*
        The confirm row, shown only once the pin has actually been moved. The
        point is written to the customer record — the backend delivers to that
        and nothing else — so it takes an explicit tap, never a gesture.
      */}
      {pending ? (
        <View style={styles.pendingRow}>
          <View style={styles.pendingTextGroup}>
            <Text style={styles.pendingTitle}>Deliver to this point?</Text>
            <Text style={styles.pendingText} numberOfLines={1}>
              {pending.isResolving || !pending.text ? 'Locating…' : pending.text}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onCancelPending}
            disabled={pending.isSaving}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Keep the saved address"
          >
            <Text style={[styles.pendingCancel, pending.isSaving && styles.pendingDisabled]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pendingConfirm, pending.isSaving && styles.pendingDisabled]}
            onPress={onConfirmPending}
            disabled={pending.isSaving || pending.isResolving}
            accessibilityRole="button"
            accessibilityLabel="Deliver to this point"
          >
            {pending.isSaving ? (
              <ActivityIndicator size="small" color={Palette.textInverse} />
            ) : (
              <Text style={styles.pendingConfirmText}>Deliver here</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity style={styles.labelRow} onPress={onPress} activeOpacity={0.7}>
        <MapPin size={16} color={Palette.ink} />
        <View style={styles.labelTextGroup}>
          <Text style={styles.labelText}>{addressLabel}</Text>
          <Text style={styles.labelAddress} numberOfLines={1}>
            {addressText}
          </Text>
        </View>
        <ChevronRight size={18} color={Palette.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Palette.borderSubtle,
  },
  mapContainer: {
    height: 160,
    backgroundColor: Palette.surfaceMuted,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: Palette.surfaceAlt,
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: Palette.primarySoft,
  },
  mapFallbackText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    color: Palette.ink,
    textAlign: 'center',
  },
  expandButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.primarySoft,
  },
  pendingTextGroup: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.ink,
  },
  pendingText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textSecondary,
  },
  pendingCancel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.textMuted,
  },
  pendingConfirm: {
    minWidth: 96,
    alignItems: 'center',
    backgroundColor: Palette.ink,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  pendingConfirmText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
  pendingDisabled: {
    opacity: 0.6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
  },
  labelTextGroup: {
    flex: 1,
  },
  labelText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.ink,
  },
  labelAddress: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
});
