import React, {useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

import {ActionButton, GoogleIcon} from '../../components';
import {
  completePhoneProfile,
  completePhoneProfileWithGoogle,
  describeGoogleSignInError,
  getGoogleAccount,
  type AuthUser,
} from '../../services';

const BRAND_NAVY = '#1F2E3D';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  onSubmitted?: (sessionToken?: string, user?: AuthUser) => void;
  phone?: string;
  profileToken?: string;
  // Carried over from the OTP verify step, in case `complete_phone_profile`
  // doesn't issue its own token for a newly-completed account.
  sessionToken?: string;
};

export default function ProfileDetailsScreen({
  onSubmitted,
  phone,
  profileToken,
  sessionToken,
}: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const isBusy = isSubmitting || isGoogleSubmitting;
  const isValid = name.trim().length >= 2 && EMAIL_PATTERN.test(email.trim());

  const onContinuePress = async () => {
    if (!isValid || isBusy) {
      return;
    }

    if (!phone || !profileToken) {
      Alert.alert('Session expired', 'Please go back and verify your phone number again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await completePhoneProfile(
        name.trim(),
        email.trim(),
        phone,
        profileToken,
      );
      // Fall back to what was just entered if the backend doesn't echo back
      // a `user` object for a newly-completed profile.
      const resolvedUser: AuthUser = response.user ?? {
        name: email.trim(),
        email: email.trim(),
        mobile_no: phone,
        full_name: name.trim(),
        user_image: null,
      };
      onSubmitted?.(response.session_token ?? sessionToken, resolvedUser);
    } catch {
      Alert.alert('Could not save profile', 'Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Name and email come from the picked Google account instead of the form.
  const onGooglePress = async () => {
    if (isBusy) {
      return;
    }

    if (!phone || !profileToken) {
      Alert.alert('Session expired', 'Please go back and verify your phone number again.');
      return;
    }

    setIsGoogleSubmitting(true);

    try {
      const account = await getGoogleAccount();
      if (!account) {
        // User closed the account picker.
        return;
      }

      const response = await completePhoneProfileWithGoogle(
        account.idToken,
        phone,
        profileToken,
        name.trim() || account.user.full_name,
      );
      if (!response.success || !response.session_token) {
        throw new Error(response.message || 'Could not sign in with Google. Please try again.');
      }
      onSubmitted?.(
        response.session_token,
        response.user ?? {...account.user, mobile_no: phone},
      );
    } catch (error) {
      Alert.alert('Google sign-in failed', describeGoogleSignInError(error));
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={['#1F2E3D', '#1B4A52', '#1E6E63']}
      end={{x: 1, y: 1}}
      start={{x: 0, y: 0}}
      style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <View
          style={[
            styles.content,
            {paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24},
          ]}>
          <Text style={styles.title}>Tell us about you</Text>
          <Text style={styles.subtitle}>
            Just your name and email so we can personalize your orders.
          </Text>

          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#a3a3a3"
              style={styles.input}
              value={name}
            />

            <Text style={[styles.inputLabel, styles.inputLabelSpaced]}>Email Address</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#a3a3a3"
              style={styles.input}
              value={email}
            />

            <ActionButton
              active={isValid}
              disabled={!isValid || isBusy}
              label={isSubmitting ? 'Saving...' : 'Continue'}
              loading={isSubmitting}
              loadingColor={BRAND_NAVY}
              onPress={onContinuePress}
              style={[styles.continueButton, isValid ? styles.continueButtonActive : null]}
              textStyle={[styles.continueText, isValid ? styles.continueTextActive : null]}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <ActionButton
              accessory={(
                <View style={styles.googleIconBadge}>
                  <GoogleIcon size={16} />
                </View>
              )}
              disabled={isBusy}
              label="Continue with Google"
              loading={isGoogleSubmitting}
              onPress={onGooglePress}
              style={styles.googleButton}
              textStyle={styles.googleButtonText}
              variant="secondary"
            />
          </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    color: '#F5FAFC',
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: '#B9CBD8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  formSection: {
    marginTop: 36,
  },
  inputLabel: {
    color: '#F5FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  inputLabelSpaced: {
    marginTop: 20,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#ededed',
    borderRadius: 18,
    borderWidth: 1,
    color: '#202020',
    fontSize: 15,
    fontWeight: '500',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  continueButton: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: 28,
  },
  continueButtonActive: {
    backgroundColor: '#2ECFC0',
  },
  continueText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 17,
    fontWeight: '700',
  },
  continueTextActive: {
    color: BRAND_NAVY,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  dividerLine: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: '#B9CBD8',
    fontSize: 13,
    fontWeight: '600',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#E4E8EB',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    paddingVertical: 14,
  },
  googleButtonText: {
    color: BRAND_NAVY,
    fontSize: 16,
    fontWeight: '700',
  },
  googleIconBadge: {
    alignItems: 'center',
    backgroundColor: '#F5F7F8',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
});
