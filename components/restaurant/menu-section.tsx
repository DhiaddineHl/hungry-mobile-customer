import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ProductCard } from './product-card';
import { Fonts } from '@/constants/theme';

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
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            {...product}
            onPress={() => onProductPress?.(product.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  row: {
    paddingHorizontal: 20,
    gap: 14,
  },
});
