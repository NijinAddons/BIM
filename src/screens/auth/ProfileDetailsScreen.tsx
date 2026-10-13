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

import {ActionButton} from '../../components';
import {completePhoneProfile, type AuthUser} from '../../services';

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
  const isValid = name.trim().length >= 2 && EMAIL_PATTERN.test(email.trim());

  const onContinuePress = async () => {
    if (!isValid || isSubmitting) {
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
              disabled={!isValid || isSubmitting}
              label={isSubmitting ? 'Saving...' : 'Continue'}
              loading={isSubmitting}
              loadingColor={BRAND_NAVY}
              onPress={onContinuePress}
              style={[styles.continueButton, isValid ? styles.continueButtonActive : null]}
              textStyle={[styles.continueText, isValid ? styles.continueTextActive : null]}
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
});
