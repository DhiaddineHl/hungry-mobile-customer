import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { SectionHeader, Skeleton, Text, Touchable } from '@/components/ds';
import { useRestaurantImageSource } from '@/hooks/use-restaurant-image';
import type { RestaurantSummary } from '@/services/api/restaurant-view-model';
import { createStyles, useTheme } from '@/theme';

/** How many restaurants the strip shows. */
const POPULAR_COUNT = 8;

/**
 * "Popular near you" — 96 logo tiles with the name and time under each.
 *
 * There is no popularity signal in the backend: no ratings, no order counts.
 * This is the first N open restaurants of the same list — a placeholder
 * ordering, NOT a popularity ranking.
 */
export function PopularRestaurants({
  restaurants,
  isLoading = false,
  onRestaurantPress,
}: {
  restaurants: RestaurantSummary[];
  isLoading?: boolean;
  onRestaurantPress?: (restaurantId: string) => void;
}) {
  const styles = useStyles();
  const { radius } = useTheme();
  const imageSource = useRestaurantImageSource();
  const popular = restaurants.filter((r) => r.isOpen !== false).slice(0, POPULAR_COUNT);

  // The list below carries the empty state; this strip just steps aside.
  if (!isLoading && popular.length === 0) return null;

  return (
    <View>
      <SectionHeader title="Popular near you" style={styles.header} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <View key={i} style={styles.tile}>
                <Skeleton width={96} height={96} radius={radius.thumb} />
                <Skeleton width={70} height={12} />
              </View>
            ))
          : popular.map((restaurant) => (
              <Touchable
                key={restaurant.id}
                onPress={() => onRestaurantPress?.(restaurant.id)}
                accessibilityLabel={restaurant.name}
                style={styles.tile}
              >
                <View style={styles.logo}>
                  <Image
                    source={imageSource(restaurant.logoUrl ?? restaurant.bannerImage)}
                    style={styles.fill}
                    contentFit="cover"
                  />
                </View>
                <View>
                  <Text variant="itemTitle" numberOfLines={2}>
                    {restaurant.name}
                  </Text>
                  {restaurant.deliveryTime ? (
                    <Text variant="caption" color="inkMuted">
                      {restaurant.deliveryTime}
                    </Text>
                  ) : null}
                </View>
              </Touchable>
            ))}
      </ScrollView>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  header: { paddingHorizontal: t.screenPadding },
  rail: { paddingHorizontal: t.screenPadding, gap: t.space[14] },
  tile: { width: t.size.popularTile, gap: t.space[8] },
  logo: {
    width: t.size.popularTile,
    height: t.size.popularTile,
    borderRadius: t.radius.thumb,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.colors.divider,
    backgroundColor: t.colors.surfaceSunken,
  },
  fill: { width: '100%', height: '100%' },
}));
