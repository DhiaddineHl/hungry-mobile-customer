import { AnimatedEntrance } from "@/components/ui/animated-entrance";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Fonts, FontSize, Palette, Radius, Spacing } from "@/constants/theme";
import { Image } from "expo-image";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const POPULAR_RESTAURANTS = [
  {
    id: "1",
    name: "Taxi Pizza",
    subtitle: "Khzema",
    image: require("@/assets/restaurants-images/restaurant-1.jpg"),
    hasRoundedImage: true,
  },
  {
    id: "2",
    name: "Tacoth",
    subtitle: "",
    image: require("@/assets/restaurants-images/restaurant-2.jpg"),
    hasRoundedImage: false,
    backgroundColor: "#F5A623",
  },
  {
    id: "3",
    name: "Papadam Food",
    subtitle: "Khzema",
    image: require("@/assets/restaurants-images/restaurant-3.jpg"),
    hasRoundedImage: true,
  },
];

interface PopularRestaurantsProps {
  onRestaurantPress?: (restaurantId: string) => void;
}

export function PopularRestaurants({
  onRestaurantPress,
}: PopularRestaurantsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Popular</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {POPULAR_RESTAURANTS.map((restaurant, index) => (
          <AnimatedEntrance key={restaurant.id} index={index} delay={80}>
            <PressableScale
              style={styles.restaurantItem}
              onPress={() => onRestaurantPress?.(restaurant.id)}
              scaleTo={0.94}
              accessibilityLabel={restaurant.name}
            >
              <View
                style={[
                  styles.imageContainer,
                  restaurant.hasRoundedImage && styles.imageContainerRounded,
                  restaurant.backgroundColor && {
                    backgroundColor: restaurant.backgroundColor,
                  },
                ]}
              >
                <Image
                  source={restaurant.image}
                  style={[
                    styles.restaurantImage,
                    restaurant.hasRoundedImage && styles.restaurantImageRounded,
                  ]}
                  contentFit="contain"
                />
              </View>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              {restaurant.subtitle ? (
                <Text style={styles.restaurantSubtitle}>
                  {restaurant.subtitle}
                </Text>
              ) : null}
            </PressableScale>
          </AnimatedEntrance>
        ))}
      </ScrollView>
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
  },
  imageContainerRounded: {
    backgroundColor: "transparent",
  },
  restaurantImage: {
    width: "100%",
    height: "100%",
  },
  restaurantImageRounded: {
    borderRadius: 20,
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
});
