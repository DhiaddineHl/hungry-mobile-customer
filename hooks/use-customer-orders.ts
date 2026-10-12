import {
  DELIVERED_STATUSES,
  type DeliveryStatus,
  type OrderDeliveryOutput,
} from '@/schemas/delivery';
import type { OrderOutput } from '@/schemas/order';
import {
  needsDeliveryRead,
  orderBucket,
  sortByNewest,
  splitOrders,
  toCustomerOrder,
  withDeliveryStatus,
  type CustomerOrder,
} from '@/services/api/order-list-view-model';
import {
  fetchCustomerOrders,
  fetchOrderById,
  isUuid,
} from '@/services/api/order-service';
import { deliveryKeys, orderKeys } from '@/services/api/query-keys';
import {
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryObserverResult,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { useCurrentCustomer } from './use-delivery-address';
import {
  IN_PROGRESS_DELIVERY_STATUSES,
  orderDeliveryQueryOptions,
} from './use-order-delivery';

/**
 * The signed-in customer's orders, read from the backend.
 *
 * There is no device-side copy of an order anywhere in this app: the server is
 * the only source, and the customer app only ever READS it. Status belongs to
 * the restaurant, the delivery agent and the back-office.
 *
 * `fetchCustomerOrders` explains the part that looks odd — the list endpoint
 * cannot be filtered by customer, so it is paged and narrowed on the device.
 *
 * Each order comes back with its delivery status folded in
 * (`CustomerOrder.deliveryStatus`) wherever it takes one to know where the
 * order stands: the backend closes the order (`FINISHED`) at PICKUP, so "on
 * the way" and "delivered" are only in the delivery — see `orderStage`.
 */

/**
 * How often an in-progress list re-reads itself.
 *
 * Still the backstop for every status change, and the ONLY mechanism for most
 * of them: a push is sent on confirmation alone (see the backend's
 * `OrderNotificationListener`), so PREPARING, READY and the delivery statuses
 * reach the customer on the next poll. A confirmation that does arrive by push
 * invalidates this query immediately — see `hooks/use-push-notifications.ts` —
 * which is why the interval below does not need shortening.
 *
 * Only runs while at least one order is still in progress, so a customer with
 * nothing pending sends no traffic.
 */
const IN_PROGRESS_POLL_MS = 20_000;

/** Deliveries of in-progress orders are re-read on the same cadence. */
const DELIVERY_POLL_MS = 20_000;

/** Orders go stale quickly — a status can change at any moment. */
const ORDERS_STALE_TIME = 10_000;

/**
 * The delivery status already in the cache for an order, as
 * `CustomerOrder.deliveryStatus` expects it — `undefined` when it has not been
 * read successfully. For the poll decisions, which run outside render.
 */
function cachedDeliveryStatus(
  queryClient: QueryClient,
  orderId: string
): DeliveryStatus | null | undefined {
  const state = queryClient.getQueryState<OrderDeliveryOutput | null>(
    deliveryKeys.detail(orderId)
  );
  return state?.status === 'success' ? (state.data?.status ?? null) : undefined;
}

/** Whether a raw order is still in progress, given what the cache knows of its delivery. */
function isInProgress(queryClient: QueryClient, output: OrderOutput): boolean {
  const order = withDeliveryStatus(
    toCustomerOrder(output),
    cachedDeliveryStatus(queryClient, output.id)
  );
  return orderBucket(order) === 'active';
}

/**
 * Whether a delivery is worth re-reading.
 *
 * Not once the food has arrived. Not once it ended without arriving AFTER the
 * pickup either (`FINISHED` order) — but before the pickup a failed delivery
 * re-queues the order for another driver, so it keeps being read.
 */
function deliveryPollInterval(
  order: Pick<CustomerOrder, 'status'>,
  delivery: OrderDeliveryOutput | null | undefined
): number | false {
  const status = delivery?.status;
  if (status && DELIVERED_STATUSES.includes(status)) return false;
  if (
    status &&
    !IN_PROGRESS_DELIVERY_STATUSES.includes(status) &&
    order.status === 'FINISHED'
  ) {
    return false;
  }
  return DELIVERY_POLL_MS;
}

/** Module-level so `useQueries` can keep its combined result stable. */
function toDeliveryStatuses(
  results: QueryObserverResult<OrderDeliveryOutput | null>[]
): (DeliveryStatus | null | undefined)[] {
  return results.map((result) =>
    result.isSuccess ? (result.data?.status ?? null) : undefined
  );
}

export interface CustomerOrdersResult {
  active: CustomerOrder[];
  completed: CustomerOrder[];
  isLoading: boolean;
  isRefetching: boolean;
  error: unknown;
  refetch: () => void;
}

export function useCustomerOrders(): CustomerOrdersResult {
  const queryClient = useQueryClient();
  const { data: customer, isLoading: isLoadingCustomer } = useCurrentCustomer();
  const customerId = customer?.id;

  const query = useQuery({
    queryKey: orderKeys.list(customerId ?? ''),
    queryFn: () => fetchCustomerOrders(customerId!),
    enabled: !!customerId,
    staleTime: ORDERS_STALE_TIME,
    // A failed read is shown, not retried three times: `fetchCustomerOrders`
    // walks several pages, so a retry multiplies the requests behind one
    // screen. The customer pulls to refresh instead.
    retry: false,
    refetchInterval: (query) => {
      const orders = query.state.data ?? [];
      const tracking = orders.some((order) => isInProgress(queryClient, order));
      return tracking ? IN_PROGRESS_POLL_MS : false;
    },
  });

  const orders = useMemo(
    () => sortByNewest((query.data ?? []).map(toCustomerOrder)),
    [query.data]
  );

  // One delivery read per order whose stage depends on it — the same cache
  // entries the order screen's driver card and the notification feed read.
  const tracked = useMemo(
    () => orders.filter((order) => needsDeliveryRead(order)),
    [orders]
  );

  const deliveryStatuses = useQueries({
    queries: tracked.map((order) => ({
      ...orderDeliveryQueryOptions(order.id),
      refetchInterval: (query: { state: { data?: OrderDeliveryOutput | null } }) =>
        deliveryPollInterval(order, query.state.data),
    })),
    combine: toDeliveryStatuses,
  });

  const { active, completed } = useMemo(() => {
    const byOrder = new Map(
      tracked.map((order, index) => [order.id, deliveryStatuses[index]])
    );
    return splitOrders(
      orders.map((order) => withDeliveryStatus(order, byOrder.get(order.id)))
    );
  }, [orders, tracked, deliveryStatuses]);

  return {
    active,
    completed,
    isLoading: isLoadingCustomer || query.isLoading,
    isRefetching: query.isFetching && !query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export interface CustomerOrderResult {
  /** Without its delivery status — the screen reads that with `useOrderDelivery`. */
  order: CustomerOrder | null;
  isLoading: boolean;
  isRefetching: boolean;
  /** The backend does not have this order — see `fetchOrderById`. */
  isMissing: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * One order by id, polled while it is still in progress.
 *
 * Shares `orderKeys.detail(id)` with `useOrder`, so the detail screen and any
 * other reader of the same order sit on one cache entry; the polling lives on
 * this observer only, and stops the moment the order is no longer active —
 * judged with its delivery, since a `FINISHED` order may still be on its way.
 */
export function useCustomerOrder(id: string | null | undefined): CustomerOrderResult {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: orderKeys.detail(id ?? ''),
    queryFn: () => fetchOrderById(id!),
    enabled: !!id && isUuid(id),
    staleTime: ORDERS_STALE_TIME,
    // Same reason as `useOrder`: a missing order answers 500, and retrying a
    // not-found only delays the empty state.
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return isInProgress(queryClient, data) ? IN_PROGRESS_POLL_MS : false;
    },
  });

  const order = useMemo(
    () => (query.data ? toCustomerOrder(query.data) : null),
    [query.data]
  );

  return {
    order,
    isLoading: query.isLoading,
    isRefetching: query.isFetching && !query.isLoading,
    // `fetchOrderById` resolves to null for a missing order — a 500, since the
    // backend answers that instead of a 404 — rather than throwing.
    isMissing: query.isSuccess && query.data === null,
    error: query.error,
    refetch: query.refetch,
  };
}
