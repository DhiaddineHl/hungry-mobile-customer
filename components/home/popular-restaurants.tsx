import { PressableScale } from "@/components/ui/pressable-scale";
import { QueryError } from "@/components/ui/query-state";
import { Fonts, FontSize, Palette, Radius, Spacing } from "@/constants/theme";
import { useRestaurantImageSource } from "@/hooks/use-restaurant-image";
import type { RestaurantSummary } from "@/services/api/restaurant-view-model";
import { Image } from "expo-image";
import { ScrollView, StyleSheet, Text, View } from "react-native";

interface PopularRestaurantsProps {
  restaurants: RestaurantSummary[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRestaurantPress?: (restaurantId: string) => void;
}

/** How many restaurants the strip shows. */
const POPULAR_COUNT = 6;

function PopularSkeleton() {
  return (
    <View style={styles.scrollContent}>
      {Array.from({ length: 3 }, (_, index) => (
        <View key={index} style={styles.restaurantItem}>
          <View style={[styles.imageContainer, styles.skeletonBlock]} />
          <View style={styles.skeletonLine} />
        </View>
      ))}
    </View>
  );
}

export function PopularRestaurants({
  restaurants,
  isLoading = false,
  error,
  onRetry,
  onRestaurantPress,
}: PopularRestaurantsProps) {
  const imageSource = useRestaurantImageSource();

  // There is no popularity signal in the backend: no ratings, no order counts,
  // and no sortable field that stands in for either. This is simply the first
  // N of the same list — a placeholder ordering, NOT a popularity ranking.
  const popular = restaurants.slice(0, POPULAR_COUNT);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Popular</Text>
        <QueryError error={error} onRetry={onRetry} />
      </View>
    );
  }

  // Nothing to show and nothing loading: the Open Restaurants section below
  // already carries the empty state, so this strip just steps aside.
  if (!isLoading && popular.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Popular</Text>
      {isLoading ? (
        <PopularSkeleton />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {popular.map((restaurant) => (
            <PressableScale
              key={restaurant.id}
              style={styles.restaurantItem}
              onPress={() => onRestaurantPress?.(restaurant.id)}
              scaleTo={0.94}
              accessibilityLabel={restaurant.name}
            >
              <View style={styles.imageContainer}>
                <Image
                  source={imageSource(restaurant.logoUrl ?? restaurant.bannerImage)}
                  style={styles.restaurantImage}
                  contentFit="cover"
                />
              </View>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {restaurant.name}
              </Text>
              {restaurant.categories ? (
                <Text style={styles.restaurantSubtitle} numberOfLines={1}>
                  {restaurant.categories}
                </Text>
              ) : null}
            </PressableScale>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  scrollContent: {
    flexDirection: "row",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  restaurantItem: {
    alignItems: "center",
    width: 100,
  },
  imageContainer: {
    width: 100,
    height: 100,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.xl + 4,
    overflow: "hidden",
    backgroundColor: Palette.surfaceMuted,
  },
  restaurantImage: {
    width: "100%",
    height: "100%",
  },
  restaurantName: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
    textAlign: "center",
  },
  restaurantSubtitle: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
  skeletonBlock: {
    backgroundColor: Palette.surfaceMuted,
  },
  skeletonLine: {
    width: 70,
    height: 12,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceMuted,
  },
});
