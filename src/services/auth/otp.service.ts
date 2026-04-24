import {appConfig} from '../../app/config/appConfig';
import {apiClient} from '../api/apiClient';
import {SendOtpResponse, VerifyOtpResponse} from './auth.types';

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
};
