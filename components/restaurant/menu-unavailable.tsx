import { Fonts, FontSize, Palette, Radius, Spacing } from "@/constants/theme";
import { UtensilsCrossed } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

/**
 * Shown when no catalog can be found for a restaurant, so there is no menu to
 * fetch — the restaurant's menu was never created in the back-office. See
 * `fetchMenuScope` and plan §2.3.
 *
 * Deliberately NOT styled as an error: nothing failed, no retry would help,
 * and the restaurant itself is fine. It uses the muted surface and the primary
 * accent rather than the danger palette, and offers no retry affordance,
 * because a retry that cannot succeed is worse than none.
 */
export function MenuUnavailable() {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <UtensilsCrossed size={28} color={Palette.primary} />
      </View>
      <Text style={styles.title}>Menu coming soon</Text>
      <Text style={styles.body}>
        This restaurant hasn&apos;t connected its menu yet. You&apos;ll be able
        to order from here as soon as it does.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxxl,
    borderRadius: Radius.xl,
    backgroundColor: Palette.surfaceAlt,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
    textAlign: "center",
  },
  body: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
