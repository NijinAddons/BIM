import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ListRenderItemInfo,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {ActionButton, ProductCard} from '../../components';
import {isWishlisted} from '../../hooks/useWishlist';
import type {RootStackScreenProps} from '../../navigation/types';
import {useCatalogItems} from '../../queries';
import type {CategoryItem} from '../../services';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';

const NUM_COLUMNS = 2;
const GRID_PADDING = 16;
const GRID_GAP = 14;
const CARD_WIDTH =
  (Dimensions.get('window').width -
    GRID_PADDING * 2 -
    GRID_GAP * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS;

const keyExtractor = (item: CategoryItem) => item.id;

type CatalogState = 'loading' | 'ready' | 'error';

type Props = RootStackScreenProps<'Search'>;

const SearchScreen = ({navigation}: Props) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  // Every leaf item group's items (shared with Home's rails through the
  // query cache) searched client-side — there's no free-text search
  // endpoint on the backend to call instead.
  const catalog = useCatalogItems();
  const allItems = catalog.items;
  const catalogState: CatalogState = catalog.isError
    ? 'error'
    : catalog.isPending
    ? 'loading'
    : 'ready';
  const loadCatalog = useCallback(() => {
    catalog.refetch();
  }, [catalog]);

  const trimmedQuery = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      trimmedQuery
        ? allItems.filter(item =>
            item.name.toLowerCase().includes(trimmedQuery),
          )
        : [],
    [allItems, trimmedQuery],
  );

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<CategoryItem>) => (
      <View style={styles.cardWrapper}>
        <ProductCard
          item={item}
          onPress={() => navigation.navigate('ProductDetail', {item})}
          onToggleWishlist={() => {
            if (isWishlisted(item.id)) {
              navigation.navigate('Wishlist');
            }
          }}
        />
      </View>
    ),
    [navigation],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />

      <View style={[styles.header, {paddingTop: insets.top + 10}]}>
        <Pressable
          hitSlop={8}
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <MaterialCommunityIcons
            color="#F5FAFC"
            name="chevron-left"
            size={24}
          />
        </Pressable>
        <View style={styles.searchPill}>
          <MaterialCommunityIcons color={MUTED} name="magnify" size={18} />
          <TextInput
            autoFocus
            onChangeText={setQuery}
            placeholder="Search for groceries, garments & more"
            placeholderTextColor={MUTED}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {query.length > 0 ? (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <MaterialCommunityIcons
                color={MUTED}
                name="close-circle"
                size={18}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {trimmedQuery === '' ? (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons color="#C6CDD3" name="magnify" size={40} />
          <Text style={styles.stateText}>
            Search for groceries, garments & more
          </Text>
        </View>
      ) : catalogState === 'loading' ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={ACCENT_TEAL} size="large" />
        </View>
      ) : catalogState === 'error' ? (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons color="#C6CDD3" name="wifi-off" size={40} />
          <Text style={styles.stateText}>
            Could not load products. Check your connection and try again.
          </Text>
          <ActionButton
            label="Retry"
            onPress={loadCatalog}
            style={styles.retryButton}
            variant="dark"
          />
        </View>
      ) : results.length === 0 ? (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons
            color="#C6CDD3"
            name="package-variant"
            size={40}
          />
          <Text style={styles.stateText}>
            No results for "{query.trim()}"
          </Text>
        </View>
      ) : (
        <FlatList
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          data={results}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          numColumns={NUM_COLUMNS}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  searchPill: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    color: BRAND_NAVY,
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  centeredState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  stateText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    minWidth: 140,
    paddingHorizontal: 24,
  },
  listContent: {
    gap: GRID_GAP,
    padding: GRID_PADDING,
    paddingBottom: 32,
  },
  row: {
    gap: GRID_GAP,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
});

export default SearchScreen;
