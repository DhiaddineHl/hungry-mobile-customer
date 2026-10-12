import { View } from 'react-native';
import { Text } from '@/components/ds';
import { ORDER_PROGRESS_STEPS, ORDER_STEP_COUNT } from '@/services/api/order-list-view-model';
import { createStyles, Icon, useTheme, type IconName } from '@/theme';

const STEP_ICONS: IconName[] = ['receipt', 'check', 'preparing', 'delivery', 'delivered'];

/**
 * ProgressSteps (design system §6): the current step named in words with
 * `Step 3 of 5`, five 4 pt segments (done/current orange, upcoming sunken)
 * and the icon row — receipt, check, chef hat, motorbike, package.
 *
 * `step` is how many stages are done (0–5), straight from the backend's two
 * statuses (`orderProgressStep`); nothing is inferred from elapsed time.
 */
export function OrderProgress({ step, statusLabel }: { step: number; statusLabel: string }) {
  const styles = useStyles();
  const { opacity } = useTheme();
  const shown = Math.max(1, Math.min(step, ORDER_STEP_COUNT));
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${statusLabel}. Step ${shown} of ${ORDER_STEP_COUNT}`}
      accessibilityValue={{ min: 0, max: ORDER_STEP_COUNT, now: step }}
    >
      <View style={styles.labels}>
        <Text variant="itemTitle" numberOfLines={1} style={styles.flex}>
          {statusLabel}
        </Text>
        <Text variant="meta" color="inkMuted" tabular>{`Step ${shown} of ${ORDER_STEP_COUNT}`}</Text>
      </View>
      <View style={styles.segments}>
        {ORDER_PROGRESS_STEPS.map((name, i) => (
          <View key={name} style={[styles.segment, i < step && styles.segmentDone]} />
        ))}
      </View>
      <View style={styles.icons}>
        {STEP_ICONS.map((icon, i) => (
          <View key={icon} style={[styles.iconCell, i >= step && { opacity: opacity.upcomingStep }]}>
            <Icon name={icon} size="row" color={i < step ? 'ink' : 'inkMuted'} />
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  wrap: { gap: t.space[10] },
  labels: { flexDirection: 'row', alignItems: 'center', gap: t.space[12] },
  segments: { flexDirection: 'row', gap: t.space[4] },
  segment: { flex: 1, height: t.size.progressSegment, borderRadius: 2, backgroundColor: t.colors.surfaceSunken },
  segmentDone: { backgroundColor: t.colors.primary },
  icons: { flexDirection: 'row' },
  iconCell: { flex: 1, alignItems: 'center' },
}));
