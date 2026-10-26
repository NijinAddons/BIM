import {NativeModules, Platform} from 'react-native';

import {postFrappeMethod} from './frappe.client';
import {backendReason, PHONE_TAKEN_MESSAGE} from './googleLogin.service';
import {verifyPhoneOtp, type AuthUser} from './otpLogin.service';

// Native bridge in ios/BuyInMinutes/AppleAuthModule.swift.
type NativeAppleCredential = {
  identityToken: string;
  authorizationCode: string;
  user: string;
  // Apple only sends name/email the first time a user authorizes the app;
  // later sign-ins return empty strings here.
  email: string;
  fullName: string;
};

const {AppleAuthModule} = NativeModules as {
  AppleAuthModule?: {signIn(): Promise<NativeAppleCredential>};
};

// Social sign-ins that go through the phone-verification step.
export type SocialProvider = 'google' | 'apple';

export const isAppleSignInAvailable = Platform.OS === 'ios' && !!AppleAuthModule;

export type AppleAccount = {
  identityToken: string;
  authorizationCode: string;
  // Apple's name for the user. Name and email only come from the first sign-in.
  fullName?: string;
  // The Apple profile in the app's user shape; `name` is the email, as for
  // Frappe users.
  user: AuthUser;
};

// The identity token's `email` claim is present on every sign-in, unlike the
// credential's `email` field, so it's the one used to look up the account.
function emailFromIdentityToken(identityToken: string): string | undefined {
  try {
    const payload = identityToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as {email?: string};
    return claims.email;
  } catch {
    return undefined;
  }
}

/**
 * Shows the Sign in with Apple sheet and returns the identity token and
 * profile, or `null` if the user dismissed it. Throws on any other failure.
 */
export async function getAppleAccount(): Promise<AppleAccount | null> {
  if (!AppleAuthModule) {
    throw new Error('Sign in with Apple is not available on this device.');
  }

  let credential: NativeAppleCredential;
  try {
    credential = await AppleAuthModule.signIn();
  } catch (error) {
    if ((error as {code?: string})?.code === 'apple_sign_in_cancelled') {
      return null;
    }
    throw error;
  }

  const email = credential.email || emailFromIdentityToken(credential.identityToken);
  if (!email) {
    // Only happens when the email scope wasn't granted.
    throw new Error('Apple did not share an email address for this account.');
  }
  const fullName = credential.fullName || undefined;
  return {
    identityToken: credential.identityToken,
    authorizationCode: credential.authorizationCode,
    fullName,
    user: {
      name: email,
      email,
      mobile_no: null,
      full_name: fullName ?? email,
      user_image: null,
    },
  };
}

/** User-facing message for a failed Apple sign-in. */
export function describeAppleSignInError(error: unknown): string {
  const code = (error as {code?: string})?.code;
  if (code === 'apple_sign_in_in_progress') {
    return 'Apple sign-in is already in progress.';
  }
  if (error instanceof Error && error.message) {
    return backendReason(error).message;
  }
  return 'Could not sign in with Apple. Please try again.';
}

// Expected to mirror `google_login`'s response.
export type AppleLoginResponse = {
  success: boolean;
  message?: string;
  is_new_user?: boolean;
  session_token?: string;
  user?: AuthUser;
};

/**
 * Exchanges an Apple identity token for a Frappe session. Like `googleLogin`,
 * call this only for accounts that already exist with a phone (see
 * `findGoogleAccountUser`); new users go through phone OTP first.
 */
export async function appleLogin(
  identityToken: string,
  authorizationCode: string,
  fullName?: string,
): Promise<AppleLoginResponse> {
  return postFrappeMethod<AppleLoginResponse>(
    'buy_in_minutes.auth.apple_login',
    {identity_token: identityToken, authorization_code: authorizationCode, full_name: fullName},
    'Apple login',
  );
}

export type ApplePhoneSignInResponse = {
  success: boolean;
  message?: string;
  session_token?: string;
  user?: AuthUser;
};

/**
 * Verifies the phone OTP, then finishes the Apple sign-in. For a new email
 * this is the only step that creates the User — with the Apple name/email
 * and the verified phone; an existing account gets the phone attached.
 */
export async function completeApplePhoneSignIn(
  identityToken: string,
  fullName: string | undefined,
  phoneNumber: string,
  otp: string,
  authFlowToken: string,
): Promise<ApplePhoneSignInResponse> {
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
  try {
    return await postFrappeMethod<ApplePhoneSignInResponse>(
      'buy_in_minutes.auth.complete_phone_profile_with_apple',
      {
        identity_token: identityToken,
        phone_number: phoneNumber,
        profile_token: profileToken,
        full_name: fullName,
      },
      'Apple sign-up',
    );
  } catch (error) {
    throw backendReason(error);
  }
}
