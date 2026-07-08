import { FavoriteCard, FavoritesEmpty } from "@/components/favorites";
import { Fonts, FontSize, Palette, Spacing } from "@/constants/theme";
import {
  type FavoriteItem,
  useFavoritesStore,
} from "@/store/favorites-store";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const items = useFavoritesStore((s) => s.items);
  const remove = useFavoritesStore((s) => s.remove);

  const restaurants = items.filter((i) => i.type === "restaurant");
  const foods = items.filter((i) => i.type === "food");

  const openItem = (item: FavoriteItem) => {
    if (item.type === "restaurant") {
      router.push(`/restaurant/${item.id}`);
    } else {
      router.push(`/food/${item.id}`);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.header}>Favorites</Text>

      {items.length === 0 ? (
        <FavoritesEmpty onBrowse={() => router.replace("/(tabs)")} />
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {restaurants.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Restaurants</Text>
              {restaurants.map((item) => (
                <FavoriteCard
                  key={`restaurant:${item.id}`}
                  item={item}
                  onPress={() => openItem(item)}
                  onRemove={() => remove("restaurant", item.id)}
                />
              ))}
            </View>
          )}

          {foods.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dishes</Text>
              {foods.map((item) => (
                <FavoriteCard
                  key={`food:${item.id}`}
                  item={item}
                  onPress={() => openItem(item)}
                  onRemove={() => remove("food", item.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    fontSize: FontSize.display,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.textSecondary,
  },
});
