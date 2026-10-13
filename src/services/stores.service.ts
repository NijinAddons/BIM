import { callFrappeMethod, toAbsoluteFileUrl } from './frappe.client';

export type Store = {
  id: string;
  name: string;
  image: string | null;
  supplier: string | null;
  description: string | null;
  banners: string[];
};

// Shape returned by `buy_in_minutes.api.get_supplier_stores` (frappe.get_all on
// the Supplier Store doctype). `store_name` is the doctype's title field;
// `name` is the primary key; `store_logo` is the attach-image field;
// `short_description` is the store's blurb shown under "About the store".
type SupplierStoreResponse = {
  name: string;
  store_name?: string | null;
  store_logo?: string | null;
  banner_image?: string | null;
  short_description?: string | null;
  description?: string | null;
  supplier?: string | null;
  supplier_name?: string | null;
};

function mapStore(entry: SupplierStoreResponse): Store {
  return {
    id: entry.name,
    name: entry.store_name || entry.name,
    image: toAbsoluteFileUrl(entry.store_logo ?? null),
    supplier: entry.supplier_name || entry.supplier || null,
    description:
      entry.short_description?.trim() || entry.description?.trim() || null,
    banners: [toAbsoluteFileUrl(entry.banner_image ?? null)].filter(
      (url): url is string => url !== null,
    ),
  };
}

export async function fetchStores(): Promise<Store[]> {
  const stores = await callFrappeMethod<SupplierStoreResponse[]>(
    'buy_in_minutes.api.get_supplier_stores',
    undefined,
    'stores',
  );

  return stores.map(mapStore);
}

// Fetch a single store fresh (e.g. to pull its `short_description` for the
// store page when the navigation param may be stale/partial). Matches on the
// store id first, then falls back to the supplier.
export async function fetchStore(
  idOrSupplier: string,
): Promise<Store | undefined> {
  const stores = await fetchStores();
  const key = idOrSupplier.trim().toLowerCase();
  return stores.find(
    store =>
      store.id.toLowerCase() === key ||
      store.supplier?.trim().toLowerCase() === key,
  );
}

export type SupplierReview = {
  id: string;
  reviewer: string;
  rating: number;
  text: string;
};

export type SupplierReviewSummary = {
  average: number;
  count: number;
  reviews: SupplierReview[];
};

// Rows returned by `buy_in_minutes.api.get_product_reviews` (reviews written on
// the supplier's "Supplier Website Profile").
type ProductReviewResponse = {
  id?: string | null;
  customerName?: string | null;
  rating?: number | null;
  description?: string | null;
};

// Reviews shown on the store page — the supplier's product reviews from the
// Supplier Website Profile. `average` / `count` are rolled up from the rows.
export async function fetchSupplierReviews(
  supplier: string,
): Promise<SupplierReviewSummary> {
  const rows = await callFrappeMethod<ProductReviewResponse[]>(
    'buy_in_minutes.api.get_product_reviews',
    { supplier },
    'supplier reviews',
  );

  const reviews: SupplierReview[] = (rows ?? []).map((row, index) => ({
    id: row.id?.trim() || `review-${index}`,
    reviewer: (row.customerName || 'Anonymous').trim(),
    rating: Math.max(0, Math.min(5, Number(row.rating) || 0)),
    text: (row.description || '').trim(),
  }));

  const rated = reviews.filter(review => review.rating > 0);
  const average =
    rated.length > 0
      ? rated.reduce((sum, review) => sum + review.rating, 0) / rated.length
      : 0;

  return { average, count: reviews.length, reviews };
}
