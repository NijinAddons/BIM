import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useSyncExternalStore } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { RootStackParamList } from '../../../app/navigation/types/root-navigation.types';
import { colors } from '../../../theme/colors';
import { getUserProfile, setUserProfile, subscribeProfile } from '../service';

type EditProfileNavProp = NativeStackNavigationProp<
  RootStackParamList,
  'EditProfile'
>;

type Props = {
  navigation: EditProfileNavProp;
};

export default function EditProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const profile = useSyncExternalStore(
    subscribeProfile,
    getUserProfile,
    getUserProfile,
  );
  const profileNameParts = React.useMemo(() => {
    const [firstName = '', ...lastNameParts] = profile.name.trim().split(/\s+/);
    return {
      firstName,
      lastName: lastNameParts.join(' '),
    };
  }, [profile.name]);
  const [firstName, setFirstName] = React.useState(profileNameParts.firstName);
  const [lastName, setLastName] = React.useState(profileNameParts.lastName);
  const [email, setEmail] = React.useState(profile.email);
  const [mobile, setMobile] = React.useState(profile.mobile);

  const onEditProfileIcon = () => {
    Alert.alert('Profile photo', 'Photo upload will be available soon.');
  };

  const onSubmit = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim();
    const trimmedMobile = mobile.trim();

    if (trimmedFirstName.length < 2) {
      Alert.alert('Invalid first name', 'Please enter your first name.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    await setUserProfile(
      {
        ...profile,
        email: trimmedEmail,
        mobile: trimmedMobile,
        name: [trimmedFirstName, trimmedLastName].filter(Boolean).join(' '),
      },
      { profileCompleted: true },
    );
    Alert.alert('Profile updated', 'Your profile details have been saved.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.container}
      >
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <MaterialCommunityIcons
              color={colors.text}
              name="arrow-left"
              size={22}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Edit profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileIconSection}>
            <Pressable
              onPress={onEditProfileIcon}
              style={styles.profileIconWrap}
            >
              <MaterialCommunityIcons
                color="#9ca3af"
                name="account"
                size={54}
              />
              <View style={styles.editIconBadge}>
                <MaterialCommunityIcons
                  color="#ffffff"
                  name="pencil"
                  size={15}
                />
              </View>
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>First name</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setFirstName}
              placeholder="Enter first name"
              placeholderTextColor="#9a9a9a"
              style={styles.input}
              value={firstName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Last name</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setLastName}
              placeholder="Enter last name"
              placeholderTextColor="#9a9a9a"
              style={styles.input}
              value={lastName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mobile number</Text>
            <TextInput
              keyboardType="phone-pad"
              onChangeText={setMobile}
              placeholder="Enter mobile number"
              placeholderTextColor="#9a9a9a"
              style={styles.input}
              value={mobile}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor="#9a9a9a"
              style={styles.input}
              value={email}
            />
          </View>

          <Pressable onPress={onSubmit} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Submit</Text>
          </Pressable>
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
  header: {
    alignItems: 'center',
    borderBottomColor: '#eeeeee',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  profileIconSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileIconWrap: {
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    borderRadius: 48,
    borderWidth: 1,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  editIconBadge: {
    alignItems: 'center',
    backgroundColor: '#1f9d55',
    borderColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    bottom: 2,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    width: 32,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#1f9d55',
    borderRadius: 12,
    marginTop: 18,
    paddingVertical: 15,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
