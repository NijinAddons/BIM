import AsyncStorage from '@react-native-async-storage/async-storage';

const FRAPPE_AUTH_STORAGE_KEY = '@buy_in_minutes_frappe_auth';

export type FrappeAuthCredentials = {
  apiKey: string;
  apiSecret: string;
};

type StoredFrappeAuthCredentials = {
  apiKey?: string;
  apiSecret?: string;
};

let currentFrappeAuthCredentials: FrappeAuthCredentials | null = null;
let hasLoadedStoredFrappeAuth = false;

const normalizeFrappeAuthCredentials = (
  credentials: StoredFrappeAuthCredentials | null | undefined,
): FrappeAuthCredentials | null => {
  if (!credentials) {
    return null;
  }

  const apiKey = typeof credentials.apiKey === 'string' ? credentials.apiKey.trim() : '';
  const apiSecret =
    typeof credentials.apiSecret === 'string' ? credentials.apiSecret.trim() : '';

  if (!apiKey || !apiSecret) {
    return null;
  }

  return {
    apiKey,
    apiSecret,
  };
};

export const getStoredFrappeAuthCredentials = () => currentFrappeAuthCredentials;

export const getFrappeAuthHeaders = (): Record<string, string> => {
  if (!currentFrappeAuthCredentials) {
    return {};
  }

  return {
    Authorization: `token ${currentFrappeAuthCredentials.apiKey}:${currentFrappeAuthCredentials.apiSecret}`,
  };
};

export const loadStoredFrappeAuthCredentials = async () => {
  if (hasLoadedStoredFrappeAuth) {
    return currentFrappeAuthCredentials;
  }

  try {
    const rawValue = await AsyncStorage.getItem(FRAPPE_AUTH_STORAGE_KEY);

    if (!rawValue) {
      currentFrappeAuthCredentials = null;
      hasLoadedStoredFrappeAuth = true;
      return currentFrappeAuthCredentials;
    }

    const parsedValue = JSON.parse(rawValue) as StoredFrappeAuthCredentials;
    currentFrappeAuthCredentials = normalizeFrappeAuthCredentials(parsedValue);
  } catch {
    currentFrappeAuthCredentials = null;
  }

  hasLoadedStoredFrappeAuth = true;
  return currentFrappeAuthCredentials;
};

export const setStoredFrappeAuthCredentials = async (
  credentials: StoredFrappeAuthCredentials,
) => {
  const normalizedCredentials = normalizeFrappeAuthCredentials(credentials);

  currentFrappeAuthCredentials = normalizedCredentials;
  hasLoadedStoredFrappeAuth = true;

  if (!normalizedCredentials) {
    await AsyncStorage.removeItem(FRAPPE_AUTH_STORAGE_KEY);
    return null;
  }

  await AsyncStorage.setItem(
    FRAPPE_AUTH_STORAGE_KEY,
    JSON.stringify(normalizedCredentials),
  );

  return normalizedCredentials;
};

export const clearStoredFrappeAuthCredentials = async () => {
  currentFrappeAuthCredentials = null;
  hasLoadedStoredFrappeAuth = true;
  await AsyncStorage.removeItem(FRAPPE_AUTH_STORAGE_KEY);
};
