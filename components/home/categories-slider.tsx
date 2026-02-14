import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

const CATEGORIES = [
  { id: '1', name: 'Pizza', icon: require('@/assets/categories-icons/Mekla_1.svg') },
  { id: '2', name: 'Burger', icon: require('@/assets/categories-icons/Mekla_2.svg') },
  { id: '3', name: 'Grill', icon: require('@/assets/categories-icons/Mekla_3.svg') },
  { id: '4', name: 'Tunisian', icon: require('@/assets/categories-icons/Mekla_4.svg') },
  { id: '5', name: 'Salad', icon: require('@/assets/categories-icons/Mekla_5.svg') },
  { id: '6', name: 'Pasta', icon: require('@/assets/categories-icons/Mekla_6.svg') },
  { id: '7', name: 'Sushi', icon: require('@/assets/categories-icons/Mekla_7.svg') },
  { id: '8', name: 'Dessert', icon: require('@/assets/categories-icons/Mekla_8.svg') },
  { id: '9', name: 'Drinks', icon: require('@/assets/categories-icons/Mekla_9.svg') },
  { id: '10', name: 'Chicken', icon: require('@/assets/categories-icons/Mekla_10.svg') },
  { id: '11', name: 'Seafood', icon: require('@/assets/categories-icons/Mekla_11.svg') },
  { id: '12', name: 'Sandwich', icon: require('@/assets/categories-icons/Mekla_12.svg') },
];

interface CategoriesSliderProps {
  onCategoryPress?: (categoryId: string) => void;
  onSeeAllPress?: () => void;
}

export function CategoriesSlider({ onCategoryPress, onSeeAllPress }: CategoriesSliderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Categories</Text>
        <TouchableOpacity style={styles.seeAllButton} onPress={onSeeAllPress}>
          <Text style={styles.seeAllText}>See All</Text>
          <ChevronRight size={16} color="#F5A623" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryItem}
            onPress={() => onCategoryPress?.(category.id)}
          >
            <View style={styles.iconContainer}>
              <Image
                source={category.icon}
                style={styles.categoryIcon}
                contentFit="contain"
              />
            </View>
            <Text style={styles.categoryName}>{category.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    color: '#F5A623',
    fontFamily: Fonts.medium,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 20,
  },
  categoryItem: {
    alignItems: 'center',
    width: 72,
  },
  iconContainer: {
    width: 72,
    height: 72,
    marginBottom: 8,
  },
  categoryIcon: {
    width: '100%',
    height: '100%',
  },
  categoryName: {
    fontSize: 13,
    color: '#1A2B3D',
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
});
