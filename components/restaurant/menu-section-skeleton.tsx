import { Palette, Radius, Spacing } from "@/constants/theme";
import { StyleSheet, View } from "react-native";

// Matches ProductCard's CARD_WIDTH so the skeleton occupies the same geometry
// the real cards will, and the menu does not jump when the data lands.
const CARD_WIDTH = 152;
const CARDS_PER_ROW = 3;

interface MenuSectionSkeletonProps {
  /** How many placeholder sections to draw. */
  sections?: number;
}

/**
 * Loading placeholder for the menu.
 *
 * Static rather than animated: the menu sits under a scroll-driven logo
 * transition, and a second animation competing with it reads as jitter on a
 * mid-range device.
 */
export function MenuSectionSkeleton({ sections = 2 }: MenuSectionSkeletonProps) {
  return (
    <View>
      {Array.from({ length: sections }, (_, section) => (
        <View key={section} style={styles.section}>
          <View style={styles.title} />
          <View style={styles.row}>
            {Array.from({ length: CARDS_PER_ROW }, (_, card) => (
              <View key={card} style={styles.card}>
                <View style={styles.image} />
                <View style={styles.line} />
                <View style={[styles.line, styles.lineShort]} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  title: {
    width: 160,
    height: 18,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceMuted,
    marginBottom: 14,
    marginHorizontal: Spacing.xl,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: Spacing.xl,
    gap: 14,
  },
  card: {
    width: CARD_WIDTH,
  },
  image: {
    width: "100%",
    height: CARD_WIDTH,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surfaceMuted,
  },
  line: {
    height: 12,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surfaceMuted,
    marginTop: Spacing.sm,
  },
  lineShort: {
    width: "50%",
  },
});
