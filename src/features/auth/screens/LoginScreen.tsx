import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
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

import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import {ActionButton} from '../../../components';
import {
  setStoredFrappeAuthCredentials,
} from '../../../services/frappe/frappeAuth';
import {appicon} from '../../../assets/images';
import {logger} from '../../../utils/logger';
import {setUserProfile} from '../../profile/service';
import {
  appleAuthService,
  AppleAuthResponse,
  getLoginAuthCredentials,
  getNestedAuthResponsePayload,
  GoogleAuthResponse,
  googleAuthService,
  otpService,
} from '../service';
import {
  findExistingAuthUserByEmail,
  getLoginUserProfile,
  getOtpDeliveryMeta,
  isExistingUserLoginResponse,
  isUserMissingError,
  normalizeSocialAuthProfile,
} from '../utils';

type LoginNavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

type Props = {
  navigation: LoginNavProp;
};

const heroItems = [
  {label: 'Vegetables', color: '#e8fbef', accent: '#3ea857', detail: '#78cc7e', type: 'vegetables'},
  {label: 'Fruits', color: '#fff2d8', accent: '#ffbe2e', detail: '#ff7a45', type: 'fruits'},
  {label: 'Groceries', color: '#ecebff', accent: '#6b57d8', detail: '#31b58d', type: 'groceries'},
  {label: 'Vegetables', color: '#e9fbfb', accent: '#49a451', detail: '#7fd38a', type: 'vegetables'},
  {label: 'Fruits', color: '#fff1dc', accent: '#ffd247', detail: '#ff8d54', type: 'fruits'},
  {label: 'Groceries', color: '#eef5ff', accent: '#4c7bd9', detail: '#f4b63d', type: 'groceries'},
  {label: 'Vegetables', color: '#eefbea', accent: '#4cab4d', detail: '#92d86b', type: 'vegetables'},
  {label: 'Fruits', color: '#fff0d6', accent: '#ffc136', detail: '#ff7457', type: 'fruits'},
  {label: 'Groceries', color: '#ecf7ff', accent: '#4f8ee2', detail: '#ffcf4e', type: 'groceries'},
  {label: 'Vegetables', color: '#eafbf6', accent: '#32a56f', detail: '#66d39c', type: 'vegetables'},
  {label: 'Fruits', color: '#fff3de', accent: '#ffca4b', detail: '#ff7d4f', type: 'fruits'},
  {label: 'Groceries', color: '#f0ecff', accent: '#7860df', detail: '#36b897', type: 'groceries'},
];

const heroRows = [
  heroItems.slice(0, 4),
  heroItems.slice(4, 8),
  heroItems.slice(8, 12),
];

const HERO_CARD_WIDTH = 92;
const HERO_CARD_GAP = 12;
const HERO_LOOP_DISTANCE = (HERO_CARD_WIDTH + HERO_CARD_GAP) * 4;
const UAE_CALLING_CODE = '971';
const UAE_LOCAL_NUMBER_LENGTH = 9;

const ANDROID_DEBUG_SHA1 = '5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25';

const getGoogleLoginErrorMessage = (error: unknown) => {
  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return 'Google Play Services is not available on this device.';
    }

    if (error.code === '10') {
      return `Google Sign-In is not configured for this Android app signature. Add package com.addons.buyinminutes with SHA-1 ${ANDROID_DEBUG_SHA1} in Firebase, enable Google sign-in, then download a fresh android/app/google-services.json.`;
    }
  }

  if (error instanceof Error && error.message) {
    if (error.message.includes('DEVELOPER_ERROR')) {
      return `Google Sign-In is not configured for this Android app signature. Add package com.addons.buyinminutes with SHA-1 ${ANDROID_DEBUG_SHA1} in Firebase, enable Google sign-in, then download a fresh android/app/google-services.json.`;
    }

    return error.message;
  }

  return 'Unable to sign in with Google. Please try again.';
};

type SocialAuthResponse = GoogleAuthResponse | AppleAuthResponse;

const getSocialLoginFlags = (response?: {data?: unknown; message?: unknown}) => {
  if (!response) {
    return {
      existingUser: false,
      phoneRequired: false,
    };
  }

  const payload = getNestedAuthResponsePayload(response);
  const existingUserFlag =
    payload?.existing_user ?? payload?.existingUser ?? payload?.user_exists;
  const phoneRequiredFlag =
    payload?.phone_required ?? payload?.phoneRequired ?? payload?.mobile_required;

  return {
    existingUser:
      typeof existingUserFlag === 'boolean'
        ? existingUserFlag
        : isExistingUserLoginResponse(response),
    phoneRequired: phoneRequiredFlag === true,
  };
};

export default function LoginScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const [mobile, setMobile] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const isValid = mobile.length === UAE_LOCAL_NUMBER_LENGTH;
  const rowAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(-HERO_LOOP_DISTANCE),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const loops = rowAnimations.map((animatedValue, index) => {
      const fromValue = index === 1 ? -HERO_LOOP_DISTANCE : 0;
      const toValue = index === 1 ? 0 : -HERO_LOOP_DISTANCE;

      animatedValue.setValue(fromValue);

      return Animated.loop(
        Animated.timing(animatedValue, {
          toValue,
          duration: 11000 + index * 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
    });

    loops.forEach(loop => loop.start());

    return () => {
      loops.forEach(loop => loop.stop());
    };
  }, [rowAnimations]);

  useEffect(() => {
    googleAuthService.configure();
  }, []);

  const onChangeMobile = (value: string) => {
    const digits = value.replace(/\D/g, '');
    setMobile(digits.slice(0, UAE_LOCAL_NUMBER_LENGTH));
  };

  const onContinue = async () => {
    if (!isValid) {
      Alert.alert('Invalid Number', 'Please enter a valid mobile number.');
      return;
    }

    const phone = `+${UAE_CALLING_CODE}${mobile}`;

    try {
      setIsSendingOtp(true);
      let authFlow: 'login' | 'signup' = 'signup';

      try {
        const loginResponse = await otpService.login(phone);
        console.log('[Login Continue] login response', loginResponse.data);
        authFlow = isExistingUserLoginResponse(loginResponse.data) ? 'login' : 'signup';
      } catch (error) {
        if (!isUserMissingError(error)) {
          throw error;
        }
      }

      const otpResponse = await otpService.sendOtp(phone);
      const otpDeliveryMeta = getOtpDeliveryMeta(otpResponse.data);
      navigation.navigate('Otp', {
        authFlow,
        callingCode: UAE_CALLING_CODE,
        expiresIn: otpDeliveryMeta.expiresIn,
        maxAttempts: otpDeliveryMeta.maxAttempts,
        mobile,
        phone,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to send OTP. Please try again.';
      Alert.alert('OTP failed', errorMessage);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const skipLogin = async () => {
    await setStoredFrappeAuthCredentials({apiKey: '', apiSecret: ''});
    await setUserProfile(
      {
        address: '',
        customer: '',
        email: '',
        mobile: '',
        name: 'BIM User',
      },
      {profileCompleted: true},
    );
    navigation.replace('MainTabs');
  };

  const persistResolvedProfile = async (
    resolvedProfile: ReturnType<typeof normalizeSocialAuthProfile>,
  ) => {
    const existingUser = await findExistingAuthUserByEmail(resolvedProfile.email);

    if (existingUser?.email) {
      return {
        customer: resolvedProfile.customer,
        email: existingUser.email.trim(),
        mobile:
          typeof existingUser.mobile_no === 'string'
            ? existingUser.mobile_no.trim()
            : '',
        name:
          typeof existingUser.full_name === 'string' && existingUser.full_name.trim()
            ? existingUser.full_name.trim()
            : resolvedProfile.name,
      };
    }

    return {
      customer: resolvedProfile.customer,
      email: resolvedProfile.email,
      mobile: resolvedProfile.mobile,
      name: resolvedProfile.name,
    };
  };

  const completeSocialLogin = async (
    authResult: SocialAuthResponse,
    logPrefix: '[Google Login]' | '[Apple Login]',
  ) => {
    const {backendResponse, profile} = authResult;

    logger.log(`${logPrefix} backend response`, backendResponse);
    logger.log(`${logPrefix} social profile`, profile);

    const resolvedProfile = normalizeSocialAuthProfile(
      backendResponse ? getLoginUserProfile(backendResponse) ?? profile : profile,
    );
    const authCredentials = backendResponse
      ? getLoginAuthCredentials(backendResponse)
      : null;

    logger.log(`${logPrefix} resolved profile`, {
      authCredentials,
      resolvedProfile,
    });

    if (authCredentials) {
      await setStoredFrappeAuthCredentials(authCredentials);
    }

    if (!resolvedProfile.email || !resolvedProfile.name) {
      throw new Error(
        `${logPrefix === '[Google Login]' ? 'Google' : 'Apple'} login did not return a valid name and email.`,
      );
    }

    const resolvedExistingProfile = await persistResolvedProfile(resolvedProfile);
    const {existingUser, phoneRequired} = getSocialLoginFlags(backendResponse);

    await setUserProfile(
      {
        address: '',
        customer: resolvedExistingProfile.customer,
        email: resolvedExistingProfile.email,
        mobile: resolvedExistingProfile.mobile,
        name: resolvedExistingProfile.name,
      },
      {
        profileCompleted: Boolean(
          resolvedExistingProfile.name.trim() && resolvedExistingProfile.email.trim(),
        ),
      },
    );

    const mobileDigits = resolvedExistingProfile.mobile.trim();

    if (existingUser && !phoneRequired) {
      navigation.replace('Otp', {
        authFlow: 'login',
        callingCode: UAE_CALLING_CODE,
        customer: resolvedExistingProfile.customer,
        email: resolvedExistingProfile.email,
        mobile: mobileDigits.replace(/^\+?971/, ''),
        name: resolvedExistingProfile.name,
        phone: mobileDigits,
      });
      return;
    }

    navigation.replace('PhoneEntry', {
      customer: resolvedExistingProfile.customer,
      email: resolvedExistingProfile.email,
      name: resolvedExistingProfile.name,
    });

    logger.log(`${logPrefix} existing user lookup`, {
      email: resolvedProfile.email,
      existingUser,
      phoneRequired,
      resolvedExistingProfile,
    });
  };

  const onGoogleLogin = async () => {
    if (!googleAuthService.isConfigured()) {
      Alert.alert(
        'Google login not ready',
        'Add the Firebase Web Client ID in appConfig and re-download google-services.json after enabling Google sign-in and SHA-1 in Firebase.',
      );
      return;
    }

    try {
      setIsGoogleSigningIn(true);
      const authResult = await googleAuthService.signIn();
      logger.log('[Google Login] auth response', authResult);
      logger.log('[Google Login] signIn result', {
        backendResponse: authResult.backendResponse,
        idToken: authResult.idToken,
        profile: authResult.profile,
      });
      await completeSocialLogin(authResult, '[Google Login]');
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert(
          'Google login cancelled',
          'Google sign-in was cancelled. Please choose an account to continue.',
        );
        return;
      }

      Alert.alert('Google login failed', getGoogleLoginErrorMessage(error));
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const onAppleLogin = async () => {
    logger.log('[Apple Login] button clicked', {
      isConfigured: appleAuthService.isConfigured(),
      platform: Platform.OS,
    });

    if (!appleAuthService.isConfigured()) {
      Alert.alert(
        'Apple login not ready',
        'Apple sign-in is not available on this iOS build yet.',
      );
      return;
    }

    try {
      setIsAppleSigningIn(true);
      logger.log('[Apple Login] invoking service signIn');
      const authResult = await appleAuthService.signIn();
      logger.log('[Apple Login] auth response', authResult);
      logger.log('[Apple Login] signIn result', {
        backendResponse: authResult.backendResponse,
        idToken: authResult.idToken,
        profile: authResult.profile,
      });
      await completeSocialLogin(authResult, '[Apple Login]');
    } catch (error) {
      logger.log('[Apple Login] screen error', error);
      if (error instanceof Error && error.message === 'Apple sign-in was cancelled.') {
        Alert.alert(
          'Apple login cancelled',
          'Apple sign-in was cancelled. Please choose an account to continue.',
        );
        return;
      }

      Alert.alert(
        'Apple login failed',
        error instanceof Error && error.message
          ? error.message
          : 'Unable to sign in with Apple. Please try again.',
      );
    } finally {
      setIsAppleSigningIn(false);
      logger.log('[Apple Login] loading state cleared');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.container}>
        <ScrollView
          bounces={false}
          contentContainerStyle={[
            styles.scrollContent,
            {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24},
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.heroSection}>
              <View style={styles.heroMarquee}>
                {heroRows.map((rowItems, rowIndex) => (
                  <View key={`hero-row-${rowIndex}`} style={styles.heroRowClip}>
                    <Animated.View
                      style={[
                        styles.heroRow,
                        {transform: [{translateX: rowAnimations[rowIndex]}]},
                      ]}>
                      {[...rowItems, ...rowItems].map((item, itemIndex) => (
                        <View
                          key={`${item.label}-${rowIndex}-${itemIndex}`}
                          style={[styles.heroTile, {backgroundColor: item.color}]}>
                          <View style={styles.productWrap}>
                            <View
                              style={[
                                styles.categoryArtwork,
                                item.type === 'vegetables' && styles.vegetablesArtwork,
                                item.type === 'fruits' && styles.fruitsArtwork,
                                item.type === 'groceries' && styles.groceriesArtwork,
                              ]}>
                              {item.type === 'vegetables' ? (
                                <>
                                  <View
                                    style={[
                                      styles.vegCircleLarge,
                                      {backgroundColor: item.accent},
                                    ]}
                                  />
                                  <View
                                    style={[
                                      styles.vegCircleSmall,
                                      {backgroundColor: item.detail},
                                    ]}
                                  />
                                  <View style={styles.vegStem} />
                                </>
                              ) : null}

                              {item.type === 'fruits' ? (
                                <>
                                  <View
                                    style={[
                                      styles.fruitBanana,
                                      {backgroundColor: item.accent},
                                    ]}
                                  />
                                  <View
                                    style={[
                                      styles.fruitOrange,
                                      {backgroundColor: item.detail},
                                    ]}
                                  />
                                  <View style={styles.fruitLeaf} />
                                </>
                              ) : null}

                              {item.type === 'groceries' ? (
                                <>
                                  <View
                                    style={[
                                      styles.groceryBag,
                                      {backgroundColor: item.accent},
                                    ]}
                                  />
                                  <View
                                    style={[
                                      styles.groceryBottle,
                                      {backgroundColor: item.detail},
                                    ]}
                                  />
                                  <View style={styles.groceryHandle} />
                                </>
                              ) : null}
                            </View>
                            <Text style={styles.cardLabel}>{item.label}</Text>
                          </View>
                        </View>
                      ))}
                    </Animated.View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.brandSection}>
              <View style={styles.brandBadge}>
                <Image source={appicon} style={styles.brandBadgeIcon} />
              </View>
              <Text style={styles.title}>
                Your daily needs, delivered instantly.
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={styles.inputRow}>
                <Text style={styles.countryCode}>+{UAE_CALLING_CODE}</Text>
                <View style={styles.inputDivider} />
                <TextInput
                  keyboardType="number-pad"
                  maxLength={UAE_LOCAL_NUMBER_LENGTH}
                  onChangeText={onChangeMobile}
                  placeholder="50XXXXXXX"
                  placeholderTextColor="#8f8f8f"
                  style={styles.input}
                  value={mobile}
                />
              </View>

              <ActionButton
                active={isValid}
                disabled={!isValid}
                label={isSendingOtp ? 'Sending OTP...' : 'Continue'}
                loading={isSendingOtp}
                onPress={onContinue}
                style={[
                  styles.continueButton,
                  isValid && !isSendingOtp ? styles.continueButtonActive : null,
                ]}
                textStyle={styles.continueText}
              />

              <View style={styles.optionalDividerRow}>
                <View style={styles.optionalDividerLine} />
                <Text style={styles.optionalDividerText}>or</Text>
                <View style={styles.optionalDividerLine} />
              </View>

              <View style={styles.socialButtonsRow}>
                <ActionButton
                  accessory={(
                    <View style={styles.socialIconBadge}>
                      <MaterialCommunityIcons
                        color="#4285F4"
                        name="google"
                        size={16}
                      />
                    </View>
                  )}
                  label={isGoogleSigningIn ? 'Signing in...' : 'Google'}
                  loading={isGoogleSigningIn}
                  loadingColor="#163322"
                  onPress={onGoogleLogin}
                  style={[styles.socialButton, styles.socialButtonRowItem]}
                  textStyle={styles.googleButtonText}
                  variant="secondary"
                />

                {Platform.OS === 'ios' ? (
                  <ActionButton
                    accessory={(
                      <View style={[styles.socialIconBadge, styles.appleIconBadge]}>
                        <MaterialCommunityIcons
                          color="#ffffff"
                          name="apple"
                          size={18}
                        />
                      </View>
                    )}
                    label="Apple"
                    loading={isAppleSigningIn}
                    onPress={onAppleLogin}
                    style={[styles.socialButton, styles.socialButtonRowItem, styles.appleButton]}
                    textStyle={[styles.googleButtonText, styles.appleButtonText]}
                    variant="dark"
                  />
                ) : null}
              </View>

              <Text style={styles.termsText}>
                By continuing, you agree to our Terms of service &amp; Privacy policy
              </Text>
            </View>
          </View>
        </ScrollView>
        <TouchableOpacity
          onPress={skipLogin}
          style={[styles.skipButton, {top: insets.top + 16}]}>
          <Text style={styles.skipText}>Skip login</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  heroSection: {
    alignItems: 'center',
    marginHorizontal: -16,
  },
  heroMarquee: {
    gap: 12,
    width: '100%',
  },
  heroRowClip: {
    overflow: 'hidden',
    width: '100%',
  },
  heroRow: {
    flexDirection: 'row',
    width: HERO_LOOP_DISTANCE * 2,
  },
  heroTile: {
    alignItems: 'center',
    borderRadius: 24,
    height: 98,
    justifyContent: 'center',
    marginRight: HERO_CARD_GAP,
    overflow: 'hidden',
    width: HERO_CARD_WIDTH,
  },
  productWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryArtwork: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    position: 'relative',
  },
  vegetablesArtwork: {
    height: 34,
    width: 42,
  },
  fruitsArtwork: {
    height: 32,
    width: 44,
  },
  groceriesArtwork: {
    height: 36,
    width: 44,
  },
  vegCircleLarge: {
    borderRadius: 14,
    height: 22,
    left: 4,
    position: 'absolute',
    top: 8,
    width: 22,
  },
  vegCircleSmall: {
    borderRadius: 11,
    height: 18,
    position: 'absolute',
    right: 2,
    top: 12,
    width: 18,
  },
  vegStem: {
    backgroundColor: '#308944',
    borderRadius: 4,
    height: 8,
    position: 'absolute',
    top: 4,
    width: 10,
  },
  fruitBanana: {
    borderRadius: 16,
    height: 12,
    left: 4,
    position: 'absolute',
    top: 12,
    transform: [{rotate: '-25deg'}],
    width: 30,
  },
  fruitOrange: {
    borderRadius: 11,
    height: 22,
    position: 'absolute',
    right: 4,
    top: 10,
    width: 22,
  },
  fruitLeaf: {
    backgroundColor: '#48a751',
    borderRadius: 6,
    height: 6,
    position: 'absolute',
    right: 10,
    top: 4,
    transform: [{rotate: '-20deg'}],
    width: 10,
  },
  groceryBag: {
    borderRadius: 8,
    bottom: 2,
    height: 24,
    left: 5,
    position: 'absolute',
    width: 24,
  },
  groceryBottle: {
    borderRadius: 6,
    height: 20,
    position: 'absolute',
    right: 6,
    top: 10,
    width: 12,
  },
  groceryHandle: {
    borderColor: '#4c4c4c',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderTopWidth: 2,
    height: 8,
    left: 12,
    position: 'absolute',
    top: 4,
    width: 12,
  },
  cardLabel: {
    color: '#303030',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 10,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  brandBadge: {
    alignItems: 'center',
    borderRadius: 18,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  brandBadgeIcon: {
    borderRadius: 18,
    height: '100%',
    width: '100%',
  },
  title: {
    color: '#222222',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 18,
    textAlign: 'center',
  },
  subtitle: {
    color: '#666666',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 6,
  },
  formSection: {
    marginTop: 20,
  },
  inputLabel: {
    color: '#222222',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#ededed',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  countryCode: {
    color: '#303030',
    fontSize: 15,
    fontWeight: '700',
  },
  inputDivider: {
    backgroundColor: '#e8e8e8',
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
    marginTop: 16,
  },
  continueButtonActive: {
    backgroundColor: '#171717',
  },
  continueText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  optionalDividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  optionalDividerLine: {
    backgroundColor: '#ececec',
    flex: 1,
    height: 1,
  },
  optionalDividerText: {
    color: '#949494',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  socialButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  socialButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e8e8e8',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
  },
  socialButtonRowItem: {
    flex: 1,
  },
  socialIconBadge: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
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
  googleButtonText: {
    color: '#202020',
    fontSize: 16,
    fontWeight: '700',
  },
  appleButtonText: {
    color: '#ffffff',
  },
  termsText: {
    color: '#a6a6a6',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 28,
    textAlign: 'center',
  },
  skipButton: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'absolute',
    right: 20,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  skipText: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '500',
  },
});
