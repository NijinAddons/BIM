import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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

import type {RequestPhoneOtpResponse} from '../../services';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const UAE_CALLING_CODE = '971';
const UAE_LOCAL_NUMBER_LENGTH = 9;

type Props = {
  // Sends the OTP for this flow (e.g. the account-linking variant).
  requestOtp: (phone: string) => Promise<RequestPhoneOtpResponse>;
  onBack?: () => void;
  // OTP was sent to `phone` (in +971… form); move on to the OTP screen.
  onCodeSent?: (phone: string, authFlowToken?: string) => void;
};

/** Collects and OTP-verifies a mobile number after Google sign-in. */
export default function PhoneEntryScreen({requestOtp, onBack, onCodeSent}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [mobile, setMobile] = useState('');
  const [isSending, setIsSending] = useState(false);
  const isValid = mobile.length === UAE_LOCAL_NUMBER_LENGTH;
  const isDisabled = !isValid || isSending;

  useEffect(() => {
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(focusTimer);
  }, []);

  const onChangeMobile = (value: string) => {
    // Accept a pasted "+971 50…" / "050…" as well as bare local digits.
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith(UAE_CALLING_CODE)) {
      digits = digits.slice(UAE_CALLING_CODE.length);
    }
    setMobile(digits.replace(/^0/, '').slice(0, UAE_LOCAL_NUMBER_LENGTH));
  };

  const onContinue = async () => {
    if (isDisabled) {
      return;
    }

    const phone = `+${UAE_CALLING_CODE}${mobile}`;
    setIsSending(true);
    Keyboard.dismiss();

    try {
      const response = await requestOtp(phone);
      onCodeSent?.(phone, response.auth_flow_token);
    } catch (error) {
      Alert.alert(
        'Could not send OTP',
        error instanceof Error && error.message
          ? error.message
          : 'Please check your connection and try again.',
      );
    } finally {
      setIsSending(false);
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
          <MaterialCommunityIcons color="#F5FAFC" name="chevron-left" size={26} />
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
          <Text style={styles.title}>Add your mobile number</Text>
          <Text style={styles.subtitle}>
            Verify your mobile number to finish signing in. We'll use it for
            delivery updates.
          </Text>

          <View style={styles.inputRow}>
            <Text style={styles.flag}>🇦🇪</Text>
            <Text style={styles.countryCode}>+{UAE_CALLING_CODE}</Text>
            <View style={styles.inputDivider} />
            <TextInput
              accessibilityLabel="Mobile number"
              autoComplete="tel"
              keyboardType="number-pad"
              onChangeText={onChangeMobile}
              onSubmitEditing={onContinue}
              placeholder="50 123 4567"
              placeholderTextColor="rgba(245,250,252,0.45)"
              ref={inputRef}
              returnKeyType="done"
              style={styles.input}
              textContentType="telephoneNumber"
              value={mobile}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={isDisabled}
            onPress={onContinue}
            style={[styles.button, !isDisabled && styles.buttonEnabled]}>
            {isSending ? (
              <ActivityIndicator color={BRAND_NAVY} />
            ) : (
              <Text style={[styles.buttonText, !isDisabled && styles.buttonTextEnabled]}>
                Send OTP
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  inputRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 32,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  flag: {
    fontSize: 18,
    marginRight: 8,
  },
  countryCode: {
    color: '#F5FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  inputDivider: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    height: 24,
    marginHorizontal: 12,
    width: 1,
  },
  input: {
    color: '#F5FAFC',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 52,
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
});
