import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
import {
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import ProductCard from '../../../components/ProductCard';
import ScreenHeader from '../../../components/ScreenHeader';
import {getUserProfile, subscribeProfile} from '../../profile/service';
import {fetchProducts, loadStoredProductCache, Product} from '../../product/service';

const TABLET_BREAKPOINT = 768;
const COORDINATE_LOCATION_PATTERN =
  /^Current location \((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/;

type CategoryDetailsRouteProp = RouteProp<RootStackParamList, 'CategoryDetails'>;
type CategoryDetailsNavProp = NativeStackNavigationProp<
  RootStackParamList,
  'CategoryDetails'
>;

const normalizeCategoryKey = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const isFruitOrVegetableCategory = (value: string) => {
  const normalizedValue = normalizeCategoryKey(value);

  return normalizedValue.includes('fruit') || normalizedValue.includes('veg');
};

const getLocationLabel = (address: string) => {
  const trimmedAddress = address.trim();

  if (!trimmedAddress || COORDINATE_LOCATION_PATTERN.test(trimmedAddress)) {
    return 'Select delivery location';
  }

  if (trimmedAddress.length > 48) {
    return `${trimmedAddress.slice(0, 48).trimEnd()}...`;
  }

  return trimmedAddress;
};

export default function CategoryDetailsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<CategoryDetailsNavProp>();
  const route = useRoute<CategoryDetailsRouteProp>();
  const {width: windowWidth} = useWindowDimensions();
  const profile = React.useSyncExternalStore(
    subscribeProfile,
    getUserProfile,
    getUserProfile,
  );
  const {categoryTitle} = route.params;
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const isTablet = windowWidth >= TABLET_BREAKPOINT;
  const productColumns = isTablet ? 3 : 2;
  const displayedLocation = getLocationLabel(profile.address);

  const filteredProducts = React.useMemo(() => {
    if (categoryTitle === 'Fruits & Vegetables') {
      return products.filter(product => isFruitOrVegetableCategory(product.itemGroup ?? ''));
    }

    const normalizedSelectedCategory = normalizeCategoryKey(categoryTitle);

    return products.filter(
      product => normalizeCategoryKey(product.itemGroup ?? '') === normalizedSelectedCategory,
    );
  }, [categoryTitle, products]);

  React.useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      const storedProducts = await loadStoredProductCache();

      if (isMounted && storedProducts.length > 0) {
        setProducts(storedProducts);
        setIsLoading(false);
      }

      const nextProducts = await fetchProducts({fallbackToMock: true, forceRefresh: true});

      if (!isMounted) {
        return;
      }

      setProducts(nextProducts);
      setIsLoading(false);
      setIsRefreshing(false);
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    const nextProducts = await fetchProducts({fallbackToMock: true, forceRefresh: true});

    setProducts(nextProducts);
    setIsRefreshing(false);
    setIsLoading(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F1C309" />
      <View style={[styles.headerBlock, {paddingTop: insets.top + 6}]}>
        <View style={styles.headerTitleBlock}>
          <ScreenHeader
            containerStyle={styles.headerCompact}
            onBackPress={() => navigation.goBack()}
            plainBackButton
            title={categoryTitle}
          />
          <Text numberOfLines={1} style={styles.locationText}>
            {displayedLocation}
          </Text>
        </View>
      </View>

      <FlatList
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {isLoading ? 'Loading products...' : `No products found in ${categoryTitle}.`}
            </Text>
          </View>
        }
        columnWrapperStyle={productColumns > 1 ? styles.productGridRow : undefined}
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + 24},
          filteredProducts.length === 0 && styles.contentEmpty,
        ]}
        data={filteredProducts}
        key={`${categoryTitle}-${productColumns}`}
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
  headerBlock: {
    backgroundColor: '#F1C309',
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerTitleBlock: {
    marginBottom: 2,
  },
  headerCompact: {
    marginBottom: 6,
  },
  locationText: {
    color: '#5A3D00',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 0,
    paddingLeft: 48,
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
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#fffaf0',
    borderColor: '#f2ddb0',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptyTitle: {
    color: '#1f1300',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
