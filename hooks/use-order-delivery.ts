import { getOrderDelivery } from '@/services/api/delivery-service';
import { deliveryKeys } from '@/services/api/query-keys';
import { subscribeToTopic } from '@/services/realtime/stomp-client';
import type { DeliveryStatus, OrderDeliveryOutput } from '@/schemas/delivery';
import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * "Has a driver been assigned to this order, and what's their status."
 *
 * STOMP is primary, the poll below is the resilience fallback — the same
 * "push updates, poll is the backstop" split `useCustomerOrder`'s
 * `refetchInterval` makes for order confirmation. A push (hungry-notification's
 * `/topic/customers/{orderId}/notifications`) invalidates the cache entry
 * immediately; the poll only matters for whatever a dropped/reconnecting
 * socket missed in between.
 */

/** Delivery statuses still worth polling for — a terminal one needs no more reads. */
export const IN_PROGRESS_DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'CREATED',
  'QUEUED',
  'BATCH_ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
];

const DELIVERY_POLL_MS = 20_000;
const DELIVERY_STALE_TIME = 10_000;

export function orderDeliveryQueryOptions(
  orderId: string | null | undefined
): UseQueryOptions<OrderDeliveryOutput | null> {
  return {
    queryKey: deliveryKeys.detail(orderId ?? ''),
    queryFn: () => getOrderDelivery(orderId!),
    enabled: !!orderId,
    staleTime: DELIVERY_STALE_TIME,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.status) return false;
      return IN_PROGRESS_DELIVERY_STATUSES.includes(data.status) ? DELIVERY_POLL_MS : false;
    },
  };
}

export interface OrderDeliveryResult {
  delivery: OrderDeliveryOutput | null;
  /**
   * The delivery status as `CustomerOrder.deliveryStatus` expects it:
   * `undefined` until the read has succeeded, `null` when there is no delivery.
   */
  status: DeliveryStatus | null | undefined;
  /** No `Delivery` row exists for this order yet — not an error, just "no driver yet". */
  isUnassigned: boolean;
  isLoading: boolean;
  error: unknown;
}

export function useOrderDelivery(orderId: string | null | undefined): OrderDeliveryResult {
  const queryClient = useQueryClient();
  const query = useQuery(orderDeliveryQueryOptions(orderId));

  useEffect(() => {
    if (!orderId) return;
    // Any frame on this topic (DRIVER_ASSIGNED today, more types later) means
    // "re-read the delivery" — the payload itself is not trusted as the new
    // state, just as a cue to refetch, so the schema stays the single source
    // of truth for what a delivery looks like.
    return subscribeToTopic(`/topic/customers/${orderId}/notifications`, () => {
      queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(orderId) });
    });
  }, [orderId, queryClient]);

  return {
    delivery: query.data ?? null,
    status: query.isSuccess ? (query.data?.status ?? null) : undefined,
    isUnassigned: query.isSuccess && query.data === null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
