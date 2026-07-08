import { PressableScale } from "@/components/ui/pressable-scale";
import { Fonts, FontSize, Palette, Radius, Spacing } from "@/constants/theme";
import { Heart } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

interface FavoritesEmptyProps {
  onBrowse?: () => void;
}

export function FavoritesEmpty({ onBrowse }: FavoritesEmptyProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Heart size={36} color={Palette.primary} />
      </View>
      <Text style={styles.title}>No favorites yet</Text>
      <Text style={styles.subtitle}>
        Tap the heart on a restaurant or dish to save it here for quick access.
      </Text>
      <PressableScale
        style={styles.button}
        onPress={onBrowse}
        scaleTo={0.97}
        accessibilityLabel="Browse restaurants"
      >
        <Text style={styles.buttonText}>Browse restaurants</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Palette.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.display,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    marginTop: Spacing.md,
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
});
