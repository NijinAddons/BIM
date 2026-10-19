import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ListRenderItemInfo,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  TextLayoutEventData,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { bim } from '../../assets/images';
import {
  ActionButton,
  AppRefreshControl,
  ScreenHeader,
  WeeklyKitsSection,
} from '../../components';
import { useDeliveryEstimate } from '../../hooks/useDeliveryEstimate';
import type { RootStackScreenProps } from '../../navigation/types';
import {
  useBrandCategories,
  useCategories,
  useItemsByBrandGroup,
  useProductBundles,
  useSupplierReviews,
} from '../../queries';
import {
  CategoryItem,
  type BrandCategory,
  type ProductBundle,
  type SupplierReview,
  type SupplierReviewSummary,
} from '../../services';

const EMPTY_ITEMS: CategoryItem[] = [];
const EMPTY_BUNDLES: ProductBundle[] = [];

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';
const STAR = '#F5A623';

const NUM_COLUMNS = 2;
const GRID_PADDING = 16;
const GRID_GAP = 14;
const DESC_COLLAPSED_LINES = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const BANNER_HEIGHT = 132;
// The banner takes its height from the first image's aspect ratio, kept
// within these bounds so an odd upload can't squash or swamp the screen.
const BANNER_MIN_HEIGHT = 100;
const BANNER_MAX_HEIGHT = Math.round(SCREEN_WIDTH * 0.75);
const BANNER_AUTOSCROLL_MS = 4000;
const LOGO_SIZE = 84;
const CARD_WIDTH =
  (Dimensions.get('window').width -
    GRID_PADDING * 2 -
    GRID_GAP * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS;

const keyExtractor = (category: BrandCategory) => category.name;

const REVIEWS_PREVIEW = 0;

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

const bannerKeyExtractor = (uri: string, index: number) => `${index}-${uri}`;

const BrandBanner = React.memo(function BrandBannerCarousel({
  banners,
}: {
  banners: string[];
}) {
  const listRef = useRef<FlatList<string>>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [preview, setPreview] = useState<string | null>(null);
  // Height / width of the first banner, once it has loaded.
  const [aspect, setAspect] = useState<number | null>(null);

  const slides = useMemo(() => banners.filter(Boolean), [banners]);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1 || preview) {
      return;
    }
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % count;
      indexRef.current = next;
      setIndex(next);
      listRef.current?.scrollToOffset({
        offset: next * SCREEN_WIDTH,
        animated: true,
      });
    }, BANNER_AUTOSCROLL_MS);

    return () => clearInterval(timer);
  }, [count, preview]);

  const height = aspect
    ? Math.min(
        BANNER_MAX_HEIGHT,
        Math.max(BANNER_MIN_HEIGHT, Math.round(SCREEN_WIDTH * aspect)),
      )
    : BANNER_HEIGHT;

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      indexRef.current = next;
      setIndex(next);
    },
    [],
  );

  const renderBanner = useCallback(
    ({ item: uri, index: slideIndex }: ListRenderItemInfo<string>) => (
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={!!failed[slideIndex]}
        onPress={() => setPreview(uri)}
        style={[styles.bannerSlide, { height }]}
      >
        {failed[slideIndex] ? (
          <View style={styles.bannerFallback} />
        ) : (
          <FastImage
            onError={() => setFailed(prev => ({ ...prev, [slideIndex]: true }))}
            onLoad={
              slideIndex === 0
                ? event => {
                    const { width, height: imageHeight } = event.nativeEvent;
                    if (width > 0 && imageHeight > 0) {
                      setAspect(imageHeight / width);
                    }
                  }
                : undefined
            }
            resizeMode={FastImage.resizeMode.contain}
            source={{ uri }}
            style={StyleSheet.absoluteFill}
          />
        )}
      </TouchableOpacity>
    ),
    [failed, height],
  );

  if (count === 0) {
    return (
      <View style={styles.bannerWrap}>
        <View style={styles.bannerFallback} />
        <View style={styles.bannerScrim} />
      </View>
    );
  }

  return (
    <View style={[styles.bannerWrap, { height }]}>
      <FlatList
        ref={listRef}
        data={slides}
        decelerationRate="fast"
        horizontal
        keyExtractor={bannerKeyExtractor}
        onMomentumScrollEnd={onMomentumScrollEnd}
        pagingEnabled
        renderItem={renderBanner}
        scrollEnabled={count > 1}
        showsHorizontalScrollIndicator={false}
        snapToInterval={SCREEN_WIDTH}
      />
      <View pointerEvents="none" style={styles.bannerScrim} />
      {count > 1 ? (
        <View pointerEvents="none" style={styles.bannerDots}>
          {slides.map((uri, dotIndex) => (
            <View
              key={bannerKeyExtractor(uri, dotIndex)}
              style={[
                styles.bannerDot,
                dotIndex === index ? styles.bannerDotActive : null,
              ]}
            />
          ))}
        </View>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setPreview(null)}
        statusBarTranslucent
        transparent
        visible={!!preview}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setPreview(null)}
          style={styles.previewBackdrop}
        >
          <View style={styles.previewClose}>
            <MaterialCommunityIcons color="#ffffff" name="close" size={26} />
          </View>
          {preview ? (
            <FastImage
              resizeMode={FastImage.resizeMode.contain}
              source={{ uri: preview }}
              style={styles.previewImage}
            />
          ) : null}
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

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

type Props = RootStackScreenProps<'BrandDetail'>;

const EMPTY_CATEGORIES: BrandCategory[] = [];

/**
 * One of the brand's categories; opens its products. Shows the category's
 * own image, falling back to one of its product photos when the category has
 * none or it fails to load (e.g. uploaded as a private file).
 */
const BrandCategoryCard = React.memo(function BrandCategoryCardTile({
  category,
  groupImage,
  onPress,
}: {
  category: BrandCategory;
  groupImage: string | null;
  onPress: (category: BrandCategory) => void;
}) {
  const sources = useMemo(
    () =>
      [groupImage, category.image].filter(
        (uri): uri is string => !!uri,
      ),
    [groupImage, category.image],
  );
  const [failedCount, setFailedCount] = useState(0);
  const image = sources[failedCount] ?? null;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onPress(category)}
      style={styles.categoryCard}
    >
      {image ? (
        <FastImage
          key={image}
          onError={() => setFailedCount(count => count + 1)}
          resizeMode={FastImage.resizeMode.cover}
          source={{ uri: image }}
          style={styles.categoryImage}
        />
      ) : (
        <View style={[styles.categoryImage, styles.categoryFallback]}>
          <Image
            resizeMode="contain"
            source={bim}
            style={styles.categoryPlaceholder}
          />
        </View>
      )}
      <View style={styles.categoryChevron}>
        <MaterialCommunityIcons color="#FFFFFF" name="chevron-right" size={16} />
      </View>
      <View style={styles.categoryOverlay}>
        <Text numberOfLines={2} style={styles.categoryName}>
          {category.name}
        </Text>
        <Text style={styles.categoryCount}>
          {category.count} {category.count === 1 ? 'product' : 'products'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const BrandScreen = ({ navigation, route }: Props) => {
  const { brand } = route.params;

  const [logoFailed, setLogoFailed] = useState(!brand.image);
  // The brand's products are shown as category (Item Group) cards; a card
  // opens that category's products on BrandCategoryItems.
  const categoriesQuery = useBrandCategories(brand.id);
  const categories = categoriesQuery.data ?? EMPTY_CATEGORIES;
  // Card images come from the Item Group itself (the Categories tab's tree).
  const itemGroupsQuery = useCategories();
  const imageByGroup = useMemo(
    () =>
      new Map(
        (itemGroupsQuery.data ?? []).map(group => [group.id, group.image]),
      ),
    [itemGroupsQuery.data],
  );
  // The first category's items stand in for the brand: they place the
  // delivery estimate and find kits sold under the brand.
  const firstGroup = categories[0]?.name ?? null;
  const sampleQuery = useItemsByBrandGroup(brand.id, firstGroup);
  const sampleItems = sampleQuery.data ?? EMPTY_ITEMS;
  const bundlesQuery = useProductBundles();
  const allBundles = bundlesQuery.data ?? EMPTY_BUNDLES;
  // A kit belongs here if its Item carries this brand, or if the brand's
  // item list includes it.
  const bundles = useMemo(() => {
    const brandItemIds = new Set(sampleItems.map(item => item.id));
    return allBundles.filter(
      bundle =>
        bundle.item.brand === brand.id || brandItemIds.has(bundle.item.id),
    );
  }, [allBundles, sampleItems, brand.id]);
  const loading = categoriesQuery.isPending;
  const error =
    categoriesQuery.isError && !categoriesQuery.data
      ? 'Could not load products. Check your connection and try again.'
      : null;
  const loadCategories = useCallback(() => {
    categoriesQuery.refetch();
  }, [categoriesQuery]);
  const [description] = useState<string | null>(
    brand.description?.trim() || null,
  );
  const [descExpanded, setDescExpanded] = useState(false);
  const [descMeasured, setDescMeasured] = useState(false);
  const [descNeedsToggle, setDescNeedsToggle] = useState(false);
  const reviewsQuery = useSupplierReviews(brand.name);
  const reviews = reviewsQuery.data ?? EMPTY_REVIEWS;
  const [reviewsExpanded, setReviewsExpanded] = useState(false);

  // Pull-to-refresh keeps the current grid on screen and leaves it
  // untouched if the refetch fails.
  const refreshBrand = useCallback(
    () =>
      Promise.all([
        categoriesQuery.refetch(),
        // `refetch` ignores `enabled`, so only reload a loaded category.
        firstGroup ? sampleQuery.refetch() : undefined,
        bundlesQuery.refetch(),
        reviewsQuery.refetch(),
      ]),
    [categoriesQuery, firstGroup, sampleQuery, bundlesQuery, reviewsQuery],
  );

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

  const openKit = useCallback(
    (bundle?: ProductBundle) =>
      navigation.navigate(
        'WeeklyKits',
        bundle ? { kitId: bundle.item.id } : undefined,
      ),
    [navigation],
  );

  const openCategory = useCallback(
    (category: BrandCategory) =>
      navigation.navigate('BrandCategoryItems', {
        brand,
        itemGroup: category.name,
      }),
    [navigation, brand],
  );

  const renderCategory = useCallback(
    ({ item: category }: ListRenderItemInfo<BrandCategory>) => (
      <BrandCategoryCard
        category={category}
        groupImage={imageByGroup.get(category.name) ?? null}
        onPress={openCategory}
      />
    ),
    [imageByGroup, openCategory],
  );

  // The Brand the screen was opened with carries no location of its own —
  // borrow the first loaded item's supplier location so the pill reflects
  // real distance, not a guess. Items can span multiple suppliers for a
  // brand, so this is an approximation, not an exact per-item value.
  const representativeItem = sampleItems[0] ?? null;
  const deliveryEstimate = useDeliveryEstimate({
    latitude: representativeItem?.supplierLatitude,
    longitude: representativeItem?.supplierLongitude,
    address: representativeItem?.supplierAddress,
  });

  const productCount = loading
    ? '…'
    : String(categories.reduce((sum, category) => sum + category.count, 0));
  const visibleReviews = useMemo(
    () =>
      reviewsExpanded
        ? reviews.reviews
        : reviews.reviews.slice(0, REVIEWS_PREVIEW),
    [reviews.reviews, reviewsExpanded],
  );

  const infoPills = useMemo(
    () => (
      // One line under "Verified brand", on the same left edge.
      <View style={styles.metaRow}>
        <View style={styles.verifiedRow}>
          <MaterialCommunityIcons
            color={BRAND_NAVY}
            name="shopping-outline"
            size={14}
          />
          <Text style={styles.metaText}>{productCount} products</Text>
        </View>
        {deliveryEstimate ? (
          <View style={styles.verifiedRow}>
            <MaterialCommunityIcons
              color={ACCENT_TEAL}
              name="clock-fast"
              size={14}
            />
            <Text style={styles.metaText}>{deliveryEstimate}</Text>
          </View>
        ) : null}
      </View>
    ),
    [productCount, deliveryEstimate],
  );

  const brandHeader = useMemo(
    () => (
      <View style={styles.headerWrap}>
        {/* Brand banner */}
        <BrandBanner banners={brand.banners} />

        {/* Circular logo overlapping the banner */}
        <View style={styles.logoRingWrap}>
          <View style={styles.logoRing}>
            {brand.image && !logoFailed ? (
              <FastImage
                onError={() => setLogoFailed(true)}
                resizeMode={FastImage.resizeMode.contain}
                source={{ uri: brand.image }}
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
          <Text numberOfLines={2} style={styles.brandName}>
            {brand.name}
          </Text>
          <View style={styles.verifiedRow}>
            <MaterialCommunityIcons
              color={ACCENT_TEAL}
              name="check-decagram"
              size={14}
            />
            <Text style={styles.verifiedText}>Verified brand</Text>
          </View>
          {infoPills}
        </View>

        {description ? (
          <View style={styles.aboutBlock}>
            <View style={styles.aboutRule} />
            <View style={styles.aboutBody}>
              <Text style={styles.aboutHeading}>About the brand</Text>
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

        {/* Reviews */}
        {reviews.count > 0 || reviews.reviews.length > 0 ? (
          <View style={styles.reviewSection}>
            <View style={styles.reviewHeader}>
              <Text style={styles.sectionHeading}>Brand reviews</Text>
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
                    ? 'Hide reviews'
                    : `Show ${reviews.reviews.length} ${
                        reviews.reviews.length === 1 ? 'review' : 'reviews'
                      }`}
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

        {bundles.length > 0 ? (
          <WeeklyKitsSection bundles={bundles} onOpenKit={openKit} />
        ) : null}

        {!loading && !error && categories.length > 0 ? (
          <View style={styles.controls}>
            <Text style={[styles.sectionHeading, styles.categoriesHeading]}>
              Categories
            </Text>
          </View>
        ) : null}
      </View>
    ),
    [
      logoFailed,
      brand,
      infoPills,
      description,
      descExpanded,
      descMeasured,
      descNeedsToggle,
      onDescriptionLayout,
      reviews,
      reviewsExpanded,
      visibleReviews,
      bundles,
      openKit,
      loading,
      error,
      categories,
    ],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />
      <ScreenHeader onBack={() => navigation.goBack()} title={brand.name} />
      <FlatList
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        data={loading || error ? EMPTY_CATEGORIES : categories}
        refreshControl={
          <AppRefreshControl onRefresh={refreshBrand} />
        }
        keyExtractor={keyExtractor}
        ListHeaderComponent={brandHeader}
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
                onPress={loadCategories}
                style={styles.retryButton}
                variant="dark"
              />
            </View>
          ) : categories.length === 0 && bundles.length === 0 ? (
            <View style={styles.centeredState}>
              <MaterialCommunityIcons
                color="#C6CDD3"
                name="package-variant"
                size={40}
              />
              <Text style={styles.stateText}>
                {brand.name} has no products yet.
              </Text>
            </View>
          ) : null
        }
        numColumns={NUM_COLUMNS}
        renderItem={renderCategory}
        showsVerticalScrollIndicator={false}
      />
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
  bannerWrap: {
    backgroundColor: '#EEF1F4',
    height: BANNER_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
  bannerSlide: {
    height: BANNER_HEIGHT,
    width: SCREEN_WIDTH,
  },
  bannerFallback: {
    backgroundColor: BRAND_NAVY,
    ...StyleSheet.absoluteFillObject,
  },
  bannerScrim: {
    backgroundColor: 'rgba(15,27,38,0.18)',
    ...StyleSheet.absoluteFillObject,
  },
  bannerDots: {
    alignItems: 'center',
    bottom: 8,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  bannerDot: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  bannerDotActive: {
    backgroundColor: '#ffffff',
    width: 16,
  },
  previewBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.92)',
    flex: 1,
    justifyContent: 'center',
  },
  previewImage: {
    height: '70%',
    width: '100%',
  },
  previewClose: {
    position: 'absolute',
    right: 20,
    top: 52,
  },

  /* Profile */
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
  // The largest square that fits inside the round ring (1/√2 of it), so a
  // square or wide logo's corners aren't clipped by the circle.
  logo: {
    height: '70%',
    width: '70%',
  },
  logoPlaceholder: {
    height: '55%',
    opacity: 0.35,
    width: '55%',
  },
  brandName: {
    color: BRAND_NAVY,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 27,
    marginBottom: 8,
  },
  verifiedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  verifiedText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },

  metaRow: {
    columnGap: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  metaText: {
    color: BRAND_NAVY,
    fontSize: 12,
    fontWeight: '700',
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

  /* Reviews */
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
    marginBottom: 12,
    marginTop: 24,
  },
  categoriesHeading: {
    paddingHorizontal: GRID_PADDING,
  },
  row: {
    gap: GRID_GAP,
    paddingHorizontal: GRID_PADDING,
  },
  categoryCard: {
    backgroundColor: '#F2F2F2',
    borderColor: '#E3E7EB',
    borderRadius: 16,
    borderWidth: 1,
    height: 120,
    marginBottom: GRID_GAP,
    overflow: 'hidden',
    width: CARD_WIDTH,
  },
  categoryImage: {
    height: '100%',
    width: '100%',
  },
  categoryFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPlaceholder: {
    height: '40%',
    opacity: 0.3,
    width: '40%',
  },
  categoryChevron: {
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
  categoryOverlay: {
    backgroundColor: 'rgba(8,24,40,0.45)',
    bottom: 0,
    left: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'absolute',
    right: 0,
  },
  categoryName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  categoryCount: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
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

export default BrandScreen;
