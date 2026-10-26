import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

import {ActionButton, GoogleIcon} from '../../components';
import {bim} from '../../assets/images';
import {
  appleLogin,
  describeAppleSignInError,
  describeGoogleSignInError,
  findGoogleAccountUser,
  getAppleAccount,
  getGoogleAccount,
  googleLogin,
  isAppleSignInAvailable,
  requestPhoneOtp,
  signOutOfGoogle,
  type AuthUser,
  type SocialProvider,
} from '../../services';

const BRAND_NAVY = '#1F2E3D';
const MUTED = '#7C8A97';
const UAE_CALLING_CODE = '971';
const UAE_LOCAL_NUMBER_LENGTH = 9;
const SCREEN_HEIGHT = Dimensions.get('window').height;

function toLocalNumber(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length > UAE_LOCAL_NUMBER_LENGTH && digits.startsWith('00971')) {
    digits = digits.slice(5);
  }
  if (digits.length > UAE_LOCAL_NUMBER_LENGTH && digits.startsWith(UAE_CALLING_CODE)) {
    digits = digits.slice(UAE_CALLING_CODE.length);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, UAE_LOCAL_NUMBER_LENGTH);
}

function formatLocalNumber(digits: string): string {
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5)]
    .filter(Boolean)
    .join(' ');
}

type Props = {
  onSkip?: () => void;
  onContinue?: (phone: string, authFlowToken?: string) => void;
  onSignedIn?: (sessionToken: string, user?: AuthUser) => void;
  // Google/Apple account picked, but a verified phone is needed first. For a
  // new user the account itself is only created after the phone OTP.
  onNeedsPhone?: (idToken: string, user: AuthUser, provider: SocialProvider) => void;
};

export default function LoginScreen({onSkip, onContinue, onSignedIn, onNeedsPhone}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [mobile, setMobile] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isValid = mobile.length === UAE_LOCAL_NUMBER_LENGTH;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates.height);
      setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 50);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const onChangeMobile = (value: string) => {
    setMobile(toLocalNumber(value));
  };

  const onGooglePress = async () => {
    if (isGoogleSigningIn) {
      return;
    }

    setIsGoogleSigningIn(true);
    Keyboard.dismiss();

    try {
      const account = await getGoogleAccount();
      if (!account) {
        // User closed the account picker.
        return;
      }

      // google_login creates the User for an unknown email, so it's only
      // called once the account exists with a phone; everyone else verifies
      // a phone first and the account is created/linked after that.
      const existing = await findGoogleAccountUser(account.user.email);
      if (!existing?.mobile_no && onNeedsPhone) {
        onNeedsPhone(account.idToken, account.user, 'google');
        return;
      }

      const response = await googleLogin(account.idToken);
      if (!response?.success || !response.session_token) {
        throw new Error(response?.message || 'Could not sign in with Google. Please try again.');
      }
      onSignedIn?.(response.session_token, response.user ?? account.user);
    } catch (error) {
      console.log('Google signIn error', error);
      // Drop the cached Google account so the picker offers a choice again.
      signOutOfGoogle();
      Alert.alert('Google sign-in failed', describeGoogleSignInError(error));
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const onApplePress = async () => {
    if (isAppleSigningIn) {
      return;
    }

    setIsAppleSigningIn(true);
    Keyboard.dismiss();

    try {
      const account = await getAppleAccount();
      if (!account) {
        // User closed the Apple sheet.
        return;
      }

      // Same rule as Google: only sign straight in when the account already
      // exists with a phone; everyone else verifies a phone first.
      const existing = await findGoogleAccountUser(account.user.email);
      if (!existing?.mobile_no && onNeedsPhone) {
        onNeedsPhone(account.identityToken, account.user, 'apple');
        return;
      }

      const response = await appleLogin(
        account.identityToken,
        account.authorizationCode,
        account.fullName,
      );
      if (!response?.success || !response.session_token) {
        throw new Error(response?.message || 'Could not sign in with Apple. Please try again.');
      }
      onSignedIn?.(response.session_token, response.user ?? account.user);
    } catch (error) {
      console.log('Apple signIn error', error);
      Alert.alert('Apple sign-in failed', describeAppleSignInError(error));
    } finally {
      setIsAppleSigningIn(false);
    }
  };

  const onContinuePress = async () => {
    if (!isValid || isSendingOtp) {
      return;
    }

    const phone = `+${UAE_CALLING_CODE}${mobile}`;
    setIsSendingOtp(true);
    Keyboard.dismiss();

    try {
      const response = await requestPhoneOtp(phone);
      onContinue?.(phone, response.auth_flow_token);
    } catch {
      Alert.alert('Could not send OTP', 'Please check your connection and try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  return (
    <LinearGradient
      colors={['#1F2E3D', '#1B4A52', '#1E6E63']}
      end={{x: 1, y: 1}}
      start={{x: 0, y: 0}}
      style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />

      <TouchableOpacity
        onPress={onSkip}
        style={[styles.skipButton, {top: insets.top + 16}]}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}>
          <View style={[styles.hero, {paddingTop: insets.top + 48}]}>
            <Image source={bim} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brand}>Buy In Minutes</Text>
          </View>

          <View style={[styles.card, {paddingBottom: insets.bottom + 24 + keyboardHeight}]}>
            <Text style={styles.intro}>Enter your mobile number to continue</Text>

            <Pressable
              onPress={() => inputRef.current?.focus()}
              style={[
                styles.inputRow,
                isFocused ? styles.inputRowFocused : null,
                isValid ? styles.inputRowValid : null,
              ]}>
              <Text style={styles.flag}>🇦🇪</Text>
              <Text style={styles.countryCode}>+{UAE_CALLING_CODE}</Text>
              <View style={styles.inputDivider} />
              <TextInput
                accessibilityLabel="Mobile number"
                autoComplete="tel"
                keyboardType="number-pad"
                onBlur={() => setIsFocused(false)}
                onChangeText={onChangeMobile}
                onFocus={() => setIsFocused(true)}
                placeholder="50 123 4567"
                placeholderTextColor="#a3a3a3"
                ref={inputRef}
                style={styles.input}
                textContentType="telephoneNumber"
                value={formatLocalNumber(mobile)}
              />
              {isValid ? (
                <MaterialCommunityIcons color="#2ECFC0" name="check-circle" size={20} />
              ) : mobile.length > 0 ? (
                <TouchableOpacity
                  accessibilityLabel="Clear mobile number"
                  hitSlop={10}
                  onPress={() => {
                    setMobile('');
                    inputRef.current?.focus();
                  }}>
                  <MaterialCommunityIcons color="#a3a3a3" name="close-circle" size={20} />
                </TouchableOpacity>
              ) : null}
            </Pressable>

            <ActionButton
              active={isValid}
              disabled={!isValid}
              label={isSendingOtp ? 'Sending OTP...' : 'Send OTP'}
              loading={isSendingOtp}
              loadingColor="#ffffff"
              onPress={onContinuePress}
              style={[
                styles.continueButton,
                isValid ? styles.continueButtonActive : null,
              ]}
              textStyle={[
                styles.continueText,
                isValid ? styles.continueTextActive : null,
              ]}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialButtonsRow}>
              <ActionButton
                accessory={(
                  <View style={styles.socialIconBadge}>
                    <GoogleIcon size={16} />
                  </View>
                )}
                label="Google"
                loading={isGoogleSigningIn}
                onPress={onGooglePress}
                style={[styles.socialButton, styles.socialButtonRowItem]}
                textStyle={styles.socialButtonText}
                variant="secondary"
              />

              {/* Sign in with Apple is offered on iOS only. */}
              {isAppleSignInAvailable ? (
                <ActionButton
                  accessory={(
                    <View style={[styles.socialIconBadge, styles.appleIconBadge]}>
                      <MaterialCommunityIcons color="#ffffff" name="apple" size={18} />
                    </View>
                  )}
                  label="Apple"
                  loading={isAppleSigningIn}
                  onPress={onApplePress}
                  style={[styles.socialButton, styles.socialButtonRowItem, styles.appleButton]}
                  textStyle={[styles.socialButtonText, styles.appleButtonText]}
                  variant="dark"
                />
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    justifyContent: 'space-between',
    minHeight: SCREEN_HEIGHT,
  },
  hero: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  logo: {
    height: 52,
    width: 52,
  },
  brand: {
    color: '#F5FAFC',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 8,
    paddingHorizontal: 24,
    paddingTop: 32,
    shadowColor: '#0F1B26',
    shadowOffset: {height: -4, width: 0},
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  intro: {
    color: BRAND_NAVY,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 20,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#F5F7F8',
    borderColor: '#E4E8EB',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  inputRowFocused: {
    backgroundColor: '#ffffff',
    borderColor: BRAND_NAVY,
  },
  inputRowValid: {
    borderColor: '#2ECFC0',
  },
  flag: {
    fontSize: 18,
    marginRight: 8,
  },
  countryCode: {
    color: '#303030',
    fontSize: 15,
    fontWeight: '700',
  },
  inputDivider: {
    backgroundColor: '#DADFE3',
    height: 22,
    marginHorizontal: 12,
    width: 1,
  },
  input: {
    color: '#202020',
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 14,
  },
  continueButton: {
    backgroundColor: '#D9DDE1',
    borderColor: '#C4CAD0',
    borderWidth: 1,
    marginTop: 16,
  },
  continueButtonActive: {
    backgroundColor: '#2ECFC0',
    borderColor: '#23A89B',
  },
  continueText: {
    color: '#8A939B',
    fontSize: 17,
    fontWeight: '700',
  },
  continueTextActive: {
    color: '#ffffff',
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  dividerLine: {
    backgroundColor: '#E4E8EB',
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  socialButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  socialButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#E4E8EB',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
  },
  socialButtonRowItem: {
    flex: 1,
  },
  socialIconBadge: {
    alignItems: 'center',
    backgroundColor: '#F5F7F8',
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  appleButton: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  appleIconBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  socialButtonText: {
    color: '#202020',
    fontSize: 16,
    fontWeight: '700',
  },
  appleButtonText: {
    color: '#ffffff',
  },
  skipButton: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: 'absolute',
    right: 20,
    zIndex: 1,
  },
  skipText: {
    color: '#F5FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
});
