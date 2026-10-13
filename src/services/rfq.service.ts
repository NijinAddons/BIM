import {
  createResource,
  fetchResource,
  fetchResourceList,
  htmlToText,
  toAbsoluteFileUrl,
  updateResource,
} from './frappe.client';
import { formatDate, formatMoney } from './orders.service';

export type QuotationRequestItem = {
  item_code: string;
  quantity: number;
  supplier?: string;
  // Supplier display name — matched on `supplier_name` when `supplier`
  // isn't a Supplier ID.
  supplier_name?: string;
  size?: string;
};

export type CreateRequestForQuotationParams = {
  items: QuotationRequestItem[];
  /** ISO date, `YYYY-MM-DD` — the RFQ's `schedule_date`. */
  requiredDate: string;
  /** Stored on the RFQ's `custom_email` so the customer can be contacted. */
  email: string;
  /** Where the quoted items go — stored on `shipping_address_display`. */
  address: string;
  /** Delivery contact number — added to `shipping_address_display`. */
  phone: string;
};

export type CreateRequestForQuotationResponse = {
  name: string;
  suppliers: string[];
  company: string;
  status: string;
  item_count: number;
};

type ItemDoc = {
  name: string;
  item_name: string | null;
  description: string | null;
  stock_uom: string;
  is_stock_item: 0 | 1;
  item_defaults?: Array<{ company: string; default_warehouse: string | null }>;
  supplier_items?: Array<{ supplier: string }>;
};

type SupplierDoc = {
  name: string;
  custom_supplier_warehouse?: string | null;
};

type RequestForQuotationDoc = {
  name: string;
  company: string;
  status: string;
  suppliers: Array<{ supplier: string }>;
  items: unknown[];
};

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function getDefaultCompany(): Promise<string> {
  const defaults = await fetchResource<{ default_company: string | null }>(
    'Global Defaults',
    'Global Defaults',
    'default company',
  );
  if (!defaults.default_company) {
    throw new Error('No default company is configured in ERPNext.');
  }
  return defaults.default_company;
}

// First candidate that matches a Supplier by ID, then by display name.
async function findSupplier(
  candidates: Array<string | null | undefined>,
): Promise<SupplierDoc | null> {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) {
      continue;
    }
    for (const field of ['name', 'supplier_name']) {
      const [match] = await fetchResourceList<SupplierDoc>(
        'Supplier',
        {
          fields: ['name', 'custom_supplier_warehouse'],
          filters: [[field, '=', value]],
          limit: 1,
        },
        'supplier',
      );
      if (match) {
        return match;
      }
    }
  }
  return null;
}

/**
 * Submit the cart's RFQ-only items (Item Group `custom_rfq_only`) as one
 * ERPNext Request for Quotation, created directly through the standard
 * `/api/resource` API — the same document ERP's own form creates. Stock items
 * need a warehouse: the supplier's `custom_supplier_warehouse`, else the
 * item's default warehouse for the company.
 */
export async function createRequestForQuotation(
  params: CreateRequestForQuotationParams,
): Promise<CreateRequestForQuotationResponse> {
  const company = await getDefaultCompany();
  const supplierNames = new Set<string>();

  const rfqItems = await Promise.all(
    params.items.map(async cartItem => {
      const item = await fetchResource<ItemDoc>(
        'Item',
        cartItem.item_code,
        `product ${cartItem.item_code}`,
      );
      const supplier = await findSupplier([
        cartItem.supplier,
        cartItem.supplier_name,
        ...(item.supplier_items ?? []).map(row => row.supplier),
      ]);
      if (!supplier) {
        throw new Error(`Supplier was not found for product ${item.name}.`);
      }
      supplierNames.add(supplier.name);

      const warehouse =
        supplier.custom_supplier_warehouse ||
        item.item_defaults?.find(row => row.company === company)
          ?.default_warehouse ||
        null;
      if (item.is_stock_item && !warehouse) {
        throw new Error(
          `No warehouse is set for supplier ${supplier.name} (product ${item.name}).`,
        );
      }

      const baseDescription = item.description || item.item_name || item.name;
      return {
        item_code: item.name,
        item_name: item.item_name || item.name,
        description: cartItem.size
          ? `${baseDescription}\n\nSelected Size: ${cartItem.size}`
          : baseDescription,
        qty: Math.max(1, Math.floor(cartItem.quantity)),
        uom: item.stock_uom,
        stock_uom: item.stock_uom,
        conversion_factor: 1,
        schedule_date: params.requiredDate,
        warehouse,
      };
    }),
  );

  // Insert as a draft, then submit — inserting with `docstatus: 1` skips
  // ERPNext setting the RFQ's `status` and fails its mandatory check.
  const draft = await createResource<RequestForQuotationDoc>(
    'Request for Quotation',
    {
      company,
      schedule_date: params.requiredDate,
      message_for_supplier:
        'Please share your best quotation for the requested items.',
      custom_email: params.email,
      // Text Editor field, so `<br>` keeps the phone on its own line in ERP.
      shipping_address_display: `${escapeHtml(
        params.address,
      )}<br>Phone: ${escapeHtml(params.phone)}`,
      suppliers: [...supplierNames]
        .sort()
        .map(supplier => ({ supplier, send_email: 0 })),
      items: rfqItems,
    },
    'request for quotation',
  );
  const rfq = await updateResource<RequestForQuotationDoc>(
    'Request for Quotation',
    draft.name,
    { docstatus: 1 },
    `request for quotation ${draft.name}`,
  );

  return {
    name: rfq.name,
    suppliers: rfq.suppliers.map(row => row.supplier),
    company: rfq.company,
    status: rfq.status,
    item_count: rfq.items.length,
  };
}

export type QuotationRequestLine = {
  itemCode: string;
  itemName: string;
  qty: number;
};

export type QuotationRequestSummary = {
  id: string; // Request for Quotation `name`
  date: string; // e.g. "Sep 3, 2026"
  isoDate: string; // `transaction_date`, `YYYY-MM-DD` — for sorting
  requiredBy: string; // `schedule_date`, formatted
  address: string | null; // `shipping_address_display`, as plain text
  rawStatus: string;
  items: QuotationRequestLine[];
};

// One row per RFQ item — the list API joins the child table when a
// `tab<Child>` field is requested.
type QuotationRequestItemRow = {
  name: string;
  transaction_date: string | null;
  schedule_date: string | null;
  status: string | null;
  shipping_address_display: string | null;
  idx: number | null; // item row number
  item_code: string | null;
  item_name: string | null;
  qty: number | null;
};

const RFQ_ITEM = '`tabRequest for Quotation Item`';

/**
 * Submitted Requests for Quotation belonging to the signed-in user, newest
 * first. RFQs made through the backend method are owned by the user; those
 * the app creates directly are owned by the API user and carry the user's
 * email on `custom_email` instead — so both are matched.
 */
export async function fetchQuotationRequestsForUser(user: {
  email?: string | null;
}): Promise<QuotationRequestSummary[]> {
  const email = user.email?.trim();
  if (!email) {
    return [];
  }

  const byField = await Promise.all(
    ['owner', 'custom_email'].map(field =>
      fetchResourceList<QuotationRequestItemRow>(
        'Request for Quotation',
        {
          fields: [
            'name',
            'transaction_date',
            'schedule_date',
            'status',
            'shipping_address_display',
            `${RFQ_ITEM}.idx`,
            `${RFQ_ITEM}.item_code`,
            `${RFQ_ITEM}.item_name`,
            `${RFQ_ITEM}.qty`,
          ],
          filters: [
            ['docstatus', '=', 1],
            [field, '=', email],
          ],
          orderBy: 'creation desc',
          limit: 500,
        },
        'quotation requests',
      ),
    ),
  );

  const requests = new Map<string, QuotationRequestSummary>();
  const seenRows = new Set<string>();
  const rows = byField.flat().sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
  for (const row of rows) {
    // The same RFQ can match on both `owner` and `custom_email`.
    const rowKey = `${row.name}|${row.idx}`;
    if (seenRows.has(rowKey)) {
      continue;
    }
    seenRows.add(rowKey);

    let request = requests.get(row.name);
    if (!request) {
      request = {
        id: row.name,
        date: formatDate(row.transaction_date),
        isoDate: row.transaction_date || '',
        requiredBy: formatDate(row.schedule_date),
        address: htmlToText(row.shipping_address_display),
        rawStatus: row.status || 'Submitted',
        items: [],
      };
      requests.set(row.name, request);
    }
    if (row.item_code) {
      request.items.push({
        itemCode: row.item_code,
        itemName: row.item_name || row.item_code,
        qty: Math.round(row.qty || 0),
      });
    }
  }

  return [...requests.values()].sort(
    (a, b) => b.isoDate.localeCompare(a.isoDate) || b.id.localeCompare(a.id),
  );
}

export type QuotationRequestDetailLine = QuotationRequestLine & {
  description: string | null;
  uom: string | null;
  image: string | null;
};

export type SupplierQuoteLine = {
  itemCode: string;
  itemName: string;
  qty: number;
  rate: string;
  amount: string;
};

/** A submitted Supplier Quotation answering the RFQ. */
export type SupplierQuote = {
  id: string; // Supplier Quotation `name`
  date: string;
  validTill: string | null;
  rawStatus: string; // e.g. `Submitted`, `Expired`
  expired: boolean;
  subtotal: string;
  taxes: string;
  total: string;
  items: SupplierQuoteLine[];
};

export type QuotationSupplier = {
  supplier: string;
  supplierName: string;
  // `Request for Quotation Supplier.quote_status` — `Pending` / `Received`.
  quoteStatus: string;
  quotes: SupplierQuote[];
};

export type QuotationRequestDetail = Omit<QuotationRequestSummary, 'items'> & {
  email: string | null;
  items: QuotationRequestDetailLine[];
  suppliers: QuotationSupplier[];
};

type RequestForQuotationFullDoc = {
  name: string;
  transaction_date: string | null;
  schedule_date: string | null;
  status: string | null;
  custom_email?: string | null;
  shipping_address_display?: string | null;
  items: Array<{
    item_code: string;
    item_name: string | null;
    description: string | null;
    qty: number | null;
    uom: string | null;
    image: string | null;
  }>;
  suppliers: Array<{
    supplier: string;
    supplier_name: string | null;
    quote_status: string | null;
  }>;
};

// One row per Supplier Quotation item (see `QuotationRequestItemRow`).
type SupplierQuotationItemRow = {
  name: string;
  supplier: string;
  status: string | null;
  transaction_date: string | null;
  valid_till: string | null;
  net_total: number | null;
  total_taxes_and_charges: number | null;
  grand_total: number | null;
  currency: string | null;
  idx: number | null;
  item_code: string | null;
  item_name: string | null;
  qty: number | null;
  rate: number | null;
  amount: number | null;
};

const SQ_ITEM = '`tabSupplier Quotation Item`';

/**
 * One Request for Quotation with its items, suppliers and the submitted
 * Supplier Quotations that answer it (matched on
 * `Supplier Quotation Item.request_for_quotation`).
 */
export async function fetchQuotationRequest(
  name: string,
): Promise<QuotationRequestDetail> {
  const [doc, quoteRows] = await Promise.all([
    fetchResource<RequestForQuotationFullDoc>(
      'Request for Quotation',
      name,
      'quotation request',
    ),
    fetchResourceList<SupplierQuotationItemRow>(
      'Supplier Quotation',
      {
        fields: [
          'name',
          'supplier',
          'status',
          'transaction_date',
          'valid_till',
          'net_total',
          'total_taxes_and_charges',
          'grand_total',
          'currency',
          `${SQ_ITEM}.idx`,
          `${SQ_ITEM}.item_code`,
          `${SQ_ITEM}.item_name`,
          `${SQ_ITEM}.qty`,
          `${SQ_ITEM}.rate`,
          `${SQ_ITEM}.amount`,
        ],
        filters: [
          ['docstatus', '=', 1],
          ['Supplier Quotation Item', 'request_for_quotation', '=', name],
        ],
        orderBy: 'creation desc',
        limit: 500,
      },
      'supplier quotations',
    ),
  ]);

  const quotesBySupplier = new Map<string, Map<string, SupplierQuote>>();
  const sortedRows = [...quoteRows].sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
  for (const row of sortedRows) {
    let quotes = quotesBySupplier.get(row.supplier);
    if (!quotes) {
      quotes = new Map();
      quotesBySupplier.set(row.supplier, quotes);
    }
    let quote = quotes.get(row.name);
    if (!quote) {
      quote = {
        id: row.name,
        date: formatDate(row.transaction_date),
        validTill: row.valid_till ? formatDate(row.valid_till) : null,
        rawStatus: row.status || 'Submitted',
        expired: row.status === 'Expired',
        subtotal: formatMoney(row.net_total, row.currency),
        taxes: formatMoney(row.total_taxes_and_charges, row.currency),
        total: formatMoney(row.grand_total, row.currency),
        items: [],
      };
      quotes.set(row.name, quote);
    }
    if (row.item_code) {
      quote.items.push({
        itemCode: row.item_code,
        itemName: row.item_name || row.item_code,
        qty: Math.round(row.qty || 0),
        rate: formatMoney(row.rate, row.currency),
        amount: formatMoney(row.amount, row.currency),
      });
    }
  }

  const items = (doc.items ?? []).map(line => ({
    itemCode: line.item_code,
    itemName: line.item_name || line.item_code,
    qty: Math.round(line.qty || 0),
    description: htmlToText(line.description),
    uom: line.uom,
    image: toAbsoluteFileUrl(line.image),
  }));

  return {
    id: doc.name,
    date: formatDate(doc.transaction_date),
    isoDate: doc.transaction_date || '',
    requiredBy: formatDate(doc.schedule_date),
    address: htmlToText(doc.shipping_address_display),
    rawStatus: doc.status || 'Submitted',
    email: doc.custom_email?.trim() || null,
    items,
    suppliers: (doc.suppliers ?? []).map(row => ({
      supplier: row.supplier,
      supplierName: row.supplier_name || row.supplier,
      quoteStatus: row.quote_status || 'Pending',
      quotes: [...(quotesBySupplier.get(row.supplier)?.values() ?? [])],
    })),
  };
}
