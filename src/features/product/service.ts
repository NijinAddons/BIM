export {
  addWishlistItem,
  createWishlistItemFromProduct,
  getWishlistItems,
  loadStoredWishlist,
  removeWishlistItem,
  subscribeWishlist,
} from './data/wishlist';
import {appConfig} from '../../app/config/appConfig';
import {frappeService} from '../../services/frappe';
import {logger} from '../../utils/logger';
import {categories, products as mockProducts, Product} from './data/mockData';

export {categories};
export const products = mockProducts;
export type {WishlistItem} from './data/wishlist';

const productCardTones = ['#fff0c2', '#e1f1ff', '#ffe5ed', '#f7e9ce', '#d9f6de'];
const defaultProductImage =
  'https://loremflickr.com/320/320/grocery,product?lock=999';

type ProductFeedRecord = Record<string, unknown>;

const asRecord = (value: unknown): ProductFeedRecord | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as ProductFeedRecord;
  }

  return null;
};

const getString = (record: ProductFeedRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const getNumber = (record: ProductFeedRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

const formatPrice = (value: number | null) => {
  if (value === null) {
    return '0.00';
  }

  return value.toFixed(value % 1 === 0 ? 0 : 2);
};

const getImageUrl = (imagePath: string) => {
  if (!imagePath) {
    return defaultProductImage;
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  return `${appConfig.productAssetBaseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
};

const toProduct = (item: unknown, index: number): Product | null => {
  const record = asRecord(item);

  if (!record) {
    return null;
  }

  const name = getString(record, [
    'item_name',
    'website_item_name',
    'web_item_name',
    'product_name',
    'title',
    'name',
  ]);

  if (!name) {
    return null;
  }

  const id =
    getString(record, ['item_code', 'name', 'id', 'sku', 'product_id']) ||
    `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`;
  const grams =
    getString(record, ['grams', 'weight', 'unit', 'stock_uom', 'uom', 'package_size']) ||
    '1 unit';
  const eta = getString(record, ['eta', 'delivery_eta']) || '10 mins';
  const image = getImageUrl(
    getString(record, [
      'website_image',
      'thumbnail',
      'image',
      'image_url',
      'product_image',
    ]),
  );
  const price = formatPrice(
    getNumber(record, [
      'price',
      'selling_price',
      'rate',
      'amount',
      'standard_rate',
      'formatted_price',
    ]),
  );
  const itemGroup = getString(record, ['item_group', 'category', 'group']) || 'Fresh';
  const offerTag =
    getString(record, ['offerTag', 'offer_tag', 'discount_tag']) || itemGroup;
  const totalSellers =
    getNumber(record, ['totalSellers', 'total_sellers', 'seller_count']) ?? 1;

  return {
    id,
    name,
    grams,
    eta,
    image,
    price,
    tone: productCardTones[index % productCardTones.length],
    offerTag,
    itemGroup,
    totalSellers,
  };
};

type FetchProductsOptions = {
  fallbackToMock?: boolean;
};

export const fetchProducts = async (
  options: FetchProductsOptions = {},
): Promise<Product[]> => {
  const {fallbackToMock = false} = options;

  try {
    const websiteItems = await frappeService.fetchWebsiteItems();
    const parsedProducts = websiteItems
      .map(toProduct)
      .filter((item): item is Product => item !== null);

    if (parsedProducts.length === 0) {
      logger.warn(
        fallbackToMock
          ? 'Product feed returned no usable products, falling back to mock data.'
          : 'Product feed returned no usable products.',
      );
      return fallbackToMock ? mockProducts : [];
    }

    return parsedProducts;
  } catch (error) {
    logger.warn(
      fallbackToMock
        ? 'Unable to fetch product feed, falling back to mock data.'
        : 'Unable to fetch product feed.',
      error,
    );
    return fallbackToMock ? mockProducts : [];
  }
};
