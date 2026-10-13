import {
  queryOptions,
  useQueries,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchCategories,
  fetchProductBundles,
  fetchItemsByBrand,
  fetchItemsByGroup,
  fetchItemsBySupplier,
  fetchQuotationRequest,
  fetchQuotationRequestsForUser,
  fetchSalesOrder,
  fetchSalesOrdersForUser,
  fetchStore,
  fetchSupplierReviews,
  type CategoryItem,
} from '../services';
import { loadHomeFeed, type HomeFeed } from '../services/homeFeed';
import { queryClient } from './client';

export { queryClient } from './client';

type OrdersUser = { email?: string | null; mobile_no?: string | null };

// Order and quote statuses change server-side, so these refetch every time
// a screen showing them mounts.
const ORDER_STALE_TIME = 0;

export const queryKeys = {
  homeFeed: ['homeFeed'] as const,
  categories: ['categories'] as const,
  productBundles: ['productBundles'] as const,
  items: ['items'] as const,
  itemsByGroup: (group: string) => ['items', 'group', group] as const,
  itemsByBrand: (brand: string) => ['items', 'brand', brand] as const,
  itemsBySupplier: (supplier: string) =>
    ['items', 'supplier', supplier] as const,
  store: (id: string) => ['stores', id] as const,
  supplierReviews: (supplier: string) =>
    ['supplierReviews', supplier] as const,
  orders: ['orders'] as const,
  ordersForUser: (user: OrdersUser) =>
    ['orders', 'list', user.email ?? null, user.mobile_no ?? null] as const,
  salesOrder: (id: string) => ['orders', 'detail', id] as const,
  quotations: ['quotations'] as const,
  quotationRequest: (id: string) => ['quotations', 'detail', id] as const,
};

export const itemsByGroupQuery = (group: string) =>
  queryOptions({
    queryKey: queryKeys.itemsByGroup(group),
    queryFn: () => fetchItemsByGroup(group),
  });

export const categoriesQuery = queryOptions({
  queryKey: queryKeys.categories,
  queryFn: fetchCategories,
});

// Each Home list loads independently and one that fails is left out of the
// result, so a refetch merges over the previous feed instead of dropping
// whatever list failed this time. The first rails' items are prefetched into
// their own queries so they're filled in before they scroll into view.
export const homeFeedQuery = (client: QueryClient = queryClient) =>
  queryOptions({
    queryKey: queryKeys.homeFeed,
    queryFn: async (): Promise<Partial<HomeFeed>> => {
      const fresh = await loadHomeFeed(groupIds =>
        Promise.all(
          groupIds.map(id => client.prefetchQuery(itemsByGroupQuery(id))),
        ),
      );
      return {
        ...client.getQueryData<Partial<HomeFeed>>(queryKeys.homeFeed),
        ...fresh,
      };
    },
  });

export function useProductBundles() {
  return useQuery({
    queryKey: queryKeys.productBundles,
    queryFn: fetchProductBundles,
  });
}

export function useCategories() {
  return useQuery(categoriesQuery);
}

export function useItemsByGroup(
  group: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    ...itemsByGroupQuery(group ?? ''),
    enabled: !!group && (options.enabled ?? true),
  });
}

export function useItemsByBrand(
  brand: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.itemsByBrand(brand ?? ''),
    queryFn: () => fetchItemsByBrand(brand!),
    enabled: !!brand && (options.enabled ?? true),
  });
}

export function useItemsBySupplier(supplier: string) {
  return useQuery({
    queryKey: queryKeys.itemsBySupplier(supplier),
    queryFn: () => fetchItemsBySupplier(supplier),
  });
}

export function useStore(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.store(id),
    queryFn: async () => (await fetchStore(id)) ?? null,
    enabled: options.enabled ?? true,
  });
}

export function useSupplierReviews(supplier: string) {
  return useQuery({
    queryKey: queryKeys.supplierReviews(supplier),
    queryFn: () => fetchSupplierReviews(supplier),
  });
}

type GroupResult = { data?: CategoryItem[]; isPending: boolean; isError: boolean };

// Module-level so TanStack Query can memoize the combined result.
const combineGroups = (results: GroupResult[]) => ({
  items: results.flatMap(result => result.data ?? []),
  isPending: results.some(result => result.isPending),
  isError: results.some(result => result.isError),
});

/** Every published leaf group's items, for client-side product search. */
export function useCatalogItems() {
  const categories = useCategories();
  const groupIds = (categories.data ?? [])
    .filter(category => !category.isGroup && category.published)
    .map(category => category.id);

  const groups = useQueries({
    queries: groupIds.map(id => itemsByGroupQuery(id)),
    combine: combineGroups,
  });

  // Retry the category list and only the groups that failed.
  const refetch = useCallback(
    () =>
      Promise.all([
        categories.refetch(),
        queryClient.refetchQueries({
          queryKey: queryKeys.items,
          predicate: query => query.state.status === 'error',
        }),
      ]),
    [categories],
  );

  return {
    items: groups.items,
    isPending: categories.isPending || groups.isPending,
    isError: categories.isError || groups.isError,
    refetch,
  };
}

export function useSalesOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.salesOrder(id),
    queryFn: () => fetchSalesOrder(id),
    staleTime: ORDER_STALE_TIME,
  });
}

export function useQuotationRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.quotationRequest(id),
    queryFn: () => fetchQuotationRequest(id),
    staleTime: ORDER_STALE_TIME,
  });
}

export function useOrdersForUser(
  user: OrdersUser | null,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.ordersForUser(user ?? {}),
    queryFn: () =>
      Promise.all([
        fetchSalesOrdersForUser(user ?? {}),
        // Quotations are secondary — if they fail, still show the orders.
        fetchQuotationRequestsForUser(user ?? {}).catch(err => {
          console.warn('fetchQuotationRequests failed', err);
          return [];
        }),
      ]),
    enabled: options.enabled ?? !!user,
    staleTime: ORDER_STALE_TIME,
  });
}

/** Call after placing an order or RFQ so the Orders tab shows it. */
export function invalidateOrders(): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.orders }),
    queryClient.invalidateQueries({ queryKey: queryKeys.quotations }),
  ]).then(() => undefined);
}

/**
 * Pull-to-refresh state: `refreshing` tracks only the user's pull, not
 * background refetches, so the spinner doesn't pop up on its own.
 */
export function useManualRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      // Queries keep their last data on failure.
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [refresh]);

  return { refreshing, onRefresh };
}
