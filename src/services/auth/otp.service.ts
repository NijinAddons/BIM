import {appConfig} from '../../app/config/appConfig';
import {apiClient} from '../api/apiClient';
import {
  CompleteSignupPayload,
  CompleteSignupResponse,
  LoginResponse,
  SendOtpResponse,
  VerifyOtpResponse,
} from './auth.types';

const normalizeSignupPayload = (
  payload: CompleteSignupPayload,
): CompleteSignupPayload => {
  return Object.entries(payload).reduce<CompleteSignupPayload>((result, [key, value]) => {
    result[key] = typeof value === 'string' ? value.trim() : value;
    return result;
  }, {});
};

export const otpService = {
  sendOtp: async (phone: string) => {
    const normalizedPhone = phone.trim();

    if (!normalizedPhone) {
      throw new Error('Phone number is required to send OTP.');
    }

    return apiClient.post<SendOtpResponse>(appConfig.sendOtpUrl, {
      body: {
        phone: normalizedPhone,
      },
      logLabel: 'Send OTP response',
    });
  },
  verifyOtp: async (phone: string, code: string) => {
    const normalizedPhone = phone.trim();
    const normalizedCode = code.trim();

    if (!normalizedPhone || !normalizedCode) {
      throw new Error('Phone number and OTP code are required.');
    }

    return apiClient.post<VerifyOtpResponse>(appConfig.verifyOtpUrl, {
      body: {
        phone: normalizedPhone,
        code: normalizedCode,
      },
      logLabel: 'Verify OTP response',
    });
  },
  login: async (phone: string) => {
    const normalizedPhone = phone.trim();

    if (!normalizedPhone) {
      throw new Error('Phone number is required to login.');
    }

    return apiClient.post<LoginResponse>(appConfig.loginUrl, {
      body: {
        phone: normalizedPhone,
      },
      logLabel: 'Login response',
    });
  },
  completeSignup: async (payload: CompleteSignupPayload) => {
    const normalizedPayload = normalizeSignupPayload(payload);

    if (Object.keys(normalizedPayload).length === 0) {
      throw new Error('Signup payload is required.');
    }

    return apiClient.post<CompleteSignupResponse>(appConfig.completeSignupUrl, {
      body: normalizedPayload,
      logLabel: 'Complete signup response',
    });
  },
};
