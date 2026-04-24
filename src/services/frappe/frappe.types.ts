export type FrappeListResponse<T> = {
  data?: T[];
  message?: T[];
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
