import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import type { CustomerOrderLine } from '@/services/api/order-list-view-model';
import { StyleSheet, Text, View } from 'react-native';

/**
 * One line of an order: what was ordered, how many, and — when it can be
 * priced — what it cost.
 *
 * The price does NOT come from the line: `OrderItem` has no price column. It is
 * passed in already resolved and already formatted by whoever knows where it
 * came from (`priceOrder`), so this component cannot accidentally present a
 * menu price as a receipt. A line with no price simply shows none, because the
 * alternative is inventing one.
 *
 * Still absent for the same reason as before: the addons the customer picked
 * (`OrderedProductAttributeDirectBasePopulator` never persists them) and the
 * per-line note (`comment` is per-order).
 */

interface OrderLineRowProps {
  line: CustomerOrderLine;
  /** `unit × quantity`, formatted. Omitted when the line cannot be priced. */
  total?: string;
  /** The per-unit price, shown only when it is not simply the total again. */
  unit?: string;
}

export function OrderLineRow({ line, total, unit }: OrderLineRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.quantityChip}>
        <Text style={styles.quantityText}>{line.quantity}x</Text>
      </View>

      <View style={styles.nameGroup}>
        <Text style={styles.name} numberOfLines={2}>
          {line.name}
        </Text>
        {/* "2 × 9,68 DT" — the arithmetic behind the figure on the right. */}
        {unit && line.quantity > 1 ? (
          <Text style={styles.unit}>
            {line.quantity} × {unit}
          </Text>
        ) : null}
      </View>

      {total ? <Text style={styles.total}>{total}</Text> : null}
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
  nameGroup: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.medium,
    color: Palette.textPrimary,
  },
  unit: {
    marginTop: 2,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
  total: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
  },
});
