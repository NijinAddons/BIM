import {RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  NativeEventEmitter,
  NativeModules,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import {ApiError} from '../../../services/api/apiError';
import {setStoredFrappeAuthCredentials} from '../../../services/frappe/frappeAuth';
import {setUserProfile} from '../../profile/service';
import {getLoginAuthCredentials, otpService} from '../service';
import {
  getLoginUserProfile,
  getOtpDeliveryMeta,
  isExistingUserLoginResponse,
  isUserMissingError,
} from '../utils';

type OtpNavProp = NativeStackNavigationProp<RootStackParamList, 'Otp'>;
type OtpRouteProp = RouteProp<RootStackParamList, 'Otp'>;

type Props = {
  navigation: OtpNavProp;
  route: OtpRouteProp;
};

type OtpVerifyModule = {
  getHash?: () => Promise<string[]>;
  getOtp: () => Promise<boolean>;
};

const getOtpVerifyModule = (): OtpVerifyModule | null => {
  try {
    return NativeModules.OtpVerify ?? null;
  } catch {
    return null;
  }
};

const DEFAULT_OTP_EXPIRY_SECONDS = 60;

const normalizePositiveNumber = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.floor(value);
};

const getOtpAttemptErrorMessage = (error: unknown) => {
  if (error instanceof ApiError && error.body) {
    try {
      const parsedBody = JSON.parse(error.body) as {message?: string | Record<string, unknown>};
      const nestedMessage =
        typeof parsedBody.message === 'object' &&
        parsedBody.message &&
        typeof parsedBody.message.message === 'string'
          ? parsedBody.message.message
          : '';
      const directMessage =
        typeof parsedBody.message === 'string' ? parsedBody.message : '';

      return (directMessage || nestedMessage || error.body).toLowerCase();
    } catch {
      return error.body.toLowerCase();
    }
  }

  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  return '';
};

const isOtpAttemptConsumedError = (error: unknown) => {
  const message = getOtpAttemptErrorMessage(error);

  return (
    message.includes('invalid otp') ||
    message.includes('incorrect otp') ||
    message.includes('invalid code') ||
    message.includes('incorrect code') ||
    message.includes('otp expired') ||
    message.includes('expired otp') ||
    message.includes('invalid verification code')
  );
};

export default function OtpScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const initialExpiresIn =
    normalizePositiveNumber(route.params.expiresIn) ?? DEFAULT_OTP_EXPIRY_SECONDS;
  const initialMaxAttempts = normalizePositiveNumber(route.params.maxAttempts) ?? null;
  const [otp, setOtp] = useState('');
  const [resendIn, setResendIn] = useState(initialExpiresIn);
  const [maxAttempts, setMaxAttempts] = useState<number | null>(initialMaxAttempts);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    initialMaxAttempts,
  );
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const isValidOtp = useMemo(() => /^\d{6}$/.test(otp), [otp]);
  const isVerifyDisabled = !isValidOtp || isVerifying || remainingAttempts === 0;

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }

    const timerId = setInterval(() => {
      setResendIn(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timerId);
  }, [resendIn]);

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);

    return () => clearTimeout(focusTimer);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    let isMounted = true;
    const otpVerifyModule = getOtpVerifyModule();
    let otpSubscription: {remove: () => void} | null = null;

    if (!otpVerifyModule) {
      console.log('OTP retriever module not available');
      return;
    }

    console.log('OTP retriever module loaded');

    const startOtpListener = async () => {
      try {
        console.log('OTP screen Android retriever init');

        if (!otpVerifyModule.getHash) {
          console.log('OTP retriever getHash not available on module');
        }

        const appHashes = otpVerifyModule.getHash
          ? await otpVerifyModule.getHash()
          : [];

        console.log('OTP retriever app hashes result', appHashes);

        if (__DEV__ && appHashes.length > 0) {
          console.log('OTP retriever app hashes', appHashes);
        }

        await otpVerifyModule.getOtp();
        console.log('OTP retriever listener started');
        const eventEmitter = new NativeEventEmitter(otpVerifyModule as never);
        otpSubscription = eventEmitter.addListener(
          'com.faizalshap.otpVerify:otpReceived',
          message => {
          console.log('OTP retriever message received', message);
          if (!isMounted || typeof message !== 'string') {
            return;
          }

          const matchedOtp = message.match(/\b(\d{6})\b/);

          if (matchedOtp?.[1]) {
            onChangeOtp(matchedOtp[1]);
            otpSubscription?.remove();
            otpSubscription = null;
          }
          },
        );
      } catch (error) {
        console.log('OTP retriever init failed', error);
        // Keep the manual entry flow working even if SMS retriever is unavailable.
      }
    };

    startOtpListener();

    return () => {
      isMounted = false;
      otpSubscription?.remove();
    };
  }, []);

  const onChangeOtp = (value: string) => {
    const digits = value.replace(/\D/g, '');
    setVerificationMessage('');
    setOtp(digits.slice(0, 6));
  };

  const onVerify = async () => {
    if (remainingAttempts === 0) {
      Alert.alert('Attempts exhausted', 'Please resend OTP to get a new code.');
      return;
    }

    if (!isValidOtp) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP.');
      return;
    }

    try {
      setIsVerifying(true);
      setVerificationMessage('');
      await otpService.verifyOtp(route.params.phone, otp);
      setVerificationMessage('OTP verified successfully.');

      if (route.params.authFlow === 'signup') {
        const socialEmail =
          typeof route.params.email === 'string' ? route.params.email.trim() : '';
        const socialName =
          typeof route.params.name === 'string' ? route.params.name.trim() : '';
        const socialCustomer =
          typeof route.params.customer === 'string' ? route.params.customer : '';

        if (socialEmail && socialName) {
          const socialSignupPayload = {
            email: socialEmail,
            fullName: socialName,
            full_name: socialName,
            phoneNumber: route.params.phone,
            phone: route.params.phone,
            username: socialName,
          };

          console.log('[OTP Verify] social complete signup request', socialSignupPayload);

          const socialSignupResponse = await otpService.completeSignup(
            socialSignupPayload,
          );
          const completedSignupProfile = getLoginUserProfile(socialSignupResponse.data);

          console.log('[OTP Verify] social complete signup response', socialSignupResponse.data);

          await setUserProfile(
            {
              address: '',
              customer: socialCustomer,
              email: completedSignupProfile?.email || socialEmail,
              mobile: completedSignupProfile?.mobile || route.params.phone,
              name: completedSignupProfile?.name || socialName,
            },
            {profileCompleted: true},
          );

          setTimeout(() => {
            navigation.replace('MainTabs');
          }, 900);
          return;
        }

        setTimeout(() => {
          navigation.replace('ProfileDetails', {
            mobile: route.params.mobile,
            phone: route.params.phone,
          });
        }, 900);
        return;
      }

      try {
        const loginResponse = await otpService.login(route.params.phone);
        console.log('[OTP Verify] login response', loginResponse.data);

        const existingUserProfile = getLoginUserProfile(loginResponse.data);
        const isExistingUser = isExistingUserLoginResponse(loginResponse.data);
        const authCredentials = getLoginAuthCredentials(loginResponse.data);

        if (isExistingUser) {
          if (authCredentials) {
            await setStoredFrappeAuthCredentials(authCredentials);
          }

          await setUserProfile(
            {
              address: '',
              customer: existingUserProfile?.customer ?? '',
              email: existingUserProfile?.email ?? '',
              mobile: existingUserProfile?.mobile || route.params.phone,
              name: existingUserProfile?.name || 'BIM User',
            },
            {profileCompleted: true},
          );

          setTimeout(() => {
            navigation.replace('MainTabs');
          }, 900);
          return;
        }

        throw new Error('Unable to login with this mobile number.');
      } catch (error) {
        if (isUserMissingError(error)) {
          setTimeout(() => {
            navigation.replace('ProfileDetails', {
              mobile: route.params.mobile,
              phone: route.params.phone,
            });
          }, 900);
          return;
        }

        throw error;
      }
    } catch (error) {
      if (isOtpAttemptConsumedError(error)) {
        setRemainingAttempts(prev => {
          if (prev === null) {
            return prev;
          }

          return Math.max(prev - 1, 0);
        });
      }

      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to verify OTP. Please try again.';
      Alert.alert('OTP verification failed', errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  const onResend = async () => {
    try {
      setIsResending(true);
      const resendResponse = await otpService.sendOtp(route.params.phone);
      const otpDeliveryMeta = getOtpDeliveryMeta(resendResponse.data);
      const nextExpiresIn =
        normalizePositiveNumber(otpDeliveryMeta.expiresIn) ?? DEFAULT_OTP_EXPIRY_SECONDS;
      const nextMaxAttempts = normalizePositiveNumber(otpDeliveryMeta.maxAttempts) ?? null;
      Alert.alert('OTP sent', 'A new OTP has been sent.');
      setOtp('');
      setVerificationMessage('');
      setResendIn(nextExpiresIn);
      setMaxAttempts(nextMaxAttempts);
      setRemainingAttempts(nextMaxAttempts);
      inputRef.current?.focus();
    } catch {
      Alert.alert('OTP failed', 'Unable to resend OTP. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.container}>
        <View
          style={[
            styles.content,
            {paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24},
          ]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <View style={styles.backChevron} />
          </TouchableOpacity>

          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to {route.params.phone}
          </Text>

          <Pressable
            onPress={() => inputRef.current?.focus()}
            style={styles.otpBoxesWrap}>
            {Array.from({length: 6}, (_, index) => {
              const digit = otp[index] ?? '';
              const isFocused = otp.length === index || (otp.length === 6 && index === 5);

              return (
                <View
                  key={`otp-box-${index}`}
                  style={[styles.otpBox, isFocused && styles.otpBoxFocused]}>
                  <Text style={styles.otpDigit}>{digit}</Text>
                </View>
              );
            })}
          </Pressable>

          <TextInput
            autoComplete="sms-otp"
            importantForAutofill="yes"
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={onChangeOtp}
            ref={inputRef}
            style={styles.hiddenInput}
            textContentType="oneTimeCode"
            value={otp}
          />

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={isVerifyDisabled}
            onPress={onVerify}
            style={[
              styles.button,
              !isVerifyDisabled && styles.buttonEnabled,
            ]}>
            <View style={styles.buttonContent}>
              {isVerifying ? <ActivityIndicator color="#ffffff" size="small" /> : null}
              <Text style={styles.buttonText}>
                {isVerifying ? 'Verifying...' : 'Verify OTP'}
              </Text>
              {!isVerifying ? <View style={styles.buttonArrow} /> : null}
            </View>
          </TouchableOpacity>

          {verificationMessage ? (
            <Text style={styles.verificationMessage}>{verificationMessage}</Text>
          ) : null}

          {maxAttempts !== null ? (
            <Text style={styles.attemptsText}>
              {remainingAttempts === 0
                ? 'No attempts left. Resend OTP to continue.'
                : `Attempts left: ${remainingAttempts}/${maxAttempts}`}
            </Text>
          ) : null}

          <TouchableOpacity
            disabled={resendIn > 0 || isResending}
            onPress={onResend}
            style={styles.resendWrap}>
            <Text style={[styles.resendText, resendIn > 0 && styles.resendTextDisabled]}>
              {isResending
                ? 'Sending OTP...'
                : resendIn > 0
                  ? `Resend OTP in ${resendIn}s`
                  : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f6f6f6',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginBottom: 28,
    width: 36,
  },
  backChevron: {
    borderBottomColor: '#1f1f1f',
    borderBottomWidth: 2,
    borderLeftColor: '#1f1f1f',
    borderLeftWidth: 2,
    height: 10,
    marginLeft: 2,
    transform: [{rotate: '45deg'}],
    width: 10,
  },
  title: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  otpBoxesWrap: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 32,
    width: '100%',
  },
  otpBox: {
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
    borderColor: '#ececec',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
  },
  otpBoxFocused: {
    borderColor: '#111111',
  },
  otpDigit: {
    color: '#202020',
    fontSize: 22,
    fontWeight: '700',
  },
  hiddenInput: {
    height: 0,
    opacity: 0,
    width: 0,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#b6bcc9',
    borderRadius: 14,
    marginTop: 24,
    paddingVertical: 15,
  },
  buttonEnabled: {
    backgroundColor: '#111111',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  buttonArrow: {
    borderRightColor: '#ffffff',
    borderRightWidth: 2,
    borderTopColor: '#ffffff',
    borderTopWidth: 2,
    height: 9,
    marginTop: 1,
    transform: [{rotate: '45deg'}],
    width: 9,
  },
  verificationMessage: {
    color: '#1f9d55',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  attemptsText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
  resendWrap: {
    marginTop: 18,
  },
  resendText: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  resendTextDisabled: {
    color: '#9b9b9b',
  },
});
