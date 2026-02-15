import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

interface SuggestedItem {
  id: string;
  name: string;
  description?: string;
  price: string;
  image: any;
  isPopular?: boolean;
}

interface SuggestedItemsProps {
  title: string;
  items: SuggestedItem[];
  onAddItem?: (itemId: string) => void;
}

export function SuggestedItems({ title, items, onAddItem }: SuggestedItemsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.imageContainer}>
              <Image source={item.image} style={styles.image} contentFit="cover" />
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => onAddItem?.(item.id)}
              >
                <Plus size={16} color="#1A2B3D" />
              </TouchableOpacity>
            </View>
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
            {item.description && (
              <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
            )}
            <View style={styles.priceRow}>
              <Text style={styles.price}>{item.price}</Text>
              {item.isPopular && (
                <Text style={styles.popularTag}>Popular</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    width: 140,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  image: {
    width: 140,
    height: 100,
    borderRadius: 12,
  },
  addButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  name: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
    marginBottom: 2,
    lineHeight: 18,
  },
  description: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#F5A623',
  },
  popularTag: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#F5A623',
  },
});
