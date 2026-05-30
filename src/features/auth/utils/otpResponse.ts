const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

const getNumber = (record: Record<string, unknown> | null, keys: string[]) => {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
};

export const getOtpResponsePayload = (response: {data?: unknown; message?: unknown}) => {
  return asRecord(response.data) ?? asRecord(response.message);
};

export const getNestedOtpResponsePayload = (response: {
  data?: unknown;
  message?: unknown;
}) => {
  const payload = getOtpResponsePayload(response);

  return asRecord(payload?.data) ?? asRecord(payload?.message) ?? payload;
};

export const getOtpDeliveryMeta = (response: {data?: unknown; message?: unknown}) => {
  const payload = getNestedOtpResponsePayload(response);

  return {
    expiresIn: getNumber(payload, ['expires_in', 'expiresIn']),
    maxAttempts: getNumber(payload, ['max_attempts', 'maxAttempts']),
  };
};
