export {
  addWishlistItem,
  createWishlistItemFromProduct,
  getWishlistItems,
  loadStoredWishlist,
  removeWishlistItem,
  subscribeWishlist,
} from './data/wishlist';
export type {Category, Product} from './data/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const getItemCode = (record: ProductFeedRecord) =>
  getString(record, ['item_code', 'name', 'id', 'sku', 'product_id']);
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

  const itemCode = getItemCode(record);
  const id = itemCode || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`;
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
      'price_list_rate',
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
  forceRefresh?: boolean;
};

type StoredProductCache = {
  products: Product[];
  updatedAt: string;
};

const PRODUCT_CACHE_STORAGE_KEY = '@buy_in_minutes_products';
let cachedProducts: Product[] = [];
let hasLoadedStoredProductCache = false;
let productFetchPromise: Promise<Product[]> | null = null;

const isProduct = (value: unknown): value is Product => {
  const record = asRecord(value);

  return Boolean(
    record &&
      typeof record.id === 'string' &&
      typeof record.name === 'string' &&
      typeof record.image === 'string' &&
      typeof record.price === 'string' &&
      typeof record.grams === 'string' &&
      typeof record.eta === 'string' &&
      typeof record.tone === 'string' &&
      typeof record.offerTag === 'string' &&
      typeof record.totalSellers === 'number',
  );
};

const persistProductCache = async (productsToStore: Product[]) => {
  const payload: StoredProductCache = {
    products: productsToStore,
    updatedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(PRODUCT_CACHE_STORAGE_KEY, JSON.stringify(payload));
};

const fetchProductsFromSource = async (fallbackToMock: boolean) => {
  try {
    const webshopItems = await frappeService.fetchAllProducts();
    logger.log('[All Products] raw response', {
      count: webshopItems.length,
      items: webshopItems,
    });

    const parsedProducts = webshopItems
      .map((item, index) => toProduct(item, index))
      .filter((item): item is Product => item !== null);

    logger.log('[All Products] mapped products', {
      count: parsedProducts.length,
      products: parsedProducts,
    });
    if (parsedProducts.length === 0) {
      logger.warn(
        fallbackToMock
          ? 'Product feed returned no usable products, falling back to mock data.'
          : 'Product feed returned no usable products.',
      );
      if (cachedProducts.length > 0) {
        return cachedProducts;
      }

      return fallbackToMock ? mockProducts : [];
    }

    cachedProducts = parsedProducts;
    hasLoadedStoredProductCache = true;
    await persistProductCache(parsedProducts);
    return parsedProducts;
  } catch (error) {
    logger.warn(
      fallbackToMock
        ? 'Unable to fetch product feed, falling back to mock data.'
        : 'Unable to fetch product feed.',
      error,
    );

    if (cachedProducts.length > 0) {
      return cachedProducts;
    }

    return fallbackToMock ? mockProducts : [];
  }
};

export const getCachedProducts = () => cachedProducts;

export const loadStoredProductCache = async () => {
  if (hasLoadedStoredProductCache) {
    return cachedProducts;
  }

  try {
    const rawValue = await AsyncStorage.getItem(PRODUCT_CACHE_STORAGE_KEY);

    if (!rawValue) {
      hasLoadedStoredProductCache = true;
      return cachedProducts;
    }

    const parsedValue = JSON.parse(rawValue) as StoredProductCache;
    const storedProducts = Array.isArray(parsedValue?.products)
      ? parsedValue.products.filter(isProduct)
      : [];

    cachedProducts = storedProducts;
  } catch (error) {
    logger.warn('Unable to load cached products.', error);
    cachedProducts = [];
  }

  hasLoadedStoredProductCache = true;
  return cachedProducts;
};

export const prefetchProducts = async () => {
  await loadStoredProductCache();

  if (cachedProducts.length > 0 || productFetchPromise) {
    return productFetchPromise ?? cachedProducts;
  }

  productFetchPromise = fetchProductsFromSource(false).finally(() => {
    productFetchPromise = null;
  });

  return productFetchPromise;
};

export const fetchProducts = async (
  options: FetchProductsOptions = {},
): Promise<Product[]> => {
  const {fallbackToMock = false, forceRefresh = false} = options;

  await loadStoredProductCache();

  if (!forceRefresh && cachedProducts.length > 0) {
    return cachedProducts;
  }

  if (productFetchPromise) {
    return productFetchPromise;
  }

  productFetchPromise = fetchProductsFromSource(fallbackToMock).finally(() => {
    productFetchPromise = null;
  });

  return productFetchPromise;
};
