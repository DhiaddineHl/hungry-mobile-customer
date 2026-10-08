import type React from 'react';
import { ScrollView, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import { Text, Touchable } from '@/components/ds';
import { createStyles } from '@/theme';
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

export interface Category {
  id: string;
  name: string;
  /** Matched (case-insensitively) against a restaurant's cuisines. */
  match: string;
  Icon: React.FC<SvgProps>;
}

export const CATEGORIES: Category[] = [
  { id: 'pizza', name: 'Pizza', match: 'pizza', Icon: Mekla1 },
  { id: 'burger', name: 'Burger', match: 'burger', Icon: Mekla2 },
  { id: 'grill', name: 'Grill', match: 'grill', Icon: Mekla3 },
  { id: 'tunisian', name: 'Tunisian', match: 'tunis', Icon: Mekla4 },
  { id: 'salads', name: 'Salads', match: 'salad', Icon: Mekla5 },
  { id: 'pasta', name: 'Pasta', match: 'pasta', Icon: Mekla6 },
  { id: 'sushi', name: 'Sushi', match: 'sushi', Icon: Mekla7 },
  { id: 'dessert', name: 'Dessert', match: 'dessert', Icon: Mekla8 },
  { id: 'drinks', name: 'Drinks', match: 'drink', Icon: Mekla9 },
  { id: 'chicken', name: 'Chicken', match: 'chicken', Icon: Mekla10 },
  { id: 'seafood', name: 'Seafood', match: 'sea', Icon: Mekla11 },
  { id: 'sandwich', name: 'Sandwiches', match: 'sandwich', Icon: Mekla12 },
];

/**
 * Category tiles (57×86): illustration over a label. The selected one's label
 * turns orange — a signal, not an action. Tapping it again clears it.
 */
export function CategoriesSlider({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {CATEGORIES.map((category) => {
        const selected = category.id === selectedId;
        return (
          <Touchable
            key={category.id}
            onPress={() => onSelect(selected ? null : category.id)}
            accessibilityState={{ selected }}
            accessibilityLabel={category.name}
            style={styles.tile}
          >
            <View style={styles.art}>
              <category.Icon width={54} height={48} />
            </View>
            <Text variant="caption" color={selected ? 'primary' : 'ink'} numberOfLines={1} style={styles.label}>
              {category.name}
            </Text>
          </Touchable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  rail: { paddingHorizontal: t.screenPadding, gap: t.space[6] },
  tile: { width: t.size.categoryTile.w + 6, height: t.size.categoryTile.h, alignItems: 'center', gap: t.space[8] },
  art: { width: t.size.categoryTile.w, height: t.size.categoryTile.w, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: t.typography.label.fontFamily },
}));
