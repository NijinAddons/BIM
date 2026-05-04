import {appConfig} from '../../app/config/appConfig';
import {ApiError} from '../api/apiError';
import {apiClient} from '../api/apiClient';
import {
  FrappeListResponse,
  ProductFilterDataResponse,
  WebsiteItemRecord,
  WebshopProductRecord,
} from './frappe.types';

const websiteItemPageSize = 100;
const itemPricePageSize = 200;

const websiteItemFields = [
  'name',
  'item_name',
  'item_code',
  'item_group',
  'stock_uom',
  'website_image',
  'thumbnail',
  'route',
  'published',
  'ranking',
];

const itemPriceFields = [
  'item_code',
  'price_list_rate',
  'currency',
  'price_list',
  'selling',
  'uom',
  'valid_from',
];
const getAuthHeaders = (): Record<string, string> => {
  if (!appConfig.frappeApiKey || !appConfig.frappeApiSecret) {
    return {};
  }

  return {
    Authorization: `token ${appConfig.frappeApiKey}:${appConfig.frappeApiSecret}`,
  };
};

const buildResourceUrl = (
  doctype: string,
  params: Record<string, string | number>,
) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    query.set(key, String(value));
  });

  return `${appConfig.frappeBaseUrl}/api/resource/${encodeURIComponent(doctype)}?${query.toString()}`;
};

const buildMethodUrl = (
  method: string,
  params: Record<string, string | number>,
) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    query.set(key, String(value));
  });

  return `${appConfig.frappeBaseUrl}/api/method/${method}?${query.toString()}`;
};

const getPositiveNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
};

export const frappeService = {
  fetchAllProducts: async () => {
    const records: WebshopProductRecord[] = [];
    let start = 0;
    let pageSize = 40;
    let totalCount = Number.POSITIVE_INFINITY;
    let useAuthHeaders = true;

    while (records.length < totalCount) {
      const url = buildMethodUrl(appConfig.allProductsFeedMethod, {
        query_args: JSON.stringify({
          attribute_filters: {},
          field_filters: {},
          from_filters: false,
          item_group: null,
          start,
        }),
      });

      let result;

      try {
        result = await apiClient.get<ProductFilterDataResponse>(url, {
          headers: useAuthHeaders ? getAuthHeaders() : {},
          logLabel: 'All products response',
        });
      } catch (error) {
        if (useAuthHeaders && error instanceof ApiError && error.status === 401) {
          useAuthHeaders = false;
          result = await apiClient.get<ProductFilterDataResponse>(url, {
            headers: {},
            logLabel: 'All products response (without auth)',
          });
        } else {
          throw error;
        }
      }

      const message = result.data?.message;
      const pageRecords = Array.isArray(message?.items) ? message.items : [];

      records.push(...pageRecords);

      totalCount = getPositiveNumber(message?.items_count, records.length);
      pageSize = getPositiveNumber(message?.settings?.products_per_page, pageSize);

      if (pageRecords.length === 0 || pageRecords.length < pageSize) {
        break;
      }

      start += pageSize;
    }

    return records;
  },
  fetchWebsiteItems: async () => {
    const records: WebsiteItemRecord[] = [];
    let start = 0;
    let useAuthHeaders = true;

    while (true) {
      const url = buildResourceUrl('Website Item', {
        fields: JSON.stringify(websiteItemFields),
        filters: JSON.stringify([['published', '=', 1]]),
        limit_page_length: websiteItemPageSize,
        limit_start: start,
      });

      let result;

      try {
        result = await apiClient.get<FrappeListResponse<WebsiteItemRecord>>(url, {
          headers: useAuthHeaders ? getAuthHeaders() : {},
          logLabel: 'Website Item response',
        });
      } catch (error) {
        if (useAuthHeaders && error instanceof ApiError && error.status === 401) {
          useAuthHeaders = false;
          result = await apiClient.get<FrappeListResponse<WebsiteItemRecord>>(url, {
            headers: {},
            logLabel: 'Website Item response (without auth)',
          });
        } else {
          throw error;
        }
      }
      const responseRecords = result.data?.data ?? result.data?.message ?? [];
      const pageRecords = Array.isArray(responseRecords) ? responseRecords : [];

      records.push(...pageRecords);

      if (pageRecords.length < websiteItemPageSize) {
        break;
      }

      start += websiteItemPageSize;
    }

    return records;
  },
  fetchItemPrices: async (itemCodes: string[]) => {
    const normalizedItemCodes = Array.from(
      new Set(itemCodes.map(itemCode => itemCode.trim()).filter(Boolean)),
    );

    if (normalizedItemCodes.length === 0) {
      return [];
    }

    const itemCodeSet = new Set(normalizedItemCodes);
    const matchedRecords: Record<string, unknown>[] = [];
    let start = 0;

    while (true) {
      const url = buildResourceUrl('Item Price', {
        fields: JSON.stringify(itemPriceFields),
        filters: JSON.stringify([['price_list', '=', 'Standard Selling']]),
        limit_page_length: itemPricePageSize,
        limit_start: start,
      });

      const result = await apiClient.get<FrappeListResponse<Record<string, unknown>>>(url, {
        headers: getAuthHeaders(),
        logLabel: 'Item Price response',
      });

      const responseRecords = result.data?.data ?? result.data?.message ?? [];
      const pageRecords = Array.isArray(responseRecords) ? responseRecords : [];

      matchedRecords.push(
        ...pageRecords.filter(record => {
          const itemCode = typeof record?.item_code === 'string' ? record.item_code.trim() : '';
          return itemCodeSet.has(itemCode);
        }),
      );

      if (pageRecords.length < itemPricePageSize) {
        break;
      }

      start += itemPricePageSize;
    }

    return matchedRecords;
  },
};
