import React, {useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ProductCard from '../../../components/ProductCard';
import ScreenHeader from '../../../components/ScreenHeader';
import {getUserProfile, subscribeProfile} from '../../profile/service';
import {fetchProducts, loadStoredProductCache, Product} from '../../product/service';
import {logger} from '../../../utils/logger';

const TABLET_BREAKPOINT = 768;

const BASE_HOME_HEADER_TABS = [
  {
    key: 'All',
    label: 'New',
    icon: 'shopping-outline',
    iconColor: '#5A3D00',
  },
  {
    key: 'Offers',
    label: 'Offers',
    icon: 'brightness-percent',
    iconColor: '#c2410c',
  },
] as const;

const normalizeCategoryKey = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const isFruitOrVegetableCategory = (value: string) => {
  const normalizedValue = normalizeCategoryKey(value);

  return normalizedValue.includes('fruit') || normalizedValue.includes('veg');
};

const COORDINATE_LOCATION_PATTERN =
  /^Current location \((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/;

const getHomeLocationLabel = (address: string) => {
  const trimmedAddress = address.trim();

  if (!trimmedAddress || COORDINATE_LOCATION_PATTERN.test(trimmedAddress)) {
    return 'Select delivery location';
  }

  if (trimmedAddress.length > 48) {
    return `${trimmedAddress.slice(0, 48).trimEnd()}...`;
  }

  return trimmedAddress;
};

const getCategoryTabPresentation = (category: string) => {
  const normalizedKey = normalizeCategoryKey(category);

  if (normalizedKey.includes('offer')) {
    return {icon: 'brightness-percent', iconColor: '#c2410c'};
  }

  if (normalizedKey.includes('fruit') || normalizedKey.includes('veg')) {
    return {icon: 'food-apple-outline', iconColor: '#117042'};
  }

  if (
    normalizedKey.includes('dairy') ||
    normalizedKey.includes('milk') ||
    normalizedKey.includes('egg')
  ) {
    return {icon: 'egg-outline', iconColor: '#006f86'};
  }

  if (
    normalizedKey.includes('atta') ||
    normalizedKey.includes('grocery') ||
    normalizedKey.includes('rice') ||
    normalizedKey.includes('flour')
  ) {
    return {icon: 'sack-outline', iconColor: '#9b6200'};
  }

  if (normalizedKey.includes('organic')) {
    return {icon: 'leaf', iconColor: '#15803d'};
  }

  if (normalizedKey.includes('snack') || normalizedKey.includes('biscuit')) {
    return {icon: 'cookie-outline', iconColor: '#7d1f4d'};
  }

  if (
    normalizedKey.includes('drink') ||
    normalizedKey.includes('beverage') ||
    normalizedKey.includes('juice')
  ) {
    return {icon: 'cup-outline', iconColor: '#0369a1'};
  }

  if (normalizedKey.includes('bakery') || normalizedKey.includes('bread')) {
    return {icon: 'bread-slice-outline', iconColor: '#b45309'};
  }

  if (normalizedKey.includes('meat') || normalizedKey.includes('chicken')) {
    return {icon: 'food-steak', iconColor: '#b91c1c'};
  }

  if (normalizedKey.includes('personalcare') || normalizedKey.includes('beauty')) {
    return {icon: 'bottle-tonic-outline', iconColor: '#7c3aed'};
  }

  return {icon: 'tag-outline', iconColor: '#5f5a52'};
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {height: windowHeight, width: windowWidth} = useWindowDimensions();
  const profile = React.useSyncExternalStore(
    subscribeProfile,
    getUserProfile,
    getUserProfile,
  );
  const [selectedTab, setSelectedTab] = useState<string>(
    BASE_HOME_HEADER_TABS[0].key,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const isTablet = windowWidth >= TABLET_BREAKPOINT;
  const isLandscape = windowWidth > windowHeight;
  const fixedTabGap = isTablet ? (isLandscape ? 12 : 8) : 8;
  const productColumns = isTablet ? 3 : 2;
  const displayedLocation = getHomeLocationLabel(profile.address);

  const headerTabs = useMemo(() => {
    const rawCategoryNames = Array.from(
      new Set(
        products
          .map(product => product.itemGroup?.trim())
          .filter((itemGroup): itemGroup is string => Boolean(itemGroup)),
      ),
    );
    const hasFruitOrVegetableCategory = rawCategoryNames.some(isFruitOrVegetableCategory);
    const normalizedCategoryNames = rawCategoryNames
      .filter(itemGroup => !isFruitOrVegetableCategory(itemGroup))
      .map(itemGroup => {
        const presentation = getCategoryTabPresentation(itemGroup);

        return {
          key: itemGroup,
          label: itemGroup,
          icon: presentation.icon,
          iconColor: presentation.iconColor,
        };
      });
    const categoryTabs = hasFruitOrVegetableCategory
      ? [
          {
            key: 'Fruits & Vegetables',
            label: 'Fruits & Vegetables',
            icon: 'food-apple-outline',
            iconColor: '#117042',
          },
          ...normalizedCategoryNames,
        ]
      : normalizedCategoryNames;

    return [
      BASE_HOME_HEADER_TABS[0],
      ...categoryTabs,
      BASE_HOME_HEADER_TABS[1],
    ];
  }, [products]);

  const shouldUseFullWidthTabs = headerTabs.length <= 5;

  useEffect(() => {
    if (!headerTabs.some(tab => tab.key === selectedTab)) {
      setSelectedTab('All');
    }
  }, [headerTabs, selectedTab]);

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      const storedProducts = await loadStoredProductCache();

      logger.log('Home tab stored products response', {
        count: storedProducts.length,
        products: storedProducts,
      });

      if (isMounted && storedProducts.length > 0) {
        setProducts(storedProducts);
        setIsLoadingProducts(false);
      }

      try {
        const nextProducts = await fetchProducts({
          fallbackToMock: false,
          forceRefresh: true,
        });

        logger.log('Home tab products API response', {
          count: nextProducts.length,
          products: nextProducts,
        });

        if (!isMounted) {
          return;
        }

        setProducts(nextProducts);
        setLoadError(
          nextProducts.length === 0 ? 'No products are available right now.' : '',
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setLoadError('Unable to load products right now.');
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false);
          setIsRefreshing(false);
        }
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const tabFilteredProducts =
      selectedTab === 'All'
        ? products
        : selectedTab === 'Offers'
          ? products.filter(product => {
              const offerTag = product.offerTag.trim().toLowerCase();
              const itemGroup = product.itemGroup?.trim().toLowerCase() ?? '';
              return offerTag.length > 0 && offerTag !== itemGroup;
            })
          : selectedTab === 'Fruits & Vegetables'
            ? products.filter(product =>
                isFruitOrVegetableCategory(product.itemGroup ?? ''),
              )
            : products.filter(product => {
                const selectedGroup = normalizeCategoryKey(selectedTab);
                return normalizeCategoryKey(product.itemGroup ?? '') === selectedGroup;
              });

    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    if (!normalizedSearchQuery) {
      return tabFilteredProducts;
    }

    return tabFilteredProducts.filter(product => {
      const searchableValues = [
        product.name,
        product.grams,
        product.itemGroup ?? '',
        product.offerTag,
      ];

      return searchableValues.some(value =>
        value.toLowerCase().includes(normalizedSearchQuery),
      );
    });
  }, [products, searchQuery, selectedTab]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLoadError('');

    try {
      const nextProducts = await fetchProducts({
        fallbackToMock: false,
        forceRefresh: true,
      });

      logger.log('Home tab products refresh response', {
        count: nextProducts.length,
        products: nextProducts,
      });

      setProducts(nextProducts);
      setLoadError(
        nextProducts.length === 0 ? 'No products are available right now.' : '',
      );
    } catch {
      setLoadError('Unable to refresh products right now.');
    } finally {
      setIsRefreshing(false);
      setIsLoadingProducts(false);
    }
  };

  const renderEmptyState = () => {
    if (isLoadingProducts) {
      return (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Loading products</Text>
          <Text style={styles.stateText}>Fetching the latest items for Home.</Text>
        </View>
      );
    }

    return (
      <View style={styles.stateCard}>
        <View style={styles.stateIconWrap}>
          <MaterialCommunityIcons color="#8a8376" name="basket-outline" size={28} />
        </View>
        <Text style={styles.stateTitle}>
          {loadError || `No products found in ${selectedTab}.`}
        </Text>
        <Text style={styles.stateText}>
          Pull down to retry or choose another tab.
        </Text>
      </View>
    );
  };

  const renderHeaderTab = (item: (typeof headerTabs)[number], index: number) => {
    const isActive = item.key === selectedTab;

    return (
      <Pressable
        key={item.key}
        onPress={() => setSelectedTab(item.key)}
        style={[
          styles.headerTab,
          shouldUseFullWidthTabs && styles.headerTabFixed,
          isTablet && !isLandscape && styles.headerTabPortrait,
          index < headerTabs.length - 1 && {marginRight: fixedTabGap},
          isActive && styles.headerTabActive,
        ]}>
        <View
          style={[
            styles.headerTabIcon,
            isActive && styles.headerTabIconActive,
          ]}>
          <MaterialCommunityIcons
            color={item.iconColor}
            name={item.icon}
            size={isActive ? 28 : 26}
          />
        </View>
        <Text
          numberOfLines={2}
          style={[
            styles.headerTabText,
            isActive && styles.headerTabTextActive,
          ]}>
          {item.label}
        </Text>
        {isActive ? <View style={styles.headerTabIndicator} /> : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#F1C309" barStyle="dark-content" />
      <View style={[styles.headerWrap, {paddingTop: insets.top + 12}]}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.appTitle}>Buy In Minutes</Text>
          <Text numberOfLines={1} style={styles.locationText}>
            {displayedLocation}
          </Text>
        </View>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons color="#7d6b41" name="magnify" size={20} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearchQuery}
            placeholder="Search for groceries"
            placeholderTextColor="#8a8376"
            style={styles.searchInput}
            value={searchQuery}
          />
          {searchQuery.length > 0 ? (
            <Pressable
              hitSlop={8}
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}>
              <MaterialCommunityIcons color="#7d6b41" name="close" size={16} />
            </Pressable>
          ) : null}
        </View>
        {shouldUseFullWidthTabs ? (
          <View style={styles.headerTabsFixedRow}>
            {headerTabs.map((item, index) => renderHeaderTab(item, index))}
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.headerTabsRow}
            data={headerTabs}
            horizontal
            keyExtractor={item => item.key}
            renderItem={({item, index}) => renderHeaderTab(item, index)}
            showsHorizontalScrollIndicator={false}
          />
        )}
      </View>
      <FlatList
        ListEmptyComponent={renderEmptyState}
        columnWrapperStyle={productColumns > 1 ? styles.productGridRow : undefined}
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + 24},
          filteredProducts.length === 0 && styles.contentEmpty,
        ]}
        data={filteredProducts}
        key={`${selectedTab}-${productColumns}`}
        keyExtractor={item => item.id}
        numColumns={productColumns}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        renderItem={({item}) => (
          <View
            style={[
              styles.productCardWrap,
              productColumns === 3 ? styles.productCardWrapTablet : styles.productCardWrapMobile,
            ]}>
            <ProductCard item={item} />
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  headerWrap: {
    backgroundColor: '#F1C309',
    paddingBottom: 0,
    paddingHorizontal: 16,
  },
  headerTabsRow: {
    alignItems: 'flex-end',
    paddingBottom: 0,
    paddingRight: 12,
    paddingTop: 2,
  },
  headerTabsFixedRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    paddingTop: 2,
  },
  headerTitleBlock: {
    marginBottom: 12,
  },
  appTitle: {
    color: '#1b1b1b',
    fontSize: 24,
    fontWeight: '900',
  },
  locationText: {
    color: '#5A3D00',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: '#fff8e6',
    borderColor: '#e7d6a8',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    color: '#3a3328',
    flex: 1,
    fontSize: 14,
    marginLeft: 10,
    paddingVertical: 0,
  },
  clearButton: {
    alignItems: 'center',
    backgroundColor: '#f2e7c0',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  headerTab: {
    alignItems: 'center',
    gap: 2,
    justifyContent: 'flex-start',
    minHeight: 72,
    minWidth: 74,
    opacity: 0.55,
    paddingBottom: 0,
    paddingHorizontal: 6,
    paddingTop: 4,
    position: 'relative',
  },
  headerTabFixed: {
    flex: 1,
    minWidth: 0,
  },
  headerTabPortrait: {
    minHeight: 78,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  headerTabActive: {
    opacity: 1,
  },
  headerTabIcon: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  headerTabIconActive: {
    opacity: 1,
  },
  headerTabText: {
    color: '#5A3D00',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
    minHeight: 28,
    textAlign: 'center',
    width: '100%',
  },
  headerTabTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  headerTabIndicator: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    bottom: 0,
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  contentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  productGridRow: {
    justifyContent: 'space-between',
  },
  productCardWrap: {
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  productCardWrapMobile: {
    width: '48%',
  },
  productCardWrapTablet: {
    width: '31.5%',
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: '#fffaf0',
    borderColor: '#f2ddb0',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  stateIconWrap: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginBottom: 12,
    width: 48,
  },
  stateTitle: {
    color: '#1f1300',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    color: '#6b5b3f',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },
});
