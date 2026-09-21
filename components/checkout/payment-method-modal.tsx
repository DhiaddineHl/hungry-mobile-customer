import { InfoSheet } from "@/components/ui/info-sheet";
import { PressableScale } from "@/components/ui/pressable-scale";
import {
  PAYMENT_DISCLOSURE,
  PAYMENT_METHOD_IDS,
  PAYMENT_METHOD_LABELS,
  paymentMethodLabel,
  type PaymentMethodId,
} from "@/constants/payment-methods";
import { Fonts, FontSize, Palette, Spacing } from "@/constants/theme";
import { Banknote, Check, Coins, CreditCard, Smartphone } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

/**
 * The payment-method picker from `design/Order Details - Payment Method.png`.
 *
 * A LOCAL PREFERENCE picker, not a payment flow. There is no payment concept
 * anywhere in the backend (plan §3.3) — no method, no status, no provider — so
 * selecting a row stores a string on the device and writes a line into the
 * order's free-text `comment`. Nothing is charged, which is why the sheet
 * carries the disclosure below the list rather than leaving the four rows to
 * imply otherwise.
 *
 * The ids, labels and disclosure live in `constants/payment-methods.ts`: the
 * order view model needs the label and must stay free of React. Only the icons
 * are declared here, because this sheet is the only place that draws them.
 */
const ICON_SIZE = 22;

const ICONS: Record<PaymentMethodId, React.ReactNode> = {
  cash: <Banknote size={ICON_SIZE} color={Palette.success} />,
  points: <Coins size={ICON_SIZE} color={Palette.ink} />,
  bank: <CreditCard size={ICON_SIZE} color={Palette.ink} />,
  sim: <Smartphone size={ICON_SIZE} color={Palette.ink} />,
};

interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  icon: React.ReactNode;
}

/** In the order the design lists them. */
export const PAYMENT_METHODS: PaymentMethodOption[] = PAYMENT_METHOD_IDS.map(
  (id) => ({ id, label: PAYMENT_METHOD_LABELS[id], icon: ICONS[id] }),
);

export { PAYMENT_DISCLOSURE, paymentMethodLabel };

interface PaymentMethodModalProps {
  visible: boolean;
  selected: PaymentMethodId;
  onSelect: (method: PaymentMethodId) => void;
  onClose: () => void;
}

export function PaymentMethodModal({
  visible,
  selected,
  onSelect,
  onClose,
}: PaymentMethodModalProps) {
  return (
    <InfoSheet visible={visible} title="Payment Method" onClose={onClose}>
      <View style={styles.list}>
        {PAYMENT_METHODS.map((option) => {
          const isSelected = option.id === selected;
          return (
            <PressableScale
              key={option.id}
              style={styles.row}
              onPress={() => onSelect(option.id)}
              scaleTo={0.99}
              accessibilityLabel={option.label}
              accessibilityHint={
                isSelected ? "Selected payment method" : "Select this payment method"
              }
            >
              <View style={styles.rowLeft}>
                {option.icon}
                <Text style={styles.label}>{option.label}</Text>
              </View>
              {isSelected ? (
                // The testID sits on a wrapper, not on the icon: lucide renders
                // an Svg whose children inherit the prop, so a testID on the
                // icon itself matches several nodes at once.
                <View testID={`payment-check-${option.id}`}>
                  <Check size={20} color={Palette.ink} />
                </View>
              ) : null}
            </PressableScale>
          );
        })}
      </View>

      <Text style={styles.disclosure}>{PAYMENT_DISCLOSURE}</Text>
    </InfoSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  label: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.medium,
    color: Palette.ink,
  },
  disclosure: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    lineHeight: 18,
    marginTop: Spacing.sm,
  },
});
