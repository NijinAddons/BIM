import {RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {
  Alert,
  ActivityIndicator,
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

import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import {ApiError} from '../../../services/api/apiError';
import {logger} from '../../../utils/logger';
import {colors} from '../../../theme/colors';
import {setUserProfile} from '../service';
import {otpService} from '../../auth/service';

type ProfileDetailsNavProp = NativeStackNavigationProp<
  RootStackParamList,
  'ProfileDetails'
>;
type ProfileDetailsRouteProp = RouteProp<RootStackParamList, 'ProfileDetails'>;

type Props = {
  navigation: ProfileDetailsNavProp;
  route: ProfileDetailsRouteProp;
};

export default function ProfileDetailsScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<'username' | 'email' | null>(
    null,
  );

  const isValidEmail = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );
  const isValidUsername = useMemo(() => username.trim().length >= 2, [username]);

  const onContinue = async () => {
    if (!isValidUsername) {
      Alert.alert('Invalid Username', 'Please enter a valid username.');
      return;
    }
    if (!isValidEmail) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    const signupPayload = {
      email: email.trim(),
      full_name: username.trim(),
      phone: route.params.phone,
      username: username.trim(),
    };

    try {
      setIsSubmitting(true);
      logger.log('Complete signup API request', {
        payload: signupPayload,
        verifiedPhone: route.params.phone,
      });
      const signupResponse = await otpService.completeSignup(signupPayload);

      logger.log('Complete signup API response', {
        phone: route.params.phone,
        payload: signupPayload,
        response: signupResponse.data,
        status: signupResponse.response.status,
      });

      await setUserProfile(
        {
          address: '',
          email: signupPayload.email,
          mobile: route.params.phone,
          name: signupPayload.username,
        },
        {profileCompleted: true},
      );
      navigation.replace('MainTabs');
    } catch (error) {
      logger.log('Complete signup API error', error);
      const errorMessage =
        error instanceof ApiError && error.body
          ? error.body
          : error instanceof Error && error.message
            ? error.message
            : 'Unable to complete signup. Please try again.';
      Alert.alert('Signup failed', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.container}>
        <ScrollView
          bounces={false}
          contentContainerStyle={[
            styles.content,
            {paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20},
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrow}>Account setup</Text>
            <Text style={styles.title}>Finish your shopping profile</Text>
            <Text style={styles.subtitle}>
              Add a few details once so invoices, delivery updates, and support
              feel seamless.
            </Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                autoCapitalize="none"
                onBlur={() => setFocusedField(null)}
                onChangeText={setUsername}
                onFocus={() => setFocusedField('username')}
                placeholder="Enter your username"
                placeholderTextColor="#9a9a9a"
                style={[
                  styles.input,
                  focusedField === 'username' && styles.inputFocused,
                ]}
                value={username}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onBlur={() => setFocusedField(null)}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                placeholder="name@example.com"
                placeholderTextColor="#9a9a9a"
                style={[
                  styles.input,
                  focusedField === 'email' && styles.inputFocused,
                ]}
                value={email}
              />
            </View>

            <Text style={styles.helperText}>
              We'll use this email for invoices, delivery updates, and account
              recovery.
            </Text>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={!isValidUsername || !isValidEmail || isSubmitting}
              onPress={onContinue}
              style={[
                styles.button,
                isValidUsername && isValidEmail && !isSubmitting && styles.buttonEnabled,
            ]}>
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    paddingHorizontal: 24,
  },
  headerBlock: {
    marginBottom: 22,
    marginTop: 8,
  },
  eyebrow: {
    color: '#7f734f',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#111111',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    marginTop: 8,
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  formSection: {
    marginTop: 8,
  },
  fieldGroup: {
    marginTop: 14,
  },
  label: {
    color: '#3f3f3f',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fffdf7',
    borderColor: '#eadfcb',
    borderRadius: 14,
    borderWidth: 1,
    color: '#202020',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inputFocused: {
    borderColor: '#121212',
  },
  helperText: {
    color: '#7b7b7b',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  footer: {
    marginTop: 20,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#b9bfcb',
    borderRadius: 16,
    paddingVertical: 15,
  },
  buttonEnabled: {
    backgroundColor: colors.primaryDark,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
