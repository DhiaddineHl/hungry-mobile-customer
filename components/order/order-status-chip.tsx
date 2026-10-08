import { Badge, StatusPill, type BadgeVariant } from '@/components/ds';
import {
  orderStage,
  orderStatusLabel,
  type CustomerOrder,
  type OrderStage,
} from '@/services/api/order-list-view-model';
import type { IconName } from '@/theme';

type StagedOrder = Pick<CustomerOrder, 'status' | 'deliveryStatus' | 'createdAt'>;

/** In progress reads warm, delivered green, refused or failed red, closed neutral. */
const VARIANT: Record<OrderStage, BadgeVariant> = {
  PLACED: 'status',
  CONFIRMED: 'status',
  PREPARING: 'status',
  READY: 'status',
  ON_THE_WAY: 'status',
  DELIVERED: 'success',
  DELIVERY_FAILED: 'danger',
  COMPLETED: 'neutral',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  UNKNOWN: 'neutral',
};

/** The order's status as a Badge (`Placed`, `Ready`…). */
export function OrderStatusChip({ order }: { order: StagedOrder; compact?: boolean }) {
  return <Badge label={orderStatusLabel(order, true)} variant={VARIANT[orderStage(order)]} />;
}

/** The outcome of a finished order as a StatusPill (`Delivered`, `Cancelled`). */
export function OrderOutcomePill({ order }: { order: StagedOrder }) {
  const stage = orderStage(order);
  const tone = stage === 'DELIVERED' ? 'success' : VARIANT[stage] === 'danger' ? 'danger' : 'neutral';
  const icon: IconName = stage === 'DELIVERED' ? 'delivered' : tone === 'danger' ? 'error' : 'check';
  return <StatusPill label={orderStatusLabel(order, true)} tone={tone} icon={icon} />;
}
