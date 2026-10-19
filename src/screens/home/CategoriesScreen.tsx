import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {ActionButton, AppRefreshControl, NotificationBell, ProductCard, ScreenHeader} from '../../components';
import {useAuthStatus} from '../../hooks/useAuth';
import {bim} from '../../assets/images';
import {isWishlisted} from '../../hooks/useWishlist';
import type {CategoriesStackScreenProps} from '../../navigation/types';
import {invalidateCatalog, useCategories, useItemsByGroup} from '../../queries';
import {Category, CategoryItem, TOP_LEVEL_PARENT} from '../../services';
import {BORDER, CARD, GREEN, GREEN_TINT, MUTED, SURFACE, TEXT, TEXT_VARIANT} from '../../theme/colors';

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_ITEMS: CategoryItem[] = [];

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const LEGACY_MUTED = '#8A94A3';

// -- legacy (drill-down) grid layout, unchanged -------------------------------

const NUM_COLUMNS = 3;
const GRID_PADDING = 16;
const GRID_GAP = 12;
const TILE_SIZE = (Dimensions.get('window').width - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const LABEL_HEIGHT = 34;

// -- root (tab landing) sidebar + explore layout ------------------------------

const SIDEBAR_WIDTH = 84;
const ROOT_GRID_GAP = 12;
const ROOT_GRID_PADDING = 16;

const CATEGORY_ICON_RULES: Array<[RegExp, string]> = [
  [/super|grocery|food|mart/i, 'basket-outline'],
  [/electronic|mobile|phone|gadget/i, 'cellphone'],
  [/fashion|garment|apparel|cloth|wear/i, 'tshirt-crew-outline'],
  [/laptop|computer/i, 'laptop'],
  [/beauty|cosmetic|makeup/i, 'lipstick'],
  [/home|furniture|decor/i, 'sofa-outline'],
  [/baby|kid|toy/i, 'baby-face-outline'],
  [/sport|fitness/i, 'dumbbell'],
  [/print|stationary|stationery/i, 'printer-outline'],
  [/pharma|health|medic/i, 'pill'],
  [/vegetable|produce|fruit/i, 'carrot'],
  [/service|repair/i, 'tools'],
  [/book/i, 'book-outline'],
];

const getCategoryIcon = (name: string): string =>
  CATEGORY_ICON_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? 'shape-outline';

type Props = CategoriesStackScreenProps<'CategoriesList'>;

const CategoriesScreen = ({navigation, route}: Props) => {
  const parentId = route.params?.parentId ?? TOP_LEVEL_PARENT;
  const parentName = route.params?.parentName;
  const isRoot = !parentName;

  const categoriesQuery = useCategories();
  const allCategories = categoriesQuery.data ?? EMPTY_CATEGORIES;
  const loading = categoriesQuery.isPending;
  // A failed refetch keeps showing the list we already have.
  const error =
    categoriesQuery.isError && !categoriesQuery.data
      ? 'Could not load categories. Check your connection and try again.'
      : null;
  const loadCategories = useCallback(() => {
    categoriesQuery.refetch();
  }, [categoriesQuery]);
  // Pull-to-refresh reloads the whole catalog, not just the list on screen,
  // so every category picks up items (un)published since it was cached.
  const refreshCategories = invalidateCatalog;

  // Coming back to the Categories tab re-checks the catalog in the
  // background (the first focus is the initial load, so it's skipped).
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isRoot && focusedBefore.current) {
        invalidateCatalog();
      }
      focusedBefore.current = true;
    }, [isRoot]),
  );

  const categories = useMemo(
    () => allCategories.filter(category => category.parentId === parentId),
    [allCategories, parentId],
  );

  const handleCategoryPress = useCallback(
    (category: Category) => {
      if (category.isGroup) {
        navigation.push('CategoriesList', {parentId: category.id, parentName: category.name});
      } else {
        navigation.navigate('CategoryItems', {categoryName: category.name, itemGroup: category.id});
      }
    },
    [navigation],
  );

  const handleProductPress = useCallback(
    (item: CategoryItem) => navigation.navigate('ProductDetail', {item}),
    [navigation],
  );

  const handleProductWishlistToggle = useCallback(
    (item: CategoryItem) => {
      if (isWishlisted(item.id)) {
        navigation.navigate('Wishlist');
      }
    },
    [navigation],
  );

  if (isRoot) {
    return (
      <RootCategoriesView
        allCategories={allCategories}
        error={error}
        loading={loading}
        onLoadCategories={loadCategories}
        onRefreshCategories={refreshCategories}
        onSelectCategory={handleCategoryPress}
        onSelectProduct={handleProductPress}
        onToggleProductWishlist={handleProductWishlistToggle}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />
      <ScreenHeader onBack={() => navigation.goBack()} title={parentName ?? 'Categories'} />

      {loading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={ACCENT_TEAL} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons color="#C6CDD3" name="wifi-off" size={40} />
          <Text style={styles.errorText}>{error}</Text>
          <ActionButton label="Retry" onPress={loadCategories} style={styles.retryButton} variant="dark" />
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons color="#C6CDD3" name="shape-outline" size={40} />
          <Text style={styles.errorText}>No categories here yet.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <AppRefreshControl color={ACCENT_TEAL} onRefresh={refreshCategories} />
          }
          showsVerticalScrollIndicator={false}>
          <View style={styles.row}>
            {categories.map(category => (
              <CategoryTile key={category.id} category={category} onPress={handleCategoryPress} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Root tab layout: title header + left category rail + right explore pane.
// ---------------------------------------------------------------------------

type RootCategoriesViewProps = {
  allCategories: Category[];
  error: string | null;
  loading: boolean;
  onLoadCategories: () => void;
  onRefreshCategories: () => Promise<void>;
  onSelectCategory: (category: Category) => void;
  onSelectProduct: (item: CategoryItem) => void;
  onToggleProductWishlist: (item: CategoryItem) => void;
};

const RootCategoriesView = ({
  allCategories,
  error,
  loading,
  onLoadCategories,
  onRefreshCategories,
  onSelectCategory,
  onSelectProduct,
  onToggleProductWishlist,
}: RootCategoriesViewProps) => {
  const insets = useSafeAreaInsets();
  const isSignedIn = useAuthStatus() === 'signedIn';
  const [selectedTopId, setSelectedTopId] = useState<string | null>(null);

  const topCategories = useMemo(
    () => allCategories.filter(category => category.parentId === TOP_LEVEL_PARENT),
    [allCategories],
  );

  useEffect(() => {
    if (topCategories.length > 0 && (!selectedTopId || !topCategories.some(c => c.id === selectedTopId))) {
      setSelectedTopId(topCategories[0].id);
    }
  }, [topCategories, selectedTopId]);

  const selectedTop = useMemo(
    () => topCategories.find(category => category.id === selectedTopId) ?? null,
    [topCategories, selectedTopId],
  );

  const subCategories = useMemo(
    () => (selectedTopId ? allCategories.filter(category => category.parentId === selectedTopId) : []),
    [allCategories, selectedTopId],
  );
  const hasSubCategories = subCategories.length > 0;

  // Only a category with no sub-categories lists its products directly.
  const showsItems = !!selectedTopId && !hasSubCategories;
  const itemsQuery = useItemsByGroup(selectedTopId, {enabled: showsItems});
  const items = itemsQuery.data ?? EMPTY_ITEMS;
  const itemsLoading = showsItems && itemsQuery.isPending;
  const itemsError =
    itemsQuery.isError && !itemsQuery.data
      ? 'Could not load items. Check your connection and try again.'
      : null;
  const loadItems = useCallback(() => {
    itemsQuery.refetch();
  }, [itemsQuery]);


  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={CARD} />

      <View style={[styles.header, {paddingTop: insets.top + 16}]}>
        <Text style={styles.title}>Categories</Text>
        {isSignedIn ? <NotificationBell /> : null}
      </View>

      {loading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={GREEN} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons color="#C6CDD3" name="wifi-off" size={40} />
          <Text style={styles.errorText}>{error}</Text>
          <ActionButton label="Retry" onPress={onLoadCategories} style={styles.retryButton} variant="dark" />
        </View>
      ) : topCategories.length === 0 ? (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons color="#C6CDD3" name="shape-outline" size={40} />
          <Text style={styles.errorText}>No categories here yet.</Text>
        </View>
      ) : (
        <View style={styles.rootBody}>
          <ScrollView
            contentContainerStyle={styles.sidebarContent}
            showsVerticalScrollIndicator={false}
            style={styles.sidebar}
          >
            {topCategories.map(category => (
              <SidebarItem
                active={category.id === selectedTopId}
                category={category}
                key={category.id}
                onPress={() => setSelectedTopId(category.id)}
              />
            ))}
          </ScrollView>

          <ScrollView
            contentContainerStyle={styles.explorePane}
            refreshControl={<AppRefreshControl color={GREEN} onRefresh={onRefreshCategories} />}
            showsVerticalScrollIndicator={false}
            style={styles.exploreScroll}
          >
            {selectedTop ? <CategoryBanner category={selectedTop} key={selectedTop.id} /> : null}

            <View style={styles.section}>
              <Text allowFontScaling={false} style={styles.sectionTitle}>
                {selectedTop ? `EXPLORE ${selectedTop.name.toUpperCase()}` : 'EXPLORE'}
              </Text>
              {hasSubCategories ? (
                subCategories.length === 0 ? (
                  <Text style={styles.emptySubText}>Nothing here yet.</Text>
                ) : (
                  <View style={styles.subGrid}>
                    {subCategories.map(category => (
                      <SubcategoryTile category={category} key={category.id} onPress={onSelectCategory} />
                    ))}
                  </View>
                )
              ) : itemsLoading ? (
                <View style={styles.itemsLoadingBlock}>
                  <ActivityIndicator color={GREEN} />
                </View>
              ) : itemsError ? (
                <View style={styles.itemsLoadingBlock}>
                  <Text style={styles.errorText}>{itemsError}</Text>
                  <ActionButton label="Retry" onPress={loadItems} style={styles.retryButton} variant="dark" />
                </View>
              ) : items.length === 0 ? (
                <Text style={styles.emptySubText}>Nothing here yet.</Text>
              ) : (
                <View style={styles.productGrid}>
                  {items.map(item => (
                    <View key={item.id} style={styles.productCardWrapper}>
                      <ProductCard item={item} onPress={onSelectProduct} onToggleWishlist={onToggleProductWishlist} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

type SidebarItemProps = {
  active: boolean;
  category: Category;
  onPress: () => void;
};

const SidebarItem = React.memo(function SidebarItemComponent({active, category, onPress}: SidebarItemProps) {
  const [imageFailed, setImageFailed] = useState(!category.image);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.sidebarItem, active ? styles.sidebarItemActive : null]}
    >
      <View style={[styles.sidebarIconWrap, active ? styles.sidebarIconWrapActive : null]}>
        {category.image && !imageFailed ? (
          <FastImage
            onError={() => setImageFailed(true)}
            resizeMode={FastImage.resizeMode.cover}
            source={{uri: category.image}}
            style={styles.sidebarIconImage}
          />
        ) : (
          <MaterialCommunityIcons
            color={active ? GREEN : TEXT_VARIANT}
            name={getCategoryIcon(category.name)}
            size={22}
          />
        )}
      </View>
      <Text numberOfLines={2} style={[styles.sidebarLabel, active ? styles.sidebarLabelActive : null]}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
});

const CategoryBanner = React.memo(function CategoryBannerComponent({category}: {category: Category}) {
  const [imageFailed, setImageFailed] = useState(!category.image);

  if (!category.image || imageFailed) {
    return (
      <View style={[styles.banner, styles.bannerFallback]}>
        <MaterialCommunityIcons color={GREEN} name={getCategoryIcon(category.name)} size={36} />
        <Text allowFontScaling={false} numberOfLines={1} style={styles.bannerFallbackTitle}>
          {category.name.toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.banner}>
      <FastImage
        onError={() => setImageFailed(true)}
        resizeMode={FastImage.resizeMode.cover}
        source={{uri: category.image}}
        style={styles.bannerImage}
      />
      <View style={styles.bannerOverlay}>
        <Text allowFontScaling={false} numberOfLines={1} style={styles.bannerTitle}>
          {category.name.toUpperCase()}
        </Text>
      </View>
    </View>
  );
});

type SubcategoryTileProps = {
  category: Category;
  onPress: (category: Category) => void;
};

const SubcategoryTile = React.memo(function SubcategoryTileComponent({category, onPress}: SubcategoryTileProps) {
  const [imageFailed, setImageFailed] = useState(!category.image);
  const handlePress = useCallback(() => onPress(category), [onPress, category]);

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={handlePress} style={styles.subTile}>
      <View style={styles.subTileInner}>
        {category.image && !imageFailed ? (
          <FastImage
            onError={() => setImageFailed(true)}
            resizeMode={FastImage.resizeMode.cover}
            source={{uri: category.image}}
            style={styles.subTileImage}
          />
        ) : (
          <View style={[styles.subTileImage, styles.subTileFallback]}>
            <Image resizeMode="contain" source={bim} style={styles.subTilePlaceholder} />
          </View>
        )}
        <View style={styles.subTileChevron}>
          <MaterialCommunityIcons color="#FFFFFF" name="chevron-right" size={16} />
        </View>
        <View style={styles.subTileOverlay}>
          <Text allowFontScaling={false} numberOfLines={2} style={styles.subTileLabel}>
            {category.name}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Legacy drill-down grid tile (pushed levels below root).
// ---------------------------------------------------------------------------

type CategoryTileProps = {
  category: Category;
  onPress: (category: Category) => void;
};

type ImageStatus = 'error' | 'loaded' | 'loading';

const CategoryTile = React.memo(function CategoryTileComponent({category, onPress}: CategoryTileProps) {
  const [imageStatus, setImageStatus] = useState<ImageStatus>(category.image ? 'loading' : 'error');
  const handlePress = useCallback(() => onPress(category), [onPress, category]);

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={handlePress} style={styles.tileWrapper}>
      <View style={styles.imageShadow}>
        <View style={styles.imageBox}>
          {category.image ? (
            <FastImage
              onError={() => setImageStatus('error')}
              onLoad={() => setImageStatus('loaded')}
              resizeMode={FastImage.resizeMode.cover}
              source={{
                cache: FastImage.cacheControl.immutable,
                priority: FastImage.priority.normal,
                uri: category.image,
              }}
              style={styles.image}
            />
          ) : null}
          {imageStatus !== 'loaded' ? (
            <View style={styles.imageOverlay}>
              {imageStatus === 'loading' ? (
                <ActivityIndicator color={LEGACY_MUTED} size="small" />
              ) : (
                <Image resizeMode="contain" source={bim} style={styles.placeholderImage} />
              )}
            </View>
          ) : null}
        </View>
      </View>
      <Text numberOfLines={2} style={styles.tileLabel}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
});

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
    color: LEGACY_MUTED,
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

  // legacy grid
  listContent: {
    padding: GRID_PADDING,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    justifyContent: 'flex-start',
  },
  tileWrapper: {
    alignItems: 'center',
    width: TILE_SIZE,
  },
  imageShadow: {
    aspectRatio: 1,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#0F1B26',
    shadowOffset: {height: 4, width: 0},
    shadowOpacity: 0.06,
    shadowRadius: 12,
    width: '100%',
  },
  imageBox: {
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    flex: 1,
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  placeholderImage: {
    height: '52%',
    opacity: 0.35,
    width: '52%',
  },
  imageOverlay: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  tileLabel: {
    color: BRAND_NAVY,
    fontSize: 12.5,
    fontWeight: '700',
    height: LABEL_HEIGHT,
    marginTop: 8,
    textAlign: 'center',
  },

  // root: title header
  header: {
    alignItems: 'center',
    backgroundColor: CARD,
    borderBottomColor: BORDER,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  title: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '800',
  },

  // root: body (sidebar + explore pane)
  rootBody: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    backgroundColor: CARD,
    borderRightColor: BORDER,
    borderRightWidth: 1,
    flexGrow: 0,
    flexShrink: 0,
    width: SIDEBAR_WIDTH,
  },
  sidebarContent: {
    backgroundColor: SURFACE,
    flexGrow: 0,
    width: '100%',
  },
  sidebarItem: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 12,
  },
  sidebarItemActive: {
    backgroundColor: GREEN_TINT,
  },
  sidebarIconWrap: {
    alignItems: 'center',
    backgroundColor: CARD,
    borderColor: BORDER,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  sidebarIconWrapActive: {
    borderColor: GREEN,
  },
  sidebarIconImage: {
    height: '100%',
    width: '100%',
  },
  sidebarLabel: {
    color: TEXT_VARIANT,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  sidebarLabelActive: {
    color: GREEN,
    fontWeight: '800',
  },

  // root: explore pane
  exploreScroll: {
    flex: 1,
  },
  explorePane: {
    // Fills the pane so a short list can still be pulled to refresh.
    flexGrow: 1,
    paddingBottom: 32,
  },
  banner: {
    height: 130,
    marginTop: 12,
    overflow: 'hidden',
  },
  bannerImage: {
    height: '100%',
    width: '100%',
  },
  bannerFallback: {
    alignItems: 'center',
    backgroundColor: GREEN_TINT,
    gap: 8,
    justifyContent: 'center',
  },
  bannerFallbackTitle: {
    color: GREEN,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  bannerOverlay: {
    backgroundColor: 'rgba(8,24,40,0.42)',
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    right: 0,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  section: {
    marginTop: 22,
    paddingHorizontal: ROOT_GRID_PADDING,
  },
  sectionTitle: {
    color: TEXT_VARIANT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  emptySubText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '500',
  },
  subGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  itemsLoadingBlock: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCardWrapper: {
    marginBottom: ROOT_GRID_GAP,
    width: '48%',
  },
  subTile: {
    backgroundColor: CARD,
    borderRadius: 16,
    elevation: 2,
    marginBottom: ROOT_GRID_GAP,
    shadowColor: '#0F1B26',
    shadowOffset: {height: 4, width: 0},
    shadowOpacity: 0.08,
    shadowRadius: 10,
    width: '48%',
  },
  subTileInner: {
    borderColor: BORDER,
    borderRadius: 16,
    borderWidth: 1,
    height: 100,
    overflow: 'hidden',
  },
  subTileImage: {
    height: '100%',
    width: '100%',
  },
  subTileFallback: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    justifyContent: 'center',
  },
  subTilePlaceholder: {
    height: '40%',
    opacity: 0.3,
    width: '40%',
  },
  subTileChevron: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,24,40,0.45)',
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    top: 6,
    width: 22,
  },
  subTileOverlay: {
    backgroundColor: 'rgba(8,24,40,0.38)',
    bottom: 0,
    left: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'absolute',
    right: 0,
  },
  subTileLabel: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});

export default CategoriesScreen;
