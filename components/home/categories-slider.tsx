import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { SvgProps } from 'react-native-svg';
import Mekla1 from '@/assets/categories-icons/Mekla_1.svg';
import Mekla2 from '@/assets/categories-icons/Mekla_2.svg';
import Mekla3 from '@/assets/categories-icons/Mekla_3.svg';
import Mekla4 from '@/assets/categories-icons/Mekla_4.svg';
import Mekla5 from '@/assets/categories-icons/Mekla_5.svg';
import Mekla6 from '@/assets/categories-icons/Mekla_6.svg';
import Mekla7 from '@/assets/categories-icons/Mekla_7.svg';
import Mekla8 from '@/assets/categories-icons/Mekla_8.svg';
import Mekla9 from '@/assets/categories-icons/Mekla_9.svg';
import Mekla10 from '@/assets/categories-icons/Mekla_10.svg';
import Mekla11 from '@/assets/categories-icons/Mekla_11.svg';
import Mekla12 from '@/assets/categories-icons/Mekla_12.svg';
import React from 'react';

const CATEGORIES: { id: string; name: string; Icon: React.FC<SvgProps> }[] = [
  { id: '1', name: 'Pizza', Icon: Mekla1 },
  { id: '2', name: 'Burger', Icon: Mekla2 },
  { id: '3', name: 'Grill', Icon: Mekla3 },
  { id: '4', name: 'Tunisian', Icon: Mekla4 },
  { id: '5', name: 'Salad', Icon: Mekla5 },
  { id: '6', name: 'Pasta', Icon: Mekla6 },
  { id: '7', name: 'Sushi', Icon: Mekla7 },
  { id: '8', name: 'Dessert', Icon: Mekla8 },
  { id: '9', name: 'Drinks', Icon: Mekla9 },
  { id: '10', name: 'Chicken', Icon: Mekla10 },
  { id: '11', name: 'Seafood', Icon: Mekla11 },
  { id: '12', name: 'Sandwich', Icon: Mekla12 },
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
              <category.Icon width={72} height={72} />
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
  categoryName: {
    fontSize: 13,
    color: '#1A2B3D',
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
});
