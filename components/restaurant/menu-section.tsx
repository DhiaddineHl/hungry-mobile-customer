import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ProductCard, type ProductImage } from './product-card';
import { Fonts, FontSize, Palette, Spacing } from '@/constants/theme';
import type { MenuProduct } from '@/services/api/product-view-model';

interface MenuSectionProps {
  /** "" for the trailing group of uncategorised products — no heading is drawn. */
  title: string;
  products: MenuProduct[];
  /**
   * A product's artwork, or `undefined` while it is still resolving or when
   * the product has none — the card then draws its placeholder. Passed as a
   * lookup rather than baked into `MenuProduct` because artwork is a separate
   * request per dish (see `useProductImageSources`), so it arrives after the
   * menu itself and must not force the view model to re-map when it does.
   */
  imageFor?: (productId: string) => ProductImage | undefined;
  onProductPress?: (productId: string) => void;
}

/**
 * One menu section, taking the view model directly rather than a hand-shaped
 * product object: `price` arrives as an `AppliedPrice | null`, and unpacking
 * it here keeps every screen from repeating the null handling.
 */
export function MenuSection({
  title,
  products,
  imageFor,
  onProductPress,
}: MenuSectionProps) {
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
            image={imageFor?.(product.id)}
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
