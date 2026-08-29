import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  HomeHeader,
  SearchBar,
  CategoriesSlider,
  FiltersSlider,
  PopularRestaurants,
  OpenRestaurants,
} from '@/components/home';
import { useRestaurants } from '@/hooks/use-restaurants';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  // The home screen owns the restaurant query; both sections below are
  // presentational and read from this one cache entry.
  const {
    data: restaurants,
    isPending,
    error,
    refetch,
  } = useRestaurants({ sort: 'name' });

  const handleNotificationPress = () => {
    console.log('Notification pressed');
  };

  const handleSearch = (text: string) => {
    console.log('Search:', text);
  };

  const handleCategoryPress = (categoryId: string) => {
    console.log('Category pressed:', categoryId);
  };

  const handleSeeAllCategories = () => {
    console.log('See all categories');
  };

  const handleFilterPress = (filterId: string) => {
    setSelectedFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((id) => id !== filterId)
        : [...prev, filterId]
    );
  };

  const handlePopularRestaurantPress = (restaurantId: string) => {
    router.push(`/restaurant/${restaurantId}`);
  };

  const handleRestaurantPress = (restaurantId: string) => {
    router.push(`/restaurant/${restaurantId}`);
  };

  const handleSeeAllRestaurants = () => {
    console.log('See all restaurants');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <HomeHeader
        notificationCount={2}
        onNotificationPress={handleNotificationPress}
      />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <SearchBar placeholder="Search the menu" onChangeText={handleSearch} />
        <CategoriesSlider
          onCategoryPress={handleCategoryPress}
          onSeeAllPress={handleSeeAllCategories}
        />
        <FiltersSlider
          selectedFilters={selectedFilters}
          onFilterPress={handleFilterPress}
        />
        <PopularRestaurants
          restaurants={restaurants ?? []}
          isLoading={isPending}
          error={error}
          onRetry={refetch}
          onRestaurantPress={handlePopularRestaurantPress}
        />
        <OpenRestaurants
          restaurants={restaurants ?? []}
          isLoading={isPending}
          error={error}
          onRetry={refetch}
          onRestaurantPress={handleRestaurantPress}
          onSeeAllPress={handleSeeAllRestaurants}
        />
      </ScrollView>
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
    paddingBottom: 20,
  },
});
