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
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {requestPhoneOtp, verifyPhoneOtp, type AuthUser} from '../../services';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';

type Props = {
  authFlowToken?: string;
  onBack?: () => void;
  onVerified?: (
    isNewUser: boolean,
    profileToken?: string,
    sessionToken?: string,
    user?: AuthUser,
  ) => void;
  phone?: string;
  // Replaces the default `verify_phone_otp` call (e.g. linking the phone to
  // a Google account). Throw to reject; the error message is shown.
  onSubmitOtp?: (phone: string, otp: string, authFlowToken: string) => Promise<void>;
  // Replaces the default `request_phone_otp` call for "Resend OTP"; must
  // start the same kind of flow as `onSubmitOtp` verifies.
  requestOtp?: (phone: string) => Promise<{auth_flow_token?: string}>;
};

// Android SMS User Consent API (android/.../SmsUserConsentModule.kt): when
// the OTP SMS arrives, Android asks the user with one tap to share it, and
// its text comes back as an event. Unlike the SMS Retriever API it doesn't
// need the app's signature hash in the SMS, which the backend doesn't add.
type SmsUserConsentModule = {
  start: () => Promise<boolean>;
  stop: () => void;
};

const SMS_CONSENT_EVENT = 'SmsUserConsent:message';

const getSmsUserConsentModule = (): SmsUserConsentModule | null =>
  Platform.OS === 'android' ? NativeModules.SmsUserConsent ?? null : null;

const extractOtp = (message: string): string | null =>
  message.match(/(?:^|\D)(\d{6})(?!\d)/)?.[1] ?? null;

const DEFAULT_OTP_EXPIRY_SECONDS = 60;

export default function OtpScreen({
  authFlowToken,
  onBack,
  onVerified,
  onSubmitOtp,
  requestOtp = requestPhoneOtp,
  phone,
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [otp, setOtp] = useState('');
  const [flowToken, setFlowToken] = useState(authFlowToken);
  const [resendIn, setResendIn] = useState(DEFAULT_OTP_EXPIRY_SECONDS);
  const [maxAttempts, setMaxAttempts] = useState<number | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
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

  // Restarted on every resend: each listen covers one SMS for 5 minutes.
  const [smsListenKey, setSmsListenKey] = useState(0);

  useEffect(() => {
    const consent = getSmsUserConsentModule();
    if (!consent) {
      return;
    }

    let isMounted = true;
    const subscription = new NativeEventEmitter(consent as never).addListener(
      SMS_CONSENT_EVENT,
      (message: unknown) => {
        const code = typeof message === 'string' ? extractOtp(message) : null;
        if (isMounted && code) {
          setVerificationMessage('');
          setOtp(code);
        }
      },
    );

    consent.start().catch(() => {
      // Manual entry keeps working if Play Services can't listen.
    });

    return () => {
      isMounted = false;
      subscription.remove();
      consent.stop();
    };
  }, [smsListenKey]);

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

    if (!phone || !flowToken) {
      Alert.alert('Session expired', 'Please go back and resend the OTP.');
      return;
    }

    setIsVerifying(true);

    if (onSubmitOtp) {
      try {
        await onSubmitOtp(phone, otp, flowToken);
      } catch (error) {
        Alert.alert(
          'Verification failed',
          error instanceof Error && error.message
            ? error.message
            : 'Please try again.',
        );
      } finally {
        setIsVerifying(false);
      }
      return;
    }

    try {
      const response = await verifyPhoneOtp(phone, otp, flowToken);
      setVerificationMessage('OTP verified successfully.');
      onVerified?.(
        response.is_new_user ?? true,
        response.profile_token,
        response.session_token,
        response.user,
      );
    } catch {
      Alert.alert('Incorrect OTP', 'The code you entered is incorrect. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const onResend = async () => {
    if (!phone) {
      Alert.alert('Missing phone number', 'Please go back and enter your phone number again.');
      return;
    }

    setIsResending(true);

    try {
      const response = await requestOtp(phone);
      setFlowToken(response.auth_flow_token);
      setOtp('');
      setVerificationMessage('');
      setResendIn(DEFAULT_OTP_EXPIRY_SECONDS);
      setSmsListenKey(key => key + 1);
      setMaxAttempts(null);
      setRemainingAttempts(null);
      inputRef.current?.focus();
    } catch {
      Alert.alert('Could not resend OTP', 'Please check your connection and try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <LinearGradient
      colors={['#1F2E3D', '#1B4A52', '#1E6E63']}
      end={{x: 1, y: 1}}
      start={{x: 0, y: 0}}
      style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />

      {onBack ? (
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={[styles.backButton, {top: insets.top + 16}]}>
          <MaterialCommunityIcons
            color="#F5FAFC"
            name="chevron-left"
            size={26}
          />
        </TouchableOpacity>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.container}>
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + (onBack ? 68 : 20),
              paddingBottom: insets.bottom + 24,
            },
          ]}>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>We sent a 6-digit code to your phone.</Text>

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
              {isVerifying ? (
                <ActivityIndicator color={BRAND_NAVY} size="small" />
              ) : null}
              <Text
                style={[
                  styles.buttonText,
                  !isVerifyDisabled && styles.buttonTextEnabled,
                ]}>
                {isVerifying ? 'Verifying...' : 'Verify OTP'}
              </Text>
              {!isVerifying && !isVerifyDisabled ? (
                <View style={styles.buttonArrow} />
              ) : null}
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    left: 20,
    position: 'absolute',
    width: 40,
    zIndex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    color: '#F5FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#B9CBD8',
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
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
  },
  otpBoxFocused: {
    borderColor: ACCENT_TEAL,
  },
  otpDigit: {
    color: '#F5FAFC',
    fontSize: 22,
    fontWeight: '700',
  },
  // Kept 1×1 rather than 0×0: Android's autofill and iOS's "From Messages"
  // code suggestion skip fields with no size.
  hiddenInput: {
    height: 1,
    left: 0,
    opacity: 0.01,
    position: 'absolute',
    top: 0,
    width: 1,
  },
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    marginTop: 24,
    paddingVertical: 15,
  },
  buttonEnabled: {
    backgroundColor: ACCENT_TEAL,
  },
  buttonText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonTextEnabled: {
    color: BRAND_NAVY,
  },
  buttonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  buttonArrow: {
    borderRightColor: BRAND_NAVY,
    borderRightWidth: 2,
    borderTopColor: BRAND_NAVY,
    borderTopWidth: 2,
    height: 9,
    marginTop: 1,
    transform: [{rotate: '45deg'}],
    width: 9,
  },
  verificationMessage: {
    color: '#7EE0B5',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  attemptsText: {
    color: '#B9CBD8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
  resendWrap: {
    marginTop: 18,
  },
  resendText: {
    color: '#F5FAFC',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  resendTextDisabled: {
    color: 'rgba(255,255,255,0.45)',
  },
});
