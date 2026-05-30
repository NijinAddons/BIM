import {LoginAuthCredentials} from './auth.types';

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

const getString = (record: Record<string, unknown> | null, keys: string[]) => {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

export const getAuthResponsePayload = (response: {
  data?: unknown;
  message?: unknown;
}) => {
  return asRecord(response.data) ?? asRecord(response.message);
};

export const getNestedAuthResponsePayload = (response: {
  data?: unknown;
  message?: unknown;
}) => {
  const payload = getAuthResponsePayload(response);

  return asRecord(payload?.data) ?? asRecord(payload?.message) ?? payload;
};

export const getLoginAuthCredentials = (response: {
  data?: unknown;
  message?: unknown;
}): LoginAuthCredentials | null => {
  const payload = getNestedAuthResponsePayload(response);
  const authRecord = asRecord(payload?.auth) ?? asRecord(payload?.credentials) ?? null;

  const apiKey = getString(authRecord, ['api_key', 'apiKey', 'key']);
  const apiSecret = getString(authRecord, ['api_secret', 'apiSecret', 'secret']);

  if (!apiKey || !apiSecret) {
    return null;
  }

  return {
    apiKey,
    apiSecret,
  };
};
