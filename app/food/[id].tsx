import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AddonGroup,
  FoodHeader,
  SpecialInstructions,
  AddToCartBar,
  FrequentlyBoughtTogether,
} from '@/components/food';
import type { AddonGroupData } from '@/components/food';

const FOOD_DATA: Record<string, {
  id: string;
  name: string;
  price: number;
  originalPrice?: string;
  discount?: string;
  description?: string;
  rating?: string;
  reviewCount?: string;
  image: ReturnType<typeof require>;
  addonGroups: AddonGroupData[];
}> = {
  c1: {
    id: 'c1',
    name: 'Crispy Chicken',
    price: 9.68,
    originalPrice: '12,9 DT',
    discount: '-25%',
    description: 'Breaded chicken escalope, bell peppers, caramelized onion, fries, cheddar sauce, choice sauce',
    rating: '76%',
    reviewCount: '22',
    image: require('@/assets/products/product-2.png'),
    addonGroups: [
      {
        id: 'extras',
        title: 'Something Extra',
        subtitle: 'Choose up to 6',
        type: 'checkbox',
        required: false,
        maxSelect: 6,
        options: [
          { id: 'egg', name: 'Egg', price: '+1 DT', isPopular: true },
          { id: 'mushrooms', name: 'Mushrooms', price: '+3,5 DT' },
          { id: 'ham', name: 'Ham', price: '+1,5 DT' },
          { id: 'cheddar_sauce', name: 'Cheddar Cheese Sauce', price: '+2 DT' },
          { id: 'cheddar_slice', name: 'Cheddar Fromage Slice', price: '+1 DT' },
          { id: 'but', name: 'But', price: '+1 DT' },
        ],
      },
      {
        id: 'sauce',
        title: 'Add some sauce',
        subtitle: 'Choose up to 3',
        type: 'checkbox',
        required: true,
        maxSelect: 3,
        options: [
          { id: 'bbq', name: 'BBQ sauce', isPopular: true },
          { id: 'garlic', name: 'Garlic sauce' },
          { id: 'harissa', name: 'Harissa' },
          { id: 'ketchup', name: 'Ketchup' },
          { id: 'mayo', name: 'Mayonnaise' },
        ],
      },
      {
        id: 'size',
        title: 'Choose crispy chicken size',
        subtitle: 'Choose up to 1',
        type: 'radio',
        required: true,
        maxSelect: 1,
        options: [
          { id: 'maxi', name: 'Maxi crispy chicken', price: '+4,2 DT' },
          { id: 'normal', name: 'Normal' },
        ],
      },
    ],
  },
};

const DEFAULT_FOOD = FOOD_DATA['c1'];

const FREQUENTLY_BOUGHT = [
  {
    id: 'fb1',
    name: 'Boga - Lim (24Cl) Canette',
    price: '2,7 DT',
    image: require('@/assets/products/product-5.png'),
    isPopular: true,
  },
  {
    id: 'fb2',
    name: 'Nuggets (12 pcs)',
    description: '12 pieces of nuggets',
    price: '12,9 DT',
    image: require('@/assets/products/product-4.png'),
  },
  {
    id: 'fb3',
    name: 'Nuggets (12 pcs)',
    description: '12 pieces of nuggets',
    price: '12,9 DT',
    image: require('@/assets/products/prodcut-3.png'),
  },
];

export default function FoodDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const food = FOOD_DATA[id] ?? DEFAULT_FOOD;

  const [quantity, setQuantity] = useState(1);
  const [specialNote, setSpecialNote] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [validated, setValidated] = useState(false);

  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    food.addonGroups.forEach((g) => { initial[g.id] = []; });
    return initial;
  });

  const handleToggle = useCallback((groupId: string, optionId: string) => {
    setSelections((prev) => {
      const group = food.addonGroups.find((g) => g.id === groupId);
      if (!group) return prev;
      const current = prev[groupId] ?? [];

      if (group.type === 'radio') {
        return { ...prev, [groupId]: [optionId] };
      }

      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }

      if (group.maxSelect && current.length >= group.maxSelect) {
        return prev;
      }

      return { ...prev, [groupId]: [...current, optionId] };
    });
  }, [food.addonGroups]);

  const requiredGroups = food.addonGroups.filter((g) => g.required);
  const allRequiredSatisfied = requiredGroups.every((g) => {
    const sel = selections[g.id] ?? [];
    return sel.length > 0;
  });

  const basePrice = food.price;
  const addonsPrice = food.addonGroups.reduce((total, group) => {
    const sel = selections[group.id] ?? [];
    return total + group.options
      .filter((opt) => sel.includes(opt.id))
      .reduce((sum, opt) => {
        if (!opt.price) return sum;
        const match = opt.price.match(/[\d,]+/);
        if (!match) return sum;
        return sum + parseFloat(match[0].replace(',', '.'));
      }, 0);
  }, 0);

  const totalPrice = ((basePrice + addonsPrice) * quantity).toFixed(2).replace('.', ',') + ' DT';

  const handleAddToCart = () => {
    setValidated(true);
    if (!allRequiredSatisfied) return;
    console.log('Add to cart:', { foodId: food.id, quantity, selections, specialNote });
    router.back();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <FoodHeader
          name={food.name}
          price={basePrice.toFixed(2).replace('.', ',') + ' DT'}
          originalPrice={food.originalPrice}
          discount={food.discount}
          description={food.description}
          rating={food.rating}
          reviewCount={food.reviewCount}
          image={food.image}
          isFavorite={isFavorite}
          onBack={() => router.back()}
          onFavorite={() => setIsFavorite((v) => !v)}
        />

        {food.addonGroups.map((group) => (
          <AddonGroup
            key={group.id}
            group={group}
            selectedIds={selections[group.id] ?? []}
            isValidated={validated}
            onToggle={handleToggle}
          />
        ))}

        <SpecialInstructions value={specialNote} onChangeText={setSpecialNote} />

        <FrequentlyBoughtTogether items={FREQUENTLY_BOUGHT} />

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <AddToCartBar
        quantity={quantity}
        total={totalPrice}
        onDecrement={() => setQuantity((q) => Math.max(1, q - 1))}
        onIncrement={() => setQuantity((q) => q + 1)}
        onAddToCart={handleAddToCart}
      />

      {validated && !allRequiredSatisfied && (
        <View style={styles.validationBanner}>
          {requiredGroups
            .filter((g) => (selections[g.id] ?? []).length === 0)
            .slice(0, 1)
            .map((g) => (
              <View key={g.id} />
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  bottomSpacer: {
    height: 20,
  },
  validationBanner: {
    position: 'absolute',
    bottom: 0,
  },
});
