import { InfoSheet } from "@/components/ui/info-sheet";

/**
 * "Delivery Fee" explainer, opened from the Info icon on the Delivery Fee row
 * of the cart and checkout summaries.
 *
 * The copy is transcribed verbatim from `design/Cart Delivery Fee Info.png` —
 * see the note in `service-fee-modal.tsx` for why the two strings are not
 * shared.
 */
export const DELIVERY_FEE_TITLE = "Delivery Fee";

export const DELIVERY_FEE_BODY =
  "This fee helps cover delivery cost. The amount varies for each store based " +
  "on things like your location and availability of nearby couriers.";

interface DeliveryFeeModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DeliveryFeeModal({ visible, onClose }: DeliveryFeeModalProps) {
  return (
    <InfoSheet
      visible={visible}
      title={DELIVERY_FEE_TITLE}
      body={DELIVERY_FEE_BODY}
      onClose={onClose}
    />
  );
}
