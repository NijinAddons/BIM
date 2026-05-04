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

export type CompleteSignupPayload = {
  email?: string;
  full_name?: string;
  phone?: string;
  username?: string;
  [key: string]: unknown;
};

export type CompleteSignupResponse = {
  data?: unknown;
  message?: unknown;
};
