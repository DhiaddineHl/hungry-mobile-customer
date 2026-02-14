import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeHeader, SearchBar, CategoriesSlider } from '@/components/home';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

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
      >
        <SearchBar
          placeholder="Search the menu"
          onChangeText={handleSearch}
        />
        <CategoriesSlider
          onCategoryPress={handleCategoryPress}
          onSeeAllPress={handleSeeAllCategories}
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
});
