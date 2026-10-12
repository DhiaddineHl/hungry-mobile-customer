import { View } from 'react-native';
import { IconWell, InfoNote, Radio, Separated, Text, Touchable } from '@/components/ds';
import { InfoSheet } from '@/components/ui/info-sheet';
import {
  PAYMENT_DISCLOSURE,
  PAYMENT_METHOD_IDS,
  PAYMENT_METHOD_LABELS,
  paymentMethodLabel,
  type PaymentMethodId,
} from '@/constants/payment-methods';
import { createStyles, type IconName } from '@/theme';

/**
 * The payment-method picker.
 *
 * A LOCAL PREFERENCE picker, not a payment flow. There is no payment concept
 * anywhere in the backend — no method, no status, no provider — so selecting a
 * row stores a string on the device and writes a line into the order's
 * free-text `comment`. Nothing is charged, which is why the sheet carries the
 * disclosure below the list rather than leaving the rows to imply otherwise.
 */
const ICONS: Record<PaymentMethodId, IconName> = {
  cash: 'cash',
  points: 'points',
  bank: 'card',
  sim: 'mobile',
};

interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  icon: IconName;
}

/** In the order the design lists them. */
export const PAYMENT_METHODS: PaymentMethodOption[] = PAYMENT_METHOD_IDS.map((id) => ({
  id,
  label: PAYMENT_METHOD_LABELS[id],
  icon: ICONS[id],
}));

export { PAYMENT_DISCLOSURE, paymentMethodLabel };

interface PaymentMethodModalProps {
  visible: boolean;
  selected: PaymentMethodId;
  onSelect: (method: PaymentMethodId) => void;
  onClose: () => void;
}

export function PaymentMethodModal({ visible, selected, onSelect, onClose }: PaymentMethodModalProps) {
  const styles = useStyles();
  return (
    <InfoSheet visible={visible} title="Payment method" onClose={onClose}>
      <View accessibilityRole="radiogroup">
        <Separated>
          {PAYMENT_METHODS.map((option) => {
            const isSelected = option.id === selected;
            return (
              <Touchable
                key={option.id}
                scaleTo={1}
                style={styles.row}
                onPress={() => onSelect(option.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={option.label}
                accessibilityHint={isSelected ? 'Selected payment method' : 'Select this payment method'}
              >
                <IconWell icon={option.icon} />
                <Text variant="itemLabel" style={styles.label}>
                  {option.label}
                </Text>
                {/* The testID marks the chosen row for tests. */}
                <View testID={isSelected ? `payment-check-${option.id}` : undefined}>
                  <Radio selected={isSelected} />
                </View>
              </Touchable>
            );
          })}
        </Separated>
      </View>
      <InfoNote>{PAYMENT_DISCLOSURE}</InfoNote>
    </InfoSheet>
  );
}

const useStyles = createStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space[14], minHeight: t.size.listRow, paddingVertical: t.space[8] },
  label: { flex: 1 },
}));
