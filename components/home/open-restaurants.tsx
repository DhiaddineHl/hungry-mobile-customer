import { AnimatedEntrance } from "@/components/ui/animated-entrance";
import { Fonts, FontSize, Palette, Radius, Spacing } from "@/constants/theme";
import { useFavoritesStore, useIsFavorite } from "@/store/favorites-store";
import { Image } from "expo-image";
import {
  ChevronRight,
  Heart,
  Motorbike,
  Store,
  ThumbsUp,
  Timer,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Local accent colors for the info-badge glyphs (matched to the Figma design).
const BadgeColor = {
  rating: "#FFE980", // amber
  time: "#F58D1D", // orange
  delivery: "#3A974C", // green
  discount: "#003049", // dark teal
} as const;

interface Restaurant {
  id: string;
  name: string;
  categories: string;
  rating: string;
  deliveryTime: string;
  deliveryFee: string;
  isFreeDelivery: boolean;
  discount?: string;
  isNew?: boolean;
  isSponsored?: boolean;
  bannerImage: any;
  isFavorite?: boolean;
}

const RESTAURANTS: Restaurant[] = [
  {
    id: "1",
    name: "Tacoth",
    categories: "French Tacos",
    rating: "92%",
    deliveryTime: "30-45 min",
    deliveryFee: "Free",
    isFreeDelivery: true,
    discount: "Up to -20% off",
    isNew: true,
    bannerImage: require("@/assets/restaurants-images/restaurant-banner-1.jpg"),
    isFavorite: true,
  },
  {
    id: "2",
    name: "Crepe Factory",
    categories: "Sweets - Breakfast - Dessert",
    rating: "75%",
    deliveryTime: "15-30 min",
    deliveryFee: "Free",
    isFreeDelivery: true,
    discount: "Up to -32% off",
    bannerImage: require("@/assets/restaurants-images/restaurant-banner-2.jpg"),
    isFavorite: true,
  },
  {
    id: "3",
    name: "Baguette",
    categories: "Sandwiches - Burgers",
    rating: "96%",
    deliveryTime: "30-45 min",
    deliveryFee: "2,5DT",
    isFreeDelivery: false,
    isSponsored: true,
    bannerImage: require("@/assets/restaurants-images/restaurant-banner-3.jpg"),
    isFavorite: true,
  },
  {
    id: "4",
    name: "Papa John's",
    categories: "Pizza - Burgers - Sandwiches",
    rating: "96%",
    deliveryTime: "30-45 min",
    deliveryFee: "2,5DT",
    isFreeDelivery: false,
    isSponsored: true,
    bannerImage: require("@/assets/restaurants-images/restaurant-banner-3.jpg"),
    isFavorite: true,
  },
];

interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress?: () => void;
}

function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
  const isFavorite = useIsFavorite("restaurant", restaurant.id);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);

  const handleFavorite = () =>
    toggleFavorite({
      id: restaurant.id,
      type: "restaurant",
      name: restaurant.name,
      image: restaurant.bannerImage,
      subtitle: restaurant.categories,
      rating: restaurant.rating,
    });

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${restaurant.name}, ${restaurant.categories}`}
    >
      <View style={styles.bannerContainer}>
        <Image
          source={restaurant.bannerImage}
          style={styles.bannerImage}
          contentFit="cover"
        />
        <Pressable
          style={({ pressed }) => [
            styles.favoriteButton,
            pressed && styles.favoritePressed,
          ]}
          onPress={handleFavorite}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite ? "Remove from favorites" : "Add to favorites"
          }
        >
          <Heart
            size={18}
            color={isFavorite ? Palette.primary : Palette.white}
            fill={isFavorite ? Palette.primary : "transparent"}
          />
        </Pressable>
        {restaurant.discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{restaurant.discount}</Text>
          </View>
        )}
        {restaurant.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newText}>NEW</Text>
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.logo}>
          <Store size={18} color={Palette.ink} />
        </View>

        <View style={styles.titleColumn}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <Text style={styles.categories} numberOfLines={1}>
            {restaurant.categories}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <View style={[styles.infoBadge, { backgroundColor: BadgeColor.rating }]}>
              <ThumbsUp size={18} color={Palette.ink} />
            </View>
            <Text style={styles.infoText}>{restaurant.rating}</Text>
          </View>

          <View style={styles.infoItem}>
            <View style={[styles.infoBadge, { backgroundColor: BadgeColor.time }]}>
              <Timer size={18} color={Palette.ink} />
            </View>
            <Text style={styles.infoText}>{restaurant.deliveryTime}</Text>
          </View>

          <View style={styles.infoItem}>
            <View
              style={[styles.infoBadge, { backgroundColor: BadgeColor.delivery }]}
            >
              <Motorbike size={18} color={Palette.white} />
            </View>
            {restaurant.isFreeDelivery ? (
              <View style={styles.freeDeliveryPill}>
                <Text style={styles.freeDeliveryText}>
                  {restaurant.deliveryFee}
                </Text>
              </View>
            ) : (
              <Text style={styles.infoText}>{restaurant.deliveryFee}</Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

interface OpenRestaurantsProps {
  onRestaurantPress?: (restaurantId: string) => void;
  onSeeAllPress?: () => void;
}

export function OpenRestaurants({
  onRestaurantPress,
  onSeeAllPress,
}: OpenRestaurantsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Open Restaurants</Text>
        <Pressable
          style={({ pressed }) => [
            styles.seeAllButton,
            pressed && styles.seeAllPressed,
          ]}
          onPress={onSeeAllPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="See all restaurants"
        >
          <Text style={styles.seeAllText}>See All</Text>
          <ChevronRight size={16} color={Palette.primary} />
        </Pressable>
      </View>

      <View style={styles.restaurantsList}>
        {RESTAURANTS.map((restaurant, index) => (
          <AnimatedEntrance key={restaurant.id} index={index} delay={120}>
            <RestaurantCard
              restaurant={restaurant}
              onPress={() => onRestaurantPress?.(restaurant.id)}
            />
          </AnimatedEntrance>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllPressed: {
    opacity: 0.6,
  },
  seeAllText: {
    fontSize: FontSize.md,
    color: Palette.primary,
    fontFamily: Fonts.medium,
  },
  restaurantsList: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  card: {
    backgroundColor: Palette.surface,
  },
  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.99 }],
  },
  bannerContainer: {
    height: 160,
    position: "relative",
    backgroundColor: Palette.surfaceMuted,
    borderRadius: Radius.xl,
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  favoriteButton: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  favoritePressed: {
    opacity: 0.7,
  },
  discountBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: BadgeColor.discount,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md - 2,
  },
  discountText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
  newBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: Palette.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  newText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: Palette.textInverse,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BadgeColor.rating,
    alignItems: "center",
    justifyContent: "center",
  },
  titleColumn: {
    flex: 1,
    justifyContent: "center",
  },
  restaurantName: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
  },
  categories: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  infoItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  infoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    fontSize: FontSize.xs,
    color: Palette.textPrimary,
    fontFamily: Fonts.semiBold,
  },
  freeDeliveryPill: {
    backgroundColor: Palette.successSoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  freeDeliveryText: {
    fontSize: FontSize.xs,
    color: Palette.success,
    fontFamily: Fonts.semiBold,
  },
});
