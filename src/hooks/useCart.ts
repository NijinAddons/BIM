import { useCallback, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CategoryItem } from '../services';

export type CartLine = {
  item: CategoryItem;
  qty: number;
};

const STORAGE_KEY = '@bim/cart';

let lines: CartLine[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lines)).catch(() => {});
}

let hydrated = false;
function hydrate() {
  if (hydrated) {
    return;
  }
  hydrated = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then(raw => {
      if (raw) {
        lines = JSON.parse(raw) as CartLine[];
        emit();
      }
    })
    .catch(() => {});
}
hydrate();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// RFQ-only items are quoted by the supplier rather than sold from stock, so
// their quantity isn't capped by the stock figure.
const RFQ_MAX_QTY = 9999;

function clampToStock(item: CategoryItem, qty: number): number {
  const ceiling = item.rfqOnly ? RFQ_MAX_QTY : item.stock > 0 ? item.stock : 0;
  return Math.max(0, Math.min(qty, ceiling));
}

export function getCart(): CartLine[] {
  return lines;
}

/** Units for one item currently in the cart (0 if absent). */
export function getCartQty(id: string): number {
  return lines.find(line => line.item.id === id)?.qty ?? 0;
}

/** Total units across every line. */
export function getCartCount(): number {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

export function getCartSubtotal(): number {
  return lines.reduce((sum, line) => sum + line.item.price * line.qty, 0);
}

/** Set an item's quantity to an absolute value; 0 or less removes the line. */
export function setCartQty(item: CategoryItem, qty: number): void {
  const next = clampToStock(item, qty);
  const existing = lines.find(line => line.item.id === item.id);

  if (next <= 0) {
    if (!existing) {
      return;
    }
    lines = lines.filter(line => line.item.id !== item.id);
  } else if (existing) {
    lines = lines.map(line =>
      line.item.id === item.id ? { item, qty: next } : line,
    );
  } else {
    lines = [{ item, qty: next }, ...lines];
  }

  persist();
  emit();
}

export function addToCart(item: CategoryItem, amount = 1): void {
  setCartQty(item, getCartQty(item.id) + amount);
}

export function removeFromCart(id: string): void {
  if (!lines.some(line => line.item.id === id)) {
    return;
  }
  lines = lines.filter(line => line.item.id !== id);
  persist();
  emit();
}

/** Drop every line matching `predicate`, e.g. just the lines just ordered. */
export function removeCartLines(predicate: (line: CartLine) => boolean): void {
  const next = lines.filter(line => !predicate(line));
  if (next.length === lines.length) {
    return;
  }
  lines = next;
  persist();
  emit();
}

export function clearCart(): void {
  if (lines.length === 0) {
    return;
  }
  lines = [];
  persist();
  emit();
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, getCart);
}

export function useCartCount(): number {
  return useSyncExternalStore(subscribe, getCartCount);
}

/** Sum of price*qty across every line, kept in sync. */
export function useCartSubtotal(): number {
  return useSyncExternalStore(subscribe, getCartSubtotal);
}

/** Quantity of one item in the cart, kept in sync. */
export function useCartQty(id: string): number {
  const getSnapshot = useCallback(() => getCartQty(id), [id]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
