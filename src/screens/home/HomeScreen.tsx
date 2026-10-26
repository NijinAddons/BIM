import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  Linking,
  ListRenderItemInfo,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { bim } from '../../assets/images';
import {
  AddressMapPicker,
  AppRefreshControl,
  BannerCarousel,
  CartBar,
  LocationPermissionSheet,
  ProductCard,
  ProfileButton,
  WeeklyKitsBanner,
  WeeklyKitsSection,
  type LocationPermissionVariant,
} from '../../components';
import { useCartCount } from '../../hooks/useCart';
import {
  isManualLocation,
  loadCurrentLocation,
  setLocationStatus,
  useLocation,
} from '../../hooks/useLocation';
import type { HomeStackScreenProps } from '../../navigation/types';
import {
  hasLocationPermission,
  LocationPermissionBlockedError,
  requestLocationPermission,
} from '../../services/location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  homeFeedQuery,
  queryKeys,
  useItemsByGroup,
  useProductBundles,
} from '../../queries';
import { Brand, CategoryItem, ProductBundle, Store } from '../../services';
import {
  readCachedHomeFeed,
  type FeedGroup,
  type HomeFeed,
} from '../../services/homeFeed';

const EMPTY_BRANDS: Brand[] = [];
const EMPTY_STORES: Store[] = [];
const EMPTY_GROUPS: FeedGroup[] = [];
const EMPTY_BUNDLES: ProductBundle[] = [];
import {
  BORDER,
  CARD,
  GREEN,
  HAIRLINE,
  MUTED,
  NAVY,
  TEAL,
  TEXT,
  TEXT_VARIANT,
} from '../../theme/colors';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used again once Shop by Category is re-enabled
const MAX_QUICK_CATEGORIES = 3;
const MAX_TRENDING_CHIPS = 6;
const RAIL_CARD_WIDTH = 160;
const RAIL_GAP = 12;
const RAIL_PADDING = 16;

type Section =
  | { kind: 'kits' }
  | { kind: 'brands' }
  | { kind: 'stores' }
  | { kind: 'quickCategories' }
  | { kind: 'rail'; groupId: string; name: string };

const toPlaceName = (value: string) =>
  value
    .replace(/\d+/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/^[\s,-]+|[\s,-]+$/g, '')
    .trim();

const HEADER_PLACE_MAX_CHARS = 40;

const truncatePlaceName = (value: string) =>
  value.length > HEADER_PLACE_MAX_CHARS
    ? `${value.slice(0, HEADER_PLACE_MAX_CHARS).trimEnd()}…`
    : value;

const brandKeyExtractor = (brand: Brand) => brand.id;
const storeKeyExtractor = (store: Store) => store.id;
const railItemKeyExtractor = (item: CategoryItem) => item.id;
const sectionKeyExtractor = (section: Section) =>
  section.kind === 'rail' ? `rail-${section.groupId}` : section.kind;

// Set once the friendly pre-permission sheet has been shown (Allow or Not
// now) so it only ever primes the user once per device, not every launch.
const LOCATION_PRIMER_KEY = '@bim/location_primer_shown';

type Props = HomeStackScreenProps<'HomeFeed'>;

const HomeScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const location = useLocation();

  const headerPlace = useMemo(() => {
    // Only a location resolved this session (GPS fix after permission was
    // granted, or an address the user picked) goes in the header — the label
    // saved last session may be somewhere else entirely.
    if (!location.label || location.status !== 'ready') {
      return null;
    }
    const cleaned = toPlaceName(location.label);
    return cleaned.length > 0 ? truncatePlaceName(cleaned) : null;
  }, [location.label, location.status]);

  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  // Filled in by the splash screen's preload when it finished in time, so
  // the feed renders complete on first paint.
  // Last successful feed from disk, shown on a cold start until the network
  // copy lands (the splash screen normally has it in the query cache already).
  const [cachedFeed, setCachedFeed] = useState<Partial<HomeFeed> | null>(null);
  const feedQuery = useQuery({
    ...homeFeedQuery(),
    placeholderData: cachedFeed ?? undefined,
  });
  const hasFeed = feedQuery.data !== undefined;

  useEffect(() => {
    if (hasFeed) {
      return;
    }
    let cancelled = false;
    readCachedHomeFeed().then(cached => {
      if (!cancelled && cached) {
        setCachedFeed(cached);
      }
    });
    return () => {
      cancelled = true;
    };
    // Only needed until the first feed arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const feed = feedQuery.data;
  const brands = feed?.brands ?? EMPTY_BRANDS;
  const stores = feed?.stores ?? EMPTY_STORES;
  const groups = feed?.groups ?? EMPTY_GROUPS;
  const brandsTotal = feed?.brandsTotal ?? brands.length;
  const storesTotal = feed?.storesTotal ?? stores.length;
  const loading = feedQuery.isPending;

  // Pull-to-refresh: refetch the feed and every rail's items.
  const queryClient = useQueryClient();
  const refreshFeed = useCallback(
    () =>
      Promise.all([
        feedQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: queryKeys.items }),
        queryClient.invalidateQueries({ queryKey: queryKeys.productBundles }),
      ]),
    [feedQuery, queryClient],
  );

  const [locationSheet, setLocationSheet] = useState<{
    visible: boolean;
    variant: LocationPermissionVariant;
  }>({ visible: false, variant: 'ask' });

  const showLocationSheet = useCallback(
    (variant: LocationPermissionVariant) => {
      setLocationSheet({ visible: true, variant });
    },
    [],
  );

  const hideLocationSheet = useCallback(() => {
    setLocationSheet(current => ({ ...current, visible: false }));
  }, []);

  // Set when this screen itself records a permission outcome, so the
  // auto-prompt effect below doesn't pop the sheet straight back up.
  const promptedLocationStatusRef = useRef<typeof location.status | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (Platform.OS === 'android') {
        const [granted, primed] = await Promise.all([
          hasLocationPermission(),
          AsyncStorage.getItem(LOCATION_PRIMER_KEY),
        ]);
        if (cancelled) {
          return;
        }
        if (!granted) {
          // No permission, no fetch: the header stays on "Location access
          // off" until the user allows it from the sheet. The sheet pops up
          // by itself only the first time; after that it's a header tap.
          if (primed) {
            promptedLocationStatusRef.current = 'denied';
          }
          setLocationStatus('denied');
          return;
        }
      }
      loadCurrentLocation();
    })();

    // Re-resolve on every foreground, not just the very first mount, so
    // reopening the app (from the background or a fresh launch) always
    // asks for the current location instead of showing a stale one.
    //
    // Only refresh silently when permission is already granted. On Android,
    // every system dialog (the permission prompt itself, the Play Services
    // "Turn on Location" dialog) briefly backgrounds the app, so requesting
    // permission from here re-opened the OS permission dialog right after
    // the user answered one. Asking is left to the location sheet.
    const subscription = AppState.addEventListener('change', nextState => {
      // An address the user picked stays the delivery location — don't
      // swap it back to wherever the phone is on every return to the app
      // (that also moved every delivery time to the GPS position).
      if (nextState !== 'active' || isManualLocation()) {
        return;
      }
      hasLocationPermission()
        .then(granted => {
          if (granted) {
            loadCurrentLocation(true);
          }
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [showLocationSheet]);

  // "Allow Location Access": the OS permission dialog is the only way to
  // get the permission, so that one native dialog is unavoidable. Once
  // granted, a normal load follows — if device location is off, that lands
  // on 'servicesOff' and our own sheet explains it.
  const requestPermissionFromSheet = useCallback(async () => {
    try {
      await requestLocationPermission();
    } catch (error) {
      const status =
        error instanceof LocationPermissionBlockedError ? 'blocked' : 'denied';
      // The user just answered the OS dialog — don't re-show our sheet for
      // a 'denied' they chose seconds ago. 'blocked' still gets its sheet,
      // since only Settings can fix it and the OS won't show a dialog.
      if (status === 'denied') {
        promptedLocationStatusRef.current = status;
      }
      setLocationStatus(status);
      return;
    }
    loadCurrentLocation(true);
  }, []);

  // "Turn On Location": open the system Location settings screen rather
  // than stacking Android's own "Turn on device location" popup on top of
  // our sheet. The AppState listener above reloads the location as soon as
  // the user comes back.
  const openLocationSettings = useCallback(() => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(
        () => Linking.openSettings(),
      );
    } else {
      Linking.openSettings();
    }
  }, []);

  // Proactively prompt the user with the branded sheet instead of only
  // changing the passive header label — without location services +
  // permission we can't resolve the exact building for delivery. Shows once
  // per status so it doesn't reappear on every re-render, but resets when
  // the status clears so it fires again if location is turned off a second
  // time mid-session.
  useEffect(() => {
    const promptable =
      location.status === 'servicesOff' ||
      location.status === 'denied' ||
      location.status === 'blocked';
    if (!promptable) {
      promptedLocationStatusRef.current = null;
      return;
    }
    if (promptedLocationStatusRef.current === location.status) {
      return;
    }
    promptedLocationStatusRef.current = location.status;

    if (location.status === 'servicesOff') {
      showLocationSheet('servicesOff');
    } else if (location.status === 'denied') {
      // The OS will still show its own permission dialog again here — reuse
      // the same friendly rationale sheet rather than a bare retry.
      showLocationSheet('ask');
    } else {
      showLocationSheet('blocked');
    }
  }, [location.status, showLocationSheet]);

  const onLocationSheetPrimaryPress = useCallback(() => {
    hideLocationSheet();
    if (locationSheet.variant === 'blocked') {
      Linking.openSettings();
      return;
    }
    if (locationSheet.variant === 'servicesOff') {
      openLocationSettings();
      return;
    }
    AsyncStorage.setItem(LOCATION_PRIMER_KEY, '1').catch(() => {});
    requestPermissionFromSheet();
  }, [
    locationSheet.variant,
    openLocationSettings,
    requestPermissionFromSheet,
    hideLocationSheet,
  ]);

  const onLocationSheetDismiss = useCallback(() => {
    hideLocationSheet();
    if (locationSheet.variant === 'ask') {
      AsyncStorage.setItem(LOCATION_PRIMER_KEY, '1').catch(() => {});
    }
  }, [locationSheet.variant, hideLocationSheet]);

  const openCategories = useCallback(
    () => navigation.navigate('Categories'),
    [navigation],
  );

  const openSearch = useCallback(
    () => navigation.navigate('Search'),
    [navigation],
  );

  const onLocationPress = useCallback(() => {
    // Reopen the same branded sheet the user already saw for this status,
    // rather than jumping straight to an action.
    if (location.status === 'servicesOff') {
      showLocationSheet('servicesOff');
      return;
    }
    if (location.status === 'denied') {
      showLocationSheet('ask');
      return;
    }
    if (location.status === 'blocked') {
      showLocationSheet('blocked');
      return;
    }
    setMapPickerOpen(true);
  }, [location.status, showLocationSheet]);

  const openCart = useCallback(() => navigation.navigate('Cart'), [navigation]);

  const openProduct = useCallback(
    (item: CategoryItem) => navigation.navigate('ProductDetail', { item }),
    [navigation],
  );

  const bundles = useProductBundles().data ?? EMPTY_BUNDLES;
  // Kits are picked on the Weekly Kits screen; a tapped kit arrives
  // preselected.
  const openKit = useCallback(
    (bundle?: ProductBundle) =>
      navigation.navigate(
        'WeeklyKits',
        bundle ? { kitId: bundle.item.id } : undefined,
      ),
    [navigation],
  );

  // A "Weekly Kits" slide leads the banner carousel once kits are live.
  const listHeader = useMemo(
    () => (
      <BannerCarousel
        leadingSlides={
          bundles.length > 0
            ? [
                {
                  id: 'weekly-kits',
                  content: <WeeklyKitsBanner bundles={bundles} />,
                  onPress: () => openKit(),
                },
              ]
            : undefined
        }
      />
    ),
    [bundles, openKit],
  );

  const openBrand = useCallback(
    (brand: Brand) => navigation.navigate('BrandDetail', { brand }),
    [navigation],
  );

  const openStore = useCallback(
    (store: Store) => navigation.navigate('StoreDetail', { store }),
    [navigation],
  );

  const openGroupItems = useCallback(
    (groupId: string, name: string) =>
      navigation.navigate('Categories', {
        screen: 'CategoryItems',
        params: { categoryName: name, itemGroup: groupId },
      }),
    [navigation],
  );

  const sections = useMemo<Section[]>(() => {
    const list: Section[] = [];
    if (brands.length > 0) {
      list.push({ kind: 'brands' });
    }
    if (stores.length > 0) {
      list.push({ kind: 'stores' });
    }
    if (bundles.length > 0) {
      list.push({ kind: 'kits' });
    }
    // if (groups.length > 0) {
    //   list.push({ kind: 'quickCategories' });
    // }
    for (const group of groups) {
      list.push({ kind: 'rail', groupId: group.id, name: group.name });
    }
    return list;
  }, [bundles.length, brands.length, stores.length, groups]);

  const renderSection = useCallback(
    ({ item: section, index }: ListRenderItemInfo<Section>) => {
      if (section.kind === 'kits') {
        return (
          <WeeklyKitsSection
            bundles={bundles}
            first={index === 0}
            onOpenKit={openKit}
          />
        );
      }
      if (section.kind === 'brands') {
        return (
          <ChipRow
            data={brands}
            first={index === 0}
            keyExtractor={brandKeyExtractor}
            onSeeAll={openCategories}
            renderChip={brand => (
              <BrandChip brand={brand} onPress={openBrand} />
            )}
            showSeeAll={brandsTotal > brands.length}
            title="Brands"
          />
        );
      }
      if (section.kind === 'stores') {
        return (
          <ChipRow
            data={stores}
            first={index === 0}
            keyExtractor={storeKeyExtractor}
            onSeeAll={openCategories}
            renderChip={store => (
              <StoreChip store={store} onPress={openStore} />
            )}
            showSeeAll={storesTotal > stores.length}
            title="Shops to Explore"
          />
        );
      }
      if (section.kind === 'quickCategories') {
        // Shop by Category — temporarily disabled.
        // return (
        //   <QuickCategoryGrid
        //     groups={groups.slice(0, MAX_QUICK_CATEGORIES)}
        //     onMore={openCategories}
        //     onOpenGroup={openGroupItems}
        //   />
        // );
        return null;
      }
      return (
        <RailSection
          first={index === 0}
          groupId={section.groupId}
          name={section.name}
          onOpenProduct={openProduct}
          onSeeAll={openGroupItems}
        />
      );
    },
    [
      bundles,
      openKit,
      brands,
      brandsTotal,
      stores,
      storesTotal,
      // groups — re-add once Shop by Category is re-enabled below.
      openBrand,
      openStore,
      openProduct,
      openCategories,
      openGroupItems,
    ],
  );

  const cartCount = useCartCount();

  const trendingGroups = useMemo(
    () => groups.slice(0, MAX_TRENDING_CHIPS),
    [groups],
  );

  const headerStyle = useMemo(
    () => [styles.header, { paddingTop: insets.top + 8 }],
    [insets.top],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <View style={headerStyle}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeft}>
            <ProfileButton variant="dark" />
            <TouchableOpacity
              activeOpacity={0.7}
              hitSlop={8}
              onPress={onLocationPress}
              style={styles.locationRow}
            >
              <View style={styles.locationIconWrap}>
                <MaterialCommunityIcons
                  color={TEAL}
                  name="map-marker"
                  size={14}
                />
              </View>
              {!headerPlace &&
              (location.status === 'loading' || location.status === 'idle') ? (
                <ActivityIndicator
                  color="#FFFFFF"
                  size="small"
                  style={styles.locationLoader}
                />
              ) : (
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  numberOfLines={1}
                  style={styles.locationText}
                >
                  {headerPlace ??
                    (location.status === 'denied' ||
                    location.status === 'blocked'
                      ? 'Location access off'
                      : location.status === 'servicesOff'
                      ? 'Turn on location'
                      : 'Set your location')}
                </Text>
              )}
              <MaterialCommunityIcons
                color="#FFFFFF"
                name="chevron-down"
                size={18}
              />
            </TouchableOpacity>
          </View>
        </View>

        <Pressable onPress={openSearch} style={styles.searchPill}>
          <MaterialCommunityIcons color={MUTED} name="magnify" size={18} />
          <Text numberOfLines={1} style={styles.searchPlaceholder}>
            Search for groceries, garments & more
          </Text>
          <View style={styles.searchIcons}>
            <MaterialCommunityIcons
              color={MUTED}
              name="tune-variant"
              size={18}
            />
          </View>
        </Pressable>

        {trendingGroups.length > 0 ? (
          <TrendingRow groups={trendingGroups} onPress={openGroupItems} />
        ) : null}
      </View>

      <FlatList
        contentContainerStyle={[
          styles.scrollContent,
          cartCount > 0 ? styles.scrollContentWithCartBar : null,
        ]}
        data={sections}
        initialNumToRender={3}
        keyExtractor={sectionKeyExtractor}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={50}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loading ? (
            <HomeFeedSkeleton />
          ) : (
            <View style={styles.loadingBlock}>
              <MaterialCommunityIcons
                color="#C6CDD3"
                name="storefront-outline"
                size={40}
              />
              <Text style={styles.emptyText}>
                Nothing to show yet. Pull back later.
              </Text>
            </View>
          )
        }
        refreshControl={
          <AppRefreshControl color={TEAL} onRefresh={refreshFeed} />
        }
        removeClippedSubviews
        renderItem={renderSection}
        showsVerticalScrollIndicator={false}
        windowSize={7}
      />

      <CartBar onPress={openCart} />

      <AddressMapPicker
        onClose={() => setMapPickerOpen(false)}
        visible={mapPickerOpen}
      />

      <LocationPermissionSheet
        onDismiss={onLocationSheetDismiss}
        onPrimaryPress={onLocationSheetPrimaryPress}
        variant={locationSheet.variant}
        visible={locationSheet.visible}
      />
    </View>
  );
};

type TrendingRowProps = {
  groups: FeedGroup[];
  onPress: (groupId: string, name: string) => void;
};

const TrendingRow = React.memo(function TrendingRowComponent({
  groups,
  onPress,
}: TrendingRowProps) {
  return (
    <View style={styles.trendingRow}>
      <Text style={styles.trendingLabel}>TRENDING</Text>
      <FlatList
        contentContainerStyle={styles.trendingList}
        data={groups}
        horizontal
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onPress(item.id, item.name)}
            style={styles.trendingChip}
          >
            <Text numberOfLines={1} style={styles.trendingChipText}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
});

type QuickCategoryGridProps = {
  groups: FeedGroup[];
  onOpenGroup: (groupId: string, name: string) => void;
  onMore: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used again once Shop by Category is re-enabled
const QuickCategoryGrid = React.memo(function QuickCategoryGridComponent({
  groups,
  onOpenGroup,
  onMore,
}: QuickCategoryGridProps) {
  return (
    <View style={styles.quickSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Shop by Category</Text>
        <TouchableOpacity hitSlop={8} onPress={onMore}>
          <Text style={styles.sectionAction}>Explore</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.quickGrid}>
        {groups.map(group => (
          <QuickCategoryTile
            key={group.id}
            group={group}
            onPress={onOpenGroup}
          />
        ))}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onMore}
          style={styles.quickTile}
        >
          <View style={[styles.quickTileIcon, styles.quickTileIconMuted]}>
            <MaterialCommunityIcons
              color={TEXT_VARIANT}
              name="dots-horizontal"
              size={22}
            />
          </View>
          <Text numberOfLines={1} style={styles.quickTileLabel}>
            More
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const QuickCategoryTile = React.memo(function QuickCategoryTileComponent({
  group,
  onPress,
}: {
  group: FeedGroup;
  onPress: (groupId: string, name: string) => void;
}) {
  const [failed, setFailed] = useState(!group.image);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(group.id, group.name)}
      style={styles.quickTile}
    >
      <View style={styles.quickTileIcon}>
        {group.image && !failed ? (
          <FastImage
            onError={() => setFailed(true)}
            resizeMode={FastImage.resizeMode.contain}
            source={{ uri: group.image }}
            style={styles.chipImage}
          />
        ) : (
          <MaterialCommunityIcons color={TEAL} name="shape-outline" size={22} />
        )}
      </View>
      <Text numberOfLines={1} style={styles.quickTileLabel}>
        {group.name}
      </Text>
    </TouchableOpacity>
  );
});

const SKELETON_CHIPS = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'];
const SKELETON_RAIL_CARDS = ['sk-1', 'sk-2', 'sk-3'];

// Placeholder shapes matching the feed's layout (chip rows + a rail), shown
// while the first cold-start fetch is in flight so the screen isn't blank.
function HomeFeedSkeleton() {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={{ opacity: pulse }}>
      <View style={[styles.section, styles.sectionFirst]}>
        <View style={styles.skeletonTitleBar} />
        <View style={styles.skeletonRow}>
          {SKELETON_CHIPS.map(key => (
            <View key={key} style={styles.chip}>
              <View style={styles.skeletonChipSquare} />
              <View style={styles.skeletonChipLabel} />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.skeletonTitleBar} />
        <View style={styles.skeletonRow}>
          {SKELETON_CHIPS.map(key => (
            <View key={key} style={styles.chip}>
              <View
                style={[styles.skeletonChipSquare, styles.skeletonChipCircle]}
              />
              <View style={styles.skeletonChipLabel} />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.skeletonTitleBar} />
        <View style={styles.skeletonRailRow}>
          {SKELETON_RAIL_CARDS.map(key => (
            <View key={key} style={styles.railCard}>
              <View style={styles.skeletonRailThumb} />
              <View style={styles.skeletonRailLine} />
              <View
                style={[styles.skeletonRailLine, styles.skeletonRailLineShort]}
              />
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

type ChipRowProps<T> = {
  title: string;
  first: boolean;
  data: T[];
  keyExtractor: (item: T) => string;
  renderChip: (item: T) => React.ReactElement;
  showSeeAll: boolean;
  onSeeAll: () => void;
};

function ChipRowComponent<T>({
  title,
  first,
  data,
  keyExtractor,
  renderChip,
  showSeeAll,
  onSeeAll,
}: ChipRowProps<T>) {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<T>) => renderChip(item),
    [renderChip],
  );
  const footer = useCallback(
    () => <SeeAllChip onPress={onSeeAll} />,
    [onSeeAll],
  );

  return (
    <View style={[styles.section, first ? styles.sectionFirst : null]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <FlatList
        contentContainerStyle={styles.chipList}
        data={data}
        horizontal
        keyExtractor={keyExtractor}
        initialNumToRender={6}
        ListFooterComponent={showSeeAll ? footer : undefined}
        maxToRenderPerBatch={6}
        renderItem={renderItem}
        windowSize={3}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const ChipRow = React.memo(ChipRowComponent) as typeof ChipRowComponent;

type RailSectionProps = {
  groupId: string;
  name: string;
  first: boolean;
  onOpenProduct: (item: CategoryItem) => void;
  onSeeAll: (groupId: string, name: string) => void;
};

const RailSection = React.memo(function RailSectionComponent({
  groupId,
  name,
  first,
  onOpenProduct,
  onSeeAll,
}: RailSectionProps) {
  const itemsQuery = useItemsByGroup(groupId);
  const items = itemsQuery.data ?? (itemsQuery.isError ? [] : null);
  const { width: windowWidth } = useWindowDimensions();

  // When there are a couple of items and a fixed card width would leave a
  // gap at the row's end, stretch the cards to fill the row instead of
  // leaving that gap — otherwise (including a single lone item) keep the
  // fixed width so longer rails still scroll horizontally and one item
  // doesn't blow up to the full screen width.
  const itemCount = items?.length ?? 0;
  const availableWidth = windowWidth - RAIL_PADDING * 2;
  const fixedRowWidth =
    itemCount * RAIL_CARD_WIDTH + Math.max(itemCount - 1, 0) * RAIL_GAP;
  const fitsWithoutScroll = itemCount > 0 && fixedRowWidth <= availableWidth;
  const cardWidth =
    fitsWithoutScroll && itemCount > 1
      ? (availableWidth - RAIL_GAP * (itemCount - 1)) / itemCount
      : RAIL_CARD_WIDTH;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CategoryItem>) => (
      <View style={[styles.railCard, { width: cardWidth }]}>
        <ProductCard item={item} onPress={onOpenProduct} />
      </View>
    ),
    [cardWidth, onOpenProduct],
  );

  if (items === null) {
    return (
      <View style={[styles.section, first ? styles.sectionFirst : null]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{name}</Text>
        </View>
        <View style={styles.skeletonRailRow}>
          {SKELETON_RAIL_CARDS.map(key => (
            <View key={key} style={styles.railCard}>
              <View style={styles.skeletonRailThumb} />
              <View style={styles.skeletonRailLine} />
              <View
                style={[styles.skeletonRailLine, styles.skeletonRailLineShort]}
              />
              <View style={styles.skeletonRailPrice} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={[styles.section, first ? styles.sectionFirst : null]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{name}</Text>
        {!fitsWithoutScroll ? (
          <TouchableOpacity hitSlop={8} onPress={() => onSeeAll(groupId, name)}>
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <FlatList
        contentContainerStyle={styles.railList}
        data={items}
        horizontal
        initialNumToRender={3}
        keyExtractor={railItemKeyExtractor}
        maxToRenderPerBatch={3}
        removeClippedSubviews
        renderItem={renderItem}
        scrollEnabled={!fitsWithoutScroll}
        windowSize={3}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
});

type BrandChipProps = {
  brand: Brand;
  onPress: (brand: Brand) => void;
};

const BrandChip = React.memo(function BrandChipComponent({
  brand,
  onPress,
}: BrandChipProps) {
  const [failed, setFailed] = useState(!brand.image);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(brand)}
      style={styles.chip}
    >
      <View style={styles.chipSquare}>
        {brand.image && !failed ? (
          <FastImage
            onError={() => setFailed(true)}
            resizeMode={FastImage.resizeMode.contain}
            source={{ uri: brand.image }}
            style={styles.chipImage}
          />
        ) : (
          <FastImage
            resizeMode={FastImage.resizeMode.contain}
            source={bim}
            style={styles.chipPlaceholder}
          />
        )}
      </View>
      <Text numberOfLines={2} style={styles.chipLabel}>
        {brand.name}
      </Text>
    </TouchableOpacity>
  );
});

type StoreChipProps = {
  store: Store;
  onPress: (store: Store) => void;
};

const StoreChip = React.memo(function StoreChipComponent({
  store,
  onPress,
}: StoreChipProps) {
  const [failed, setFailed] = useState(!store.image);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(store)}
      style={styles.chip}
    >
      <View style={styles.chipCircle}>
        {store.image && !failed ? (
          <FastImage
            onError={() => setFailed(true)}
            resizeMode={FastImage.resizeMode.cover}
            source={{ uri: store.image }}
            style={styles.chipImage}
          />
        ) : (
          <FastImage
            resizeMode={FastImage.resizeMode.contain}
            source={bim}
            style={styles.chipPlaceholder}
          />
        )}
      </View>
      <Text numberOfLines={2} style={styles.chipLabel}>
        {store.name}
      </Text>
    </TouchableOpacity>
  );
});

const SeeAllChip = React.memo(function SeeAllChipComponent({
  onPress,
}: {
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.chip}>
      <View style={[styles.chipCircle, styles.chipCircleMuted]}>
        <MaterialCommunityIcons
          color={TEXT_VARIANT}
          name="arrow-right"
          size={22}
        />
      </View>
      <Text numberOfLines={2} style={styles.chipLabel}>
        See All
      </Text>
    </TouchableOpacity>
  );
});

const softShadow = {
  elevation: 1,
  shadowColor: '#0F1B26',
  shadowOffset: { height: 2, width: 0 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: CARD,
    flex: 1,
  },
  header: {
    backgroundColor: NAVY,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  headerTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 10,
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 6,
  },
  locationIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,165,147,0.16)',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  locationLoader: {
    marginHorizontal: 4,
  },
  locationText: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  searchPill: {
    alignItems: 'center',
    backgroundColor: CARD,
    borderColor: HAIRLINE,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchPlaceholder: {
    color: MUTED,
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  searchIcons: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  trendingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 14,
  },
  trendingLabel: {
    color: TEAL,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginRight: 10,
  },
  trendingList: {
    gap: 8,
  },
  trendingChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  trendingChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 28,
  },
  scrollContentWithCartBar: {
    paddingBottom: 76,
  },
  loadingBlock: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  section: {
    marginTop: 28,
  },
  sectionFirst: {
    marginTop: 10,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionAction: {
    color: GREEN,
    fontSize: 14,
    fontWeight: '600',
  },
  chipList: {
    gap: 16,
    paddingHorizontal: 16,
  },
  chip: {
    alignItems: 'center',
    width: 76,
  },
  chipSquare: {
    ...softShadow,
    alignItems: 'center',
    backgroundColor: CARD,
    borderColor: BORDER,
    borderRadius: 14,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 8,
    width: 64,
  },
  chipCircle: {
    ...softShadow,
    alignItems: 'center',
    backgroundColor: CARD,
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  chipCircleMuted: {
    backgroundColor: BORDER,
  },
  chipImage: {
    height: '100%',
    width: '100%',
  },
  chipPlaceholder: {
    height: '52%',
    opacity: 0.3,
    width: '52%',
  },
  chipLabel: {
    color: TEXT_VARIANT,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  railList: {
    gap: 12,
    paddingHorizontal: 16,
  },
  railCard: {
    width: RAIL_CARD_WIDTH,
  },
  skeletonTitleBar: {
    backgroundColor: BORDER,
    borderRadius: 6,
    height: 16,
    marginBottom: 12,
    marginLeft: 16,
    width: 120,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
  },
  skeletonChipSquare: {
    backgroundColor: BORDER,
    borderRadius: 14,
    height: 64,
    width: 64,
  },
  skeletonChipCircle: {
    borderRadius: 999,
  },
  skeletonChipLabel: {
    backgroundColor: BORDER,
    borderRadius: 4,
    height: 10,
    marginTop: 8,
    width: 48,
  },
  skeletonRailRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
  skeletonRailThumb: {
    aspectRatio: 1,
    backgroundColor: BORDER,
    borderRadius: 18,
    width: '100%',
  },
  skeletonRailLine: {
    backgroundColor: BORDER,
    borderRadius: 4,
    height: 10,
    marginTop: 8,
    width: '90%',
  },
  skeletonRailLineShort: {
    width: '50%',
  },
  skeletonRailPrice: {
    backgroundColor: BORDER,
    borderRadius: 8,
    height: 30,
    marginTop: 14,
    width: '100%',
  },
  quickSection: {
    marginTop: 28,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 16,
  },
  quickTile: {
    alignItems: 'center',
    width: 72,
  },
  quickTileIcon: {
    ...softShadow,
    alignItems: 'center',
    backgroundColor: CARD,
    borderColor: BORDER,
    borderRadius: 16,
    borderWidth: 1,
    height: 60,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 60,
  },
  quickTileIconMuted: {
    backgroundColor: BORDER,
  },
  quickTileLabel: {
    color: TEXT_VARIANT,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default HomeScreen;
