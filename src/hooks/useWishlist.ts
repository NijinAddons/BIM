import {useCallback, useSyncExternalStore} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {CategoryItem} from '../services';

export type WishlistItem = CategoryItem;

const STORAGE_KEY = '@bim/wishlist';

let items: WishlistItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
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
        items = JSON.parse(raw) as WishlistItem[];
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

export function getWishlist(): WishlistItem[] {
  return items;
}

export function isWishlisted(id: string): boolean {
  return items.some(entry => entry.id === id);
}

export function toggleWishlist(item: WishlistItem): void {
  items = isWishlisted(item.id) ? items.filter(entry => entry.id !== item.id) : [item, ...items];
  persist();
  emit();
}

export function removeFromWishlist(id: string): void {
  if (!isWishlisted(id)) {
    return;
  }
  items = items.filter(entry => entry.id !== id);
  persist();
  emit();
}

export function useWishlist(): WishlistItem[] {
  return useSyncExternalStore(subscribe, getWishlist);
}

export function useIsWishlisted(id: string): boolean {
  const getSnapshot = useCallback(() => isWishlisted(id), [id]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
