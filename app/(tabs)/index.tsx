import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HomeHeader,
  SearchBar,
  CategoriesSlider,
  FiltersSlider,
  PopularRestaurants,
  OpenRestaurants,
} from '@/components/home';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const handleLocationPress = () => {
    console.log('Location pressed');
  };

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
    console.log('Popular restaurant pressed:', restaurantId);
  };

  const handleRestaurantPress = (restaurantId: string) => {
    console.log('Restaurant pressed:', restaurantId);
  };

  const handleSeeAllRestaurants = () => {
    console.log('See all restaurants');
  };

  const handleFavoritePress = (restaurantId: string) => {
    console.log('Favorite pressed:', restaurantId);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <HomeHeader
        deliveryLocation="Home"
        notificationCount={2}
        onLocationPress={handleLocationPress}
        onNotificationPress={handleNotificationPress}
      />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <SearchBar
          placeholder="Search the menu"
          onChangeText={handleSearch}
        />
        <CategoriesSlider
          onCategoryPress={handleCategoryPress}
          onSeeAllPress={handleSeeAllCategories}
        />
        <FiltersSlider
          selectedFilters={selectedFilters}
          onFilterPress={handleFilterPress}
        />
        <PopularRestaurants
          onRestaurantPress={handlePopularRestaurantPress}
        />
        <OpenRestaurants
          onRestaurantPress={handleRestaurantPress}
          onSeeAllPress={handleSeeAllRestaurants}
          onFavoritePress={handleFavoritePress}
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
