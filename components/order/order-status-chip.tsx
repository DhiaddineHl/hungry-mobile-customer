import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { orderStatusLabel } from '@/services/api/order-list-view-model';
import type { OrderStatus } from '@/schemas/order';
import { CircleAlert, CircleX, Clock, PackageCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

/**
 * The pill that says where an order stands, straight from the backend status.
 *
 * Four looks, one per kind of truth: handed to the driver (green), cancelled
 * (red), a status the app cannot read (neutral grey), and in progress (brand).
 * An unknown status is never dressed as progress — see `orderStatusLabel`.
 */

interface OrderStatusChipProps {
  status: OrderStatus | null;
  /** Uses the short label, for tight rows like the completed card. */
  compact?: boolean;
}

export function OrderStatusChip({ status, compact = false }: OrderStatusChipProps) {
  const label = orderStatusLabel(status, compact);

  const tone =
    status === 'READY'
      ? 'success'
      : status === 'CANCELLED'
        ? 'danger'
        : !status
          ? 'muted'
          : 'brand';

  const Icon =
    tone === 'success'
      ? PackageCheck
      : tone === 'danger'
        ? CircleX
        : tone === 'muted'
          ? CircleAlert
          : Clock;

  const color = TONE_COLORS[tone];

  return (
    <View style={[styles.chip, { backgroundColor: TONE_BACKGROUNDS[tone] }]}>
      <Icon size={14} color={color} />
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const TONE_COLORS = {
  success: Palette.success,
  danger: Palette.danger,
  muted: Palette.textMuted,
  brand: Palette.primaryDark,
} as const;

const TONE_BACKGROUNDS = {
  success: Palette.successSoft,
  danger: Palette.dangerSoft,
  muted: Palette.surfaceMuted,
  brand: Palette.primarySoft,
} as const;

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  label: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
});
