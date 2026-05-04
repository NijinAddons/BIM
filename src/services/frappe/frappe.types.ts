export type FrappeListResponse<T> = {
  data?: T[];
  message?: T[];
};

export type ProductFilterDataResponse = {
  message?: {
    items?: WebshopProductRecord[];
    items_count?: number | string | null;
    settings?: WebshopSettingsRecord | null;
    sub_categories?: Array<Record<string, unknown>>;
  };
};

export type WebshopProductRecord = {
  formatted_price?: string | null;
  has_variants?: number | null;
  in_cart?: boolean | null;
  in_stock?: boolean | null;
  item_code?: string | null;
  item_group?: string | null;
  item_name?: string | null;
  name?: string | null;
  on_backorder?: number | null;
  price_list_rate?: number | string | null;
  ranking?: number | null;
  route?: string | null;
  short_description?: string | null;
  variant_of?: string | null;
  web_item_name?: string | null;
  website_image?: string | null;
  website_warehouse?: string | null;
  wished?: boolean | null;
};

export type WebshopSettingsRecord = {
  products_per_page?: number | string | null;
};

export type WebsiteItemRecord = {
  item_code?: string | null;
  item_group?: string | null;
  item_name?: string | null;
  name?: string | null;
  published?: number | null;
  ranking?: number | null;
  route?: string | null;
  stock_uom?: string | null;
  thumbnail?: string | null;
  website_image?: string | null;
};
