import {RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
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
import {otpService} from '../service';

type OtpNavProp = NativeStackNavigationProp<RootStackParamList, 'Otp'>;
type OtpRouteProp = RouteProp<RootStackParamList, 'Otp'>;

type Props = {
  navigation: OtpNavProp;
  route: OtpRouteProp;
};

export default function OtpScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [otp, setOtp] = useState('');
  const [resendIn, setResendIn] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const isValidOtp = useMemo(() => /^\d{6}$/.test(otp), [otp]);

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

  const onChangeOtp = (value: string) => {
    const digits = value.replace(/\D/g, '');
    setVerificationMessage('');
    setOtp(digits.slice(0, 6));
  };

  const onVerify = async () => {
    if (!isValidOtp) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP.');
      return;
    }

    try {
      setIsVerifying(true);
      setVerificationMessage('');
      await otpService.verifyOtp(route.params.phone, otp);
      setVerificationMessage('OTP verified successfully.');
      setTimeout(() => {
        navigation.replace('ProfileDetails', {mobile: route.params.mobile});
      }, 900);
    } catch (error) {
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
      await otpService.sendOtp(route.params.phone);
      Alert.alert('OTP sent', 'A new OTP has been sent.');
      setOtp('');
      setResendIn(30);
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
            disabled={!isValidOtp || isVerifying}
            onPress={onVerify}
            style={[
              styles.button,
              isValidOtp && !isVerifying && styles.buttonEnabled,
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
