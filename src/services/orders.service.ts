import {
  fetchResource,
  fetchResourceList,
  htmlToText,
  postFrappeMethod,
} from './frappe.client';

/** Coarse status buckets the UI styles against (see `STATUS_STYLES`). */
export type OrderStatusKey =
  | 'Delivered'
  | 'Processing'
  | 'Out for delivery'
  | 'Cancelled';

// ERPNext `Sales Order.status` → UI bucket.
const STATUS_MAP: Record<string, OrderStatusKey> = {
  Completed: 'Delivered',
  Closed: 'Delivered',
  'To Deliver': 'Out for delivery',
  'To Deliver and Bill': 'Out for delivery',
  'To Bill': 'Processing',
  'On Hold': 'Processing',
  Draft: 'Processing',
  Cancelled: 'Cancelled',
};

export function mapSalesOrderStatus(raw: string | null): OrderStatusKey {
  return (raw && STATUS_MAP[raw]) || 'Processing';
}

export type SalesOrderSummary = {
  id: string; // Sales Order `name`
  date: string; // e.g. "Aug 22, 2026"
  isoDate: string; // `transaction_date`, `YYYY-MM-DD` — for sorting
  rawStatus: string; // ERPNext status verbatim
  statusKey: OrderStatusKey;
  total: string; // e.g. "AED 86.50"
  totalAmount: number;
  currency: string;
  itemQty: number; // `total_qty`
  customer: string;
  customerName: string | null;
};

export type SalesOrderLine = {
  id: string;
  itemName: string;
  qty: number;
  rate: string;
  amount: string;
};

export type SalesOrderDetail = SalesOrderSummary & {
  items: SalesOrderLine[];
  subtotal: string;
  taxesAndCharges: string;
  address: string | null;
};

type SalesOrderRow = {
  name: string;
  transaction_date: string | null;
  status: string | null;
  grand_total: number | null;
  rounded_total: number | null;
  currency: string | null;
  total_qty: number | null;
  customer: string | null;
  customer_name: string | null;
};

type SalesOrderDoc = SalesOrderRow & {
  net_total: number | null;
  total: number | null;
  total_taxes_and_charges: number | null;
  address_display: string | null;
  shipping_address: string | null;
  items: Array<{
    name: string;
    item_code: string | null;
    item_name: string | null;
    qty: number | null;
    rate: number | null;
    amount: number | null;
  }> | null;
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatDate(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) {
    return iso;
  }
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function formatMoney(amount: number | null, currency: string | null): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return `${currency || 'AED'} ${value.toFixed(2)}`;
}

const SUMMARY_FIELDS = [
  'name',
  'transaction_date',
  'status',
  'grand_total',
  'rounded_total',
  'currency',
  'total_qty',
  'customer',
  'customer_name',
];

function toSummary(row: SalesOrderRow): SalesOrderSummary {
  const amount = row.rounded_total || row.grand_total || 0;
  return {
    id: row.name,
    date: formatDate(row.transaction_date),
    isoDate: row.transaction_date || '',
    rawStatus: row.status || 'Draft',
    statusKey: mapSalesOrderStatus(row.status),
    total: formatMoney(amount, row.currency),
    totalAmount: amount,
    currency: row.currency || 'AED',
    itemQty: Math.round(row.total_qty || 0),
    customer: row.customer || '',
    customerName: row.customer_name || null,
  };
}

/**
 * List Sales Orders, newest first.
 *
 * @param options.customer Filter to one Customer docname (omit for all orders).
 * @param options.limit    Max rows (default 50).
 */
export async function fetchSalesOrders(
  options: {customer?: string; limit?: number} = {},
): Promise<SalesOrderSummary[]> {
  const rows = await fetchResourceList<SalesOrderRow>(
    'Sales Order',
    {
      fields: SUMMARY_FIELDS,
      filters: options.customer
        ? [['customer', '=', options.customer]]
        : undefined,
      orderBy: 'transaction_date desc, creation desc',
      limit: options.limit ?? 50,
    },
    'orders',
  );

  return rows.map(toSummary);
}

/** Fetch one Sales Order with its line items and totals. */
export async function fetchSalesOrder(name: string): Promise<SalesOrderDetail> {
  const doc = await fetchResource<SalesOrderDoc>('Sales Order', name, 'order');
  const currency = doc.currency || 'AED';

  return {
    ...toSummary(doc),
    subtotal: formatMoney(doc.net_total ?? doc.total ?? 0, currency),
    taxesAndCharges: formatMoney(doc.total_taxes_and_charges ?? 0, currency),
    address: htmlToText(doc.address_display) ?? htmlToText(doc.shipping_address),
    items: (doc.items ?? []).map(line => ({
      id: line.name,
      itemName: line.item_name || line.item_code || 'Item',
      qty: Math.round(line.qty || 0),
      rate: formatMoney(line.rate ?? 0, currency),
      amount: formatMoney(line.amount ?? 0, currency),
    })),
  };
}

/** Resolve the ERPNext Customer linked to a phone number (Customer.mobile_no). */
export async function findCustomerByMobile(
  mobileNo: string,
): Promise<string | null> {
  const rows = await fetchResourceList<{name: string}>(
    'Customer',
    {fields: ['name'], filters: [['mobile_no', '=', mobileNo]], limit: 1},
    'customer lookup',
  );
  return rows[0]?.name ?? null;
}

/**
 * Resolve the Customer for a signed-in app user, mirroring the backend's
 * `_get_or_create_customer_for_user` (`buy_in_minutes/payment.py`): match on
 * `Customer.email_id` first, then fall back to `Customer.mobile_no`.
 */
export async function findCustomerForUser(user: {
  email?: string | null;
  mobile_no?: string | null;
}): Promise<string | null> {
  if (user.email) {
    const rows = await fetchResourceList<{name: string}>(
      'Customer',
      {fields: ['name'], filters: [['email_id', '=', user.email]], limit: 1},
      'customer lookup',
    );
    if (rows[0]) {
      return rows[0].name;
    }
  }
  return user.mobile_no ? findCustomerByMobile(user.mobile_no) : null;
}

/**
 * Sales Orders belonging to the signed-in user. Returns an empty list when the
 * user has no Customer record yet (never an unfiltered list of everyone's
 * orders).
 */
export async function fetchSalesOrdersForUser(
  user: {email?: string | null; mobile_no?: string | null},
  options: {limit?: number} = {},
): Promise<SalesOrderSummary[]> {
  const customer = await findCustomerForUser(user);
  if (!customer) {
    return [];
  }
  return fetchSalesOrders({customer, limit: options.limit});
}

export type PlaceOrderItem = {
  item_code: string;
  quantity: number;
  rate: number;
  supplier?: string;
  size?: string;
};

export type PlaceCashOnDeliveryOrderParams = {
  items: PlaceOrderItem[];
  /** ISO date, `YYYY-MM-DD`. */
  deliveryDate: string;
  /** e.g. `"10 AM - 12 PM"` (see `CartScreen.tsx`'s `DELIVERY_SLOTS`). */
  deliverySlot: string | null;
  deliveryFee: number;
  customerPickup: boolean;
  addressDisplay: string | null;
};

export type PlaceCashOnDeliveryOrderResponse = {
  success: boolean;
  sales_order: string;
  purchase_orders: string[];
  payment_method: string;
};

/**
 * Place a Cash on Delivery order via the backend's whitelisted
 * `create_cash_on_delivery_order` method (confirmed against the actual
 * backend source, `buy_in_minutes/payment.py` on the Frappe Cloud bench —
 * available locally at
 * `~/frappe-dev/frappe-bench/apps/buy_in_minutes/buy_in_minutes/payment.py`).
 *
 * The prior "Cart is empty" (417) was never a session/cart-sync
 * architecture issue — `create_cash_on_delivery_order` already builds the
 * Sales Order straight from a `cart_items` argument, no server-side cart
 * lookup at all. The bug was simply that this app was posting the payload
 * under the wrong key (`items` instead of `cart_items`) with the wrong item
 * shape (`qty` instead of `quantity`), so the backend's `cart_items`
 * parameter was always `None`, and `_normalize_cart_items(None)`
 * immediately throws `"Cart is empty."` — matching the error exactly.
 *
 * `_upsert_sales_order` runs entirely with `ignore_permissions=True`, so
 * this also sidesteps the earlier direct-REST 403 by construction — no
 * Sales Order doctype permission is needed on the calling user at all.
 *
 * Known gap (not fixed here): `_upsert_sales_order` resolves the order's
 * `customer` via `_get_or_create_customer_for_user(frappe.session.user)` —
 * i.e. whoever `frappe.session.user` resolves to server-side, which today
 * is this app's static API key's account, not the actual signed-in app
 * customer (see `frappe.client.ts`). Every order will currently be
 * attributed to that one account until requests are authenticated as the
 * real customer.
 *
 * Structured `delivery_address` (building/area/etc., required by
 * `_get_or_create_customer_address` when present) is intentionally omitted
 * here — this app only collects a free-text address (`useLocation`'s
 * `address`), which is instead sent as `address_display` and gets persisted
 * onto the Sales Order directly, independent of the structured address
 * object.
 */
export async function placeCashOnDeliveryOrder(
  params: PlaceCashOnDeliveryOrderParams,
): Promise<PlaceCashOnDeliveryOrderResponse> {
  const response = await postFrappeMethod<PlaceCashOnDeliveryOrderResponse>(
    'buy_in_minutes.payment.create_cash_on_delivery_order',
    {
      cart_items: params.items,
      delivery_date: params.deliveryDate,
      delivery_slot: params.deliverySlot,
      delivery_fee: params.deliveryFee,
      customer_pickup: params.customerPickup,
      address_display: params.addressDisplay,
    },
    'cash on delivery order',
  );
  console.log('create_cash_on_delivery_order response', response);
  return response;
}
