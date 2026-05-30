import {NativeModules, Platform} from 'react-native';

import {appConfig} from '../../app/config/appConfig';
import {logger} from '../../utils/logger';
import {apiClient} from '../api/apiClient';
import {AppleAuthResponse, GoogleLoginResponse} from './auth.types';

type NativeAppleAuthResult = {
  authorizationCode?: string;
  email?: string;
  fullName?: string;
  identityToken?: string;
  user?: string;
};

type AppleAuthNativeModule = {
  signIn: () => Promise<NativeAppleAuthResult>;
};

const APPLE_LOGIN_LOG_PREFIX = '[Apple Login]';
const FALLBACK_APPLE_USER_NAME = 'BIM User';

const asTrimmedString = (value?: string) => value?.trim() ?? '';

const getAppleAuthModule = (): AppleAuthNativeModule | null => {
  try {
    const module =
      (NativeModules.AppleAuthModule as AppleAuthNativeModule | undefined) ?? null;

    logger.log(`${APPLE_LOGIN_LOG_PREFIX} NativeModules.AppleAuthModule`, module);

    return module;
  } catch {
    logger.log(`${APPLE_LOGIN_LOG_PREFIX} NativeModules.AppleAuthModule lookup failed`);
    return null;
  }
};

const getNormalizedProfile = (result: NativeAppleAuthResult) => ({
  customer: '',
  email: asTrimmedString(result.email),
  mobile: '',
  name: asTrimmedString(result.fullName) || FALLBACK_APPLE_USER_NAME,
});

const getAppleAuthPayloadLog = (
  result: NativeAppleAuthResult,
  identityToken: string,
  authorizationCode: string,
  appleUser: string,
) => ({
  authorizationCodeLength: authorizationCode.length,
  email: asTrimmedString(result.email),
  fullName: asTrimmedString(result.fullName),
  hasIdentityToken: Boolean(identityToken),
  hasUser: Boolean(appleUser),
  identityToken,
  payload: {
    apple_user: appleUser,
    authorization_code_length: authorizationCode.length,
    email: asTrimmedString(result.email),
    full_name: asTrimmedString(result.fullName),
    identity_token_length: identityToken.length,
  },
});

export const appleAuthService = {
  isConfigured: () => {
    const configured = Platform.OS === 'ios' && Boolean(getAppleAuthModule());

    logger.log(`${APPLE_LOGIN_LOG_PREFIX} isConfigured check`, {
      configured,
      platform: Platform.OS,
    });

    return configured;
  },

  signIn: async (): Promise<AppleAuthResponse> => {
    try {
      logger.log(`${APPLE_LOGIN_LOG_PREFIX} signIn started`, {
        platform: Platform.OS,
      });

      if (Platform.OS !== 'ios') {
        throw new Error('Apple sign-in is only available on iOS.');
      }

      const appleAuthModule = getAppleAuthModule();

      if (!appleAuthModule) {
        throw new Error('Apple sign-in native module is not available on this build.');
      }

      const result = await appleAuthModule.signIn();
      const identityToken = asTrimmedString(result.identityToken);
      const authorizationCode = asTrimmedString(result.authorizationCode);
      const appleUser = asTrimmedString(result.user);
      const profile = getNormalizedProfile(result);

      logger.log(`${APPLE_LOGIN_LOG_PREFIX} native signIn raw response`, result);
      logger.log(`${APPLE_LOGIN_LOG_PREFIX} native signIn result`, {
        authorizationCodeLength: authorizationCode.length,
        email: result.email ?? '',
        fullName: result.fullName ?? '',
        hasIdentityToken: Boolean(identityToken),
        hasUser: Boolean(appleUser),
        identityToken,
      });

      if (!identityToken) {
        throw new Error('Apple sign-in did not return a valid identity token.');
      }

      logger.log(
        `${APPLE_LOGIN_LOG_PREFIX} backend request payload`,
        getAppleAuthPayloadLog(result, identityToken, authorizationCode, appleUser),
      );
      const backendResponse = await apiClient.post<GoogleLoginResponse>(
        appConfig.appleLoginUrl,
        {
          body: {
            identity_token: identityToken,
          },
          logLabel: 'Apple login response',
        },
      );

      logger.log(`${APPLE_LOGIN_LOG_PREFIX} backend response`, backendResponse.data);
      logger.log(`${APPLE_LOGIN_LOG_PREFIX} final normalized profile`, profile);

      return {
        backendResponse: backendResponse.data,
        idToken: identityToken,
        profile,
      };
    } catch (error) {
      logger.log(`${APPLE_LOGIN_LOG_PREFIX} signIn error`, error);
      throw error;
    }
  },
};
