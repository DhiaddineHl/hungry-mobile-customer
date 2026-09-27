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
import { selectUnreadCount, useNotificationStore } from '@/store/notification-store';

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

  // Unread rows in the device inbox; the notifications screen clears them.
  const unreadNotifications = useNotificationStore(selectUnreadCount);

  const handleNotificationPress = () => {
    router.push('/notifications');
  };

  // The home search bar is an entry point, not its own input: tapping it opens the
  // dedicated results screen (its own field, auto-focused), which is where a query
  // actually runs — see app/search-results.tsx.
  const handleSearchFocus = () => {
    router.push('/search-results');
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
        notificationCount={unreadNotifications}
        onNotificationPress={handleNotificationPress}
      />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <SearchBar placeholder="Search restaurants or dishes" onFocus={handleSearchFocus} />
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
