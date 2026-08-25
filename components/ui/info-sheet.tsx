import { BottomSheet } from "@/components/ui/bottom-sheet";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Fonts, FontSize, Palette, Radius, Spacing } from "@/constants/theme";
import { StyleSheet, Text, View } from "react-native";

/**
 * Title + one paragraph + a full-width orange "Close" button, on top of the
 * existing `BottomSheet`.
 *
 * Both fee designs (`design/Cart Service Fee Info.png`,
 * `design/Cart Delivery Fee Info.png`) are this component with different copy,
 * so the sheet chrome is written once here rather than per modal (plan §4.1).
 * The wrappers in `components/checkout/` supply the strings.
 */
interface InfoSheetProps {
  visible: boolean;
  title: string;
  /** Optional: the payment sheet is a title plus `children`, with no paragraph. */
  body?: string;
  onClose: () => void;
  /** Rendered between the paragraph and the Close button. */
  children?: React.ReactNode;
}

export function InfoSheet({ visible, title, body, onClose, children }: InfoSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="65%">
      <Text style={styles.title}>{title}</Text>

      <View style={styles.divider} />

      {body ? <Text style={styles.body}>{body}</Text> : null}

      {children}

      <PressableScale
        style={styles.closeButton}
        onPress={onClose}
        scaleTo={0.98}
        dimTo={0.95}
        accessibilityLabel="Close"
      >
        <Text style={styles.closeText}>Close</Text>
      </PressableScale>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.bold,
    color: Palette.ink,
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  // The designs rule a hairline the full width of the sheet, past its gutter.
  divider: {
    height: 1,
    backgroundColor: Palette.borderSubtle,
    marginHorizontal: -Spacing.xxl,
  },
  body: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textSecondary,
    lineHeight: 22,
    marginTop: Spacing.xl,
  },
  closeButton: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.xxl + 4,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xxxl,
  },
  closeText: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
});
