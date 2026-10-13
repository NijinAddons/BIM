import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Keyboard,
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
import LinearGradient from 'react-native-linear-gradient';

import {ActionButton} from '../../components';
import {bim} from '../../assets/images';
import {requestPhoneOtp} from '../../services';

const BRAND_NAVY = '#1F2E3D';
const MUTED = '#7C8A97';
const UAE_CALLING_CODE = '971';
const UAE_LOCAL_NUMBER_LENGTH = 9;
// Captured once (not tied to the live, keyboard-shrunk frame) so the
// ScrollView content stays taller than the visible area once the keyboard
// opens on Android — otherwise it has nothing to scroll and can't bring the
// focused input above the keyboard.
const SCREEN_HEIGHT = Dimensions.get('window').height;

type Props = {
  onSkip?: () => void;
  onContinue?: (phone: string, authFlowToken?: string) => void;
};

export default function LoginScreen({onSkip, onContinue}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [mobile, setMobile] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isValid = mobile.length === UAE_LOCAL_NUMBER_LENGTH;

  // On modern Android (edge-to-edge, targetSdk 35+) the window no longer
  // shrinks for the keyboard the way `adjustResize` used to, so neither
  // KeyboardAvoidingView nor ScrollView's own layout has anything to react
  // to. Track the keyboard height ourselves and pad + scroll manually.
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
    setMobile(value.replace(/\D/g, '').slice(0, UAE_LOCAL_NUMBER_LENGTH));
  };

  const onContinuePress = async () => {
    if (!isValid || isSendingOtp) {
      return;
    }

    const phone = `+${UAE_CALLING_CODE}${mobile}`;
    setIsSendingOtp(true);

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

          {/* The keyboard space goes inside the white card, not below it —
              padding the scroll content left a band of the gradient
              background showing between the card and the keyboard. */}
          <View style={[styles.card, {paddingBottom: insets.bottom + 24 + keyboardHeight}]}>
            <Text style={styles.heading}>Log in or sign up</Text>
            <Text style={styles.subheading}>
              Enter your mobile number. New here? We'll create your account automatically — no separate sign-up needed.
            </Text>

            <Text style={styles.inputLabel}>Mobile Number</Text>
            <View style={[styles.inputRow, isValid ? styles.inputRowValid : null]}>
              <Text style={styles.flag}>🇦🇪</Text>
              <Text style={styles.countryCode}>+{UAE_CALLING_CODE}</Text>
              <View style={styles.inputDivider} />
              <TextInput
                keyboardType="number-pad"
                maxLength={UAE_LOCAL_NUMBER_LENGTH}
                onChangeText={onChangeMobile}
                placeholder="50 123 4567"
                placeholderTextColor="#a3a3a3"
                style={styles.input}
                value={mobile}
              />
              {isValid ? (
                <MaterialCommunityIcons color="#2ECFC0" name="check-circle" size={20} />
              ) : null}
            </View>

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

            <Text style={styles.helperText}>
              We'll text you a one-time code to verify it's you.
            </Text>

            {/* Social login — disabled for now, keep for when Google/Apple sign-in is wired up.
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialButtonsRow}>
              <ActionButton
                accessory={(
                  <View style={styles.socialIconBadge}>
                    <MaterialCommunityIcons color="#4285F4" name="google" size={16} />
                  </View>
                )}
                label="Google"
                style={[styles.socialButton, styles.socialButtonRowItem]}
                textStyle={styles.socialButtonText}
                variant="secondary"
              />

              <ActionButton
                accessory={(
                  <View style={[styles.socialIconBadge, styles.appleIconBadge]}>
                    <MaterialCommunityIcons color="#ffffff" name="apple" size={18} />
                  </View>
                )}
                label="Apple"
                style={[styles.socialButton, styles.socialButtonRowItem, styles.appleButton]}
                textStyle={[styles.socialButtonText, styles.appleButtonText]}
                variant="dark"
              />
            </View>
            */}
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
  heading: {
    color: BRAND_NAVY,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  subheading: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 28,
  },
  inputLabel: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
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
  helperText: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 14,
    textAlign: 'center',
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
