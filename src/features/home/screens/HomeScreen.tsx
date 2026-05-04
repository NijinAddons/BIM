import {
  CompositeNavigationProp,
  useNavigation,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleProp,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  BottomTabParamList,
  RootStackParamList,
} from '../../../app/navigation/types/root-navigation.types';
import {bim} from '../../../assets/images';
import { appConfig } from '../../../app/config/appConfig';
import { colors } from '../../../theme/colors';
import { logger } from '../../../utils/logger';
import {
  configureLocation,
  requestLocationPermission,
} from '../../../services/location/locationPermission.service';
import {
  addProductToCart,
  getCartItems,
  subscribeCart,
} from '../../cart/service';
import {
  getUserProfile,
  isUserProfileCompleted,
  setUserProfile,
  subscribeProfile,
} from '../../profile/service';
import { Product } from '../../product/types';
import {
  addWishlistItem,
  createWishlistItemFromProduct,
  fetchProducts,
  getWishlistItems,
  loadStoredWishlist,
  subscribeWishlist,
} from '../../product/service';

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type HeaderTheme = {
  background: string;
  shadow: string;
  accentText: string;
  avatarBackground: string;
  avatarText: string;
};

const headerThemes: Record<string, HeaderTheme> = {
  All: {
    background: '#7a4b12',
    shadow: '#3c1d02',
    accentText: '#f6dfb0',
    avatarBackground: '#f7edd5',
    avatarText: '#6a3e0f',
  },
  Summer: {
    background: '#ca7a16',
    shadow: '#7f4300',
    accentText: '#fff0be',
    avatarBackground: '#fff0c8',
    avatarText: '#8b4e00',
  },
  Electronics: {
    background: '#155e75',
    shadow: '#083847',
    accentText: '#d8f3ff',
    avatarBackground: '#d9f2fb',
    avatarText: '#0b4456',
  },
  Beauty: {
    background: '#a5486d',
    shadow: '#632742',
    accentText: '#ffe1ec',
    avatarBackground: '#ffe1ec',
    avatarText: '#7d2c4d',
  },
  Pharmacy: {
    background: '#2d6a4f',
    shadow: '#173728',
    accentText: '#dcf7de',
    avatarBackground: '#def5e3',
    avatarText: '#1f533c',
  },
};

const fallbackHeaderThemes: HeaderTheme[] = [
  {
    background: '#8b5a16',
    shadow: '#4c2c06',
    accentText: '#ffe7b6',
    avatarBackground: '#fff1d0',
    avatarText: '#6b3f08',
  },
  {
    background: '#146c43',
    shadow: '#073f25',
    accentText: '#dff8e7',
    avatarBackground: '#e3f8e9',
    avatarText: '#0d4f2f',
  },
  {
    background: '#0f5f6d',
    shadow: '#083942',
    accentText: '#d9f7ff',
    avatarBackground: '#dff7fb',
    avatarText: '#094451',
  },
  {
    background: '#8f3f52',
    shadow: '#54212e',
    accentText: '#ffe1e8',
    avatarBackground: '#ffe6ec',
    avatarText: '#6b2b3c',
  },
];

const getHeaderTheme = (tabKey: string): HeaderTheme => {
  const normalizedKey = tabKey.trim().toLowerCase();

  if (normalizedKey === 'all') {
    return headerThemes.All;
  }

  if (normalizedKey === 'atta' || normalizedKey.includes('grocery')) {
    return {
      background: '#8b5a16',
      shadow: '#4c2c06',
      accentText: '#ffe7b6',
      avatarBackground: '#fff1d0',
      avatarText: '#6b3f08',
    };
  }

  if (normalizedKey.includes('fruit') || normalizedKey.includes('veg')) {
    return {
      background: '#1f7a3f',
      shadow: '#0b4523',
      accentText: '#dcfce7',
      avatarBackground: '#e4f8e9',
      avatarText: '#14532d',
    };
  }

  if (normalizedKey.includes('dairy') || normalizedKey.includes('egg')) {
    return {
      background: '#0f6a7a',
      shadow: '#073f49',
      accentText: '#dff8ff',
      avatarBackground: '#e0f7fb',
      avatarText: '#07515e',
    };
  }

  if (normalizedKey.includes('meat') || normalizedKey.includes('poultry')) {
    return {
      background: '#9f3f33',
      shadow: '#5d1f18',
      accentText: '#ffe1dc',
      avatarBackground: '#ffe8e4',
      avatarText: '#7a291f',
    };
  }

  const themeIndex =
    normalizedKey
      .split('')
      .reduce((sum, character) => sum + character.charCodeAt(0), 0) %
    fallbackHeaderThemes.length;
  return fallbackHeaderThemes[themeIndex];
};

const getHeaderTabIcon = (label: string) => {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel === 'all') {
    return { icon: 'shopping-outline', iconColor: '#fff7e6' };
  }

  if (normalizedLabel.includes('fruit') || normalizedLabel.includes('veg')) {
    return { icon: 'food-apple-outline', iconColor: '#d7f7dd' };
  }

  if (normalizedLabel.includes('dairy') || normalizedLabel.includes('egg')) {
    return { icon: 'egg-outline', iconColor: '#fff0c8' };
  }

  if (normalizedLabel.includes('atta')) {
    return { icon: 'barley', iconColor: '#f6dfb0' };
  }

  if (normalizedLabel.includes('grocery')) {
    return { icon: 'sack-outline', iconColor: '#f6dfb0' };
  }

  return { icon: 'basket-outline', iconColor: '#d8f3ff' };
};

const getCategoryDisplayTitle = (title: string) => {
  return title;
};

const getCategorySortPriority = (title: string) => {
  const normalizedTitle = title.trim().toLowerCase();

  if (normalizedTitle === 'atta' || normalizedTitle.includes('grocery')) {
    return 0;
  }

  if (normalizedTitle === 'fruits & veg') {
    return 1;
  }

  return 2;
};

type ProductGroup = {
  title: string;
  products: Product[];
};

type HomeListItem =
  | { key: 'hero'; type: 'hero' }
  | { key: 'sticky'; type: 'sticky' }
  | { key: 'loading'; type: 'loading' }
  | { key: 'empty'; type: 'empty' }
  | { key: string; title: string; type: 'groupHeader' }
  | { key: string; products: Product[]; type: 'productRow' };

const PRODUCT_ROW_SIZE = 2;
const INITIAL_RENDER_CONTENT_ITEMS = 10;
const CONTENT_PAGE_SIZE = 8;

const chunkProducts = (items: Product[]) => {
  const rows: Product[][] = [];

  for (let index = 0; index < items.length; index += PRODUCT_ROW_SIZE) {
    rows.push(items.slice(index, index + PRODUCT_ROW_SIZE));
  }

  return rows;
};

type GeoPosition = {
  coords: {
    latitude: number;
    longitude: number;
  };
};

type GeoPositionError = {
  code?: number;
  message?: string;
};

type GoogleGeocodeResponse = {
  error_message?: string;
  results?: Array<{
    address_components?: Array<{
      long_name?: string;
      types?: string[];
    }>;
    formatted_address?: string;
  }>;
  status?: string;
};

type GeocodeResult = NonNullable<GoogleGeocodeResponse['results']>[number];
type AddressComponent = NonNullable<GeocodeResult['address_components']>[number];

type OpenStreetMapReverseGeocodeResponse = {
  address?: {
    city?: string;
    city_district?: string;
    county?: string;
    neighbourhood?: string;
    road?: string;
    state?: string;
    suburb?: string;
    town?: string;
    village?: string;
  };
  display_name?: string;
  name?: string;
};

const DASHBOARD_LOCATION_TIMEOUT_MS = 20000;
const GOOGLE_GEOCODE_TIMEOUT_MS = 12000;
const QUICK_DASHBOARD_LOCATION_TIMEOUT_MS = 2500;
const QUICK_DASHBOARD_LOCATION_MAX_AGE_MS = 900000;
const PRECISE_DASHBOARD_LOCATION_TIMEOUT_MS = 18000;
const PRECISE_DASHBOARD_LOCATION_MAX_AGE_MS = 60000;
const COORDINATE_LOCATION_PATTERN =
  /^Current location \((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/;

const getSavedCoordinateLocation = (address: string) => {
  const match = address.trim().match(COORDINATE_LOCATION_PATTERN);

  if (!match) {
    return null;
  }

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {latitude, longitude};
};

const getAddressComponent = (
  components: AddressComponent[] | undefined,
  type: string,
) => {
  if (!Array.isArray(components)) {
    return '';
  }

  const match = components.find(component => component.types?.includes(type));
  return match?.long_name?.trim() ?? '';
};

const buildDashboardLocationLabel = (result?: GeocodeResult) => {
  if (!result) {
    return '';
  }

  const components = result.address_components;
  const parts = [
    getAddressComponent(components, 'neighborhood') ||
      getAddressComponent(components, 'sublocality_level_1') ||
      getAddressComponent(components, 'sublocality'),
    getAddressComponent(components, 'locality'),
    getAddressComponent(components, 'administrative_area_level_1'),
    getAddressComponent(components, 'country'),
  ]
    .map(part => part.trim())
    .filter(Boolean)
    .filter((part, index, array) => array.indexOf(part) === index);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return result.formatted_address?.trim() ?? '';
};

const LEGACY_ADDRESS_FIELD_PATTERN = /^(phone|email|landmark)\s*:/i;

const isLikelyPersonNameSegment = (segment: string) => {
  const normalizedSegment = segment.trim();

  if (!normalizedSegment) {
    return false;
  }

  if (/\d/.test(normalizedSegment)) {
    return false;
  }

  const normalizedWords = normalizedSegment
    .split(/\s+/)
    .filter(Boolean);

  if (normalizedWords.length === 0 || normalizedWords.length > 4) {
    return false;
  }

  return normalizedWords.every(word => /^[A-Za-z.'-]+$/.test(word));
};

const getHeaderLocationLabel = (address: string) => {
  const trimmedAddress = address.trim();

  if (!trimmedAddress || getSavedCoordinateLocation(trimmedAddress)) {
    return '';
  }

  const parts = trimmedAddress
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => !LEGACY_ADDRESS_FIELD_PATTERN.test(part));

  if (parts.length === 0) {
    return '';
  }

  const normalizedParts =
    parts.length > 1 && isLikelyPersonNameSegment(parts[0])
      ? parts.slice(1)
      : parts;

  return normalizedParts.join(', ');
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const hasRequestedDashboardLocation = useRef(false);
  const listRef = useRef<FlatList<HomeListItem>>(null);
  const cartItems = useSyncExternalStore(
    subscribeCart,
    getCartItems,
    getCartItems,
  );
  const profile = useSyncExternalStore(
    subscribeProfile,
    getUserProfile,
    getUserProfile,
  );
  const [wishlistIds, setWishlistIds] = useState<string[]>(
    getWishlistItems().map(item => item.id),
  );
  const [selectedHeaderTab, setSelectedHeaderTab] = useState('All');
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [visibleContentCount, setVisibleContentCount] = useState(
    INITIAL_RENDER_CONTENT_ITEMS,
  );
  const deferredFeaturedProducts = useDeferredValue(featuredProducts);
  const cartIndicatorAnimation = useRef(new Animated.Value(0)).current;
  const deliveryDigitAnimation = useRef(new Animated.Value(0)).current;
  const skeletonPulseAnimation = useRef(new Animated.Value(0)).current;

  const productGroups = React.useMemo<ProductGroup[]>(() => {
    const groups = new Map<string, Product[]>();

    deferredFeaturedProducts.forEach(product => {
      const itemGroup = product.itemGroup?.trim() || 'Other';
      const groupProducts = groups.get(itemGroup) ?? [];
      groups.set(itemGroup, [...groupProducts, product]);
    });

    return Array.from(groups, ([title, products]) => ({ title, products })).sort(
      (left, right) => {
        const priorityDifference =
          getCategorySortPriority(left.title) - getCategorySortPriority(right.title);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return left.title.localeCompare(right.title);
      },
    );
  }, [deferredFeaturedProducts]);
  const headerTabs = React.useMemo(
    () => [
      { key: 'All', label: 'All', ...getHeaderTabIcon('All') },
      ...productGroups.map(group => ({
        key: group.title,
        label: getCategoryDisplayTitle(group.title),
        ...getHeaderTabIcon(group.title),
      })),
    ],
    [productGroups],
  );
  const displayedProductGroups = React.useMemo(
    () =>
      selectedHeaderTab === 'All'
        ? productGroups
        : productGroups.filter(group => group.title === selectedHeaderTab),
    [productGroups, selectedHeaderTab],
  );
  const isAllHeaderTabSelected = selectedHeaderTab === 'All';
  const contentItems = React.useMemo<HomeListItem[]>(() => {
    if (isLoadingProducts) {
      return [{ key: 'loading', type: 'loading' }];
    }

    if (displayedProductGroups.length === 0) {
      return [{ key: 'empty', type: 'empty' }];
    }

    if (isAllHeaderTabSelected) {
      return displayedProductGroups.flatMap(group => {
        const productRows = chunkProducts(group.products).map((products, index) => ({
          key: `${group.title}-row-${index}`,
          products,
          type: 'productRow' as const,
        }));

        return [
          {
            key: `group-header-${group.title}`,
            title: group.title,
            type: 'groupHeader' as const,
          },
          ...productRows,
        ];
      });
    }

    return chunkProducts(
      displayedProductGroups.flatMap(group => group.products),
    ).map((products, index) => ({
      key: `filtered-row-${selectedHeaderTab}-${index}`,
      products,
      type: 'productRow' as const,
    }));
  }, [displayedProductGroups, isAllHeaderTabSelected, isLoadingProducts, selectedHeaderTab]);
  const visibleContentItems = React.useMemo(
    () => contentItems.slice(0, visibleContentCount),
    [contentItems, visibleContentCount],
  );
  const listData = React.useMemo<HomeListItem[]>(
    () => [
      { key: 'hero', type: 'hero' },
      { key: 'sticky', type: 'sticky' },
      ...visibleContentItems,
    ],
    [visibleContentItems],
  );

  const renderFeaturedProductCard = (
    item: Product,
    cardStyle?: StyleProp<ViewStyle>,
  ) => {
    const shouldShowOfferTag =
      item.offerTag.trim().toLowerCase() !== item.itemGroup?.trim().toLowerCase();

    return (
      <Pressable
        key={item.id}
        onPress={() => navigation.navigate('ProductDetails', { product: item })}
        style={[styles.featuredProductCard, cardStyle]}
      >
        <View
          style={[
            styles.featuredProductImageWrap,
            { backgroundColor: item.tone },
          ]}
        >
          <Image
            source={{ uri: item.image }}
            style={styles.featuredProductImage}
          />
          {shouldShowOfferTag ? (
            <View style={styles.featuredProductBadge}>
              <Text style={styles.featuredProductBadgeText}>{item.offerTag}</Text>
            </View>
          ) : null}
          <Pressable
            hitSlop={8}
            onPress={event => {
              event.stopPropagation();
              onPressWishlist(item);
            }}
            style={styles.featuredWishlistButton}
          >
            <MaterialCommunityIcons
              color={wishlistIds.includes(item.id) ? '#ef4662' : '#7a7a7a'}
              name={wishlistIds.includes(item.id) ? 'heart' : 'heart-outline'}
              size={17}
            />
          </Pressable>
        </View>
        <Text numberOfLines={1} style={styles.featuredProductName}>
          {item.name}
        </Text>
        <Text style={styles.featuredProductMeta}>{item.grams}</Text>
        <View style={styles.featuredProductFooter}>
          <View style={styles.featuredProductPriceWrap}>
            <Text style={styles.featuredProductPrice}>AED {item.price}</Text>
            <Text style={styles.featuredProductSellerCount}>
              Sellers: {item.totalSellers}
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={event => {
              event.stopPropagation();
              addProductToCart(item);
            }}
            style={({ pressed }) => [
              styles.featuredProductAddButton,
              pressed && styles.featuredProductAddButtonPressed,
            ]}
          >
            {({ pressed }) => (
              <Text
                style={[
                  styles.featuredProductAddText,
                  pressed && styles.featuredProductAddTextPressed,
                ]}
              >
                Add
              </Text>
            )}
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const onPressWishlist = async (product: Product) => {
    await addWishlistItem(createWishlistItemFromProduct(product));
    setWishlistIds(current =>
      current.includes(product.id) ? current : [...current, product.id],
    );
    navigation.navigate('Wishlist');
  };

  const getDashboardPosition = (
    options: Parameters<typeof Geolocation.getCurrentPosition>[2],
  ) =>
    new Promise<GeoPosition>((resolve, reject) => {
      let isSettled = false;
      const timeout = setTimeout(() => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        reject(new Error('Dashboard location request timed out.'));
      }, DASHBOARD_LOCATION_TIMEOUT_MS);

      Geolocation.getCurrentPosition(
        position => {
          if (isSettled) {
            return;
          }

          isSettled = true;
          clearTimeout(timeout);
          resolve(position);
        },
        (error: GeoPositionError) => {
          if (isSettled) {
            return;
          }

          isSettled = true;
          clearTimeout(timeout);
          reject(
            new Error(
              error.message || `Location failed with code ${error.code ?? 'unknown'}.`,
            ),
          );
        },
        {
          ...options,
        },
      );
    });

  const getDashboardLocationLabel = async (
    latitude: number,
    longitude: number,
  ) => {
    const response = await Promise.race([
      fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${appConfig.googleMapsApiKey}`,
      ),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Google Maps geocoding timed out.')),
          GOOGLE_GEOCODE_TIMEOUT_MS,
        );
      }),
    ]);

    const data = (await response.json()) as GoogleGeocodeResponse;

    if (!response.ok || data.status !== 'OK') {
      throw new Error(
        data.error_message ||
          `Google Maps could not resolve your current location: ${data.status}`,
      );
    }

    const result = data.results?.[0];
    const label = buildDashboardLocationLabel(result);

    if (!label) {
      throw new Error('Google Maps did not return a formatted address.');
    }

    return label;
  };

  const getFallbackLocationLabel = async (
    latitude: number,
    longitude: number,
  ) => {
    const response = await Promise.race([
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      ),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Fallback reverse geocoding timed out.')),
          GOOGLE_GEOCODE_TIMEOUT_MS,
        );
      }),
    ]);
    const data = (await response.json()) as OpenStreetMapReverseGeocodeResponse;

    if (data.display_name) {
      return data.display_name;
    }

    const addressParts = [
      data.address?.road,
      data.address?.neighbourhood,
      data.address?.suburb,
      data.address?.city_district,
      data.address?.city || data.address?.town || data.address?.village,
      data.address?.state,
    ].filter(Boolean);

    if (addressParts.length) {
      return addressParts.join(', ');
    }

    if (data.name) {
      return data.name;
    }

    throw new Error('Fallback reverse geocoder did not return an address.');
  };

  useEffect(() => {
    let isMounted = true;

    const resolveDashboardLocation = async () => {
      const savedCoordinateLocation = getSavedCoordinateLocation(profile.address);

      if (
        (profile.address.trim() && !savedCoordinateLocation) ||
        hasRequestedDashboardLocation.current
      ) {
        return;
      }

      hasRequestedDashboardLocation.current = true;
      configureLocation();

      try {
        let nextLocation = savedCoordinateLocation;

        if (!nextLocation) {
          const hasPermission = await requestLocationPermission();

          if (!hasPermission || !isMounted) {
            return;
          }

          try {
            const quickPosition = await getDashboardPosition({
              enableHighAccuracy: false,
              maximumAge: QUICK_DASHBOARD_LOCATION_MAX_AGE_MS,
              timeout: QUICK_DASHBOARD_LOCATION_TIMEOUT_MS,
            });
            nextLocation = quickPosition.coords;
          } catch (quickLocationError) {
            logger.log(
              'Home dashboard quick location lookup failed',
              quickLocationError,
            );
          }

          if (!nextLocation) {
            const precisePosition = await getDashboardPosition({
              enableHighAccuracy: true,
              maximumAge: PRECISE_DASHBOARD_LOCATION_MAX_AGE_MS,
              timeout: PRECISE_DASHBOARD_LOCATION_TIMEOUT_MS,
            });
            nextLocation = precisePosition.coords;
          }
        }

        const {latitude, longitude} = nextLocation;

        if (!isMounted) {
          return;
        }

        let locationLabel = '';

        try {
          locationLabel = await getDashboardLocationLabel(latitude, longitude);
        } catch (error) {
          logger.log('Home dashboard Google Maps reverse geocode failed', error);
          locationLabel = await getFallbackLocationLabel(latitude, longitude);
        }

        logger.log('Home dashboard fetched location', locationLabel || null);

        if (!isMounted) {
          return;
        }

        await setUserProfile({
          ...getUserProfile(),
          address: locationLabel,
        });
      } catch (error) {
        logger.log('Home dashboard location lookup failed', error);
      }
    };

    resolveDashboardLocation();

    return () => {
      isMounted = false;
    };
  }, [profile.address]);

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      logger.log('Home tab product fetch started', {
        feedMethod: appConfig.allProductsFeedMethod,
        pageUrl: appConfig.allProductsPageUrl,
      });

      if (isMounted) {
        setIsLoadingProducts(true);
      }

      const nextProducts = await fetchProducts({ fallbackToMock: false });

      logger.log('Home tab product fetch mapped response', {
        count: nextProducts.length,
        itemGroups: nextProducts.reduce<Record<string, number>>(
          (acc, product) => {
            const itemGroup = product.itemGroup?.trim() || 'Other';
            acc[itemGroup] = (acc[itemGroup] ?? 0) + 1;
            return acc;
          },
          {},
        ),
        products: nextProducts,
      });

      if (isMounted) {
        setFeaturedProducts(nextProducts);
        setIsLoadingProducts(false);
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const syncWishlist = async () => {
      const items = await loadStoredWishlist();

      if (isMounted) {
        setWishlistIds(items.map(item => item.id));
      }
    };

    syncWishlist();

    const unsubscribe = subscribeWishlist(() => {
      setWishlistIds(getWishlistItems().map(item => item.id));
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const renderProductLoadingState = () => (
    <View style={styles.loadingProductsWrap}>
      {[0, 1].map(sectionIndex => (
        <View
          key={`loading-section-${sectionIndex}`}
          style={styles.loadingSectionBlock}
        >
          <Animated.View
            style={[
              styles.skeletonBase,
              styles.loadingProductsTitleSkeleton,
              skeletonAnimatedStyle,
            ]}
          />
          <View style={styles.loadingProductsGrid}>
            {[0, 1].map(cardIndex => (
              <View
                key={`loading-card-${sectionIndex}-${cardIndex}`}
                style={styles.loadingProductCard}
              >
                <Animated.View
                  style={[
                    styles.skeletonBase,
                    styles.loadingProductBadge,
                    skeletonAnimatedStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.skeletonBase,
                    styles.loadingProductImage,
                    skeletonAnimatedStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.skeletonBase,
                    styles.loadingProductLineLarge,
                    skeletonAnimatedStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.skeletonBase,
                    styles.loadingProductLineSmall,
                    skeletonAnimatedStyle,
                  ]}
                />
                <View style={styles.loadingProductFooter}>
                  <View style={styles.loadingProductPriceWrap}>
                    <Animated.View
                      style={[
                        styles.skeletonBase,
                        styles.loadingProductPriceLine,
                        skeletonAnimatedStyle,
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.skeletonBase,
                        styles.loadingProductSellerLine,
                        skeletonAnimatedStyle,
                      ]}
                    />
                  </View>
                  <Animated.View
                    style={[
                      styles.skeletonBase,
                      styles.loadingProductButton,
                      skeletonAnimatedStyle,
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  useEffect(() => {
    if (
      selectedHeaderTab !== 'All' &&
      !productGroups.some(group => group.title === selectedHeaderTab)
    ) {
      setSelectedHeaderTab('All');
    }
  }, [productGroups, selectedHeaderTab]);

  useEffect(() => {
    setVisibleContentCount(
      Math.min(INITIAL_RENDER_CONTENT_ITEMS, contentItems.length),
    );
  }, [contentItems]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(deliveryDigitAnimation, {
          duration: 260,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(deliveryDigitAnimation, {
          duration: 260,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.delay(1100),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [deliveryDigitAnimation]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(cartIndicatorAnimation, {
          duration: 520,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(cartIndicatorAnimation, {
          duration: 520,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.delay(900),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [cartIndicatorAnimation]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulseAnimation, {
          duration: 700,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonPulseAnimation, {
          duration: 700,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [skeletonPulseAnimation]);

  const statusBarTopInset =
    Platform.OS === 'android'
      ? insets.top || StatusBar.currentHeight || 0
      : insets.top;
  const stickyHeaderStyle = {
    paddingTop: Platform.OS === 'android' ? statusBarTopInset + 2 : 2,
  };
  const selectedHeaderTheme = getHeaderTheme(selectedHeaderTab);
  const displayedLocation = getHeaderLocationLabel(profile.address);
  const profileName = profile.name.trim();
  const shouldShowGuestAvatar =
    !isUserProfileCompleted() || !profileName || profileName === 'BIM User';
  const profileInitial = profileName.charAt(0).toUpperCase();
  const cartItemCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const cartPreviewItems = cartItems.slice(0, 3);
  const cartArrowAnimatedStyle = {
    opacity: cartIndicatorAnimation.interpolate({
      inputRange: [0, 0.45, 1],
      outputRange: [1, 0.2, 0],
    }),
    transform: [
      {
        translateX: cartIndicatorAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 10],
        }),
      },
      {
        scale: cartIndicatorAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.84],
        }),
      },
    ],
  };
  const deliveryDigitAnimatedStyle = {
    opacity: deliveryDigitAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.9, 1],
    }),
    transform: [
      {
        scale: deliveryDigitAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.12],
        }),
      },
      {
        translateY: deliveryDigitAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -1],
        }),
      },
    ],
  };
  const cartMascotAnimatedStyle = {
    opacity: cartIndicatorAnimation.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [0, 0.2, 1],
    }),
    transform: [
      {
        translateX: cartIndicatorAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, 0],
        }),
      },
      {
        rotate: cartIndicatorAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: ['-10deg', '0deg'],
        }),
      },
      {
        scale: cartIndicatorAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.84, 1],
        }),
      },
    ],
  };
  const skeletonAnimatedStyle = {
    opacity: skeletonPulseAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.45, 0.95],
    }),
  };

  const renderHeroHeader = () => (
    <View
      style={[
        styles.heroTop,
        {
          backgroundColor: selectedHeaderTheme.background,
          paddingTop: statusBarTopInset + 8,
        },
      ]}
    >
      <View style={styles.deliveryRow}>
        <Pressable
          onPress={() => navigation.navigate('ConfirmLocation', {mode: 'search'})}
          style={styles.locationPressable}
        >
          <View style={styles.metaRow}>
            <Text style={styles.deliveryEta}>
              Buy in{' '}
              <Animated.Text
                style={[styles.deliveryEtaTime, deliveryDigitAnimatedStyle]}
              >
                8
              </Animated.Text>{' '}
              Minutes
            </Text>
          </View>
          {displayedLocation ? (
            <View style={styles.locationRow}>
              <Text
                style={[
                  styles.locationText,
                  { color: selectedHeaderTheme.accentText },
                ]}
              >
                {displayedLocation}
              </Text>
              <MaterialCommunityIcons
                color={selectedHeaderTheme.accentText}
                name="chevron-down"
                size={12}
                style={styles.locationChevron}
              />
            </View>
          ) : null}
        </Pressable>
        <View
          style={[
            styles.avatarBadge,
            {
              backgroundColor: selectedHeaderTheme.avatarBackground,
              shadowColor: selectedHeaderTheme.shadow,
            },
          ]}
        >
          {shouldShowGuestAvatar ? (
            <MaterialCommunityIcons
              color={selectedHeaderTheme.avatarText}
              name="account-outline"
              size={20}
            />
          ) : (
            <Text
              style={[
                styles.avatarText,
                { color: selectedHeaderTheme.avatarText },
              ]}
            >
              {profileInitial}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  const renderStickyHeader = () => (
    <View
      style={[
        styles.stickyHeaderWrap,
        stickyHeaderStyle,
        {
          backgroundColor: selectedHeaderTheme.background,
          shadowColor: selectedHeaderTheme.shadow,
        },
      ]}
    >
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          placeholder="Search for milk, bread, fruits"
          placeholderTextColor="#737373"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.headerTabsSection}>
        <FlatList
          contentContainerStyle={styles.headerTabsRow}
          data={headerTabs}
          horizontal
          keyExtractor={item => item.key}
          renderItem={({item}) => {
            const isActive = item.key === selectedHeaderTab;

            return (
              <Pressable
                onPress={() => {
                  React.startTransition(() => {
                    setSelectedHeaderTab(item.key);
                  });
                  listRef.current?.scrollToOffset({animated: true, offset: 0});
                }}
                style={[
                  styles.headerTab,
                  isActive && styles.headerTabActive,
                ]}
              >
                <View
                  style={[
                    styles.headerTabIcon,
                    isActive && styles.headerTabIconActive,
                  ]}
                >
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
                  ]}
                >
                  {item.label}
                </Text>
                {isActive ? (
                  <View
                    style={[
                      styles.headerTabIndicator,
                      item.key === 'All' && styles.headerTabIndicatorFirst,
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          }}
          removeClippedSubviews={false}
          showsHorizontalScrollIndicator={false}
          style={styles.headerTabsScroll}
        />
      </View>
    </View>
  );

  const loadMoreProducts = () => {
    if (isLoadingProducts || visibleContentCount >= contentItems.length) {
      return;
    }

    setVisibleContentCount(current =>
      Math.min(current + CONTENT_PAGE_SIZE, contentItems.length),
    );
  };

  const renderListFooter = () => {
    if (isLoadingProducts || visibleContentCount >= contentItems.length) {
      return <View style={styles.listFooterSpacer} />;
    }

    return (
      <View style={styles.paginationFooter}>
        <ActivityIndicator color="#7a4b12" size="small" />
        <Text style={styles.paginationFooterText}>Loading more products...</Text>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar
        backgroundColor={
          Platform.OS === 'android'
            ? 'transparent'
            : selectedHeaderTheme.background
        }
        barStyle="light-content"
        translucent={Platform.OS === 'android'}
      />
      <FlatList
        bounces={false}
        contentContainerStyle={[
          styles.contentContainer,
          {paddingBottom: insets.bottom + (cartItemCount > 0 ? 108 : 24)},
        ]}
        data={listData}
        initialNumToRender={12}
        keyExtractor={item => item.key}
        ListFooterComponent={renderListFooter}
        maxToRenderPerBatch={8}
        onEndReached={loadMoreProducts}
        onEndReachedThreshold={0.35}
        ref={listRef}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={({item, index}) => {
          const isFirstContentItem = index === 2;

          switch (item.type) {
            case 'hero':
              return renderHeroHeader();
            case 'sticky':
              return renderStickyHeader();
            case 'loading':
              return (
                <View
                  style={[
                    styles.section,
                    isFirstContentItem && styles.firstContentItem,
                  ]}
                >
                  {renderProductLoadingState()}
                </View>
              );
            case 'empty':
              return (
                <View
                  style={[
                    styles.featuredProductsEmpty,
                    isFirstContentItem && styles.firstContentItem,
                  ]}
                >
                  <Text style={styles.featuredProductsEmptyTitle}>
                    No website items found
                  </Text>
                  <Text style={styles.featuredProductsEmptyText}>
                    Check the Metro logs for the Frappe Website Item response.
                  </Text>
                </View>
              );
            case 'groupHeader':
              return (
                <View
                  style={[
                    styles.productGroupHeader,
                    styles.productGroupHeaderList,
                    isFirstContentItem && styles.firstContentItem,
                  ]}
                >
                  <Text style={styles.productGroupTitle}>
                    {getCategoryDisplayTitle(item.title)}
                  </Text>
                </View>
              );
            case 'productRow':
              return (
                <View
                  style={[
                    styles.productRow,
                    isFirstContentItem && styles.firstContentItem,
                  ]}
                >
                  {item.products.map(product =>
                    renderFeaturedProductCard(product, styles.productGridCard),
                  )}
                  {item.products.length < PRODUCT_ROW_SIZE ? (
                    <View style={styles.productRowSpacer} />
                  ) : null}
                </View>
              );
            default:
              return null;
          }
        }}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={50}
        windowSize={7}
      />

      {cartItemCount > 0 ? (
        <View
          pointerEvents="box-none"
          style={[styles.cartBarWrap, { bottom: insets.bottom + 12 }]}
        >
          <Pressable
            onPress={() => navigation.navigate('Cart')}
            style={({ pressed }) => [
              styles.cartBar,
              pressed && styles.cartBarPressed,
            ]}
          >
            <View style={styles.cartBarImages}>
              {cartPreviewItems.map((item, index) => (
                <Image
                  key={item.id}
                  source={{ uri: item.image }}
                  style={[
                    styles.cartBarImage,
                    index > 0 && styles.cartBarImageOverlap,
                  ]}
                />
              ))}
            </View>
            <View style={styles.cartBarAction}>
              <Text style={styles.cartBarActionText}>View Cart</Text>
              <Text style={styles.cartBarCountText}>
                {cartItemCount} item{cartItemCount > 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.cartBarArrowWrap}>
              <Animated.View
                style={[styles.cartBarIndicator, cartArrowAnimatedStyle]}
              >
                <MaterialCommunityIcons
                  color="#177a34"
                  name="arrow-right"
                  size={18}
                />
              </Animated.View>
              <Animated.Image
                source={bim}
                style={[
                  styles.cartBarIndicator,
                  styles.cartBarMascot,
                  cartMascotAnimatedStyle,
                ]}
              />
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  contentContainer: {
    backgroundColor: '#ffffff',
  },
  heroTop: {
    paddingHorizontal: 16,
  },
  stickyHeaderWrap: {
    paddingBottom: 0,
    paddingHorizontal: 16,
    paddingTop: 2,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 10,
  },
  deliveryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Platform.OS === 'android' ? 2 : 8,
  },
  locationPressable: {
    flex: 1,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deliveryEta: {
    color: '#ffffff',
    fontSize: 25,
    fontWeight: '800',
  },
  deliveryEtaTime: {
    color: '#ffe08a',
  },
  deliveryEtaCount: {
    color: '#ffe08a',
    fontSize: 28,
    fontWeight: '900',
    textShadowColor: 'rgba(255, 235, 153, 0.5)',
    textShadowOffset: {width: 0, height: 0},
    textShadowRadius: 8,
  },
  locationRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    maxWidth: '90%',
    marginTop: Platform.OS === 'android' ? 2 : 6,
  },
  locationText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  locationChevron: {
    flexShrink: 0,
    marginLeft: 3,
  },
  avatarBadge: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    width: 36,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#eadfce',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
    shadowColor: '#381a00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  searchIcon: {
    color: '#444444',
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  headerTabsSection: {
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    borderBottomWidth: 1,
    marginBottom: 0,
    marginHorizontal: -16,
    overflow: 'visible',
    position: 'relative',
  },
  headerTabsScroll: {
    paddingLeft: 0,
    paddingRight: 16,
  },
  headerTabsRow: {
    alignItems: 'flex-end',
    minWidth: '100%',
    paddingBottom: 0,
  },
  headerTab: {
    alignItems: 'center',
    gap: 2,
    minHeight: 72,
    minWidth: 74,
    opacity: 0.55,
    paddingHorizontal: 6,
    paddingBottom: 0,
    paddingTop: 4,
    position: 'relative',
  },
  headerTabActive: {
    opacity: 1,
    transform: [{ translateY: 0 }],
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
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  headerTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  headerTabIndicator: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    bottom: 0,
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 2,
  },
  headerTabIndicatorFirst: {
    borderTopLeftRadius: 0,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  firstContentItem: {
    marginTop: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionMeta: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  productGroupBlock: {
    marginBottom: 18,
  },
  productGroupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  productGroupHeaderList: {
    paddingHorizontal: 16,
  },
  productGroupTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  productGroupCount: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
  },
  featuredProductCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ece7d8',
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 12,
    padding: 10,
    width: 180,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  productGridCard: {
    marginRight: 0,
    width: '48%',
  },
  productRowSpacer: {
    width: '48%',
  },
  featuredProductImageWrap: {
    borderRadius: 12,
    height: 92,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  featuredProductImage: {
    height: '100%',
    resizeMode: 'contain',
    width: '100%',
  },
  featuredProductBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 6,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    top: 8,
  },
  featuredProductBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  featuredWishlistButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#ece7d8',
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 32,
  },
  featuredProductName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  featuredProductMeta: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 3,
  },
  featuredProductFooter: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  featuredProductPriceWrap: {
    flex: 1,
    marginRight: 8,
  },
  featuredProductPrice: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  featuredProductSellerCount: {
    color: '#0f766e',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  featuredProductAddButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.tagGreen,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  featuredProductAddButtonPressed: {
    backgroundColor: colors.tagGreen,
  },
  featuredProductAddText: {
    color: colors.tagGreen,
    fontSize: 12,
    fontWeight: '700',
  },
  featuredProductAddTextPressed: {
    color: '#ffffff',
  },
  loadingProductsWrap: {
    paddingBottom: 8,
  },
  loadingSectionBlock: {
    marginBottom: 12,
  },
  skeletonBase: {
    backgroundColor: '#eadfce',
  },
  loadingProductsTitleSkeleton: {
    borderRadius: 999,
    height: 16,
    marginBottom: 12,
    width: '38%',
  },
  loadingProductsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loadingProductCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ece7d8',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    padding: 10,
    width: '48%',
  },
  loadingProductBadge: {
    borderRadius: 999,
    height: 24,
    marginBottom: 10,
    width: '34%',
  },
  loadingProductImage: {
    borderRadius: 12,
    height: 92,
    marginBottom: 10,
  },
  loadingProductLineLarge: {
    borderRadius: 999,
    height: 12,
    marginBottom: 8,
    width: '80%',
  },
  loadingProductLineSmall: {
    borderRadius: 999,
    height: 10,
    marginBottom: 12,
    width: '52%',
  },
  loadingProductFooter: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loadingProductPriceWrap: {
    flex: 1,
    marginRight: 8,
  },
  loadingProductPriceLine: {
    borderRadius: 999,
    height: 12,
    marginBottom: 6,
    width: '46%',
  },
  loadingProductSellerLine: {
    borderRadius: 999,
    height: 10,
    width: '62%',
  },
  loadingProductButton: {
    borderRadius: 8,
    height: 32,
    width: 54,
  },
  featuredProductsEmpty: {
    backgroundColor: '#fffaf0',
    borderColor: '#eadfce',
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  featuredProductsEmptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  featuredProductsEmptyText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  paginationFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingBottom: 12,
    paddingTop: 2,
  },
  paginationFooterText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  listFooterSpacer: {
    height: 8,
  },
  bestsellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bestsellerCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ece7d8',
    borderRadius: 14,
    borderWidth: 1,
    elevation: 3,
    padding: 10,
    shadowColor: '#9db8c7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    width: '31%',
  },
  bestsellerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bestsellerImage: {
    backgroundColor: '#f7f2e7',
    borderRadius: 8,
    height: 38,
    marginBottom: 6,
    width: '48%',
  },
  bestsellerTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'left',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryItem: {
    marginBottom: 16,
    width: '23%',
  },
  categoryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ece7d8',
    borderRadius: 14,
    borderWidth: 1,
    elevation: 2,
    padding: 8,
    shadowColor: '#a7c2d1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    width: '100%',
  },
  categoryCardImage: {
    backgroundColor: '#f7f2e7',
    borderRadius: 10,
    height: 78,
    width: '100%',
  },
  categoryItemTitle: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
    marginTop: 6,
    textAlign: 'left',
    width: '100%',
  },
  modalOverlay: {
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 12,
    paddingTop: 16,
  },
  modalSheetPartialHeight: {
    height: '80%',
  },
  modalTopBar: {
    alignItems: 'center',
    borderColor: '#e8e3db',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: '#f5f1ea',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  modalContentRow: {
    alignItems: 'stretch',
    borderTopColor: '#ece8df',
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  modalSidebar: {
    backgroundColor: '#f8f8f8',
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
    width: 72,
  },
  modalDivider: {
    alignSelf: 'stretch',
    backgroundColor: '#ece8df',
    width: 1,
  },
  modalProductsScroll: {
    flex: 1,
  },
  modalSidebarItem: {
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 6,
    paddingVertical: 6,
    position: 'relative',
    width: '100%',
  },
  modalSidebarItemActive: {
    backgroundColor: '#ffffff',
  },
  modalSidebarIndicator: {
    backgroundColor: '#29a643',
    borderRadius: 999,
    bottom: 6,
    position: 'absolute',
    right: 0,
    top: 6,
    width: 3,
  },
  modalSidebarImage: {
    backgroundColor: '#fff3e3',
    borderRadius: 16,
    height: 34,
    marginBottom: 4,
    width: 34,
  },
  modalSidebarText: {
    color: '#7c7368',
    fontSize: 8,
    fontWeight: '500',
    lineHeight: 10,
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
  },
  modalSidebarTextActive: {
    color: '#1f1f1f',
    fontWeight: '700',
    textAlign: 'center',
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  modalProductCard: {
    backgroundColor: '#ffffff',
    borderColor: '#eee8dc',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 230,
    padding: 8,
    width: '48.6%',
  },
  modalImageWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  modalImage: {
    backgroundColor: '#efe3d0',
    borderRadius: 12,
    height: 118,
    width: '100%',
  },
  modalEtaBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 999,
    flexDirection: 'row',
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    position: 'absolute',
    top: 8,
  },
  modalEtaText: {
    color: '#1f1f1f',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  modalWishlistButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 28,
  },
  modalDiscountBadge: {
    backgroundColor: '#2f8b38',
    borderTopRightRadius: 12,
    bottom: 0,
    left: 0,
    paddingHorizontal: 8,
    paddingVertical: 5,
    position: 'absolute',
  },
  modalDiscountText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  modalProductWeight: {
    color: '#6f675c',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalProductName: {
    color: '#1f1f1f',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    minHeight: 34,
  },
  modalProductActionRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  modalPriceBlock: {
    flex: 1,
    paddingRight: 8,
  },
  modalProductPrice: {
    color: '#1f1f1f',
    fontSize: 15,
    fontWeight: '800',
  },
  modalProductMrp: {
    color: '#8d8579',
    fontSize: 10,
    marginTop: 2,
    textDecorationLine: 'line-through',
  },
  modalAddButton: {
    alignItems: 'center',
    backgroundColor: '#f1fbf1',
    borderColor: '#2f8b38',
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 58,
    paddingVertical: 8,
  },
  modalAddButtonPressed: {
    backgroundColor: '#2f8b38',
    transform: [{ scale: 0.97 }],
  },
  modalAddText: {
    color: '#2f8b38',
    fontSize: 12,
    fontWeight: '800',
  },
  modalAddTextPressed: {
    color: '#ffffff',
  },
  toastWrap: {
    left: 12,
    position: 'absolute',
    right: 12,
  },
  cartBarWrap: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  cartBar: {
    alignItems: 'center',
    backgroundColor: '#177a34',
    borderRadius: 999,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#0d4e20',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  cartBarPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  cartBarImages: {
    alignItems: 'center',
    flexDirection: 'row',
    marginRight: 12,
  },
  cartBarImage: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    borderRadius: 17,
    borderWidth: 2,
    height: 34,
    width: 34,
  },
  cartBarImageOverlap: {
    marginLeft: -10,
  },
  cartBarCountText: {
    color: 'rgba(255, 255, 255, 0.84)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  cartBarAction: {
    marginRight: 12,
  },
  cartBarActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  cartBarArrowWrap: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 15,
    height: 34,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 34,
  },
  cartBarIndicator: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    position: 'absolute',
    width: '100%',
  },
  cartBarMascot: {
    height: 18,
    resizeMode: 'contain',
    width: 18,
  },
  toast: {
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  toastAction: {
    marginLeft: 14,
  },
  toastActionText: {
    color: '#8bd46e',
    fontSize: 13,
    fontWeight: '700',
  },
});
