import AsyncStorage from '@react-native-async-storage/async-storage';

import {Product} from '../../product/data/mockData';

export type CartItem = {
  description: string;
  id: string;
  image: string;
  name: string;
  grams: string;
  price: number;
  quantity: number;
  tone: string;
  eta: string;
};

export type CartAddition = {
  id: string;
  name: string;
  quantity: number;
  timestamp: number;
};

let cartItems: CartItem[] = [];
let lastCartAddition: CartAddition | null = null;
const CART_STORAGE_KEY = '@buy_in_minutes_cart';

const listeners = new Set<() => void>();
const additionListeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

const notifyAddition = () => {
  additionListeners.forEach(listener => listener());
};

const persistCartItems = () =>
  AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems)).catch(() => undefined);

const toCartItem = (product: Product): CartItem => ({
  description: product.itemGroup?.trim() || product.grams,
  id: product.id,
  eta: product.eta,
  grams: product.grams,
  image: product.image,
  name: product.name,
  price: Number(product.price),
  quantity: 1,
  tone: product.tone,
});

export function getCartItems() {
  return cartItems;
}

export function subscribeCart(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLastCartAddition() {
  return lastCartAddition;
}

export function subscribeCartAdditions(listener: () => void) {
  additionListeners.add(listener);
  return () => {
    additionListeners.delete(listener);
  };
}

export async function loadStoredCart() {
  try {
    const rawValue = await AsyncStorage.getItem(CART_STORAGE_KEY);

    if (!rawValue) {
      cartItems = [];
      notify();
      return;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsedValue)) {
      cartItems = [];
      notify();
      return;
    }

    cartItems = parsedValue.filter((item): item is CartItem => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const record = item as Record<string, unknown>;

      return (
        typeof record.id === 'string' &&
        typeof record.image === 'string' &&
        typeof record.name === 'string' &&
        (record.description === undefined || typeof record.description === 'string') &&
        typeof record.grams === 'string' &&
        typeof record.price === 'number' &&
        typeof record.quantity === 'number' &&
        typeof record.tone === 'string' &&
        typeof record.eta === 'string'
      );
    });

    cartItems = cartItems.map(item => ({
      ...item,
      description: item.description || item.grams,
    }));

    notify();
  } catch {
    cartItems = [];
    notify();
  }
}

export function addProductToCart(product: Product) {
  const existingItem = cartItems.find(item => item.id === product.id);
  const nextQuantity = existingItem ? existingItem.quantity + 1 : 1;

  if (existingItem) {
    cartItems = cartItems.map(item =>
      item.id === product.id ? {...item, quantity: item.quantity + 1} : item,
    );
  } else {
    cartItems = [...cartItems, toCartItem(product)];
  }

  lastCartAddition = {
    id: product.id,
    name: product.name,
    quantity: nextQuantity,
    timestamp: Date.now(),
  };

  notify();
  notifyAddition();
  persistCartItems();
}

export function updateCartItemQuantity(id: string, delta: number) {
  cartItems = cartItems
    .map(item =>
      item.id === id ? {...item, quantity: Math.max(0, item.quantity + delta)} : item,
    )
    .filter(item => item.quantity > 0);

  notify();
  persistCartItems();
}

export function clearCart() {
  cartItems = [];
  notify();
  persistCartItems();
}
