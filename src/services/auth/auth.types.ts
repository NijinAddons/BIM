export type SendOtpResponse = {
  message?: unknown;
};

export type VerifyOtpResponse = {
  message?: unknown;
};

export type LoginResponse = {
  data?: unknown;
  message?: unknown;
};

export type LoginAuthCredentials = {
  apiKey: string;
  apiSecret: string;
};

export type CompleteSignupPayload = {
  email?: string;
  fullName?: string;
  full_name?: string;
  phoneNumber?: string;
  phone?: string;
  username?: string;
  [key: string]: unknown;
};

export type CompleteSignupResponse = {
  data?: unknown;
  message?: unknown;
};

export type GoogleAuthProfile = {
  customer?: string;
  email: string;
  mobile: string;
  name: string;
};

export type GoogleLoginResponse = {
  data?: unknown;
  message?: unknown;
};

export type GoogleAuthResponse = {
  backendResponse?: GoogleLoginResponse;
  idToken: string;
  profile: GoogleAuthProfile;
};

export type AppleAuthResponse = {
  backendResponse?: GoogleLoginResponse;
  idToken: string;
  profile: GoogleAuthProfile;
};
