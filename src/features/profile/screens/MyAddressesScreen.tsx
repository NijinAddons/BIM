import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
import {Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import {colors} from '../../../theme/colors';
import {
  buildSavedAddressDetailLines,
  deleteSavedAddress,
  getSavedAddressIconName,
  getSavedAddressType,
  getSavedAddresses,
  loadStoredAddresses,
  subscribeSavedAddresses,
} from '../service';

type MyAddressesNavProp = NativeStackNavigationProp<RootStackParamList, 'MyAddresses'>;

type Props = {
  navigation: MyAddressesNavProp;
};

export default function MyAddressesScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const savedAddresses = React.useSyncExternalStore(
    subscribeSavedAddresses,
    getSavedAddresses,
    getSavedAddresses,
  );

  React.useEffect(() => {
    loadStoredAddresses().catch(() => undefined);
  }, []);

  const addNewAddress = () => {
    navigation.navigate('ConfirmLocation', {mode: 'search'});
  };

  const editAddress = (item: ReturnType<typeof getSavedAddresses>[number]) => {
    setOpenMenuId(null);
    navigation.navigate('ConfirmLocation', {
      address: item.address,
      details: item.details,
      mode: 'search',
      savedAddressId: item.id,
    });
  };

  const confirmDeleteAddress = (item: ReturnType<typeof getSavedAddresses>[number]) => {
    setOpenMenuId(null);
    Alert.alert('Delete address', 'Do you want to remove this saved address?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteSavedAddress(item.id).catch(() => undefined);
        },
      },
    ]);
  };

  const toggleAddressActions = (itemId: string) => {
    setOpenMenuId(current => (current === itemId ? null : itemId));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={[styles.header, {paddingTop: insets.top + 10}]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons color={colors.text} name="arrow-left" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + 24},
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.contentScroll}>
        <Pressable onPress={addNewAddress} style={styles.addNewButton}>
          <MaterialCommunityIcons color="#2563eb" name="plus" size={18} />
          <Text style={styles.addNewText}>Add new</Text>
        </Pressable>

        {savedAddresses.length > 0 ? (
          <View style={styles.savedList}>
            {savedAddresses.map(item => (
              <View key={item.id} style={styles.addressRow}>
                <MaterialCommunityIcons
                  color="#1f9d55"
                  name={getSavedAddressIconName(item)}
                  size={18}
                />
                <View style={styles.addressBody}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{getSavedAddressType(item)}</Text>
                  </View>
                  {buildSavedAddressDetailLines(item).map((line, index) => (
                    <Text
                      key={`${item.id}-${index}`}
                      numberOfLines={index === 0 ? 1 : 2}
                      style={index === 0 ? styles.addressPrimaryText : styles.addressText}>
                      {line}
                    </Text>
                  ))}
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => toggleAddressActions(item.id)}
                  style={styles.addressMenuButton}>
                  <MaterialCommunityIcons
                    color={colors.mutedText}
                    name="dots-horizontal"
                    size={18}
                  />
                </Pressable>
                {openMenuId === item.id ? (
                  <View style={styles.addressMenuPopup}>
                    <Pressable
                      onPress={() => editAddress(item)}
                      style={styles.addressMenuItem}>
                      <Text style={styles.addressMenuText}>Edit</Text>
                    </Pressable>
                    <View style={styles.addressMenuDivider} />
                    <Pressable
                      onPress={() => confirmDeleteAddress(item)}
                      style={styles.addressMenuItem}>
                      <Text style={styles.addressMenuDeleteText}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
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
  contentScroll: {
    flex: 1,
  },
  content: {
    alignItems: 'flex-end',
    flexGrow: 1,
    gap: 20,
    padding: 16,
  },
  addNewButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  addNewText: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '800',
  },
  savedList: {
    alignSelf: 'stretch',
    gap: 16,
  },
  addressRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    position: 'relative',
  },
  addressMenuButton: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  addressMenuPopup: {
    backgroundColor: '#ffffff',
    borderColor: '#e8eadf',
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 120,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 28,
    zIndex: 10,
  },
  addressMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addressMenuText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  addressMenuDeleteText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
  },
  addressMenuDivider: {
    backgroundColor: '#eef1ea',
    height: 1,
  },
  addressBody: {
    flex: 1,
    gap: 4,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
  },
  addressPrimaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  addressText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
});
