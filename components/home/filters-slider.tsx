import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ArrowUpDown } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

const FILTERS = [
  { id: '1', label: 'Promotions', hasIcon: false },
  { id: '2', label: 'Free Delivery', hasIcon: false },
  { id: '3', label: 'This Month Top', hasIcon: true },
  { id: '4', label: 'Rating 4.5+', hasIcon: false },
  { id: '5', label: 'Fast Delivery', hasIcon: false },
  { id: '6', label: 'New', hasIcon: false },
];

interface FiltersSliderProps {
  selectedFilters?: string[];
  onFilterPress?: (filterId: string) => void;
}

export function FiltersSlider({ selectedFilters = [], onFilterPress }: FiltersSliderProps) {
  const isSelected = (id: string) => selectedFilters.includes(id);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Filters</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterChip,
              isSelected(filter.id) && styles.filterChipSelected,
            ]}
            onPress={() => onFilterPress?.(filter.id)}
          >
            {filter.hasIcon && (
              <ArrowUpDown size={14} color={isSelected(filter.id) ? '#FFFFFF' : '#1A2B3D'} />
            )}
            <Text
              style={[
                styles.filterText,
                isSelected(filter.id) && styles.filterTextSelected,
              ]}
            >
              {filter.label}
            </Text>
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
  title: {
    fontSize: 20,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  filterChipSelected: {
    backgroundColor: '#F5A623',
    borderColor: '#F5A623',
  },
  filterText: {
    fontSize: 14,
    color: '#1A2B3D',
    fontFamily: Fonts.medium,
  },
  filterTextSelected: {
    color: '#FFFFFF',
  },
});
