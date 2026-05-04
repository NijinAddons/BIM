import AsyncStorage from '@react-native-async-storage/async-storage';

import {Product} from './mockData';

export type WishlistItem = {
  id: string;
  image: string;
  name: string;
  price: number;
  mrp: number;
  unit: string;
  pack: string;
  eta: string;
  stock: string;
};

const WISHLIST_STORAGE_KEY = '@buy_in_minutes_wishlist';

let wishlistItems: WishlistItem[] = [];
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

const persistWishlist = async () => {
  await AsyncStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistItems));
};

const parseProductPrice = (price: string) => {
  const parsedPrice = Number(price);
  return Number.isFinite(parsedPrice) ? parsedPrice : 0;
};

export const createWishlistItemFromProduct = (product: Product): WishlistItem => {
  const price = parseProductPrice(product.price);

  return {
    id: product.id,
    image: product.image,
    name: product.name,
    price,
    mrp: price,
    unit: product.grams,
    pack: product.grams,
    eta: product.eta,
    stock: 'In stock',
  };
};

export const getWishlistItems = () => wishlistItems;

export const subscribeWishlist = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const loadStoredWishlist = async () => {
  try {
    const rawValue = await AsyncStorage.getItem(WISHLIST_STORAGE_KEY);

    if (!rawValue) {
      wishlistItems = [];
      notify();
      return wishlistItems;
    }

    const parsedValue = JSON.parse(rawValue) as WishlistItem[];
    wishlistItems = Array.isArray(parsedValue) ? parsedValue : [];
    notify();
    return wishlistItems;
  } catch {
    wishlistItems = [];
    notify();
    return wishlistItems;
  }
};

export const addWishlistItem = async (item: WishlistItem) => {
  const exists = wishlistItems.some(wishlistItem => wishlistItem.id === item.id);

  if (exists) {
    wishlistItems = [
      item,
      ...wishlistItems.filter(wishlistItem => wishlistItem.id !== item.id),
    ];
  } else {
    wishlistItems = [item, ...wishlistItems];
  }

  await persistWishlist();
  notify();
  return wishlistItems;
};

export const removeWishlistItem = async (id: string) => {
  wishlistItems = wishlistItems.filter(item => item.id !== id);
  await persistWishlist();
  notify();
  return wishlistItems;
};
