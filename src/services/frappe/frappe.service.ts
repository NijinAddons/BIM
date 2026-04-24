import {appConfig} from '../../app/config/appConfig';
import {apiClient} from '../api/apiClient';
import {FrappeListResponse, WebsiteItemRecord} from './frappe.types';

const websiteItemPageSize = 100;

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

export const frappeService = {
  fetchWebsiteItems: async () => {
    const records: WebsiteItemRecord[] = [];
    let start = 0;

    while (true) {
      const url = buildResourceUrl('Website Item', {
        fields: JSON.stringify(websiteItemFields),
        filters: JSON.stringify([['published', '=', 1]]),
        limit_page_length: websiteItemPageSize,
        limit_start: start,
      });

      const result = await apiClient.get<FrappeListResponse<WebsiteItemRecord>>(url, {
        headers: getAuthHeaders(),
        logLabel: 'Website Item response',
      });
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
};
