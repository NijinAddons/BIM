import React, {useState} from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  ActionButton,
  AddressMapPicker,
  CustomAlert,
  ScreenHeader,
} from '../../components';
import {
  addressExtras,
  removeAddress,
  useAddresses,
  type SavedAddress,
} from '../../hooks/useAddresses';
import {setManualLocation, useLocation} from '../../hooks/useLocation';
import type {ProfileStackScreenProps} from '../../navigation/types';

const BRAND_NAVY = '#1F2E3D';
const MUTED = '#8A94A3';
const BORDER = '#E1E5EA';
const ACCENT = '#2ECFC0';

// Both flows are the same map + detail-form UI (AddressMapPicker); only
// `editing` (null vs a SavedAddress) tells it whether to create or patch.
type MapTarget = {mode: 'add'} | {mode: 'edit'; entry: SavedAddress};

type Props = ProfileStackScreenProps<'SavedAddresses'>;

export default function SavedAddressesScreen({navigation}: Props) {
  const saved = useAddresses();
  const {address: activeAddress} = useLocation();
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedAddress | null>(null);

  const selectAsDelivery = (entry: SavedAddress) => {
    setManualLocation({label: entry.label, address: entry.address});
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader onBack={() => navigation.goBack()} title="Saved addresses" />

      <FlatList
        contentContainerStyle={styles.listContent}
        data={saved}
        keyExtractor={entry => entry.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              color={MUTED}
              name="map-marker-off-outline"
              size={36}
            />
            <Text style={styles.emptyText}>No saved addresses yet.</Text>
          </View>
        }
        renderItem={({item}) => {
          const isSelected = activeAddress != null && activeAddress === item.address;
          return (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => selectAsDelivery(item)}
            style={[styles.row, isSelected && styles.rowSelected]}
          >
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons
                color={BRAND_NAVY}
                name="map-marker-outline"
                size={20}
              />
            </View>
            <View style={styles.rowText}>
              <Text numberOfLines={1} style={styles.rowLabel}>
                {item.label}
              </Text>
              <Text numberOfLines={2} style={styles.rowAddress}>
                {item.address}
              </Text>
              {addressExtras(item) ? (
                <Text numberOfLines={1} style={styles.rowNote}>
                  {addressExtras(item)}
                </Text>
              ) : null}
            </View>
            <View style={styles.rowActions}>
              <TouchableOpacity
                hitSlop={10}
                onPress={() => setMapTarget({mode: 'edit', entry: item})}
                style={styles.rowActionButton}
              >
                <MaterialCommunityIcons
                  color={MUTED}
                  name="pencil-outline"
                  size={18}
                />
              </TouchableOpacity>
              <TouchableOpacity
                hitSlop={10}
                onPress={() => setDeleteTarget(item)}
                style={styles.rowActionButton}
              >
                <MaterialCommunityIcons
                  color={MUTED}
                  name="trash-can-outline"
                  size={18}
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          );
        }}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <ActionButton
          accessory={
            <MaterialCommunityIcons color="#ffffff" name="plus" size={18} />
          }
          label="Add new address"
          onPress={() => setMapTarget({mode: 'add'})}
        />
      </View>

      <AddressMapPicker
        editing={mapTarget?.mode === 'edit' ? mapTarget.entry : null}
        onClose={() => setMapTarget(null)}
        visible={mapTarget !== null}
      />

      <CustomAlert
        icon="map-marker-remove-outline"
        message={`Remove "${deleteTarget?.label ?? ''}" from your saved addresses?`}
        onClose={() => setDeleteTarget(null)}
        onPrimaryButtonPress={() => {
          if (deleteTarget) {
            removeAddress(deleteTarget.id);
          }
        }}
        primaryButtonLabel="Remove"
        primaryButtonVariant="destructive"
        secondaryButtonLabel="Cancel"
        title="Remove address"
        visible={deleteTarget !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 80,
  },
  emptyText: {
    color: MUTED,
    fontSize: 13.5,
    fontWeight: '600',
  },
  row: {
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderColor: BORDER,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    padding: 14,
  },
  rowSelected: {
    borderColor: ACCENT,
    borderWidth: 2,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(31,46,61,0.08)',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    color: BRAND_NAVY,
    fontSize: 15,
    fontWeight: '700',
  },
  rowAddress: {
    color: MUTED,
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 2,
  },
  rowNote: {
    color: MUTED,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 14,
  },
  rowActionButton: {
    padding: 2,
  },
  footer: {
    borderTopColor: BORDER,
    borderTopWidth: 1,
    padding: 16,
  },
});
