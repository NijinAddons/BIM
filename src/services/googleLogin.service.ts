import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import {GOOGLE_WEB_CLIENT_ID} from '../config';
import {fetchResourceList, postFrappeMethod} from './frappe.client';
import {
  requestPhoneOtp,
  verifyPhoneOtp,
  type AuthUser,
  type RequestPhoneOtpResponse,
} from './otpLogin.service';

let isConfigured = false;

/**
 * Configures the native Google Sign-In SDK once. `webClientId` must be the
 * OAuth *web* client — Google then issues an ID token whose audience the
 * backend can verify. On Android the app's own Android OAuth client is matched
 * by package name + signing SHA-1, so it isn't passed here.
 */
function ensureConfigured(): void {
  if (isConfigured) {
    return;
  }
  GoogleSignin.configure({webClientId: GOOGLE_WEB_CLIENT_ID});
  isConfigured = true;
}

export type GoogleAccount = {
  idToken: string;
  // The Google profile in the app's user shape; `name` is the email, as for
  // Frappe users.
  user: AuthUser;
};

/**
 * Shows Google's account picker and returns the ID token and profile, or
 * `null` if the user dismissed it. Throws on any other failure.
 */
export async function getGoogleAccount(): Promise<GoogleAccount | null> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});

  // The SDK reuses the last-picked account silently; clear it so the
  // account picker shows on every tap.
  await GoogleSignin.signOut().catch(() => {});

  const response = await GoogleSignin.signIn();
  console.log('Google signIn response', JSON.stringify(response, null, 2));
  if (isCancelledResponse(response)) {
    return null;
  }

  const {idToken, user} = response.data;
  if (!idToken) {
    // Only happens when `webClientId` is missing or wrong.
    throw new Error('Google did not return an ID token');
  }
  return {
    idToken,
    user: {
      name: user.email,
      email: user.email,
      mobile_no: null,
      full_name: user.name ?? user.email,
      user_image: user.photo,
    },
  };
}

/** User-facing message for a failed Google sign-in. */
export function describeGoogleSignInError(error: unknown): string {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.IN_PROGRESS:
        return 'Google sign-in is already in progress.';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play Services is unavailable or out of date on this device.';
    }
    // DEVELOPER_ERROR (10) means the package name / SHA-1 isn't registered
    // as an Android OAuth client in the Google Cloud project.
    console.warn('[googleLogin] native error', error.code, error.message);
    if (String(error.code) === '10') {
      return "Google sign-in isn't set up for this build of the app (error 10). Please try again later.";
    }
  } else if (error instanceof Error && error.message) {
    // Backend rejections arrive as "Failed to submit Google login (403): <reason>".
    const match = error.message.match(/^Failed to submit Google login \(\d+\): (.+)$/s);
    return match ? match[1] : error.message;
  }
  return 'Could not sign in with Google. Please try again.';
}

/** Clears the cached Google account so the picker shows again next time. */
export async function signOutOfGoogle(): Promise<void> {
  ensureConfigured();
  try {
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google — nothing to clear.
  }
}

// Expected to mirror `verify_phone_otp`'s response.
export type GoogleLoginResponse = {
  success: boolean;
  message?: string;
  is_new_user?: boolean;
  session_token?: string;
  user?: AuthUser;
  needs_phone?: boolean;
};

/**
 * Exchanges a Google ID token for a Frappe session. Note the backend creates
 * the User for an unknown email, so call this only for accounts that already
 * exist (see `findGoogleAccountUser`); new users go through phone OTP first.
 */
export async function googleLogin(idToken: string): Promise<GoogleLoginResponse> {
  const response = await postFrappeMethod<GoogleLoginResponse>(
    'buy_in_minutes.auth.google_login',
    {id_token: idToken},
    'Google login',
  );
  console.log('googleLogin response', response);
  return response;
}

type UserLookup = {name: string; mobile_no: string | null};

/** The User registered with `email`, if any — looked up without creating one. */
export async function findGoogleAccountUser(email: string): Promise<UserLookup | null> {
  const [user] = await fetchResourceList<UserLookup>(
    'User',
    {fields: ['name', 'mobile_no'], filters: [['email', '=', email]], limit: 1},
    'account',
  );
  return user ?? null;
}

// "Failed to submit OTP verification (400): Invalid OTP." → "Invalid OTP."
export function backendReason(error: unknown): Error {
  if (error instanceof Error) {
    const match = error.message.match(/^Failed to (?:submit|load) .+? \(\d+\): (.+)$/s);
    return match ? new Error(match[1]) : error;
  }
  return new Error('Something went wrong. Please try again.');
}

export const PHONE_TAKEN_MESSAGE =
  'This mobile number is already registered to another account. Please use a different number.';

/**
 * Sends the OTP for the phone step after Google sign-in. A number that
 * already belongs to an account is refused up front: verifying it would sign
 * in to that account rather than attach the number to this Google account.
 */
export async function requestGooglePhoneOtp(
  phoneNumber: string,
): Promise<RequestPhoneOtpResponse> {
  const [owner] = await fetchResourceList<{name: string}>(
    'User',
    {fields: ['name'], filters: [['mobile_no', '=', phoneNumber]], limit: 1},
    'account',
  );
  if (owner) {
    throw new Error(PHONE_TAKEN_MESSAGE);
  }
  try {
    return await requestPhoneOtp(phoneNumber);
  } catch (error) {
    throw backendReason(error);
  }
}

export type GooglePhoneSignInResponse = {
  success: boolean;
  message?: string;
  session_token?: string;
  user?: AuthUser;
};

/**
 * Verifies the phone OTP, then finishes the Google sign-in. For a new email
 * this is the only step that creates the User — with the Google name/email
 * and the verified phone; an existing Google account gets the phone attached.
 */
export async function completeGooglePhoneSignIn(
  idToken: string,
  fullName: string | undefined,
  phoneNumber: string,
  otp: string,
  authFlowToken: string,
): Promise<GooglePhoneSignInResponse> {
  let profileToken: string | undefined;
  try {
    // A new number's OTP only yields a profile_token here; nothing is created.
    const verified = await verifyPhoneOtp(phoneNumber, otp, authFlowToken);
    profileToken = verified.profile_token;
  } catch (error) {
    throw backendReason(error);
  }
  if (!profileToken) {
    throw new Error(PHONE_TAKEN_MESSAGE);
  }
  return completePhoneProfileWithGoogle(idToken, phoneNumber, profileToken, fullName);
}

/**
 * Finishes a phone sign-up (OTP already verified → `profileToken`) with the
 * Google account's email and name. Creates the User, or attaches the phone to
 * the existing account for that Google email.
 */
export async function completePhoneProfileWithGoogle(
  idToken: string,
  phoneNumber: string,
  profileToken: string,
  fullName?: string,
): Promise<GooglePhoneSignInResponse> {
  try {
    return await postFrappeMethod<GooglePhoneSignInResponse>(
      'buy_in_minutes.auth.complete_phone_profile_with_google',
      {
        id_token: idToken,
        phone_number: phoneNumber,
        profile_token: profileToken,
        full_name: fullName,
      },
      'Google sign-up',
    );
  } catch (error) {
    throw backendReason(error);
  }
}
