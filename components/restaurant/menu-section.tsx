import { View, Text, StyleSheet } from 'react-native';
import { ProductCard } from './product-card';

interface Product {
  id: string;
  name: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  rating?: string;
  reviewCount?: string;
  image: any;
}

interface MenuSectionProps {
  title: string;
  products: Product[];
  onProductPress?: (productId: string) => void;
}

export function MenuSection({ title, products, onProductPress }: MenuSectionProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.productsGrid}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            {...product}
            onPress={() => onProductPress?.(product.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A2B3D',
    marginBottom: 16,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
