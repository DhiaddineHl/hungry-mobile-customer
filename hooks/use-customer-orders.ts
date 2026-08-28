import {
  orderBucket,
  sortByNewest,
  splitOrders,
  toCustomerOrder,
  type CustomerOrder,
} from '@/services/api/order-list-view-model';
import {
  fetchCustomerOrders,
  fetchOrderById,
  isUuid,
} from '@/services/api/order-service';
import { orderKeys } from '@/services/api/query-keys';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useCurrentCustomer } from './use-delivery-address';

/**
 * The signed-in customer's orders, read from the backend.
 *
 * There is no device-side copy of an order anywhere in this app: the server is
 * the only source, and the customer app only ever READS it. Status belongs to
 * the restaurant, the delivery agent and the back-office.
 *
 * `fetchCustomerOrders` explains the part that looks odd — the list endpoint
 * cannot be filtered by customer, so it is paged and narrowed on the device.
 */

/**
 * How often an in-progress list re-reads itself.
 *
 * This is the whole tracking mechanism: there are no push notifications and no
 * websocket, so a status set by the restaurant reaches the customer on the next
 * poll. Only runs while at least one order is still in progress, so a customer
 * with nothing pending sends no traffic.
 */
const IN_PROGRESS_POLL_MS = 20_000;

/** Orders go stale quickly — a status can change at any moment. */
const ORDERS_STALE_TIME = 10_000;

export interface CustomerOrdersResult {
  active: CustomerOrder[];
  completed: CustomerOrder[];
  isLoading: boolean;
  isRefetching: boolean;
  error: unknown;
  refetch: () => void;
}

export function useCustomerOrders(): CustomerOrdersResult {
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
      const tracking = orders.some(
        (order) => orderBucket(toCustomerOrder(order)) === 'active'
      );
      return tracking ? IN_PROGRESS_POLL_MS : false;
    },
  });

  const { active, completed } = useMemo(() => {
    const orders = sortByNewest((query.data ?? []).map(toCustomerOrder));
    return splitOrders(orders);
  }, [query.data]);

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
 * this observer only, and stops the moment the order is no longer active.
 */
export function useCustomerOrder(id: string | null | undefined): CustomerOrderResult {
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
      return orderBucket(toCustomerOrder(data)) === 'active'
        ? IN_PROGRESS_POLL_MS
        : false;
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
