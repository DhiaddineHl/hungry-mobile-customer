import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import {
  ORDER_PROGRESS_STEPS,
  ORDER_STEP_COUNT,
} from '@/services/api/order-list-view-model';
import { Bike, ChefHat, CircleCheck, Receipt } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

/**
 * The four-stage bar on an active order: Placed → Confirmed → Preparing → On
 * the way.
 *
 * The stages ARE the four backend statuses an order moves through; nothing is
 * inferred from elapsed time and the customer app never advances one.
 * `orderProgressStep` in `order-list-view-model.ts` owns the mapping.
 */

const STEP_ICONS = [Receipt, CircleCheck, ChefHat, Bike];

interface OrderProgressProps {
  /** How many stages are done, 0–4. 0 renders every stage as pending. */
  step: number;
  /** The sentence above the bar, e.g. "Preparing your food…". */
  statusLabel: string;
}

export function OrderProgress({ step, statusLabel }: OrderProgressProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.status} numberOfLines={1}>
          {statusLabel}
        </Text>
        {step > 0 ? (
          <Text style={styles.stepCount}>
            Step {step} of {ORDER_STEP_COUNT}
          </Text>
        ) : null}
      </View>

      <View
        style={styles.bars}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: ORDER_STEP_COUNT, now: step }}
      >
        {ORDER_PROGRESS_STEPS.map((name, index) => (
          <View
            key={name}
            style={[styles.bar, index < step ? styles.barDone : styles.barPending]}
          />
        ))}
      </View>

      <View style={styles.icons}>
        {ORDER_PROGRESS_STEPS.map((name, index) => {
          const Icon = STEP_ICONS[index];
          const done = index < step;
          return (
            <View key={name} style={styles.iconSlot}>
              <Icon
                size={20}
                color={done ? Palette.primary : Palette.textPlaceholder}
                strokeWidth={done ? 2.2 : 2}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  status: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Palette.textPrimary,
  },
  stepCount: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.primary,
  },
  bars: {
    flexDirection: 'row',
    gap: 6,
  },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: Radius.pill,
  },
  barDone: {
    backgroundColor: Palette.primary,
  },
  barPending: {
    backgroundColor: Palette.surfaceMuted,
  },
  icons: {
    flexDirection: 'row',
  },
  iconSlot: {
    flex: 1,
    alignItems: 'center',
  },
});
