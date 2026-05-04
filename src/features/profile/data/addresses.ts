import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedAddressDetails = {
  addressType?: 'Home' | 'Office';
  apartment?: string;
  area?: string;
  buildingNumber?: string;
  city?: string;
  country?: string;
  fullName?: string;
  landmark?: string;
  place?: string;
  phoneNumber?: string;
  postalCode?: string;
  state?: string;
  street?: string;
};

export type SavedAddress = {
  address: string;
  id: string;
  createdAt: number;
  details?: SavedAddressDetails;
};

export const buildSavedAddressDetailLines = (address: SavedAddress) => {
  const details = address.details;

  if (!details) {
    return [address.address];
  }

  const primaryLine = details.fullName?.trim() ?? '';

  const secondaryLine = [
    details.apartment,
    details.buildingNumber,
    details.street,
    details.landmark ? `Landmark: ${details.landmark}` : '',
    details.place,
    details.area,
    details.city,
    details.state,
    details.postalCode,
    details.country,
  ]
    .filter(Boolean)
    .join(', ');

  const tertiaryLine = details.phoneNumber?.trim() ?? '';

  return [primaryLine, secondaryLine, tertiaryLine].filter(Boolean) as string[];
};

export const getSavedAddressType = (address: SavedAddress) =>
  address.details?.addressType ?? 'Home';

export const getSavedAddressIconName = (address: SavedAddress) =>
  getSavedAddressType(address) === 'Office' ? 'briefcase-outline' : 'home-outline';

const SAVED_ADDRESSES_STORAGE_KEY = '@buy_in_minutes_saved_addresses';

let savedAddresses: SavedAddress[] = [];
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

const persistSavedAddresses = async () => {
  await AsyncStorage.setItem(
    SAVED_ADDRESSES_STORAGE_KEY,
    JSON.stringify(savedAddresses),
  );
};

export const getSavedAddresses = () => savedAddresses;

export const subscribeSavedAddresses = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const loadStoredAddresses = async () => {
  try {
    const rawValue = await AsyncStorage.getItem(SAVED_ADDRESSES_STORAGE_KEY);

    if (!rawValue) {
      savedAddresses = [];
      notify();
      return;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsedValue)) {
      savedAddresses = [];
      notify();
      return;
    }

    savedAddresses = parsedValue.filter((item): item is SavedAddress => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const record = item as Record<string, unknown>;

      return (
        typeof record.address === 'string' &&
        typeof record.id === 'string' &&
        typeof record.createdAt === 'number' &&
        (record.details === undefined ||
          (typeof record.details === 'object' && record.details !== null))
      );
    });
    notify();
  } catch {
    savedAddresses = [];
    notify();
  }
};

type AddSavedAddressInput =
  | string
  | {
      id?: string;
      address: string;
      details?: SavedAddressDetails;
    };

const sanitizeDetails = (details?: SavedAddressDetails): SavedAddressDetails | undefined => {
  if (!details) {
    return undefined;
  }

  const nextDetails = Object.fromEntries(
    Object.entries(details)
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : ''])
      .filter(([, value]) => value),
  ) as SavedAddressDetails;

  return Object.keys(nextDetails).length > 0 ? nextDetails : undefined;
};

export const addSavedAddress = async (input: AddSavedAddressInput) => {
  const nextAddressValue = typeof input === 'string' ? input : input.address;
  const trimmedAddress = nextAddressValue.trim();
  const details = sanitizeDetails(typeof input === 'string' ? undefined : input.details);
  const id = typeof input === 'string' ? undefined : input.id;

  if (!trimmedAddress) {
    return null;
  }

  if (id) {
    const existingAddressIndex = savedAddresses.findIndex(item => item.id === id);

    if (existingAddressIndex >= 0) {
      const updatedAddress: SavedAddress = {
        ...savedAddresses[existingAddressIndex],
        address: trimmedAddress,
        details,
      };

      savedAddresses = savedAddresses.map(item => (item.id === id ? updatedAddress : item));
      await persistSavedAddresses();
      notify();
      return updatedAddress;
    }
  }

  const existingAddress = savedAddresses.find(
    item => item.address.trim().toLowerCase() === trimmedAddress.toLowerCase(),
  );

  if (existingAddress) {
    return existingAddress;
  }

  const nextAddress: SavedAddress = {
    address: trimmedAddress,
    createdAt: Date.now(),
    details,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };

  savedAddresses = [nextAddress, ...savedAddresses];
  await persistSavedAddresses();
  notify();
  return nextAddress;
};

export const ensureSavedAddress = async (input: AddSavedAddressInput) => {
  const nextAddressValue = typeof input === 'string' ? input : input.address;
  const trimmedAddress = nextAddressValue.trim();

  if (!trimmedAddress) {
    return null;
  }

  const existingAddress = savedAddresses.find(
    item => item.address.trim().toLowerCase() === trimmedAddress.toLowerCase(),
  );

  if (existingAddress) {
    return existingAddress;
  }

  return addSavedAddress(input);
};

export const deleteSavedAddress = async (id: string) => {
  const nextSavedAddresses = savedAddresses.filter(item => item.id !== id);

  if (nextSavedAddresses.length === savedAddresses.length) {
    return false;
  }

  savedAddresses = nextSavedAddresses;
  await persistSavedAddresses();
  notify();
  return true;
};

export const clearSavedAddresses = async () => {
  savedAddresses = [];
  await AsyncStorage.removeItem(SAVED_ADDRESSES_STORAGE_KEY);
  notify();
};
