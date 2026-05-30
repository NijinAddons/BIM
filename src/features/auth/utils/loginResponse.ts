import {ApiError} from '../../../services/api/apiError';

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

const getString = (
  record: Record<string, unknown> | null,
  keys: string[],
) => {
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

export const getLoginPayload = (response: {data?: unknown; message?: unknown}) => {
  return asRecord(response.data) ?? asRecord(response.message);
};

export const getNestedLoginPayload = (response: {
  data?: unknown;
  message?: unknown;
}) => {
  const payload = getLoginPayload(response);

  return asRecord(payload?.data) ?? asRecord(payload?.message) ?? payload;
};

export const getLoginUserProfile = (response: {
  data?: unknown;
  message?: unknown;
}) => {
  const responseRecord = asRecord(response);
  const payload = getNestedLoginPayload(response);
  const user =
    asRecord(payload?.user) ??
    asRecord(payload?.data) ??
    asRecord(payload?.message) ??
    payload;
  const customerRecord =
    asRecord(payload?.customer) ??
    asRecord(user?.customer) ??
    null;

  if (!user) {
    return null;
  }

  const name =
    getString(user, ['full_name', 'fullName', 'username', 'name']) ??
    getString(payload, ['full_name', 'fullName', 'username', 'name']) ??
    getString(responseRecord, ['full_name', 'fullName', 'username', 'name']) ??
    '';
  const email =
    getString(user, ['email', 'email_id']) ??
    getString(payload, ['email', 'email_id']) ??
    getString(responseRecord, ['email', 'email_id', 'user']) ??
    '';
  const mobile =
    getString(user, ['phone', 'mobile', 'mobile_no']) ??
    getString(payload, ['phone', 'mobile', 'mobile_no']) ??
    getString(responseRecord, ['phone', 'mobile', 'mobile_no']) ??
    '';
  const customer =
    getString(customerRecord, ['name', 'customer_name', 'customerName']) ??
    getString(user, [
      'customer',
      'customer_name',
      'customerName',
      'customer_id',
      'customerId',
    ]) ??
    getString(payload, [
      'customer',
      'customer_name',
      'customerName',
      'customer_id',
      'customerId',
    ]) ??
    '';

  if (!name && !email && !mobile && !customer) {
    return null;
  }

  return {
    customer,
    email,
    mobile,
    name,
  };
};

export const isExistingUserLoginResponse = (response: {
  data?: unknown;
  message?: unknown;
}) => {
  if (getLoginUserProfile(response)) {
    return true;
  }

  const payload = getNestedLoginPayload(response);

  if (!payload) {
    return false;
  }

  const explicitExisting =
    payload.user_exists ??
    payload.userExists ??
    payload.existing_user ??
    payload.existingUser;

  if (typeof explicitExisting === 'boolean') {
    return explicitExisting;
  }

  const explicitNewUser = payload.is_new_user ?? payload.isNewUser;

  if (typeof explicitNewUser === 'boolean') {
    return !explicitNewUser;
  }

  const messageText =
    getString(payload, ['status', 'message', 'detail'])?.toLowerCase() ?? '';

  if (
    messageText.includes('not exist') ||
    messageText.includes('new user') ||
    messageText.includes('signup')
  ) {
    return false;
  }

  return (
    messageText.includes('login success') ||
    messageText.includes('logged in') ||
    messageText.includes('user exists')
  );
};

export const isUserMissingError = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return false;
  }

  if (error.status === 404) {
    return true;
  }

  const body = error.body?.toLowerCase() ?? '';

  return (
    body.includes('not found') ||
    body.includes('user does not exist') ||
    body.includes('customer does not exist') ||
    body.includes('new user') ||
    body.includes('signup')
  );
};
