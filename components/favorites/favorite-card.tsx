import { RESTAURANT_IMAGE_PLACEHOLDER } from "@/constants/images";
import { Fonts, FontSize, Palette, Radius, Spacing } from "@/constants/theme";
import { useRestaurantImageSourceFromPath } from "@/hooks/use-restaurant-image";
import type { FavoriteItem } from "@/store/favorites-store";
import { Image } from "expo-image";
import { Heart, ThumbsUp } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface FavoriteCardProps {
  item: FavoriteItem;
  onPress?: () => void;
  onRemove?: () => void;
}

export function FavoriteCard({ item, onPress, onRemove }: FavoriteCardProps) {
  // A stored `number` is a bundled require id and needs no resolution; a
  // stored `string` is the backend's relative path, resolved against the
  // current API base here rather than when the favorite was saved.
  const toSource = useRestaurantImageSourceFromPath();
  const source =
    typeof item.image === "number"
      ? item.image
      : item.image
        ? toSource(item.image)
        : { uri: RESTAURANT_IMAGE_PLACEHOLDER };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <Image source={source} style={styles.image} contentFit="cover" />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          {item.price ? <Text style={styles.price}>{item.price}</Text> : null}
          {item.rating ? (
            <View style={styles.ratingRow}>
              <ThumbsUp size={12} color={Palette.primary} />
              <Text style={styles.rating}>{item.rating}</Text>
              {item.reviewCount ? (
                <Text style={styles.reviewCount}>({item.reviewCount})</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.heart, pressed && styles.heartPressed]}
        onPress={onRemove}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Remove from favorites"
      >
        <Heart size={20} color={Palette.primary} fill={Palette.primary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.borderSubtle,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.99 }],
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceMuted,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: 2,
  },
  price: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Palette.primary,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  rating: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.primary,
  },
  reviewCount: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
  heart: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.primarySoft,
  },
  heartPressed: {
    opacity: 0.7,
  },
});
