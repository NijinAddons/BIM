import {useSyncExternalStore} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedAddress = {
  id: string;
  label: string; // "Home", "Office", …
  address: string; // full address line
  phone: string; // contact number for this delivery
  street: string; // street / road name
  emirate: string; // UAE emirate
  note: string; // optional landmark / delivery note
  room?: string; // room / flat number (missing on older entries)
  landmark?: string; // nearby landmark (missing on older entries)
};

const STORAGE_KEY = '@bim/addresses';

let addresses: SavedAddress[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(addresses)).catch(() => {});
}

let hydrated = false;
function hydrate() {
  if (hydrated) {
    return;
  }
  hydrated = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then(raw => {
      if (!raw) {
        return;
      }
      try {
        addresses = JSON.parse(raw) as SavedAddress[];
        emit();
      } catch {}
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

function makeId() {
  return `addr_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

/** "Room 302 · Marina Heights · Near Lulu" — the extras under an address. */
export function addressExtras(entry: SavedAddress): string {
  const landmark = entry.landmark?.replace(/^near\s+/i, '');
  return [
    entry.room ? `Room ${entry.room}` : '',
    entry.note,
    landmark ? `Near ${landmark}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function addAddress(input: Omit<SavedAddress, 'id'>): SavedAddress {
  const entry: SavedAddress = {id: makeId(), ...input};
  addresses = [entry, ...addresses];
  persist();
  emit();
  return entry;
}

export function updateAddress(
  id: string,
  updates: Partial<Omit<SavedAddress, 'id'>>,
): void {
  addresses = addresses.map(entry =>
    entry.id === id ? {...entry, ...updates} : entry,
  );
  persist();
  emit();
}

export function removeAddress(id: string): void {
  const next = addresses.filter(entry => entry.id !== id);
  if (next.length === addresses.length) {
    return;
  }
  addresses = next;
  persist();
  emit();
}

export function useAddresses(): SavedAddress[] {
  return useSyncExternalStore(subscribe, () => addresses);
}
