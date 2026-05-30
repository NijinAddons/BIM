import {appConfig} from '../../../app/config/appConfig';
import {getFrappeAuthHeaders} from '../../../services/frappe/frappeAuth';
import {logger} from '../../../utils/logger';

export const normalizeSocialAuthProfile = (profile: {
  customer?: string;
  email?: string;
  mobile?: string;
  name?: string;
}) => ({
  customer: typeof profile.customer === 'string' ? profile.customer : '',
  email: typeof profile.email === 'string' ? profile.email.trim() : '',
  mobile: typeof profile.mobile === 'string' ? profile.mobile.trim() : '',
  name: typeof profile.name === 'string' ? profile.name.trim() : '',
});

export type ExistingAuthUserRecord = {
  email?: string;
  full_name?: string;
  mobile_no?: string;
  name?: string;
  username?: string;
};

export const findExistingAuthUserByEmail = async (email: string) => {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    return null;
  }

  const params = new URLSearchParams();
  params.set(
    'fields',
    JSON.stringify(['name', 'email', 'full_name', 'mobile_no', 'username']),
  );
  params.set('filters', JSON.stringify([['email', '=', trimmedEmail]]));
  params.set('limit_page_length', '1');

  const response = await fetch(
    `${appConfig.frappeBaseUrl}/api/resource/User?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
        ...getFrappeAuthHeaders(),
      },
      method: 'GET',
    },
  );
  const rawBody = await response.text();

  logger.log('[Auth] user lookup response', {
    body: rawBody,
    email: trimmedEmail,
    ok: response.ok,
    status: response.status,
  });

  if (!response.ok) {
    return null;
  }

  const parsed = JSON.parse(rawBody) as {
    data?: ExistingAuthUserRecord[];
    message?: ExistingAuthUserRecord[];
  };
  const records = parsed.data ?? parsed.message ?? [];

  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }

  return records[0] ?? null;
};
