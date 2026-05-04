import AsyncStorage from '@react-native-async-storage/async-storage';

import {appConfig} from '../../app/config/appConfig';
import {ApiError} from '../../services/api/apiError';
import {logger} from '../../utils/logger';
import {getUserProfile} from '../profile/service';
import type {CartItem} from './data/cart';

const SALES_ORDER_STORAGE_KEY = '@buy_in_minutes_sales_order_name';
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

let syncChain: Promise<void> = Promise.resolve();

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

const getAuthHeaders = (): Record<string, string> => {
  if (!appConfig.frappeApiKey || !appConfig.frappeApiSecret) {
    return {};
  }

  return {
    Authorization: `token ${appConfig.frappeApiKey}:${appConfig.frappeApiSecret}`,
  };
};

const buildSalesOrderUrl = (salesOrderName?: string) => {
  const baseUrl = `${appConfig.frappeBaseUrl}/api/resource/Sales%20Order`;

  if (!salesOrderName) {
    return baseUrl;
  }

  return `${baseUrl}/${encodeURIComponent(salesOrderName)}`;
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

const getSalesOrderPayload = (cartItems: CartItem[]): SalesOrderPayload => {
  const profile = getUserProfile();
  const trimmedAddress = profile.address.trim();
  const trimmedName = profile.name.trim();
  const shopperName =
    trimmedName && trimmedName !== 'BIM User' ? trimmedName : DEFAULT_CUSTOMER_NAME;

  return {
    company: DEFAULT_COMPANY,
    currency: DEFAULT_CURRENCY,
    customer: DEFAULT_CUSTOMER_NAME,
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
  const authHeaders = getAuthHeaders();
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
      'Sales Order authentication failed. Check frappeApiKey and frappeApiSecret.',
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

const createSalesOrder = async (cartItems: CartItem[]) => {
  const payload = getSalesOrderPayload(cartItems);
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
  const payload = getSalesOrderPayload(cartItems);

  await requestSalesOrder<FrappeDocumentResponse<SalesOrderDocument>>(
    'PUT',
    buildSalesOrderUrl(salesOrderName),
    payload as unknown as Record<string, unknown>,
  );
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

export const ensureSalesOrderForCart = async (cartItems: CartItem[]) => {
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

export const getSalesOrderSyncErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'Unable to sync sales order.';
  }

  return (
    getFrappeExceptionMessage(error.body) ??
    error.body ??
    error.message
  );
};

const syncCartToSalesOrder = async (cartItems: CartItem[]) => {
  await ensureSalesOrderForCart(cartItems);
};

export const scheduleCartSalesOrderSync = (cartItems: CartItem[]) => {
  syncChain = syncChain
    .catch(() => undefined)
    .then(() => syncCartToSalesOrder(cartItems));

  return syncChain;
};
