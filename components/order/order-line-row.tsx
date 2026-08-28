import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import type { CustomerOrderLine } from '@/services/api/order-list-view-model';
import { StyleSheet, Text, View } from 'react-native';

/**
 * One line of an order, as the backend returns it: what was ordered and how
 * many.
 *
 * There is nothing else to show. `OrderItem` has no price column, the ordered
 * product's attributes come back without the addon the customer picked
 * (`OrderedProductAttributeDirectBasePopulator` never persists them), and the
 * per-line note was never stored — `comment` is per-order. Rendering any of
 * those would mean inventing them.
 */

interface OrderLineRowProps {
  line: CustomerOrderLine;
}

export function OrderLineRow({ line }: OrderLineRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.quantityChip}>
        <Text style={styles.quantityText}>{line.quantity}x</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {line.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  quantityChip: {
    minWidth: 36,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceMuted,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.textSecondary,
  },
  name: {
    flex: 1,
    fontSize: FontSize.lg,
    fontFamily: Fonts.medium,
    color: Palette.textPrimary,
  },
});
