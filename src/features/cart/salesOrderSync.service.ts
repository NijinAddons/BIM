import AsyncStorage from '@react-native-async-storage/async-storage';

import {appConfig} from '../../app/config/appConfig';
import {ApiError} from '../../services/api/apiError';
import {getFrappeAuthHeaders} from '../../services/frappe/frappeAuth';
import {logger} from '../../utils/logger';
import {getUserProfile, setUserProfile} from '../profile/service';
import type {CartItem} from './data/cart';

const SALES_ORDER_STORAGE_KEY = '@buy_in_minutes_sales_order_name';
const SALES_INVOICE_STORAGE_KEY = '@buy_in_minutes_sales_invoice_by_order';
const DEFAULT_CUSTOMER_NAME = 'Guest';
const DEFAULT_COMPANY = 'Buy In Minutes';
const DEFAULT_CURRENCY = 'AED';

type FrappeDocumentResponse<T> = {
  data?: T;
  message?: T;
};

type SalesOrderDocument = {
  currency?: string;
  docstatus?: number;
  grand_total?: number | string;
  name?: string;
  rounded_total?: number | string;
  status?: string;
};

export type PlaceOrderResult = {
  linkedSalesOrderName: string;
  referenceDoctype: 'Sales Order';
  salesOrder: SalesOrderDocument | null;
};

type SalesInvoiceDocument = {
  currency?: string;
  docstatus?: number;
  grand_total?: number | string;
  name?: string;
  rounded_total?: number | string;
  status?: string;
};

type CustomerDocument = {
  customer_name?: string;
  email_id?: string;
  mobile_no?: string;
  name?: string;
};

type SalesOrderItemPayload = {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
};

type SalesOrderPayload = {
  company: string;
  currency: string;
  customer: string;
  delivery_date: string;
  items: SalesOrderItemPayload[];
  order_type: 'Sales';
  remarks?: string;
};

let syncChain: Promise<string | null> = Promise.resolve(null);
let activeEnsureSalesOrderKey: string | null = null;
let activeEnsureSalesOrderPromise: Promise<string | null> | null = null;

const getFrappeExceptionMessage = (body?: string) => {
  if (!body) {
    return null;
  }

  try {
    const parsedBody = JSON.parse(body) as {
      _server_messages?: string;
      exc?: string;
      exception?: string;
      exc_type?: string;
      message?: string | Record<string, unknown>;
    };

    if (typeof parsedBody._server_messages === 'string' && parsedBody._server_messages) {
      try {
        const serverMessages = JSON.parse(parsedBody._server_messages) as string[];
        const firstMessage = serverMessages[0];

        if (typeof firstMessage === 'string' && firstMessage) {
          try {
            const parsedMessage = JSON.parse(firstMessage) as {
              message?: string;
            };

            if (typeof parsedMessage.message === 'string' && parsedMessage.message.trim()) {
              return parsedMessage.message.trim();
            }
          } catch {
            return firstMessage;
          }
        }
      } catch {
        return parsedBody._server_messages;
      }
    }

    if (typeof parsedBody.message === 'string' && parsedBody.message.trim()) {
      return parsedBody.message.trim();
    }

    return parsedBody.exception ?? parsedBody.exc ?? parsedBody.exc_type ?? null;
  } catch {
    return body;
  }
};

const buildSalesOrderUrl = (salesOrderName?: string) => {
  const baseUrl = `${appConfig.frappeBaseUrl}/api/resource/Sales%20Order`;

  if (!salesOrderName) {
    return baseUrl;
  }

  return `${baseUrl}/${encodeURIComponent(salesOrderName)}`;
};

const buildSubmitSalesOrderUrl = () =>
  `${appConfig.frappeBaseUrl}/api/method/frappe.client.submit`;

const buildInsertDocumentUrl = () =>
  `${appConfig.frappeBaseUrl}/api/method/frappe.client.insert`;

const buildSalesInvoiceUrl = (salesInvoiceName?: string) => {
  const baseUrl = `${appConfig.frappeBaseUrl}/api/resource/Sales%20Invoice`;

  if (!salesInvoiceName) {
    return baseUrl;
  }

  return `${baseUrl}/${encodeURIComponent(salesInvoiceName)}`;
};

const buildPosInvoiceUrl = (posInvoiceName?: string) => {
  const baseUrl = `${appConfig.frappeBaseUrl}/api/resource/POS%20Invoice`;

  if (!posInvoiceName) {
    return baseUrl;
  }

  return `${baseUrl}/${encodeURIComponent(posInvoiceName)}`;
};

const buildMakeSalesInvoiceUrl = () =>
  `${appConfig.frappeBaseUrl}/api/method/erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice`;

const buildSalesInvoicePdfUrl = (salesInvoiceName: string) => {
  const params = new URLSearchParams();
  params.set('doctype', 'Sales Invoice');
  params.set('name', salesInvoiceName);
  params.set('format', 'Standard');
  params.set('no_letterhead', '0');

  return `${appConfig.frappeBaseUrl}/api/method/frappe.utils.print_format.download_pdf?${params.toString()}`;
};

const buildCustomerUrl = (customerName?: string) => {
  const baseUrl = `${appConfig.frappeBaseUrl}/api/resource/Customer`;

  if (!customerName) {
    return baseUrl;
  }

  return `${baseUrl}/${encodeURIComponent(customerName)}`;
};

const toMinorPayloadItems = (cartItems: CartItem[]): SalesOrderItemPayload[] =>
  cartItems.map(item => ({
    item_code: item.id,
    item_name: item.name,
    qty: item.quantity,
    rate: item.price,
  }));

const getDeliveryDate = () => {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 1);
  return nextDate.toISOString().slice(0, 10);
};

const getCartSyncKey = (cartItems: CartItem[]) => {
  const profile = getUserProfile();

  return JSON.stringify({
    address: profile.address.trim(),
    cartItems: cartItems.map(item => ({
      id: item.id,
      price: item.price,
      quantity: item.quantity,
    })),
    customer: profile.customer.trim(),
    email: profile.email.trim(),
    mobile: profile.mobile.trim(),
    name: profile.name.trim(),
  });
};

const getSalesOrderPayload = (
  cartItems: CartItem[],
  salesOrderCustomer: string,
): SalesOrderPayload => {
  const profile = getUserProfile();
  const trimmedAddress = profile.address.trim();
  const trimmedName = profile.name.trim();
  const shopperName =
    trimmedName && trimmedName !== 'BIM User' ? trimmedName : DEFAULT_CUSTOMER_NAME;

  return {
    company: DEFAULT_COMPANY,
    currency: DEFAULT_CURRENCY,
    customer: salesOrderCustomer,
    delivery_date: getDeliveryDate(),
    items: toMinorPayloadItems(cartItems),
    order_type: 'Sales',
    remarks: [
      `Customer name: ${shopperName}`,
      trimmedAddress
        ? `Delivery address: ${trimmedAddress}`
        : 'Delivery address not provided in app profile.',
    ].join('\n'),
  };
};

const requestSalesOrder = async <T>(
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  body?: Record<string, unknown>,
) => {
  const authHeaders = getFrappeAuthHeaders();
  const hasAuthHeaders = Object.keys(authHeaders).length > 0;

  const requestOnce = async (useAuthHeaders: boolean) => {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(useAuthHeaders ? authHeaders : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const rawBody = await response.text();

    logger.log('[Sales Order] sync response', {
      body: rawBody,
      method,
      ok: response.ok,
      status: response.status,
      url,
      usedAuthHeaders: useAuthHeaders,
    });

    return {rawBody, response};
  };

  const {rawBody, response} = await requestOnce(hasAuthHeaders);

  if (!response.ok && response.status === 401 && hasAuthHeaders) {
    throw new ApiError(
      'Sales Order authentication failed. Check the stored login API key and API secret.',
      {
        body: rawBody,
        status: response.status,
        url,
      },
    );
  }

  if (!response.ok) {
    throw new ApiError(`Sales Order sync failed with status ${response.status}`, {
      body: rawBody,
      status: response.status,
      url,
    });
  }

  if (!rawBody) {
    return {} as T;
  }

  return JSON.parse(rawBody) as T;
};

const getDocumentFromResponse = (response: FrappeDocumentResponse<SalesOrderDocument>) =>
  response.data ?? response.message ?? null;

const getSalesInvoiceDocumentFromResponse = (
  response: FrappeDocumentResponse<SalesInvoiceDocument>,
) => response.data ?? response.message ?? null;

const getSalesOrderTotal = (document: SalesOrderDocument) => {
  const totalCandidates = [document.rounded_total, document.grand_total];

  for (const candidate of totalCandidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }

    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

const isLoggedInProfile = () => {
  const profile = getUserProfile();

  return Boolean(
    (profile.name.trim() && profile.name !== 'BIM User') ||
      profile.mobile.trim() ||
      (profile.email.trim() && profile.email !== 'name@example.com'),
  );
};

const buildCustomerLookupUrl = (filters: unknown) => {
  const params = new URLSearchParams();
  params.set(
    'fields',
    JSON.stringify(['name', 'customer_name', 'mobile_no', 'email_id']),
  );
  params.set('filters', JSON.stringify(filters));
  params.set('limit_page_length', '1');
  params.set('order_by', 'modified desc');
  return `${buildCustomerUrl()}?${params.toString()}`;
};

const getCustomerFromResponse = (response: FrappeDocumentResponse<CustomerDocument>) =>
  response.data ?? response.message ?? null;

const findCustomer = async (filters: unknown) => {
  const response = await requestSalesOrder<FrappeDocumentResponse<CustomerDocument[]>>(
    'GET',
    buildCustomerLookupUrl(filters),
  );
  const records = response.data ?? response.message ?? [];

  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }

  return records[0] ?? null;
};

const resolveExistingCustomer = async () => {
  const profile = getUserProfile();
  const trimmedMobile = profile.mobile.trim();
  const trimmedEmail = profile.email.trim();
  const trimmedName = profile.name.trim();

  if (trimmedMobile) {
    const mobileCustomer = await findCustomer([['mobile_no', '=', trimmedMobile]]);

    if (mobileCustomer?.name) {
      return mobileCustomer;
    }
  }

  if (trimmedEmail && trimmedEmail !== 'name@example.com') {
    const emailCustomer = await findCustomer([['email_id', '=', trimmedEmail]]);

    if (emailCustomer?.name) {
      return emailCustomer;
    }
  }

  if (trimmedName && trimmedName !== 'BIM User') {
    const nameCustomer = await findCustomer([['customer_name', '=', trimmedName]]);

    if (nameCustomer?.name) {
      return nameCustomer;
    }
  }

  return null;
};

const createCustomer = async () => {
  const profile = getUserProfile();
  const trimmedMobile = profile.mobile.trim();
  const trimmedEmail = profile.email.trim();
  const trimmedName = profile.name.trim();
  const customerName =
    (trimmedName && trimmedName !== 'BIM User' && trimmedName) ||
    trimmedMobile ||
    trimmedEmail ||
    DEFAULT_CUSTOMER_NAME;

  const response = await requestSalesOrder<FrappeDocumentResponse<CustomerDocument>>(
    'POST',
    buildCustomerUrl(),
    {
      customer_group: 'All Customer Groups',
      customer_name: customerName,
      customer_type: 'Individual',
      email_id: trimmedEmail && trimmedEmail !== 'name@example.com' ? trimmedEmail : undefined,
      mobile_no: trimmedMobile || undefined,
      territory: 'All Territories',
    } as unknown as Record<string, unknown>,
  );

  return getCustomerFromResponse(response);
};

const resolveSalesOrderCustomer = async () => {
  const profile = getUserProfile();
  const storedCustomer = profile.customer?.trim() ?? '';
  const loggedIn = isLoggedInProfile();

  if (storedCustomer && (!loggedIn || storedCustomer !== DEFAULT_CUSTOMER_NAME)) {
    return storedCustomer;
  }

  if (!loggedIn) {
    return DEFAULT_CUSTOMER_NAME;
  }

  const existingCustomer = await resolveExistingCustomer();

  if (existingCustomer?.name) {
    await setUserProfile({
      ...profile,
      customer: existingCustomer.name,
    });

    logger.log('[Sales Order] resolved existing customer', {
      customer: existingCustomer.name,
      customerName: existingCustomer.customer_name,
      email: existingCustomer.email_id,
      mobile: existingCustomer.mobile_no,
    });

    return existingCustomer.name;
  }

  try {
    const createdCustomer = await createCustomer();

    if (!createdCustomer?.name) {
      throw new Error('Customer creation succeeded but no customer name was returned.');
    }

    await setUserProfile({
      ...profile,
      customer: createdCustomer.name,
    });

    logger.log('[Sales Order] created customer', {
      customer: createdCustomer.name,
      customerName: createdCustomer.customer_name,
      email: createdCustomer.email_id,
      mobile: createdCustomer.mobile_no,
    });

    return createdCustomer.name;
  } catch (error) {
    logger.log('[Sales Order] customer create failed, retrying lookup', error);

    const fallbackCustomer = await resolveExistingCustomer();

    if (fallbackCustomer?.name) {
      await setUserProfile({
        ...profile,
        customer: fallbackCustomer.name,
      });

      return fallbackCustomer.name;
    }

    throw error;
  }
};

const shouldRecreateSalesOrder = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return false;
  }

  if (error.status === 404) {
    return true;
  }

  if (error.status === 417) {
    return true;
  }

  if (error.status === 503) {
    return true;
  }

  return Boolean(error.body?.includes('DoesNotExistError'));
};

const isTimestampMismatchError = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return false;
  }

  if (error.status !== 417) {
    return false;
  }

  return Boolean(error.body?.includes('TimestampMismatchError'));
};

const isSubmitPermissionError = (error: unknown) => {
  if (!(error instanceof ApiError) || error.status !== 403) {
    return false;
  }

  const exceptionMessage = getFrappeExceptionMessage(error.body)?.toLowerCase() ?? '';

  return (
    exceptionMessage.includes('not permitted') ||
    exceptionMessage.includes('permission') ||
    exceptionMessage.includes('not allowed')
  );
};

const isCustomerPermissionError = (error: unknown) => {
  if (!(error instanceof ApiError) || error.status !== 403) {
    return false;
  }

  const exceptionMessage = getFrappeExceptionMessage(error.body)?.toLowerCase() ?? '';
  const requestUrl = error.url?.toLowerCase() ?? '';

  return (
    (exceptionMessage.includes('insufficient permission') &&
      exceptionMessage.includes('customer')) ||
    requestUrl.includes('/api/resource/customer')
  );
};

const createSalesOrder = async (cartItems: CartItem[]) => {
  const salesOrderCustomer = await resolveSalesOrderCustomer();
  const payload = getSalesOrderPayload(cartItems, salesOrderCustomer);
  logger.log('[Sales Order] create payload', {
    customer: payload.customer,
    customerName: getUserProfile().name,
    deliveryDate: payload.delivery_date,
    profile: getUserProfile(),
    remarks: payload.remarks,
  });
  const response = await requestSalesOrder<FrappeDocumentResponse<SalesOrderDocument>>(
    'POST',
    buildSalesOrderUrl(),
    payload as unknown as Record<string, unknown>,
  );
  const createdDocument = getDocumentFromResponse(response);
  const salesOrderName = createdDocument?.name;

  if (!salesOrderName) {
    throw new Error('Sales Order creation succeeded but no document name was returned.');
  }

  logger.log('[Sales Order] created draft', {
    docstatus: createdDocument?.docstatus,
    name: salesOrderName,
    status: createdDocument?.status,
  });

  await AsyncStorage.setItem(SALES_ORDER_STORAGE_KEY, salesOrderName);
};

const updateSalesOrder = async (salesOrderName: string, cartItems: CartItem[]) => {
  const salesOrderCustomer = await resolveSalesOrderCustomer();
  const payload = getSalesOrderPayload(cartItems, salesOrderCustomer);
  logger.log('[Sales Order] update payload', {
    customer: payload.customer,
    customerName: getUserProfile().name,
    profile: getUserProfile(),
    remarks: payload.remarks,
    salesOrderName,
  });

  await requestSalesOrder<FrappeDocumentResponse<SalesOrderDocument>>(
    'PUT',
    buildSalesOrderUrl(salesOrderName),
    payload as unknown as Record<string, unknown>,
  );
};

export const updateExistingSalesOrderItems = async (
  salesOrderName: string,
  cartItems: CartItem[],
) => {
  if (!salesOrderName.trim()) {
    throw new Error('Sales Order name is required to update ERPNext order items.');
  }

  if (cartItems.length === 0) {
    throw new Error('At least one item is required to update the ERPNext order.');
  }

  await updateSalesOrder(salesOrderName, cartItems);

  return submitSalesOrder(salesOrderName);
};

export const updateExistingPosInvoiceItems = async (
  posInvoiceName: string,
  cartItems: CartItem[],
) => {
  if (!posInvoiceName.trim()) {
    throw new Error('POS Invoice name is required to update ERPNext order items.');
  }

  if (cartItems.length === 0) {
    throw new Error('At least one item is required to update the ERPNext POS Invoice.');
  }

  const invoiceResponse = await requestSalesOrder<FrappeDocumentResponse<Record<string, unknown>>>(
    'GET',
    buildPosInvoiceUrl(posInvoiceName),
  );
  const invoiceDocument =
    (invoiceResponse.data ?? invoiceResponse.message ?? null) as Record<string, unknown> | null;

  if (!invoiceDocument) {
    throw new Error('POS Invoice lookup succeeded but no document was returned.');
  }

  const existingItems = Array.isArray(invoiceDocument.items)
    ? (invoiceDocument.items as Record<string, unknown>[])
    : [];

  const nextItems = cartItems.map(cartItem => {
    const matchingExistingItem =
      existingItems.find(item => {
        const itemCode = typeof item.item_code === 'string' ? item.item_code.trim() : '';
        return itemCode === cartItem.id;
      }) ?? null;

    return {
      ...(matchingExistingItem ? sanitizeUpdatedDocument(matchingExistingItem) : {}),
      item_code: cartItem.id,
      item_name: cartItem.name,
      qty: cartItem.quantity,
      rate: cartItem.price,
    };
  });

  const nextDocument = sanitizeUpdatedDocument(invoiceDocument);
  nextDocument.items = nextItems;

  const updateResponse = await requestSalesOrder<FrappeDocumentResponse<SalesInvoiceDocument>>(
    'PUT',
    buildPosInvoiceUrl(posInvoiceName),
    nextDocument,
  );

  return getSalesInvoiceDocumentFromResponse(updateResponse);
};

export const submitSalesOrder = async (salesOrderName: string) => {
  let lastFetchedDocument: SalesOrderDocument | null = null;

  const submitLatestDocument = async () => {
    const existingDocumentResponse = await requestSalesOrder<
      FrappeDocumentResponse<SalesOrderDocument>
    >('GET', buildSalesOrderUrl(salesOrderName));
    const existingDocument = getDocumentFromResponse(existingDocumentResponse);
    lastFetchedDocument = existingDocument;

    if (!existingDocument?.name) {
      throw new Error('Sales Order lookup succeeded but no document was returned.');
    }

    if (existingDocument.docstatus === 1) {
      logger.log('[Sales Order] already submitted', {
        docstatus: existingDocument.docstatus,
        name: existingDocument.name,
        status: existingDocument.status,
      });

      return existingDocument;
    }

    const response = await requestSalesOrder<FrappeDocumentResponse<SalesOrderDocument>>(
      'POST',
      buildSubmitSalesOrderUrl(),
      {
        doc: existingDocument as unknown as Record<string, unknown>,
      },
    );

    return getDocumentFromResponse(response);
  };

  try {
    const submittedDocument = await submitLatestDocument();

    logger.log('[Sales Order] submitted', {
      docstatus: submittedDocument?.docstatus,
      name: submittedDocument?.name ?? salesOrderName,
      status: submittedDocument?.status,
    });

    return submittedDocument ?? null;
  } catch (error) {
    const fallbackDocument = lastFetchedDocument as SalesOrderDocument | null;

    if (isSubmitPermissionError(error) && fallbackDocument?.name) {
      logger.log('[Sales Order] submit skipped because API user lacks submit permission', {
        body: error instanceof ApiError ? error.body : undefined,
        name: fallbackDocument.name,
        status: error instanceof ApiError ? error.status : undefined,
      });

      return fallbackDocument;
    }

    if (!isTimestampMismatchError(error)) {
      throw error;
    }

    logger.log('[Sales Order] submit retry after timestamp mismatch', {
      name: salesOrderName,
    });

    const submittedDocument = await submitLatestDocument();

    logger.log('[Sales Order] submitted after retry', {
      docstatus: submittedDocument?.docstatus,
      name: submittedDocument?.name ?? salesOrderName,
      status: submittedDocument?.status,
    });

    return submittedDocument ?? null;
  }
};

export const placeOrder = async (
  cartItems: CartItem[],
): Promise<PlaceOrderResult> => {
  const linkedSalesOrderName = await ensureSalesOrderForCart(cartItems);

  if (!linkedSalesOrderName) {
    throw new Error('Unable to create the sales order for this cart. Please try again.');
  }

  // Checkout only needs a stable Sales Order reference. Submitting it here blocks
  // the UI before payment/navigation, so keep submit best-effort in the background.
  void submitSalesOrder(linkedSalesOrderName).catch(error => {
    logger.log('[Sales Order] background submit failed after checkout preparation', {
      error,
      salesOrderName: linkedSalesOrderName,
    });
  });

  return {
    linkedSalesOrderName,
    referenceDoctype: 'Sales Order',
    salesOrder: null,
  };
};

export const clearLinkedSalesOrder = async () => {
  await AsyncStorage.removeItem(SALES_ORDER_STORAGE_KEY);
};

export const getLinkedSalesOrderName = () =>
  AsyncStorage.getItem(SALES_ORDER_STORAGE_KEY);

export const getSalesOrderPaymentDetails = async (salesOrderName: string) => {
  const response = await requestSalesOrder<FrappeDocumentResponse<SalesOrderDocument>>(
    'GET',
    buildSalesOrderUrl(salesOrderName),
  );
  const document = getDocumentFromResponse(response);

  if (!document?.name) {
    throw new Error('Sales Order lookup succeeded but no document was returned.');
  }

  const amount = getSalesOrderTotal(document);

  if (amount === null) {
    throw new Error('Sales Order is missing grand total.');
  }

  return {
    amount,
    currency: (document.currency ?? DEFAULT_CURRENCY).toString(),
    referenceDoctype: 'Sales Order' as const,
    referenceName: document.name,
  };
};

const getStoredSalesInvoiceMap = async () => {
  const rawValue = await AsyncStorage.getItem(SALES_INVOICE_STORAGE_KEY);

  if (!rawValue) {
    return {} as Record<string, string>;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Record<string, unknown>;
    const nextMap: Record<string, string> = {};

    Object.entries(parsedValue).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        nextMap[key] = value.trim();
      }
    });

    return nextMap;
  } catch {
    return {} as Record<string, string>;
  }
};

const setStoredSalesInvoiceName = async (
  salesOrderName: string,
  salesInvoiceName: string,
) => {
  const currentMap = await getStoredSalesInvoiceMap();
  currentMap[salesOrderName] = salesInvoiceName;
  await AsyncStorage.setItem(SALES_INVOICE_STORAGE_KEY, JSON.stringify(currentMap));
};

const clearStoredSalesInvoiceName = async (salesOrderName: string) => {
  const currentMap = await getStoredSalesInvoiceMap();

  if (!currentMap[salesOrderName]) {
    return;
  }

  delete currentMap[salesOrderName];
  await AsyncStorage.setItem(SALES_INVOICE_STORAGE_KEY, JSON.stringify(currentMap));
};

const getStoredSalesInvoiceName = async (salesOrderName: string) => {
  const currentMap = await getStoredSalesInvoiceMap();
  return currentMap[salesOrderName] ?? null;
};

const sanitizeInsertedInvoiceDoc = (document: Record<string, unknown>) => {
  const nextDocument = {...document};

  delete nextDocument.name;
  delete nextDocument.__islocal;
  delete nextDocument.__onload;
  delete nextDocument.__run_link_triggers;
  delete nextDocument.amended_from;
  delete nextDocument.owner;
  delete nextDocument.creation;
  delete nextDocument.modified;
  delete nextDocument.modified_by;
  delete nextDocument.docstatus;
  delete nextDocument.idx;

  return nextDocument;
};

const sanitizeUpdatedDocument = (document: Record<string, unknown>) => {
  const nextDocument = {...document};

  delete nextDocument.name;
  delete nextDocument.owner;
  delete nextDocument.creation;
  delete nextDocument.modified;
  delete nextDocument.modified_by;
  delete nextDocument.docstatus;
  delete nextDocument.idx;

  return nextDocument;
};

const createSalesInvoiceFromSalesOrder = async (salesOrderName: string) => {
  const draftResponse = await requestSalesOrder<FrappeDocumentResponse<Record<string, unknown>>>(
    'POST',
    buildMakeSalesInvoiceUrl(),
    {
      source_name: salesOrderName,
    },
  );
  const mappedDraft =
    (draftResponse.data ?? draftResponse.message ?? null) as Record<string, unknown> | null;

  if (!mappedDraft) {
    throw new Error('Sales Invoice draft could not be created from Sales Order.');
  }

  const insertResponse = await requestSalesOrder<FrappeDocumentResponse<SalesInvoiceDocument>>(
    'POST',
    buildInsertDocumentUrl(),
    {
      doc: sanitizeInsertedInvoiceDoc(mappedDraft),
    },
  );
  const insertedInvoice = getSalesInvoiceDocumentFromResponse(insertResponse);

  if (!insertedInvoice?.name) {
    throw new Error('Sales Invoice creation succeeded but no document name was returned.');
  }

  await setStoredSalesInvoiceName(salesOrderName, insertedInvoice.name);

  return insertedInvoice;
};

const submitSalesInvoice = async (salesInvoiceName: string) => {
  const invoiceResponse = await requestSalesOrder<FrappeDocumentResponse<SalesInvoiceDocument>>(
    'GET',
    buildSalesInvoiceUrl(salesInvoiceName),
  );
  const invoiceDocument = getSalesInvoiceDocumentFromResponse(invoiceResponse);

  if (!invoiceDocument?.name) {
    throw new Error('Sales Invoice lookup succeeded but no document was returned.');
  }

  if (invoiceDocument.docstatus === 1) {
    return invoiceDocument;
  }

  try {
    const submitResponse = await requestSalesOrder<FrappeDocumentResponse<SalesInvoiceDocument>>(
      'POST',
      buildSubmitSalesOrderUrl(),
      {
        doc: invoiceDocument as unknown as Record<string, unknown>,
      },
    );

    return getSalesInvoiceDocumentFromResponse(submitResponse) ?? invoiceDocument;
  } catch (error) {
    if (isSubmitPermissionError(error)) {
      logger.log('[Sales Invoice] submit skipped because API user lacks submit permission', {
        body: error instanceof ApiError ? error.body : undefined,
        name: invoiceDocument.name,
        status: error instanceof ApiError ? error.status : undefined,
      });

      return invoiceDocument;
    }

    throw error;
  }
};

export const generateSalesInvoiceForSalesOrder = async (salesOrderName: string) => {
  const submittedSalesOrder = await submitSalesOrder(salesOrderName);

  if (!submittedSalesOrder?.name) {
    throw new Error('Sales Order could not be loaded before invoice generation.');
  }

  if (submittedSalesOrder.docstatus !== 1) {
    throw new Error(
      'Sales Invoice generation requires a submitted Sales Order. The backend API user does not have permission to submit this Sales Order yet.',
    );
  }

  const storedSalesInvoiceName = await getStoredSalesInvoiceName(salesOrderName);

  if (storedSalesInvoiceName) {
    try {
      const submittedExistingInvoice = await submitSalesInvoice(storedSalesInvoiceName);

      return {
        pdfUrl: buildSalesInvoicePdfUrl(storedSalesInvoiceName),
        salesInvoice: submittedExistingInvoice,
      };
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }

      await clearStoredSalesInvoiceName(salesOrderName);
    }
  }

  const createdInvoice = await createSalesInvoiceFromSalesOrder(salesOrderName);
  const submittedInvoice = await submitSalesInvoice(createdInvoice.name ?? '');

  if (!createdInvoice.name) {
    throw new Error('Sales Invoice name is missing after creation.');
  }

  return {
    pdfUrl: buildSalesInvoicePdfUrl(createdInvoice.name),
    salesInvoice: submittedInvoice ?? createdInvoice,
  };
};

const ensureSalesOrderForCartInternal = async (cartItems: CartItem[]) => {
  if (cartItems.length === 0) {
    await clearLinkedSalesOrder();
    return null;
  }

  const existingSalesOrderName = await AsyncStorage.getItem(SALES_ORDER_STORAGE_KEY);

  try {
    if (existingSalesOrderName) {
      await updateSalesOrder(existingSalesOrderName, cartItems);
      return existingSalesOrderName;
    }

    await createSalesOrder(cartItems);
    return AsyncStorage.getItem(SALES_ORDER_STORAGE_KEY);
  } catch (error) {
    logger.log('[Sales Order] ensure failed', {
      cartItems,
      error,
      salesOrderName: existingSalesOrderName,
    });

    if (existingSalesOrderName && shouldRecreateSalesOrder(error)) {
      await clearLinkedSalesOrder();
      await createSalesOrder(cartItems);
      return AsyncStorage.getItem(SALES_ORDER_STORAGE_KEY);
    }

    throw error;
  }
};

export const ensureSalesOrderForCart = async (cartItems: CartItem[]) => {
  const syncKey = getCartSyncKey(cartItems);

  if (activeEnsureSalesOrderKey === syncKey && activeEnsureSalesOrderPromise) {
    return activeEnsureSalesOrderPromise;
  }

  const nextPromise = ensureSalesOrderForCartInternal(cartItems).finally(() => {
    if (activeEnsureSalesOrderPromise === nextPromise) {
      activeEnsureSalesOrderKey = null;
      activeEnsureSalesOrderPromise = null;
    }
  });

  activeEnsureSalesOrderKey = syncKey;
  activeEnsureSalesOrderPromise = nextPromise;

  return nextPromise;
};

export const getSalesOrderSyncErrorMessage = (error: unknown) => {
  if (isCustomerPermissionError(error)) {
    return [
      'Your logged-in ERPNext API user does not have permission to access Customer.',
      'The app is already sending your dynamic api_key/api_secret, but Place Order cannot continue until the backend either grants Customer read/create permission to that user or returns the customer id/name directly from the login API.',
    ].join(' ');
  }

  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'Unable to sync sales order.';
  }

  return (
    getFrappeExceptionMessage(error.body) ??
    error.body ??
    error.message
  );
};

const syncCartToSalesOrder = (cartItems: CartItem[]) => ensureSalesOrderForCart(cartItems);

export const scheduleCartSalesOrderSync = (cartItems: CartItem[]) => {
  syncChain = syncChain
    .catch(() => undefined)
    .then(() => syncCartToSalesOrder(cartItems));

  return syncChain;
};
