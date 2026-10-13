import {callFrappeMethod, postFrappeMethod} from './frappe.client';

export type RequestPhoneOtpResponse = {
  success: boolean;
  status?: string;
  message?: string;
  auth_flow_token?: string;
  auth_mode?: string;
  user_exists?: boolean;
  website_user_exists?: boolean;
};

export async function requestPhoneOtp(phoneNumber: string): Promise<RequestPhoneOtpResponse> {
  const response = await callFrappeMethod<RequestPhoneOtpResponse>(
    'buy_in_minutes.auth.request_phone_otp',
    {phone_number: phoneNumber},
    'phone OTP',
  );
  console.log('requestPhoneOtp response', response);
  return response;
}

// Frappe User doctype fields, as observed on a real verify_phone_otp
// response: { name: 'demo@gmail.com', email: 'demo@gmail.com',
// mobile_no: '+971509050493', full_name: 'Demo User', user_image: null }.
export type AuthUser = {
  // Frappe's User docname — for this app, the same as `email`.
  name: string;
  email: string;
  mobile_no: string | null;
  full_name: string;
  user_image: string | null;
};

export type VerifyPhoneOtpResponse = {
  success: boolean;
  message?: string;
  profile_token?: string;
  is_new_user?: boolean;
  website_user_created?: boolean;
  website_user_exists?: boolean;
  needs_profile?: boolean;
  profile_completed?: boolean;
  session_token?: string;
  user?: AuthUser;
};

export async function verifyPhoneOtp(
  phoneNumber: string,
  otp: string,
  authFlowToken: string,
): Promise<VerifyPhoneOtpResponse> {
  const response = await postFrappeMethod<VerifyPhoneOtpResponse>(
    'buy_in_minutes.auth.verify_phone_otp',
    {
      phone_number: phoneNumber,
      otp,
      auth_flow_token: authFlowToken,
    },
    'OTP verification',
  );
  console.log('verifyPhoneOtp response', response);
  return response;
}

export type CompletePhoneProfileResponse = {
  success: boolean;
  message?: string;
  // Not confirmed from a real response yet — kept optional in case profile
  // completion (which finalizes a new user's account) issues its own token
  // rather than reusing the one from `verify_phone_otp`.
  session_token?: string;
  user?: AuthUser;
};

export async function completePhoneProfile(
  fullName: string,
  email: string,
  phoneNumber: string,
  profileToken: string,
): Promise<CompletePhoneProfileResponse> {
  const response = await postFrappeMethod<CompletePhoneProfileResponse>(
    'buy_in_minutes.auth.complete_phone_profile',
    {
      full_name: fullName,
      email,
      phone_number: phoneNumber,
      profile_token: profileToken,
    },
    'profile completion',
  );
  console.log('completePhoneProfile response', response);
  return response;
}
