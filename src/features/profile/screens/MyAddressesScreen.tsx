import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useSyncExternalStore} from 'react';
import {
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import {colors} from '../../../theme/colors';
import {getUserProfile, setUserProfile, subscribeProfile} from '../service';

type MyAddressesNavProp = NativeStackNavigationProp<RootStackParamList, 'MyAddresses'>;

type Props = {
  navigation: MyAddressesNavProp;
};

export default function MyAddressesScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const profile = useSyncExternalStore(subscribeProfile, getUserProfile, getUserProfile);
  const [showAddressForm, setShowAddressForm] = React.useState(false);
  const [addressInput, setAddressInput] = React.useState(profile.address);
  const [searchQuery, setSearchQuery] = React.useState('');
  const hasAddress = Boolean(profile.address.trim());

  React.useEffect(() => {
    setAddressInput(profile.address);
  }, [profile.address]);

  const onSaveAddress = async () => {
    const trimmedAddress = addressInput.trim();

    if (!trimmedAddress) {
      Alert.alert('Address required', 'Please enter your delivery address.');
      return;
    }

    await setUserProfile(
      {
        ...profile,
        address: trimmedAddress,
      },
      {profileCompleted: true},
    );
    setShowAddressForm(false);
  };

  const useCurrentLocation = () => {
    navigation.navigate('ConfirmLocation', {});
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={[styles.header, {paddingTop: insets.top + 10}]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons color={colors.text} name="arrow-left" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>My addresses</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.searchField}>
          <MaterialCommunityIcons color="#7c7368" name="magnify" size={20} />
          <TextInput
            onChangeText={setSearchQuery}
            placeholder="Search saved address or area"
            placeholderTextColor="#8c8c8c"
            style={styles.searchInput}
            value={searchQuery}
          />
        </View>

        <Pressable
          onPress={useCurrentLocation}
          style={styles.currentLocationButton}>
          <View style={styles.currentLocationLeft}>
            <View style={styles.gpsIconWrap}>
              <MaterialCommunityIcons color="#ffffff" name="crosshairs-gps" size={19} />
            </View>
            <View style={styles.currentLocationTextWrap}>
              <Text style={styles.currentLocationTitle}>Use current location</Text>
              <Text style={styles.currentLocationSubtitle}>
                Open map and confirm your GPS location
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons color={colors.mutedText} name="chevron-right" size={22} />
        </Pressable>

        <Pressable
          onPress={() => setShowAddressForm(current => !current)}
          style={styles.addAddressButton}>
          <View style={styles.addAddressLeft}>
            <View style={styles.addAddressIconWrap}>
              <MaterialCommunityIcons color="#7a4b12" name="plus" size={20} />
            </View>
            <Text style={styles.addAddressText}>Add new address</Text>
          </View>
          <MaterialCommunityIcons
            color={colors.mutedText}
            name={showAddressForm ? 'chevron-up' : 'chevron-down'}
            size={22}
          />
        </Pressable>

        {showAddressForm ? (
          <View style={styles.addressForm}>
            <Text style={styles.inputLabel}>Delivery address</Text>
            <TextInput
              multiline
              onChangeText={setAddressInput}
              placeholder="Flat, building, street, area"
              placeholderTextColor="#9a9a9a"
              style={styles.addressInput}
              value={addressInput}
            />
            <Pressable onPress={onSaveAddress} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save address</Text>
            </Pressable>
          </View>
        ) : null}

        {hasAddress ? (
          <View style={styles.savedAddressesSection}>
            <Text style={styles.sectionTitle}>Your saved addresses</Text>
            <View style={styles.addressCard}>
              <View style={styles.addressIconWrap}>
                <MaterialCommunityIcons color="#1f9d55" name="map-marker" size={22} />
              </View>
              <View style={styles.addressBody}>
                <Text style={styles.addressLabel}>Default address</Text>
                <Text style={styles.addressText}>{profile.address}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons color="#7a4b12" name="map-marker-plus-outline" size={30} />
            </View>
            <Text style={styles.emptyTitle}>No addresses yet</Text>
            <Text style={styles.emptyText}>
              Add a delivery address during checkout or from your cart to see it here.
            </Text>
          </View>
        )}
      </View>
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
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    gap: 14,
    padding: 16,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e8eadf',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    paddingLeft: 10,
    paddingVertical: 13,
  },
  currentLocationButton: {
    alignItems: 'center',
    backgroundColor: '#f5fbf7',
    borderColor: '#d8efdf',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  currentLocationLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  gpsIconWrap: {
    alignItems: 'center',
    backgroundColor: '#1f9d55',
    borderRadius: 14,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  currentLocationTextWrap: {
    flex: 1,
  },
  currentLocationTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  currentLocationSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  addAddressButton: {
    alignItems: 'center',
    borderColor: '#f0e5d4',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  addAddressLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  addAddressIconWrap: {
    alignItems: 'center',
    backgroundColor: '#fff5e8',
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  addAddressText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  addressForm: {
    borderColor: '#e8eadf',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  addressInput: {
    borderColor: '#e5e7eb',
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    minHeight: 92,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#1f9d55',
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 13,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  savedAddressesSection: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  addressCard: {
    alignItems: 'flex-start',
    borderColor: '#e8eadf',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 16,
  },
  addressIconWrap: {
    alignItems: 'center',
    backgroundColor: '#e8f8ee',
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    marginRight: 12,
    width: 44,
  },
  addressBody: {
    flex: 1,
  },
  addressLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  addressText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  emptyCard: {
    alignItems: 'center',
    borderColor: '#f0e5d4',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 34,
  },
  emptyIconWrap: {
    alignItems: 'center',
    backgroundColor: '#fff5e8',
    borderRadius: 24,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
});
