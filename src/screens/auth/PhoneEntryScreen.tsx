import React, {useState} from 'react';
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

const UAE_CALLING_CODE = '971';
const UAE_LOCAL_NUMBER_LENGTH = 9;

export default function PhoneEntryScreen() {
  const insets = useSafeAreaInsets();
  const [mobile, setMobile] = useState('');
  const isValid = mobile.length === UAE_LOCAL_NUMBER_LENGTH;

  const onChangeMobile = (value: string) => {
    const digits = value.replace(/\D/g, '');
    setMobile(digits.slice(0, UAE_LOCAL_NUMBER_LENGTH));
  };

  const onContinue = () => {
    if (!isValid) {
      Alert.alert('Invalid Number', 'Please enter a valid mobile number.');
      return;
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
            {paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24},
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Enter phone number</Text>
          <Text style={styles.subtitle}>
            Add your mobile number to finish sign in for your account.
          </Text>

          <Text style={styles.inputLabel}>Mobile Number</Text>
          <View style={styles.inputRow}>
            <Text style={styles.countryCode}>+{UAE_CALLING_CODE}</Text>
            <View style={styles.inputDivider} />
            <TextInput
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={UAE_LOCAL_NUMBER_LENGTH}
              onChangeText={onChangeMobile}
              placeholder="501234567"
              placeholderTextColor="#8f8f8f"
              textContentType="telephoneNumber"
              style={styles.input}
              value={mobile}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={!isValid}
            onPress={onContinue}
            style={[styles.continueButton, isValid && styles.continueButtonActive]}>
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
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
    flexGrow: 1,
    paddingHorizontal: 24,
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
    marginBottom: 28,
    marginTop: 8,
  },
  inputLabel: {
    color: '#1f1f1f',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d9d9d9',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 10,
  },
  countryCode: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
  },
  inputDivider: {
    backgroundColor: '#e7e7e7',
    height: 28,
    marginHorizontal: 8,
    width: 1,
  },
  input: {
    color: '#111111',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
  },
  continueButton: {
    alignItems: 'center',
    backgroundColor: '#d8e9d6',
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 56,
  },
  continueButtonActive: {
    backgroundColor: '#1f9d55',
  },
  continueText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
