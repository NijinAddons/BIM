import AsyncStorage from '@react-native-async-storage/async-storage';

import type {CartItem} from '../cart/service';

const ORDERS_STORAGE_KEY = '@buy_in_minutes_orders';

export type LocalOrderSyncState = 'pending' | 'syncing' | 'confirmed' | 'failed';

export type LocalOrder = {
  address: string;
  backendDoctype: 'POS Invoice' | 'Sales Order';
  backendOrderName: string;
  backendStatus: string;
  createdAt: number;
  customerEmail: string;
  customerMobile: string;
  customerName: string;
  deliveryFee: number;
  errorMessage: string;
  id: string;
  itemCount: number;
  items: CartItem[];
  subtotal: number;
  syncState: LocalOrderSyncState;
  total: number;
};

type CreateLocalOrderInput = {
  address: string;
  customerEmail: string;
  customerMobile: string;
  customerName: string;
  deliveryFee: number;
  items: CartItem[];
  subtotal: number;
  total: number;
};

let orders: LocalOrder[] = [];
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

const persistOrders = async () => {
  await AsyncStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
};

const normalizeStoredOrders = (value: unknown): LocalOrder[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is LocalOrder => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const record = item as Record<string, unknown>;

      return (
        typeof record.id === 'string' &&
        typeof record.address === 'string' &&
        typeof record.backendOrderName === 'string' &&
        typeof record.backendStatus === 'string' &&
        typeof record.createdAt === 'number' &&
        typeof record.customerEmail === 'string' &&
        typeof record.customerMobile === 'string' &&
        typeof record.customerName === 'string' &&
        typeof record.deliveryFee === 'number' &&
        typeof record.errorMessage === 'string' &&
        typeof record.itemCount === 'number' &&
        Array.isArray(record.items) &&
        typeof record.subtotal === 'number' &&
        typeof record.syncState === 'string' &&
        typeof record.total === 'number'
      );
    })
    .sort((left, right) => right.createdAt - left.createdAt);
};

export const getOrders = () => orders;

export const subscribeOrders = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const loadStoredOrders = async () => {
  try {
    const rawValue = await AsyncStorage.getItem(ORDERS_STORAGE_KEY);

    if (!rawValue) {
      orders = [];
      notify();
      return orders;
    }

    orders = normalizeStoredOrders(JSON.parse(rawValue));
  } catch {
    orders = [];
  }

  notify();
  return orders;
};

export const createLocalOrder = async (
  input: CreateLocalOrderInput,
): Promise<LocalOrder> => {
  const createdAt = Date.now();
  const nextOrder: LocalOrder = {
    address: input.address.trim(),
    backendDoctype: 'Sales Order',
    backendOrderName: '',
    backendStatus: 'Queued locally',
    createdAt,
    customerEmail: input.customerEmail.trim(),
    customerMobile: input.customerMobile.trim(),
    customerName: input.customerName.trim(),
    deliveryFee: input.deliveryFee,
    errorMessage: '',
    id: `order-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    itemCount: input.items.reduce((total, item) => total + item.quantity, 0),
    items: input.items.map(item => ({...item})),
    subtotal: input.subtotal,
    syncState: 'pending',
    total: input.total,
  };

  orders = [nextOrder, ...orders];
  notify();
  await persistOrders();
  return nextOrder;
};

export const updateLocalOrder = async (
  orderId: string,
  patch: Partial<Omit<LocalOrder, 'id' | 'createdAt' | 'items'>>,
) => {
  let didUpdate = false;

  orders = orders.map(order => {
    if (order.id !== orderId) {
      return order;
    }

    didUpdate = true;
    return {
      ...order,
      ...patch,
    };
  });

  if (!didUpdate) {
    return;
  }

  notify();
  await persistOrders();
};

export const updateLocalOrderItems = async (
  orderId: string,
  items: CartItem[],
) => {
  let didUpdate = false;

  orders = orders.map(order => {
    if (order.id !== orderId) {
      return order;
    }

    didUpdate = true;
    const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);

    return {
      ...order,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      items: items.map(item => ({...item})),
      subtotal,
      total: subtotal + order.deliveryFee,
    };
  });

  if (!didUpdate) {
    return;
  }

  notify();
  await persistOrders();
};
