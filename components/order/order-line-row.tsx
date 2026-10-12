import { View } from 'react-native';
import { Text } from '@/components/ds';
import type { CustomerOrderLine } from '@/services/api/order-list-view-model';
import { createStyles } from '@/theme';

/** One ordered dish: `2× Crispy Chicken`, its line total and unit price. */
export function OrderLineRow({
  line,
  total,
  unit,
}: {
  line: CustomerOrderLine;
  /** Formatted line total; absent when nothing prices the line. */
  total?: string;
  /** Formatted unit price, shown under the name when the quantity is > 1. */
  unit?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="itemLabel" numberOfLines={2}>
          <Text variant="itemTitle">{`${line.quantity}× `}</Text>
          {line.name}
        </Text>
        {unit && line.quantity > 1 ? (
          <Text variant="caption" color="inkMuted" tabular>{`${unit} each`}</Text>
        ) : null}
      </View>
      {total ? <Text variant="price">{total}</Text> : null}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space[12], paddingVertical: t.space[10] },
}));
