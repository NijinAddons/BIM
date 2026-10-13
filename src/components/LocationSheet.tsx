import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {setManualLocation} from '../hooks/useLocation';
import {
  addressExtras,
  removeAddress,
  useAddresses,
  type SavedAddress,
} from '../hooks/useAddresses';
import {searchPlaces, type PlacePrediction} from '../services/location';
import AddressMapPicker from './AddressMapPicker';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';
const BORDER = '#E1E5EA';

type Props = {
  visible: boolean;
  onClose: () => void;
  // Distance from the screen top to sit below, e.g. a measured header height.
  // Defaults to just below the status bar when not given.
  topOffset?: number;
};

export default function LocationSheet({visible, onClose, topOffset}: Props) {
  const insets = useSafeAreaInsets();
  const saved = useAddresses();

  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const hasQuery = query.trim().length > 0;

  // Reset transient UI whenever the sheet is dismissed.
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setPredictions([]);
      setSearching(false);
      setMapOpen(false);
    }
  }, [visible]);

  // Debounced Google Places Autocomplete on the query.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setPredictions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(q, controller.signal)
        .then(setPredictions)
        .catch(() => setPredictions([]))
        .finally(() => setSearching(false));
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const chooseSaved = (entry: SavedAddress) => {
    setManualLocation({label: entry.label, address: entry.address});
    onClose();
  };

  const choosePrediction = (prediction: PlacePrediction) => {
    setManualLocation({
      label: prediction.primary,
      address: prediction.description,
    });
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.kav, {marginTop: topOffset ?? insets.top + 8}]}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />

            <View style={styles.titleRow}>
              <Text style={styles.title}>Delivery location</Text>
              <Pressable hitSlop={10} onPress={onClose}>
                <MaterialCommunityIcons color={MUTED} name="close" size={22} />
              </Pressable>
            </View>

            <View style={styles.searchField}>
              <MaterialCommunityIcons color={MUTED} name="magnify" size={18} />
              <TextInput
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="Search buildings, streets, areas"
                placeholderTextColor={MUTED}
                style={styles.searchInput}
                value={query}
              />
              {query.length > 0 ? (
                <Pressable hitSlop={8} onPress={() => setQuery('')}>
                  <MaterialCommunityIcons
                    color={MUTED}
                    name="close-circle"
                    size={16}
                  />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              contentContainerStyle={[
                styles.scrollBody,
                {paddingBottom: insets.bottom + 20},
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
            >
              {hasQuery ? (
                searching ? (
                  <View style={styles.searchStatus}>
                    <ActivityIndicator color={ACCENT_TEAL} size="small" />
                    <Text style={styles.searchStatusText}>Searching…</Text>
                  </View>
                ) : predictions.length === 0 ? (
                  <Text style={styles.emptyText}>No matching places.</Text>
                ) : (
                  predictions.map(prediction => (
                    <Pressable
                      android_ripple={{color: 'rgba(0,0,0,0.06)'}}
                      key={prediction.id}
                      onPress={() => choosePrediction(prediction)}
                      style={styles.row}
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
                          {prediction.primary}
                        </Text>
                        {prediction.secondary ? (
                          <Text numberOfLines={1} style={styles.rowSub}>
                            {prediction.secondary}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))
                )
              ) : (
                <>
                  {saved.length > 0 ? (
                    <Text style={styles.groupHeading}>Saved addresses</Text>
                  ) : null}

                  {saved.map(entry => (
                    <Pressable
                      android_ripple={{color: 'rgba(0,0,0,0.06)'}}
                      key={entry.id}
                      onPress={() => chooseSaved(entry)}
                      style={styles.row}
                    >
                      <View style={styles.rowIcon}>
                        <MaterialCommunityIcons
                          color={BRAND_NAVY}
                          name="map-marker-outline"
                          size={20}
                        />
                      </View>
                      <View style={styles.rowText}>
                        <Text style={styles.rowLabel}>{entry.label}</Text>
                        <Text numberOfLines={2} style={styles.rowSub}>
                          {entry.address}
                        </Text>
                        {addressExtras(entry) ? (
                          <Text numberOfLines={1} style={styles.rowNote}>
                            {addressExtras(entry)}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        hitSlop={10}
                        onPress={() => removeAddress(entry.id)}
                        style={styles.rowDelete}
                      >
                        <MaterialCommunityIcons
                          color={MUTED}
                          name="trash-can-outline"
                          size={18}
                        />
                      </Pressable>
                    </Pressable>
                  ))}

                  <Pressable
                    android_ripple={{color: 'rgba(0,0,0,0.06)'}}
                    onPress={() => setMapOpen(true)}
                    style={[styles.row, styles.addRow]}
                  >
                    <View style={styles.rowIcon}>
                      <MaterialCommunityIcons
                        color={ACCENT_TEAL}
                        name="plus-circle-outline"
                        size={20}
                      />
                    </View>
                    <Text style={styles.addRowText}>Add new address</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>

      <AddressMapPicker visible={mapOpen} onClose={() => setMapOpen(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(15,27,38,0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  kav: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  scroll: {
    flex: 1,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: BORDER,
    borderRadius: 3,
    height: 5,
    marginBottom: 14,
    width: 40,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: BRAND_NAVY,
    fontSize: 17,
    fontWeight: '800',
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: '#F2F4F6',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: BRAND_NAVY,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  scrollBody: {
    paddingTop: 8,
  },
  row: {
    alignItems: 'flex-start',
    borderBottomColor: BORDER,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
  },
  rowIcon: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    color: BRAND_NAVY,
    fontSize: 14.5,
    fontWeight: '700',
  },
  rowSub: {
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
  rowDelete: {
    padding: 2,
  },
  groupHeading: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 18,
    textTransform: 'uppercase',
  },
  emptyText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  searchStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 16,
  },
  searchStatusText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  addRow: {
    alignItems: 'center',
    borderBottomWidth: 0,
  },
  addRowText: {
    color: ACCENT_TEAL,
    fontSize: 14,
    fontWeight: '800',
    includeFontPadding: false,
  },
});
