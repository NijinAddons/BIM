import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, Dimensions, FlatList, ListRenderItemInfo, StatusBar, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {ActionButton, AppRefreshControl, ProductCard, ProductFilterBar, ScreenHeader, useProductFilters} from '../../components';
import {isWishlisted} from '../../hooks/useWishlist';
import type {RootStackScreenProps} from '../../navigation/types';
import {useItemsByBrandGroup, useProductBundles} from '../../queries';
import type {CategoryItem} from '../../services';
import VariantAddSheet from './VariantAddSheet';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';

const NUM_COLUMNS = 2;
const GRID_PADDING = 16;
const GRID_GAP = 14;
const CARD_WIDTH = (Dimensions.get('window').width - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const keyExtractor = (item: CategoryItem) => item.id;
const EMPTY_ITEMS: CategoryItem[] = [];

type Props = RootStackScreenProps<'BrandCategoryItems'>;

/** One brand's products in one category, opened from a Brand screen card. */
const BrandCategoryItemsScreen = ({navigation, route}: Props) => {
  const {brand, itemGroup} = route.params;

  const itemsQuery = useItemsByBrandGroup(brand.id, itemGroup);
  const bundlesQuery = useProductBundles();
  // Kits have their own section on the Brand screen, so keep them out here.
  const items = useMemo(() => {
    const kitIds = new Set((bundlesQuery.data ?? []).map(bundle => bundle.item.id));
    return (itemsQuery.data ?? EMPTY_ITEMS).filter(item => !kitIds.has(item.id));
  }, [itemsQuery.data, bundlesQuery.data]);
  const filters = useProductFilters(items);

  // Variants of one product, keyed by their template (`variantOf`). A card
  // whose product comes in several variants picks one in a sheet on ADD TO
  // CART instead of adding straight away.
  const families = useMemo(() => {
    const map = new Map<string, CategoryItem[]>();
    for (const item of items) {
      if (item.variantOf) {
        map.set(item.variantOf, [...(map.get(item.variantOf) ?? []), item]);
      }
    }
    return map;
  }, [items]);
  const [sheetItem, setSheetItem] = useState<CategoryItem | null>(null);
  const openSheet = useCallback((item: CategoryItem) => setSheetItem(item), []);
  const closeSheet = useCallback(() => setSheetItem(null), []);
  const sheetFamily = useMemo(
    () => (sheetItem?.variantOf ? families.get(sheetItem.variantOf) ?? [sheetItem] : []),
    [families, sheetItem],
  );
  const loading = itemsQuery.isPending && !itemsQuery.isError;
  // A failed refetch keeps showing the items we already have.
  const error =
    itemsQuery.isError && !itemsQuery.data
      ? 'Could not load items. Check your connection and try again.'
      : null;
  const loadItems = useCallback(() => {
    itemsQuery.refetch();
  }, [itemsQuery]);

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<CategoryItem>) => (
      <View style={styles.cardWrapper}>
        <ProductCard
          item={item}
          onAddPress={
            item.variantOf && (families.get(item.variantOf)?.length ?? 0) > 1
              ? openSheet
              : undefined
          }
          onPress={() => navigation.navigate('ProductDetail', {item})}
          onToggleWishlist={() => {
            if (isWishlisted(item.id)) {
              navigation.navigate('Wishlist');
            }
          }}
        />
      </View>
    ),
    [navigation, families, openSheet],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />
      <ScreenHeader onBack={() => navigation.goBack()} title={`${brand.name} · ${itemGroup}`} />

      {loading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={ACCENT_TEAL} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons color="#C6CDD3" name="wifi-off" size={40} />
          <Text style={styles.errorText}>{error}</Text>
          <ActionButton label="Retry" onPress={loadItems} style={styles.retryButton} variant="dark" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons color="#C6CDD3" name="package-variant" size={40} />
          <Text style={styles.errorText}>No items in {itemGroup} yet.</Text>
        </View>
      ) : (
        <FlatList
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          data={filters.visibleItems}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          keyExtractor={keyExtractor}
          ListEmptyComponent={
            <View style={styles.noMatches}>
              <MaterialCommunityIcons color="#C6CDD3" name="magnify-close" size={40} />
              <Text style={styles.errorText}>No products match your search.</Text>
              <TouchableOpacity hitSlop={8} onPress={filters.clear}>
                <Text style={styles.clearFilters}>Clear filters</Text>
              </TouchableOpacity>
            </View>
          }
          ListHeaderComponent={
            <View style={styles.controls}>
              <ProductFilterBar filters={filters} placeholder={`Search in ${itemGroup}`} />
            </View>
          }
          numColumns={NUM_COLUMNS}
          refreshControl={
            <AppRefreshControl onRefresh={itemsQuery.refetch} />
          }
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}

      <VariantAddSheet family={sheetFamily} item={sheetItem} onClose={closeSheet} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  centeredState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
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
    paddingBottom: 32,
    paddingHorizontal: GRID_PADDING,
  },
  // The filter bar carries its own side gutter, so cancel the list's.
  controls: {
    marginHorizontal: -GRID_PADDING,
    paddingTop: GRID_PADDING,
  },
  noMatches: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  clearFilters: {
    color: ACCENT_TEAL,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 14,
  },
  row: {
    gap: GRID_GAP,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
});

export default BrandCategoryItemsScreen;
