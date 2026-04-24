import {Product} from '../../product/data/mockData';

export type CartItem = {
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

const listeners = new Set<() => void>();
const additionListeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

const notifyAddition = () => {
  additionListeners.forEach(listener => listener());
};

const toCartItem = (product: Product): CartItem => ({
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
}

export function updateCartItemQuantity(id: string, delta: number) {
  cartItems = cartItems
    .map(item =>
      item.id === id ? {...item, quantity: Math.max(0, item.quantity + delta)} : item,
    )
    .filter(item => item.quantity > 0);

  notify();
}

export function clearCart() {
  cartItems = [];
  notify();
}
