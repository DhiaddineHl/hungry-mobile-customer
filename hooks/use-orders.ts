import { fetchOrderById, isUuid } from '@/services/api/order-service';
import { orderKeys } from '@/services/api/query-keys';
import { useQuery } from '@tanstack/react-query';

/**
 * One order by id.
 *
 * Orders are created by the server — `POST /checkout` turns the customer's cart
 * into them (see `hooks/use-checkout.ts`) — so this module only reads.
 *
 * `retry: false` for the same reason `fetchOrderById` maps 500 to `null`: a
 * missing order answers 500, and retrying a not-found three times only delays
 * the empty state.
 */
export function useOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ''),
    queryFn: () => fetchOrderById(id!),
    enabled: !!id && isUuid(id),
    retry: false,
  });
}
