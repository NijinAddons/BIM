import {RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {
  Alert,
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
import {colors} from '../../../theme/colors';
import {setUserProfile} from '../service';

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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [focusedField, setFocusedField] = useState<'name' | 'email' | null>(
    null,
  );

  const isValidEmail = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );
  const isValidName = useMemo(() => fullName.trim().length >= 2, [fullName]);

  const onContinue = async () => {
    if (!isValidName) {
      Alert.alert('Invalid Name', 'Please enter your full name.');
      return;
    }
    if (!isValidEmail) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    await setUserProfile(
      {
        address: '',
        email: email.trim(),
        mobile: `+91 ${route.params.mobile}`,
        name: fullName.trim(),
      },
      {profileCompleted: true},
    );
    navigation.replace('MainTabs');
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
              <Text style={styles.label}>Full name</Text>
              <TextInput
                autoCapitalize="words"
                onBlur={() => setFocusedField(null)}
                onChangeText={setFullName}
                onFocus={() => setFocusedField('name')}
                placeholder="Enter your full name"
                placeholderTextColor="#9a9a9a"
                style={[
                  styles.input,
                  focusedField === 'name' && styles.inputFocused,
                ]}
                value={fullName}
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
              onPress={onContinue}
              style={[
                styles.button,
                isValidName && isValidEmail && styles.buttonEnabled,
            ]}>
              <Text style={styles.buttonText}>Continue</Text>
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
