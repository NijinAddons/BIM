import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import {configureLocation} from '../../../services/location/locationPermission.service';
import {colors} from '../../../theme/colors';
import {
  addSavedAddress,
  ensureSavedAddress,
  getSavedAddresses,
  getUserProfile,
  loadStoredAddresses,
  setUserProfile,
  subscribeSavedAddresses,
  UserProfile,
} from '../../profile/service';

type AddressSelectionNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'AddressSelection'
>;

export default function AddressSelectionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AddressSelectionNavigationProp>();
  const [profile, setProfile] = React.useState<UserProfile>(getUserProfile());
  const savedAddresses = React.useSyncExternalStore(
    subscribeSavedAddresses,
    getSavedAddresses,
    getSavedAddresses,
  );
  const [addressInput, setAddressInput] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showAddAddressForm, setShowAddAddressForm] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      const currentProfile = getUserProfile();
      setProfile(currentProfile);
      setAddressInput(currentProfile.address);
    }, []),
  );

  React.useEffect(() => {
    configureLocation();
    loadStoredAddresses().catch(() => undefined);
  }, []);

  React.useEffect(() => {
    ensureSavedAddress(profile.address).catch(() => undefined);
  }, [profile.address]);

  const saveAddress = async (nextAddress: string) => {
    const trimmedAddress = nextAddress.trim();

    if (!trimmedAddress) {
      Alert.alert('Address required', 'Please enter your delivery address.');
      return;
    }

    const updatedProfile = {
      ...profile,
      address: trimmedAddress,
    };

    setProfile(updatedProfile);
    setAddressInput(trimmedAddress);
    await setUserProfile(updatedProfile, {profileCompleted: true});
    await addSavedAddress(trimmedAddress);
    navigation.goBack();
  };

  const useCurrentLocation = () => {
    navigation.navigate('ConfirmLocation', {mode: 'current'});
  };

  const addNewAddress = () => {
    navigation.navigate('ConfirmLocation', {mode: 'search'});
  };

  const requestAddressFromFriend = () => {
    Alert.alert(
      'Request address from friend',
      'Sharing flow can be connected here next.',
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24},
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <Pressable
              hitSlop={8}
              onPress={() => navigation.goBack()}
              style={styles.backButton}>
              <MaterialCommunityIcons color={colors.text} name="arrow-left" size={22} />
            </Pressable>
            <Text style={styles.headerTitle}>Select location</Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.subtitle}>
            Choose how you want to set your delivery location.
          </Text>

          <View style={styles.searchWrap}>
            <MaterialCommunityIcons color="#7c7368" name="magnify" size={20} />
            <TextInput
              onChangeText={setSearchQuery}
              placeholder="Search area, street or building"
              placeholderTextColor="#8c8c8c"
              style={styles.searchInput}
              value={searchQuery}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose an option</Text>

          <Pressable
            onPress={useCurrentLocation}
            style={styles.actionRow}>
            <View style={styles.actionRowLeft}>
              <View style={[styles.iconWrap, styles.currentLocationIconWrap]}>
                <MaterialCommunityIcons color="#ffffff" name="crosshairs-gps" size={18} />
              </View>
              <View style={styles.addressTextWrap}>
                <Text style={styles.addressTitle}>Use my current location</Text>
                <Text style={styles.addressValue}>
                  Open map and confirm your exact delivery spot
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              color="#8d8579"
              name="chevron-right"
              size={20}
            />
          </Pressable>

          <Pressable
            onPress={addNewAddress}
            style={styles.actionRow}>
            <View style={styles.actionRowLeft}>
              <View style={[styles.iconWrap, styles.addAddressIconWrap]}>
                <MaterialCommunityIcons color="#7a4b12" name="plus" size={20} />
              </View>
              <View style={styles.addressTextWrap}>
                <Text style={styles.addressTitle}>Add new address</Text>
                <Text style={styles.addressValue}>
                  Enter house, building, street and area details
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons
              color="#8d8579"
              name="chevron-right"
              size={20}
            />
          </Pressable>

          <Pressable onPress={requestAddressFromFriend} style={styles.actionRow}>
            <View style={styles.actionRowLeft}>
              <View style={[styles.iconWrap, styles.requestFriendIconWrap]}>
                <MaterialCommunityIcons color="#155e75" name="account-arrow-right-outline" size={18} />
              </View>
              <View style={styles.addressTextWrap}>
                <Text style={styles.addressTitle}>Request address from friend</Text>
                <Text style={styles.addressValue}>
                  Ask someone to share their exact delivery location
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons color="#8d8579" name="chevron-right" size={20} />
          </Pressable>
        </View>
        {savedAddresses.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your saved addresses</Text>
            {savedAddresses.map(item => (
              <Pressable
                key={item.id}
                onPress={() => saveAddress(item.address)}
                style={styles.savedAddressCard}>
                <View style={styles.actionRowLeft}>
                  <View style={[styles.iconWrap, styles.selectedLocationIconWrap]}>
                    <MaterialCommunityIcons color="#2f9a35" name="map-marker-check" size={18} />
                  </View>
                  <View style={styles.addressTextWrap}>
                    <Text style={styles.addressTitle}>Saved address</Text>
                    <Text style={styles.addressValue}>{item.address}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons color="#8d8579" name="chevron-right" size={20} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  container: {
    paddingHorizontal: 18,
  },
  headerSection: {
    borderBottomColor: '#ece7d8',
    borderBottomWidth: 1,
    marginBottom: 6,
    paddingBottom: 18,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 36,
  },
  subtitle: {
    color: '#6d6456',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
  },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 18,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    paddingVertical: 13,
    paddingLeft: 10,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  actionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  actionRowDisabled: {
    opacity: 0.7,
  },
  actionRowLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#fff0cf',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  currentLocationIconWrap: {
    backgroundColor: '#2f9a35',
  },
  addAddressIconWrap: {
    backgroundColor: '#fff0cf',
  },
  requestFriendIconWrap: {
    backgroundColor: '#dff0ff',
  },
  selectedLocationIconWrap: {
    backgroundColor: '#e8f6e8',
  },
  addressTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  addressTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  addressValue: {
    color: '#6d6456',
    fontSize: 13,
    marginTop: 3,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  addressInput: {
    color: colors.text,
    fontSize: 14,
    minHeight: 110,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 14,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  savedAddressCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: '#cfe7cf',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
});
