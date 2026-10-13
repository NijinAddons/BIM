import {
  callFrappeMethod,
  fetchResourceList,
  toAbsoluteFileUrl,
} from './frappe.client';

// One supplier the Item is assigned to (a row of the backend `supplier_options`).
export type SupplierOption = {
  name: string;
  displayName: string;
  image: string | null;
  outOfStock: boolean;
  // Supplier's geo coords (from the Supplier doctype), used for delivery ETAs.
  latitude: number | null;
  longitude: number | null;
  // Falls back to geocoding this when lat/long aren't set on the Supplier.
  address: string | null;
};

// Treat 0 / missing / non-finite coordinates as "no location set". Accepts
// numeric strings too, since a Data-type custom field comes back as text.
function toCoord(value: number | string | null | undefined): number | null {
  const num =
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof num === 'number' && Number.isFinite(num) && num !== 0
    ? num
    : null;
}

type CoordPair = { latitude: number; longitude: number };

// The storefront only serves the UAE (latitude ~22–27, longitude ~51–57).
const inUaeLatitude = (value: number) => value >= 22 && value <= 27;
const inUaeLongitude = (value: number) => value >= 51 && value <= 57;

/**
 * Latitude and longitude as one pair, or null unless both are valid. Never
 * mix the two halves from different records: a supplier with only one of
 * them filled in used to borrow the other from the item, producing a point
 * nowhere near the store and a wildly wrong delivery time.
 */
function toCoordPair(
  rawLatitude: number | string | null | undefined,
  rawLongitude: number | string | null | undefined,
): CoordPair | null {
  const latitude = toCoord(rawLatitude);
  const longitude = toCoord(rawLongitude);
  if (latitude == null || longitude == null) {
    return null;
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }
  // Entered the wrong way round in ERPNext (longitude in the latitude field)
  // — unambiguous for a UAE point, so swap it back.
  if (inUaeLongitude(latitude) && inUaeLatitude(longitude)) {
    return { latitude: longitude, longitude: latitude };
  }
  return { latitude, longitude };
}

/**
 * The default supplier's location for the delivery ETA/fee: the supplier's
 * own coordinates, else its address (geocoded later), and only then the
 * item-level fields.
 */
function resolveSupplierLocation(item: ItemResponse): {
  coords: CoordPair | null;
  address: string | null;
} {
  const supplierCoords = toCoordPair(
    item.supplier_custom_latitude,
    item.supplier_custom_longitude,
  );
  const supplierAddress = item.supplier_custom_google_address?.trim() || null;
  if (supplierCoords || supplierAddress) {
    return { coords: supplierCoords, address: supplierAddress };
  }
  return {
    coords: toCoordPair(item.custom_latitude, item.custom_longitude),
    address: item.custom_google_address?.trim() || null,
  };
}

// A single ERPNext Item Attribute for a variant item, e.g. { name: 'Size', value: 'L' }.
export type VariantAttribute = {
  name: string;
  value: string;
};

export type CategoryItem = {
  brand: string | null;
  id: string;
  image: string | null;
  images: string[];
  itemGroup: string;
  name: string;
  price: number;
  stock: number;
  // Per-item delivery fee (ERPNext `custom_delivery_fee`), or null if unset.
  deliveryFee: number | null;
  // Whether checkout must collect a delivery/pickup time slot for this item
  // (ERPNext `custom_delivery_slots`) — mirrors the web app's cart page.
  requiresDeliverySlot: boolean;
  supplier: string | null;
  supplierOptions: SupplierOption[];
  // Default supplier's geo coords (+ address fallback), for the delivery ETA.
  supplierLatitude: number | null;
  supplierLongitude: number | null;
  supplierAddress: string | null;
  // The template Item this is a variant of (ERPNext `variant_of`), or null.
  variantOf: string | null;
  variantAttributes: VariantAttribute[];
  // Item Group's `custom_rfq_only` — show "Request Quotation" instead of
  // the cart control for these items (see `ProductCard.tsx`).
  rfqOnly: boolean;
  // Set only on Product Bundle kits (see `bundles.service.ts`): the weekly
  // basic kit, or one week's kit.
  kitRole?: KitRole;
  // How a kit in the cart is bought. Kept on the cart line only for now —
  // checkout doesn't send it to ERPNext yet.
  kitPlan?: KitPlan;
};

export type KitRole = 'basic' | 'week';

/** `one-time`: a single delivery. `monthly`: 4 weekly deliveries, auto-renewing. */
export type KitPlan = 'one-time' | 'monthly';

type ItemAttachment = {
  file_name: string;
  file_url: string;
};

type SupplierOptionResponse = {
  name: string;
  display_name?: string | null;
  image?: string | null;
  custom_out_of_stock?: boolean | number | string | null;
  custom_latitude?: number | null;
  custom_longitude?: number | null;
  custom_google_address?: string | null;
};

// `variant_attributes` rows from `get_items` (attribute label + resolved value).
type VariantAttributeResponse = {
  attribute?: string | null;
  value?: string | null;
};

type ItemResponse = {
  actual_qty?: number | null;
  attachments: ItemAttachment[] | null;
  brand: string | null;
  disabled?: 0 | 1 | null;
  custom_delivery_fee?: number | null;
  custom_delivery_slots?: boolean | number | string | null;
  custom_out_of_stock?: boolean | number | string | null;
  custom_stock_qty?: number | null;
  image: string | null;
  item_code: string;
  item_group: string | null;
  item_name: string;
  price_list_rate: number;
  selling_price: number;
  standard_rate: number;
  supplier_display_name: string | null;
  supplier_name: string | null;
  supplier_custom_latitude?: number | null;
  supplier_custom_longitude?: number | null;
  supplier_custom_google_address?: string | null;
  custom_latitude?: number | null;
  custom_longitude?: number | null;
  custom_google_address?: string | null;
  supplier_options?: SupplierOptionResponse[] | null;
  variant_of?: string | null;
  variant_attributes?: VariantAttributeResponse[] | null;
  // Stamped per-item from its Item Group by the backend's
  // `_apply_item_group_images` — same field, several possible shapes
  // depending on how the Check field was set up on the site.
  custom_rfq_only?: boolean | number | string | null;
};

// Suppliers this Item is assigned to, deduped by supplier name.
function mapSupplierOptions(
  rows: SupplierOptionResponse[] | null | undefined,
): SupplierOption[] {
  const seen = new Set<string>();
  return (rows ?? []).reduce<SupplierOption[]>((options, row) => {
    const name = row.name?.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      const coords = toCoordPair(row.custom_latitude, row.custom_longitude);
      options.push({
        name,
        displayName: row.display_name?.trim() || name,
        image: toAbsoluteFileUrl(row.image ?? null),
        outOfStock: toTruthyFlag(row.custom_out_of_stock),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        address: row.custom_google_address?.trim() || null,
      });
    }
    return options;
  }, []);
}

// The item's ERPNext variant attributes (Colour / Size / …), trimmed and
// deduped by attribute label, dropping any without both label and value.
function mapVariantAttributes(
  rows: VariantAttributeResponse[] | null | undefined,
): VariantAttribute[] {
  const seen = new Set<string>();
  return (rows ?? []).reduce<VariantAttribute[]>((attributes, row) => {
    const name = row.attribute?.trim();
    const value = row.value?.trim();
    if (name && value && !seen.has(name)) {
      seen.add(name);
      attributes.push({ name, value });
    }
    return attributes;
  }, []);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.abs(hash * 31 + value.charCodeAt(i)) % 1000000;
  }
  return hash;
}

// The Item's selling rate from the Pricing tab — its Item Price on the
// "Standard Selling" price list, which `get_items` returns as `selling_price`.
function resolvePrice(item: { selling_price?: number | null }): number {
  return item.selling_price ?? 0;
}

type StockFields = {
  item_code: string;
  actual_qty?: number | null;
  custom_stock_qty?: number | null;
};

// TODO(backend): replace with the real stock field once get_items exposes it.
// For now derive a stable placeholder from the item code: 0 = out of stock,
// small numbers surface the "Only N left" state.
function resolveStock(item: StockFields): number {
  if (typeof item.actual_qty === 'number') {
    return Math.max(0, item.actual_qty);
  }
  if (typeof item.custom_stock_qty === 'number') {
    return Math.max(0, item.custom_stock_qty);
  }
  return hashString(item.item_code) % 15;
}

// Whether an item is out of stock for a given supplier: the supplier's own
// out-of-stock flag (set per supplier_options row) takes precedence, since a
// supplier can be out while others assigned to the same item aren't. Falls
// back to the item's overall stock qty when no matching supplier is found.
export function isOutOfStockForSupplier(
  item: Pick<CategoryItem, 'stock' | 'supplierOptions'>,
  supplier: string | null,
): boolean {
  if (!supplier) {
    return item.stock <= 0;
  }
  const option = item.supplierOptions.find(
    opt => opt.displayName === supplier || opt.name === supplier,
  );
  return option ? option.outOfStock : item.stock <= 0;
}

// Gallery images come from the item's Attachments section, with the primary image first and duplicates removed.
function resolveImages(item: ItemResponse): string[] {
  const urls = [
    item.image,
    ...(item.attachments ?? []).map(attachment => attachment.file_url),
  ]
    .map(toAbsoluteFileUrl)
    .filter((url): url is string => url !== null);

  return Array.from(new Set(urls));
}

// Mirrors the web app's `itemRequiresDeliverySlot`/`isRfqOnlyItem` — a
// Frappe Check/Select field can come back as 0/1, "Yes", or a boolean
// depending on how it was set up on the site, so check every truthy
// variant rather than one shape.
function toTruthyFlag(
  value: boolean | number | string | null | undefined,
): boolean {
  return value === true || value === 1 || value === '1' || value === 'Yes';
}

function mapItem(item: ItemResponse, fallbackGroup = ''): CategoryItem {
  const supplierLocation = resolveSupplierLocation(item);
  const supplierOptions = mapSupplierOptions(item.supplier_options);
  const outOfStock =
    toTruthyFlag(item.custom_out_of_stock) ||
    (supplierOptions.length > 0 &&
      supplierOptions.every(option => option.outOfStock));
  return {
    brand: item.brand,
    id: item.item_code,
    image: toAbsoluteFileUrl(item.image),
    images: resolveImages(item),
    itemGroup: item.item_group ?? fallbackGroup,
    name: item.item_name,
    price: resolvePrice(item),
    stock: outOfStock ? 0 : resolveStock(item),
    deliveryFee:
      typeof item.custom_delivery_fee === 'number'
        ? item.custom_delivery_fee
        : null,
    requiresDeliverySlot: toTruthyFlag(item.custom_delivery_slots),
    supplier: item.supplier_display_name || item.supplier_name,
    supplierOptions,
    supplierLatitude: supplierLocation.coords?.latitude ?? null,
    supplierLongitude: supplierLocation.coords?.longitude ?? null,
    supplierAddress: supplierLocation.address,
    variantOf: item.variant_of?.trim() || null,
    variantAttributes: mapVariantAttributes(item.variant_attributes),
    rfqOnly: toTruthyFlag(item.custom_rfq_only),
  };
}

// Codes of Items ticked "Published" (`custom_published`) in ERPNext.
// `get_items` doesn't return that field, so it's looked up separately on
// every load, so publishing/unpublishing in ERPNext shows up on the next
// screen load. Calls within a few seconds share one request, since Home
// loads many item groups at once.
const PUBLISHED_REUSE_MS = 5000;
let publishedItemCodes: {
  fetchedAt: number;
  pending: Promise<Set<string>>;
} | null = null;

function getPublishedItemCodes(): Promise<Set<string>> {
  const now = Date.now();
  if (
    publishedItemCodes &&
    now - publishedItemCodes.fetchedAt < PUBLISHED_REUSE_MS
  ) {
    return publishedItemCodes.pending;
  }
  const pending = fetchResourceList<{ name: string }>(
    'Item',
    {
      fields: ['name'],
      filters: [['custom_published', '=', 1]],
      limit: 0,
    },
    'published items',
  )
    .then(rows => new Set(rows.map(row => row.name)))
    .catch(error => {
      publishedItemCodes = null;
      throw error;
    });
  publishedItemCodes = { fetchedAt: now, pending };
  return pending;
}

// Only Items that are published and not disabled should reach the storefront.
// Out-of-stock status is applied after mapping by forcing `stock` to 0, so
// products stay visible and render with the card's Sold out label.
async function onlyPublished<T extends ItemResponse>(items: T[]): Promise<T[]> {
  const published = await getPublishedItemCodes();
  return items.filter(
    item => item.disabled !== 1 && published.has(item.item_code),
  );
}

function fetchGroupItemResponses(itemGroup: string): Promise<ItemResponse[]> {
  return callFrappeMethod<ItemResponse[]>(
    'buy_in_minutes.api.get_items',
    { item_group: itemGroup },
    'items',
  );
}

async function toGroupItems(
  items: ItemResponse[],
  itemGroup: string,
): Promise<CategoryItem[]> {
  return (await onlyPublished(items)).map(item => mapItem(item, itemGroup));
}

export async function fetchItemsByGroup(
  itemGroup: string,
): Promise<CategoryItem[]> {
  return toGroupItems(await fetchGroupItemResponses(itemGroup), itemGroup);
}

// Requires `buy_in_minutes.api.get_items` to honour a `brand` filter param.
export async function fetchItemsByBrand(
  brand: string,
): Promise<CategoryItem[]> {
  const items = await callFrappeMethod<ItemResponse[]>(
    'buy_in_minutes.api.get_items',
    { brand },
    'brand items',
  );

  return (await onlyPublished(items)).map(item => mapItem(item));
}

// Products sold by a supplier / store. `get_items` doesn't filter by supplier
// server-side yet, so match on the item's default supplier or its assigned
// supplier options.
export async function fetchItemsBySupplier(
  supplier: string,
): Promise<CategoryItem[]> {
  const items = await callFrappeMethod<ItemResponse[]>(
    'buy_in_minutes.api.get_items',
    { supplier },
    'store items',
  );

  const target = supplier.trim().toLowerCase();
  return (await onlyPublished(items))
    .map(item => mapItem(item))
    .filter(item => {
      if (item.supplier?.trim().toLowerCase() === target) {
        return true;
      }
      return item.supplierOptions.some(
        option =>
          option.name.trim().toLowerCase() === target ||
          option.displayName.trim().toLowerCase() === target,
      );
    })
    .map(item =>
      isOutOfStockForSupplier(item, supplier) ? { ...item, stock: 0 } : item,
    );
}

export type ItemVariant = {
  id: string;
  name: string;
  image: string | null;
  price: number;
  stock: number;
  attributes: VariantAttribute[];
};

// Rows of the Item Variant Attribute child table on a variant Item.
type ItemAttributeRow = {
  attribute: string;
  attribute_value: string;
};

type ItemVariantResponse = {
  item_code: string;
  item_name: string;
  image?: string | null;
  attributes?: ItemAttributeRow[] | null;
  actual_qty?: number | null;
  custom_stock_qty?: number | null;
  price_list_rate?: number | null;
  selling_price?: number | null;
  standard_rate?: number | null;
};

// Requires `buy_in_minutes.api.get_item_variants` returning the variant Items
// of `item_code` (those with `variant_of` = item_code) plus their attributes.
export async function fetchItemVariants(
  itemCode: string,
): Promise<ItemVariant[]> {
  const variants = await callFrappeMethod<ItemVariantResponse[]>(
    'buy_in_minutes.api.get_item_variants',
    { item_code: itemCode },
    'variants',
  );

  const published = await getPublishedItemCodes();
  return variants
    .filter(variant => published.has(variant.item_code))
    .map(variant => ({
      id: variant.item_code,
      name: variant.item_name,
      image: toAbsoluteFileUrl(variant.image ?? null),
      price: resolvePrice(variant),
      stock: resolveStock(variant),
      attributes: (variant.attributes ?? []).map(row => ({
        name: row.attribute,
        value: row.attribute_value,
      })),
    }));
}
