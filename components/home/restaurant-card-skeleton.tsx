import { Palette, Radius, Spacing } from "@/constants/theme";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/**
 * Loading placeholder for a restaurant card. Geometry is copied from
 * `open-restaurants.tsx` — 160pt banner, 34pt logo, the same paddings — so the
 * list does not jump when real cards replace it.
 */
export function RestaurantCardSkeleton() {
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.set(
      withRepeat(
        withTiming(1, { duration: 800, reduceMotion: ReduceMotion.System }),
        -1,
        true
      )
    );
  }, [pulse]);

  const shimmer = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <View style={styles.card} accessibilityLabel="Loading restaurant">
      <Animated.View style={[styles.banner, shimmer]} />
      <View style={styles.content}>
        <Animated.View style={[styles.logo, shimmer]} />
        <View style={styles.titleColumn}>
          <Animated.View style={[styles.line, styles.nameLine, shimmer]} />
          <Animated.View style={[styles.line, styles.categoriesLine, shimmer]} />
        </View>
      </View>
    </View>
  );
}

/** The list-shaped loading state: a few cards, matching the real list's gap. */
export function RestaurantListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <RestaurantCardSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  card: {
    backgroundColor: Palette.surface,
  },
  banner: {
    height: 160,
    borderRadius: Radius.xl,
    backgroundColor: Palette.surfaceMuted,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Palette.surfaceMuted,
  },
  titleColumn: {
    flex: 1,
    gap: Spacing.sm,
  },
  line: {
    height: 12,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceMuted,
  },
  nameLine: {
    width: "55%",
  },
  categoriesLine: {
    width: "75%",
    height: 10,
  },
});
