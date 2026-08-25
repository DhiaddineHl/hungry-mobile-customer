import { InfoSheet } from "@/components/ui/info-sheet";

/**
 * "Service Fee" explainer, opened from the Info icon on the Service Fee row of
 * the cart and checkout summaries.
 *
 * The copy is transcribed verbatim from `design/Cart Service Fee Info.png`. It
 * is NOT shared with {@link DeliveryFeeModal}: the two paragraphs differ by one
 * word ("service cost" vs "delivery cost") and each design is the source of
 * truth for its own sheet.
 */
export const SERVICE_FEE_TITLE = "Service Fee";

export const SERVICE_FEE_BODY =
  "This fee helps cover service cost. The amount varies for each store based " +
  "on things like your location and availability of nearby couriers.";

interface ServiceFeeModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ServiceFeeModal({ visible, onClose }: ServiceFeeModalProps) {
  return (
    <InfoSheet
      visible={visible}
      title={SERVICE_FEE_TITLE}
      body={SERVICE_FEE_BODY}
      onClose={onClose}
    />
  );
}
