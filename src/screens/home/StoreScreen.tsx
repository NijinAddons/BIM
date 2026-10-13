import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ListRenderItemInfo,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { bim } from '../../assets/images';
import { ActionButton, ProductCard, ScreenHeader } from '../../components';
import { useDeliveryEstimate } from '../../hooks/useDeliveryEstimate';
import { isWishlisted } from '../../hooks/useWishlist';
import type { RootStackScreenProps } from '../../navigation/types';
import {
  useItemsBySupplier,
  useManualRefresh,
  useStore,
  useSupplierReviews,
} from '../../queries';
import {
  CategoryItem,
  type SupplierReview,
  type SupplierReviewSummary,
} from '../../services';

const EMPTY_ITEMS: CategoryItem[] = [];

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';
const STAR = '#F5A623';

const NUM_COLUMNS = 2;
const GRID_PADDING = 16;
const GRID_GAP = 14;
const DESC_COLLAPSED_LINES = 3;
const BANNER_HEIGHT = 132;
const LOGO_SIZE = 84;
const CARD_WIDTH =
  (Dimensions.get('window').width -
    GRID_PADDING * 2 -
    GRID_GAP * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS;

const SCROLL_TOP_THRESHOLD = 600;

type SortMode = 'featured' | 'priceAsc' | 'priceDesc';

const SORT_CYCLE: SortMode[] = ['featured', 'priceAsc', 'priceDesc'];
const SORT_LABEL: Record<SortMode, string> = {
  featured: 'Featured',
  priceAsc: 'Price: low to high',
  priceDesc: 'Price: high to low',
};

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList,
) as unknown as typeof FlatList;

const keyExtractor = (item: CategoryItem) => item.id;

const REVIEWS_PREVIEW = 1;

const EMPTY_REVIEWS: SupplierReviewSummary = {
  average: 0,
  count: 0,
  reviews: [],
};

function renderStars(rating: number, size: number) {
  return [1, 2, 3, 4, 5].map(position => {
    const name =
      rating >= position
        ? 'star'
        : rating >= position - 0.5
        ? 'star-half-full'
        : 'star-outline';
    return (
      <MaterialCommunityIcons
        key={position}
        color={STAR}
        name={name}
        size={size}
      />
    );
  });
}

const ReviewCard = React.memo(function ReviewCardRow({
  review,
}: {
  review: SupplierReview;
}) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHead}>
        <View style={styles.reviewAvatar}>
          <Text style={styles.reviewInitial}>
            {review.reviewer.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewName}>{review.reviewer}</Text>
          <View style={styles.reviewStarsSmall}>
            {renderStars(review.rating, 12)}
          </View>
        </View>
      </View>
      {review.text ? (
        <Text style={styles.reviewText}>{review.text}</Text>
      ) : null}
    </View>
  );
});

type Props = RootStackScreenProps<'StoreDetail'>;

const StoreScreen = ({ navigation, route }: Props) => {
  const { store } = route.params;

  const supplierKey = store.supplier ?? store.name;
  const banner = store.banners[0] ?? null;

  const [logoFailed, setLogoFailed] = useState(!store.image);
  const [bannerFailed, setBannerFailed] = useState(!banner);
  const itemsQuery = useItemsBySupplier(supplierKey);
  const items = itemsQuery.data ?? EMPTY_ITEMS;
  const loading = itemsQuery.isPending;
  // A failed refetch keeps showing the grid we already have.
  const error =
    itemsQuery.isError && !itemsQuery.data
      ? 'Could not load products. Check your connection and try again.'
      : null;
  const loadItems = useCallback(() => {
    itemsQuery.refetch();
  }, [itemsQuery]);

  // The navigation param can be stale/partial — fetch the store fresh only
  // when it didn't carry a description.
  const initialDescription = store.description?.trim() || null;
  const freshStore = useStore(store.id || supplierKey, {
    enabled: !initialDescription,
  });
  const description =
    initialDescription ?? freshStore.data?.description ?? null;
  const [descExpanded, setDescExpanded] = useState(false);
  const [descMeasured, setDescMeasured] = useState(false);
  const [descNeedsToggle, setDescNeedsToggle] = useState(false);
  const reviewsQuery = useSupplierReviews(supplierKey);
  const reviews = reviewsQuery.data ?? EMPTY_REVIEWS;
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('featured');
  const [showScrollTop, setShowScrollTop] = useState(false);

  const listRef = useRef<FlatList<CategoryItem>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const onDescriptionLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (descMeasured) {
        return;
      }
      setDescMeasured(true);
      setDescNeedsToggle(event.nativeEvent.lines.length > DESC_COLLAPSED_LINES);
    },
    [descMeasured],
  );

  // Pull-to-refresh keeps the current grid on screen and leaves it
  // untouched if the refetch fails.
  const refreshStore = useCallback(
    () => Promise.all([itemsQuery.refetch(), reviewsQuery.refetch()]),
    [itemsQuery, reviewsQuery],
  );
  const { refreshing, onRefresh } = useManualRefresh(refreshStore);

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach(item => {
      if (item.itemGroup) {
        counts.set(item.itemGroup, (counts.get(item.itemGroup) ?? 0) + 1);
      }
    });
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [items]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = items.filter(
      item =>
        (!activeGroup || item.itemGroup === activeGroup) &&
        (!needle ||
          item.name.toLowerCase().includes(needle) ||
          (item.brand ?? '').toLowerCase().includes(needle)),
    );
    if (sort === 'featured') {
      return filtered;
    }
    return [...filtered].sort((a, b) =>
      sort === 'priceAsc' ? a.price - b.price : b.price - a.price,
    );
  }, [items, query, activeGroup, sort]);

  const isFiltering = query.trim() !== '' || activeGroup !== null;

  const clearFilters = useCallback(() => {
    setQuery('');
    setActiveGroup(null);
  }, []);

  const cycleSort = useCallback(
    () =>
      setSort(
        current =>
          SORT_CYCLE[(SORT_CYCLE.indexOf(current) + 1) % SORT_CYCLE.length],
      ),
    [],
  );

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (event: any) =>
          setShowScrollTop(
            event.nativeEvent.contentOffset.y > SCROLL_TOP_THRESHOLD,
          ),
      }),
    [scrollY],
  );

  const scrollToTop = useCallback(
    () => listRef.current?.scrollToOffset({ offset: 0, animated: true }),
    [],
  );

  const bannerTransform = useMemo(
    () => [
      {
        translateY: scrollY.interpolate({
          inputRange: [-BANNER_HEIGHT, 0, BANNER_HEIGHT],
          outputRange: [-BANNER_HEIGHT / 2, 0, BANNER_HEIGHT * 0.4],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: scrollY.interpolate({
          inputRange: [-BANNER_HEIGHT, 0],
          outputRange: [2, 1],
          extrapolateRight: 'clamp',
        }),
      },
    ],
    [scrollY],
  );

  const openProduct = useCallback(
    (item: CategoryItem) => navigation.navigate('ProductDetail', { item }),
    [navigation],
  );

  const handleToggleWishlist = useCallback(
    (item: CategoryItem) => {
      if (isWishlisted(item.id)) {
        navigation.navigate('Wishlist');
      }
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CategoryItem>) => (
      <View style={styles.cardWrapper}>
        <ProductCard
          item={item}
          onPress={openProduct}
          onToggleWishlist={handleToggleWishlist}
        />
      </View>
    ),
    [openProduct, handleToggleWishlist],
  );

  const visibleReviews = useMemo(
    () =>
      reviewsExpanded
        ? reviews.reviews
        : reviews.reviews.slice(0, REVIEWS_PREVIEW),
    [reviews.reviews, reviewsExpanded],
  );

  // This store's supplier coordinates, read off its loaded items (the store
  // record itself carries none): the matching supplier option first, else
  // an item whose default supplier is this store.
  const storeLocation = useMemo(() => {
    const key = supplierKey.trim().toLowerCase();
    const matches = (name: string | null | undefined) =>
      !!name && name.trim().toLowerCase() === key;
    for (const item of items) {
      const option = item.supplierOptions.find(
        candidate =>
          (matches(candidate.name) || matches(candidate.displayName)) &&
          candidate.latitude != null &&
          candidate.longitude != null,
      );
      if (option) {
        return { latitude: option.latitude, longitude: option.longitude };
      }
    }
    const byDefault = items.find(
      item => matches(item.supplier) && item.supplierLatitude != null,
    );
    return {
      latitude: byDefault?.supplierLatitude ?? null,
      longitude: byDefault?.supplierLongitude ?? null,
    };
  }, [items, supplierKey]);
  const deliveryEstimate = useDeliveryEstimate(storeLocation);

  const storeHeader = useMemo(
    () => (
      <View style={styles.headerWrap}>
        {/* Storefront banner */}
        <View style={styles.bannerWrap}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: bannerTransform },
            ]}
          >
            {banner && !bannerFailed ? (
              <FastImage
                onError={() => setBannerFailed(true)}
                resizeMode={FastImage.resizeMode.cover}
                source={{ uri: banner }}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={styles.bannerFallback} />
            )}
          </Animated.View>
          <View style={styles.bannerScrim} />
        </View>

        {/* Circular logo overlapping the banner */}
        <View style={styles.logoRingWrap}>
          <View style={styles.logoRing}>
            {store.image && !logoFailed ? (
              <FastImage
                onError={() => setLogoFailed(true)}
                resizeMode={FastImage.resizeMode.cover}
                source={{ uri: store.image }}
                style={styles.logo}
              />
            ) : (
              <Image
                resizeMode="contain"
                source={bim}
                style={styles.logoPlaceholder}
              />
            )}
          </View>
        </View>

        {/* Title sits below the banner + logo with a clear gap */}
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.storeName}>
              {store.name}
            </Text>
            <MaterialCommunityIcons
              accessibilityLabel="Verified store"
              color={ACCENT_TEAL}
              name="check-decagram"
              size={20}
            />
          </View>
          {deliveryEstimate ? (
            <View style={styles.deliveryRow}>
              <MaterialCommunityIcons
                color={ACCENT_TEAL}
                name="clock-fast"
                size={14}
              />
              <Text style={styles.deliveryText}>
                Delivery in {deliveryEstimate}
              </Text>
            </View>
          ) : null}
        </View>

        {description ? (
          <View style={styles.aboutBlock}>
            <View style={styles.aboutRule} />
            <View style={styles.aboutBody}>
              <Text style={styles.aboutHeading}>About the store</Text>
              <Text
                onTextLayout={onDescriptionLayout}
                numberOfLines={
                  !descMeasured || descExpanded
                    ? undefined
                    : DESC_COLLAPSED_LINES
                }
                style={styles.aboutText}
              >
                {description}
              </Text>
              {descNeedsToggle ? (
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => setDescExpanded(value => !value)}
                >
                  <Text style={styles.aboutToggle}>
                    {descExpanded ? 'Show less' : 'Show more'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Supplier reviews (from the Supplier Website Profile) */}
        {reviews.count > 0 || reviews.reviews.length > 0 ? (
          <View style={styles.reviewSection}>
            <View style={styles.reviewHeader}>
              <Text style={styles.sectionHeading}>Store reviews</Text>
              <View style={styles.reviewRating}>
                <MaterialCommunityIcons color={STAR} name="star" size={15} />
                <Text style={styles.reviewRatingValue}>
                  {reviews.average.toFixed(1)}
                </Text>
                <Text style={styles.reviewRatingCount}>({reviews.count})</Text>
              </View>
            </View>

            {visibleReviews.map(review => (
              <ReviewCard key={review.id} review={review} />
            ))}

            {reviews.reviews.length > REVIEWS_PREVIEW ? (
              <TouchableOpacity
                hitSlop={8}
                onPress={() => setReviewsExpanded(value => !value)}
                style={styles.reviewMore}
              >
                <Text style={styles.reviewMoreText}>
                  {reviewsExpanded
                    ? 'Show fewer reviews'
                    : `Show all ${reviews.reviews.length} reviews`}
                </Text>
                <MaterialCommunityIcons
                  color={ACCENT_TEAL}
                  name={reviewsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <View style={styles.controls}>
            <View style={styles.gridHeadRow}>
              <Text style={styles.gridHeadingInline}>
                {isFiltering
                  ? `${visibleItems.length} of ${items.length} products`
                  : 'All products'}
              </Text>
              <TouchableOpacity
                accessibilityLabel={`Sort: ${SORT_LABEL[sort]}. Tap to change`}
                activeOpacity={0.7}
                hitSlop={8}
                onPress={cycleSort}
                style={[
                  styles.sortButton,
                  sort !== 'featured' && styles.sortButtonActive,
                ]}
              >
                <MaterialCommunityIcons
                  color={sort !== 'featured' ? '#ffffff' : BRAND_NAVY}
                  name="sort"
                  size={14}
                />
                <Text
                  style={[
                    styles.sortText,
                    sort !== 'featured' && styles.sortTextActive,
                  ]}
                >
                  {SORT_LABEL[sort]}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <MaterialCommunityIcons color={MUTED} name="magnify" size={20} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder={`Search in ${store.name}`}
                placeholderTextColor={MUTED}
                returnKeyType="search"
                style={styles.searchInput}
                value={query}
              />
              {query ? (
                <TouchableOpacity
                  accessibilityLabel="Clear search"
                  hitSlop={8}
                  onPress={() => setQuery('')}
                >
                  <MaterialCommunityIcons
                    color={MUTED}
                    name="close-circle"
                    size={18}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            {groups.length > 1 ? (
              <ScrollView
                contentContainerStyle={styles.chipRowContent}
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                style={styles.chipRow}
              >
                {[{ name: null, count: items.length }, ...groups].map(group => {
                  const selected = activeGroup === group.name;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      key={group.name ?? 'all'}
                      onPress={() => setActiveGroup(group.name)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {group.name ?? 'All'}
                      </Text>
                      <Text
                        style={[
                          styles.chipCount,
                          selected && styles.chipCountSelected,
                        ]}
                      >
                        {group.count}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        ) : null}
      </View>
    ),
    [
      banner,
      bannerFailed,
      logoFailed,
      store,
      description,
      descExpanded,
      descMeasured,
      descNeedsToggle,
      onDescriptionLayout,
      reviews,
      reviewsExpanded,
      visibleReviews,
      bannerTransform,
      loading,
      error,
      items.length,
      isFiltering,
      visibleItems.length,
      sort,
      cycleSort,
      query,
      groups,
      activeGroup,
      deliveryEstimate,
    ],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />
      <ScreenHeader onBack={() => navigation.goBack()} title={store.name} />

      <AnimatedFlatList
        ref={listRef}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        data={loading || error ? [] : visibleItems}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            colors={[ACCENT_TEAL]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={ACCENT_TEAL}
          />
        }
        keyExtractor={keyExtractor}
        ListHeaderComponent={storeHeader}
        ListFooterComponent={
          loading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator color={ACCENT_TEAL} size="large" />
            </View>
          ) : error ? (
            <View style={styles.centeredState}>
              <MaterialCommunityIcons
                color="#C6CDD3"
                name="wifi-off"
                size={40}
              />
              <Text style={styles.stateText}>{error}</Text>
              <ActionButton
                label="Retry"
                onPress={loadItems}
                style={styles.retryButton}
                variant="dark"
              />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.centeredState}>
              <MaterialCommunityIcons
                color="#C6CDD3"
                name="storefront-outline"
                size={40}
              />
              <Text style={styles.stateText}>
                {store.name} hasn't listed any products yet.
              </Text>
            </View>
          ) : visibleItems.length === 0 ? (
            <View style={styles.centeredState}>
              <MaterialCommunityIcons
                color="#C6CDD3"
                name="magnify-close"
                size={40}
              />
              <Text style={styles.stateText}>
                No products match your search.
              </Text>
              <TouchableOpacity hitSlop={8} onPress={clearFilters}>
                <Text style={styles.clearFilters}>Clear filters</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        numColumns={NUM_COLUMNS}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
      />

      {showScrollTop ? (
        <TouchableOpacity
          accessibilityLabel="Scroll to top"
          activeOpacity={0.85}
          onPress={scrollToTop}
          style={styles.scrollTop}
        >
          <MaterialCommunityIcons color="#ffffff" name="chevron-up" size={24} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },

  headerWrap: {
    marginBottom: 8,
  },

  /* Banner */
  bannerWrap: {
    backgroundColor: '#EEF1F4',
    height: BANNER_HEIGHT,
    width: '100%',
  },
  bannerFallback: {
    backgroundColor: BRAND_NAVY,
    ...StyleSheet.absoluteFillObject,
  },
  bannerScrim: {
    backgroundColor: 'rgba(15,27,38,0.18)',
    ...StyleSheet.absoluteFillObject,
  },
  logoRingWrap: {
    flexDirection: 'row',
    marginTop: -LOGO_SIZE / 2,
    paddingHorizontal: GRID_PADDING,
  },
  identity: {
    marginTop: 8,
    paddingHorizontal: GRID_PADDING,
  },
  logoRing: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 3,
    elevation: 4,
    height: LOGO_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#0F1B26',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    width: LOGO_SIZE,
  },
  logo: {
    height: '100%',
    width: '100%',
  },
  logoPlaceholder: {
    height: '55%',
    opacity: 0.35,
    width: '55%',
  },
  storeName: {
    color: BRAND_NAVY,
    fontSize: 20,
    fontWeight: '900',
    flexShrink: 1,
    lineHeight: 27,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  deliveryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
  },
  deliveryText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },

  /* About */
  aboutBlock: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: GRID_PADDING,
  },
  aboutRule: {
    backgroundColor: ACCENT_TEAL,
    borderRadius: 2,
    width: 3,
  },
  aboutBody: {
    flex: 1,
  },
  aboutHeading: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  aboutText: {
    color: '#4A5563',
    fontSize: 13.5,
    lineHeight: 20,
  },
  aboutToggle: {
    color: ACCENT_TEAL,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  reviewSection: {
    marginTop: 24,
    paddingHorizontal: GRID_PADDING,
  },
  reviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionHeading: {
    color: BRAND_NAVY,
    fontSize: 16,
    fontWeight: '900',
  },
  reviewRating: {
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reviewRatingValue: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '800',
  },
  reviewRatingCount: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewCard: {
    borderTopColor: '#EEF1F4',
    borderTopWidth: 1,
    paddingVertical: 14,
  },
  reviewHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  reviewAvatar: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  reviewInitial: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  reviewMeta: {
    flex: 1,
    gap: 3,
  },
  reviewName: {
    color: BRAND_NAVY,
    fontSize: 13.5,
    fontWeight: '800',
  },
  reviewStarsSmall: {
    flexDirection: 'row',
  },
  reviewMore: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 3,
    marginTop: 6,
  },
  reviewMoreText: {
    color: ACCENT_TEAL,
    fontSize: 13,
    fontWeight: '800',
  },
  reviewText: {
    color: '#4A5563',
    fontSize: 13,
    lineHeight: 19,
  },

  /* Grid */
  controls: {
    marginTop: 24,
  },
  gridHeadRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: GRID_PADDING,
  },
  gridHeadingInline: {
    color: BRAND_NAVY,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  sortButton: {
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  sortButtonActive: {
    backgroundColor: BRAND_NAVY,
  },
  sortText: {
    color: BRAND_NAVY,
    fontSize: 12,
    fontWeight: '700',
  },
  sortTextActive: {
    color: '#ffffff',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: GRID_PADDING,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: BRAND_NAVY,
    flex: 1,
    fontSize: 14,
    paddingVertical: 11,
  },
  chipRow: {
    marginBottom: 4,
    marginTop: 12,
  },
  chipRowContent: {
    gap: 8,
    paddingHorizontal: GRID_PADDING,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipSelected: {
    backgroundColor: BRAND_NAVY,
  },
  chipText: {
    color: BRAND_NAVY,
    fontSize: 12.5,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  chipCount: {
    color: MUTED,
    fontSize: 11.5,
    fontWeight: '700',
  },
  chipCountSelected: {
    color: ACCENT_TEAL,
  },
  clearFilters: {
    color: ACCENT_TEAL,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 14,
  },
  scrollTop: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    borderRadius: 22,
    bottom: 24,
    elevation: 6,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    shadowColor: '#0F1B26',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    width: 44,
  },
  row: {
    gap: GRID_GAP,
    paddingHorizontal: GRID_PADDING,
  },
  cardWrapper: {
    marginBottom: GRID_GAP,
    width: CARD_WIDTH,
  },

  centeredState: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
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
});

export default StoreScreen;
