import { fetchResource, fetchResourceList, toAbsoluteFileUrl } from './frappe.client';
import type { CategoryItem, KitRole } from './items.service';

/**
 * Weekly vegetable kits, modelled in ERPNext as Product Bundles: the bundle's
 * parent Item is what goes in the cart and on the Sales Order (ERPNext
 * expands it into the component items itself), and its child rows are the
 * kit's contents.
 *
 * The bundle whose Item is named `BASIC_KIT_NAME` is the basic kit: the
 * same essentials every week, sold on its own. Every other enabled,
 * published bundle is one week's kit ("Week 1 – Kerala Regular Kit", …),
 * also sold on its own; week kits go out on Saturdays and rotate by week of
 * the month (see `kitIndexForDate`). Only the kit for the next open
 * Saturday can be ordered, until 5 PM the Friday before (see
 * `nextKitDeliveryDate`). A customer can take a week kit, the basic kit, or
 * both.
 */
export const BASIC_KIT_NAME = 'Weekly Basic Kit';

// Kits aren't stock items, so the cart caps them at this per-order quantity
// instead of a stock figure.
const KIT_MAX_QTY = 10;

const SELLING_PRICE_LIST = 'Standard Selling';

export type BundleComponent = {
  itemCode: string;
  name: string;
  image: string | null;
  qty: number;
  uom: string | null;
};

export type ProductBundle = {
  /** `basic`: the Weekly Basic Kit. `week`: one week's rotating kit. */
  role: KitRole;
  /** The bundle's parent Item, shaped for the cart and checkout. */
  item: CategoryItem;
  /** "Weekly Basic Kit", "Week 1 – Kerala Regular Kit". */
  label: string;
  components: BundleComponent[];
  /** Total of the components measured by weight, or null if none are. */
  weightKg: number | null;
};

type BundleListRow = { name: string; new_item_code: string };

type BundleDoc = {
  new_item_code: string;
  items: Array<{ item_code: string; qty: number; uom: string | null }>;
};

type ItemRow = {
  item_code: string;
  item_name: string;
  image: string | null;
  item_group: string | null;
  stock_uom: string | null;
  brand?: string | null;
  custom_published?: 0 | 1 | null;
  disabled?: 0 | 1 | null;
};

type ItemPriceRow = { item_code: string; price_list_rate: number };

function toKitItem(row: ItemRow, role: KitRole, price: number): CategoryItem {
  const image = toAbsoluteFileUrl(row.image);
  return {
    brand: row.brand || null,
    id: row.item_code,
    image,
    images: image ? [image] : [],
    itemGroup: row.item_group ?? '',
    name: row.item_name,
    price,
    stock: KIT_MAX_QTY,
    deliveryFee: null,
    requiresDeliverySlot: false,
    supplier: null,
    supplierOptions: [],
    supplierLatitude: null,
    supplierLongitude: null,
    supplierAddress: null,
    variantOf: null,
    variantAttributes: [],
    rfqOnly: false,
    kitRole: role,
  };
}

/**
 * A quantity in kg, or null when its unit isn't a weight. Some bundle rows
 * hold kilograms under a Gram UOM ("0.75 Gram" for 750 g), so a gram figure
 * below 10 is read as kilograms — no kit packs less than 10 g of a vegetable.
 */
function toKg(qty: number, uom: string | null): number | null {
  const unit = uom?.trim() ?? '';
  if (/^(gram|g|gm)s?$/i.test(unit)) {
    return qty < 10 ? qty : qty / 1000;
  }
  if (/^(kilogram|kg)s?$/i.test(unit)) {
    return qty;
  }
  return null;
}

function componentKg(component: BundleComponent): number | null {
  return toKg(component.qty, component.uom);
}

function totalKg(components: BundleComponent[]): number | null {
  const weights = components
    .map(componentKg)
    .filter((kg): kg is number => kg !== null);
  return weights.length > 0 ? weights.reduce((sum, kg) => sum + kg, 0) : null;
}

/**
 * Enabled bundles whose parent Item is published: the basic kit first, then
 * the week kits in item-code order (VG-30 is week 1, VG-31 week 2, …). A kit
 * without a selling price comes back with `price: 0`; the UI shows it but
 * doesn't let it be ordered.
 */
export async function fetchProductBundles(): Promise<ProductBundle[]> {
  const rows = await fetchResourceList<BundleListRow>(
    'Product Bundle',
    {
      fields: ['name', 'new_item_code'],
      filters: [['disabled', '=', 0]],
      limit: 100,
    },
    'kits',
  );
  if (rows.length === 0) {
    return [];
  }

  // The list API doesn't return child tables, so read each bundle for its
  // contents.
  const docs = await Promise.all(
    rows.map(row => fetchResource<BundleDoc>('Product Bundle', row.name, 'kit')),
  );

  const parentCodes = docs.map(doc => doc.new_item_code);
  const allCodes = [
    ...new Set([
      ...parentCodes,
      ...docs.flatMap(doc => doc.items.map(row => row.item_code)),
    ]),
  ];

  const [items, prices] = await Promise.all([
    fetchResourceList<ItemRow>(
      'Item',
      {
        fields: [
          'item_code',
          'item_name',
          'image',
          'item_group',
          'stock_uom',
          'brand',
          'custom_published',
          'disabled',
        ],
        filters: [['item_code', 'in', allCodes]],
        limit: allCodes.length,
      },
      'kit items',
    ),
    fetchResourceList<ItemPriceRow>(
      'Item Price',
      {
        fields: ['item_code', 'price_list_rate'],
        filters: [
          ['item_code', 'in', parentCodes],
          ['price_list', '=', SELLING_PRICE_LIST],
        ],
        limit: parentCodes.length * 4,
      },
      'kit prices',
    ),
  ]);

  const itemsByCode = new Map(items.map(item => [item.item_code, item]));
  const priceByCode = new Map(
    prices.map(price => [price.item_code, price.price_list_rate]),
  );

  const kits: ProductBundle[] = [];
  for (const doc of docs) {
    const parent = itemsByCode.get(doc.new_item_code);
    if (!parent || parent.disabled === 1 || parent.custom_published !== 1) {
      continue;
    }
    const role: KitRole =
      parent.item_name.trim().toLowerCase() === BASIC_KIT_NAME.toLowerCase()
        ? 'basic'
        : 'week';
    const components = doc.items.map(row => {
      const component = itemsByCode.get(row.item_code);
      return {
        itemCode: row.item_code,
        name: component?.item_name ?? row.item_code,
        image: toAbsoluteFileUrl(component?.image ?? null),
        qty: row.qty,
        uom: row.uom ?? component?.stock_uom ?? null,
      };
    });
    kits.push({
      role,
      item: toKitItem(parent, role, priceByCode.get(parent.item_code) ?? 0),
      label: parent.item_name,
      components,
      weightKg: totalKg(components),
    });
  }

  const basic = kits.filter(kit => kit.role === 'basic');
  const weeks = kits
    .filter(kit => kit.role === 'week')
    .sort((a, b) =>
      a.item.id.localeCompare(b.item.id, undefined, { numeric: true }),
    )
    // Kit names may already say "Week 2 …"; otherwise number them.
    .map((kit, index) =>
      /^week\s*\d/i.test(kit.label)
        ? kit
        : { ...kit, label: `Week ${index + 1} – ${kit.label}` },
    );
  return [...basic, ...weeks];
}

/** Week kit orders for a Saturday close at this hour on the Friday before. */
export const KIT_ORDER_CUTOFF_HOUR = 17;

/** When orders for the Saturday `delivery` close: 5 PM the Friday before. */
export function kitOrderCutoff(delivery: Date): Date {
  return new Date(
    delivery.getFullYear(),
    delivery.getMonth(),
    delivery.getDate() - 1,
    KIT_ORDER_CUTOFF_HOUR,
  );
}

/**
 * The next Saturday still open for orders at `from`: the coming Saturday
 * until its Friday cutoff, then the one after (a week later if `from` is a
 * Saturday).
 */
export function nextKitDeliveryDate(from: Date = new Date()): Date {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7 || 7));
  if (from >= kitOrderCutoff(date)) {
    date.setDate(date.getDate() + 7);
  }
  return date;
}

/**
 * Which kit (index into the name-ordered list) goes out on `date`: the 1st
 * Saturday of the month gets the first kit, the 2nd the second, and so on,
 * wrapping when there are fewer kits than Saturdays.
 */
export function kitIndexForDate(date: Date, kitCount: number): number {
  if (kitCount <= 0) {
    return -1;
  }
  return Math.floor((date.getDate() - 1) / 7) % kitCount;
}

/** "6.55 kg". */
export function formatKg(kg: number): string {
  return `${Number(kg.toFixed(2))} kg`;
}

/** "1000 Gram" → "1 kg", "0.5 Gram" → "500 g", "1 Pack" → "1 Pack". */
export function formatComponentQty(qty: number, uom: string | null): string {
  const trim = (value: number) =>
    Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  const kg = toKg(qty, uom);
  if (kg !== null) {
    return kg >= 1 ? `${trim(kg)} kg` : `${trim(kg * 1000)} g`;
  }
  const unit = uom?.trim() ?? '';
  return unit ? `${trim(qty)} ${unit}` : trim(qty);
}

export type KitItemDetails = {
  itemCode: string;
  name: string;
  /** Plain text — ERPNext stores the description as HTML. */
  description: string | null;
  itemGroup: string | null;
  brand: string | null;
  countryOfOrigin: string | null;
  images: string[];
};

type ItemDoc = {
  item_code: string;
  item_name: string;
  description?: string | null;
  item_group?: string | null;
  brand?: string | null;
  country_of_origin?: string | null;
  image?: string | null;
};

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Full details of one item inside a kit, for the kit item sheet. Kit
 * contents usually aren't published on their own, so this reads the Item
 * doc directly rather than going through the storefront item lists.
 */
export async function fetchKitItemDetails(
  itemCode: string,
): Promise<KitItemDetails> {
  const doc = await fetchResource<ItemDoc>('Item', itemCode, 'kit item');
  const description = doc.description ? htmlToText(doc.description) : '';
  const image = toAbsoluteFileUrl(doc.image ?? null);
  return {
    itemCode: doc.item_code,
    name: doc.item_name,
    // ERPNext defaults the description to the item name — not worth showing.
    description:
      description && description !== doc.item_name ? description : null,
    itemGroup: doc.item_group || null,
    brand: doc.brand || null,
    countryOfOrigin: doc.country_of_origin || null,
    images: image ? [image] : [],
  };
}
