import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchBrands, type Brand } from './brands.service';
import { fetchCategories } from './categories.service';
import { fetchStores, type Store } from './stores.service';

export const MAX_BRAND_CHIPS = 12;
export const MAX_STORE_CHIPS = 12;
// Rails whose items are fetched up front, so they're already filled in by the
// time they scroll into view instead of swapping a placeholder for content
// (and shifting the layout) mid-scroll.
export const PREFETCH_RAILS = 6;

export type FeedGroup = { id: string; name: string; image: string | null };

export type HomeFeed = {
  brands: Brand[];
  brandsTotal: number;
  stores: Store[];
  storesTotal: number;
  groups: FeedGroup[];
};

// Stale-while-revalidate cache for the Home feed's top-level lists: shown
// instantly on the next cold start while a fresh copy loads in the
// background, instead of a blank spinner every time the app opens.
const FEED_CACHE_KEY = '@bim/home_feed_cache';

export async function readCachedHomeFeed(): Promise<Partial<HomeFeed> | null> {
  try {
    const raw = await AsyncStorage.getItem(FEED_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Partial<HomeFeed>) : null;
  } catch {
    return null;
  }
}

async function persistFeedCache(partial: Partial<HomeFeed>): Promise<void> {
  try {
    const existing = (await readCachedHomeFeed()) ?? {};
    await AsyncStorage.setItem(
      FEED_CACHE_KEY,
      JSON.stringify({ ...existing, ...partial }),
    );
  } catch {
    // Best-effort — a failed write just means the next cold start falls
    // back to the network-only loading state.
  }
}

/**
 * Fetches the Home feed's lists and hands the first rails' group ids to
 * `prefetchRails`. Each list is independent: one that fails is left out of
 * the result (and out of the cache) rather than failing the others.
 */
export async function loadHomeFeed(
  prefetchRails: (groupIds: string[]) => Promise<unknown>,
): Promise<Partial<HomeFeed>> {
  const feed: Partial<HomeFeed> = {};

  const brandsRequest = fetchBrands()
    .then(all => {
      feed.brands = all.slice(0, MAX_BRAND_CHIPS);
      feed.brandsTotal = all.length;
    })
    .catch(() => undefined);

  const storesRequest = fetchStores()
    .then(all => {
      feed.stores = all.slice(0, MAX_STORE_CHIPS);
      feed.storesTotal = all.length;
    })
    .catch(() => undefined);

  const categoriesRequest = fetchCategories()
    .then(all => {
      const groups = all
        .filter(category => !category.isGroup && category.published)
        .map(category => ({
          id: category.id,
          name: category.name,
          image: category.image,
        }));
      feed.groups = groups;
      return prefetchRails(
        groups.slice(0, PREFETCH_RAILS).map(group => group.id),
      );
    })
    .catch(() => undefined);

  await Promise.all([brandsRequest, storesRequest, categoriesRequest]);
  persistFeedCache(feed);
  return feed;
}

