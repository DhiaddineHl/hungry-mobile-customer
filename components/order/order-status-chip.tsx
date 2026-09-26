import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import {
  orderStage,
  orderStatusLabel,
  type CustomerOrder,
  type OrderStage,
} from '@/services/api/order-list-view-model';
import { Bike, CircleAlert, CircleCheck, CircleX, Clock, PackageCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

/**
 * The pill that says where an order stands, from its order AND delivery
 * status (`orderStage`).
 *
 * Four looks, one per kind of truth: delivered or closed (green), declined,
 * cancelled or not delivered (red), a status the app cannot read (neutral
 * grey), and in progress (brand — a bike once the driver has it). An unknown
 * status is never dressed as progress — see `orderStatusLabel`.
 */

type Tone = 'success' | 'danger' | 'muted' | 'brand';

const STAGE_TONES: Record<OrderStage, Tone> = {
  PLACED: 'brand',
  CONFIRMED: 'brand',
  PREPARING: 'brand',
  READY: 'brand',
  ON_THE_WAY: 'brand',
  DELIVERED: 'success',
  COMPLETED: 'success',
  DELIVERY_FAILED: 'danger',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  UNKNOWN: 'muted',
};

interface OrderStatusChipProps {
  order: Pick<CustomerOrder, 'status' | 'deliveryStatus' | 'createdAt'>;
  /** Uses the short label, for tight rows like the completed card. */
  compact?: boolean;
}

export function OrderStatusChip({ order, compact = false }: OrderStatusChipProps) {
  const stage = orderStage(order);
  const label = orderStatusLabel(order, compact);
  const tone = STAGE_TONES[stage];

  const Icon =
    stage === 'DELIVERED'
      ? PackageCheck
      : stage === 'ON_THE_WAY'
        ? Bike
        : tone === 'success'
          ? CircleCheck
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
