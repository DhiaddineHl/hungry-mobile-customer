import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ProductCard } from './product-card';
import { Fonts, FontSize, Palette, Spacing } from '@/constants/theme';
import type { MenuProduct } from '@/services/api/product-view-model';

interface MenuSectionProps {
  /** "" for the trailing group of uncategorised products — no heading is drawn. */
  title: string;
  products: MenuProduct[];
  onProductPress?: (productId: string) => void;
}

/**
 * One menu section, taking the view model directly rather than a hand-shaped
 * product object: `price` arrives as an `AppliedPrice | null`, and unpacking
 * it here keeps every screen from repeating the null handling.
 */
export function MenuSection({ title, products, onProductPress }: MenuSectionProps) {
  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            // A null price leaves these undefined, which is what makes the
            // card render as unorderable.
            price={product.price?.formatted}
            originalPrice={product.price?.original}
            discount={product.price?.discountLabel}
            onPress={() => onProductPress?.(product.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
    marginBottom: 14,
    paddingHorizontal: Spacing.xl,
  },
  row: {
    paddingHorizontal: Spacing.xl,
    gap: 14,
  },
});
