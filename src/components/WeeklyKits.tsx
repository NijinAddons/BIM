import React from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { bim } from '../assets/images';
import {
  formatKg,
  kitIndexForDate,
  nextKitDeliveryDate,
  type ProductBundle,
} from '../services';
import {
  BORDER,
  CARD,
  GREEN,
  GREEN_TINT,
  MUTED,
  SURFACE,
  TEXT,
} from '../theme/colors';

const KIT_CARD_WIDTH = 112;

// Trim trailing-zero decimals ("329.00" -> "329"), as on ProductCard.
const formatPrice = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');

/** "AED 49", or a placeholder while the kit has no selling price yet. */
export function kitPriceLabel(bundle: ProductBundle): string {
  return bundle.item.price > 0
    ? `AED ${formatPrice(bundle.item.price)}`
    : 'Price coming soon';
}

export function kitItemCountLabel(bundle: ProductBundle): string {
  const count = bundle.components.length;
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

/** "6.55 kg / week", falling back to the item count. */
export function kitWeightLabel(bundle: ProductBundle): string {
  return bundle.weightKg !== null
    ? `${formatKg(bundle.weightKg)} / week`
    : kitItemCountLabel(bundle);
}

/**
 * Id of the one week kit open for orders — the kit for the next Saturday
 * whose Friday cutoff hasn't passed — or null if none.
 */
export function nextSaturdayKitId(bundles: ProductBundle[]): string | null {
  const weeks = bundles.filter(bundle => bundle.role === 'week');
  const index = kitIndexForDate(nextKitDeliveryDate(), weeks.length);
  return weeks[index]?.item.id ?? null;
}

type KitImageProps = {
  bundle: ProductBundle;
  style?: StyleProp<ViewStyle>;
};

/**
 * The kit's own image when it has one, else a 2×2 collage of its contents
 * (kit Items usually have no picture of their own).
 */
export function KitImage({ bundle, style }: KitImageProps) {
  if (bundle.item.image) {
    return (
      <View style={[styles.imageBox, style]}>
        <FastImage
          resizeMode={FastImage.resizeMode.cover}
          source={{ uri: bundle.item.image }}
          style={styles.fill}
        />
      </View>
    );
  }

  const images = bundle.components
    .map(component => component.image)
    .filter((uri): uri is string => !!uri);
  // A partial grid would leave blank quadrants, so fewer than four images
  // shows just the first one.
  const tiles = images.length >= 4 ? images.slice(0, 4) : images.slice(0, 1);

  if (tiles.length === 0) {
    return (
      <View style={[styles.imageBox, styles.fallbackBox, style]}>
        <FastImage
          resizeMode={FastImage.resizeMode.contain}
          source={bim}
          style={styles.fallbackLogo}
        />
      </View>
    );
  }

  return (
    <View style={[styles.imageBox, styles.collage, style]}>
      {tiles.map((uri, index) => (
        <FastImage
          key={`${index}-${uri}`}
          resizeMode={FastImage.resizeMode.cover}
          source={{ uri }}
          style={tiles.length === 1 ? styles.fill : styles.collageTile}
        />
      ))}
    </View>
  );
}

/**
 * Banner-carousel slide promoting the weekly kits (drawn in code — the kits
 * have no banner art of their own). The carousel handles the tap.
 */
export function WeeklyKitsBanner({ bundles }: { bundles: ProductBundle[] }) {
  const nextId = nextSaturdayKitId(bundles);
  const next = bundles.find(bundle => bundle.item.id === nextId) ?? bundles[0];
  if (!next) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <View style={styles.bannerText}>
        <View style={styles.bannerPill}>
          <Text style={styles.bannerPillText}>DELIVERED EVERY SATURDAY</Text>
        </View>
        <Text numberOfLines={2} style={styles.bannerTitle}>
          Weekly Vegetable Kits
        </Text>
        <Text numberOfLines={2} style={styles.bannerSubtitle}>
          Next Saturday: {next.label}
        </Text>
        <View style={styles.bannerCta}>
          <Text style={styles.bannerCtaText}>Shop kits</Text>
          <MaterialCommunityIcons color={GREEN} name="chevron-right" size={16} />
        </View>
      </View>
      <KitImage bundle={next} style={styles.bannerImage} />
    </View>
  );
}

type SectionProps = {
  bundles: ProductBundle[];
  first?: boolean;
  /** Called with no kit for "See all". */
  onOpenKit: (bundle?: ProductBundle) => void;
};

const kitKeyExtractor = (bundle: ProductBundle) => bundle.item.id;

/** Home's "Weekly Kits" section: a compact row of this month's kits. */
export default function WeeklyKitsSection({
  bundles,
  first = false,
  onOpenKit,
}: SectionProps) {
  const nextId = nextSaturdayKitId(bundles);
  if (bundles.length === 0) {
    return null;
  }

  const renderKit = ({ item: bundle }: ListRenderItemInfo<ProductBundle>) => {
    // Only next Saturday's kit can be ordered; the rest are shown locked.
    const isNext = bundle.item.id === nextId;
    const locked = bundle.role === 'week' && !isNext;
    return (
      <Pressable
        accessibilityState={{ disabled: locked }}
        onPress={() => onOpenKit(locked ? undefined : bundle)}
        style={({ pressed }) => [
          styles.kitCard,
          isNext ? styles.kitCardNext : null,
          locked ? styles.kitCardLocked : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <KitImage bundle={bundle} style={styles.kitImage} />
        {isNext ? (
          <View style={styles.nextBadge}>
            <Text style={styles.nextBadgeText}>NEXT</Text>
          </View>
        ) : null}
        {locked ? (
          <View style={[styles.nextBadge, styles.lockedBadge]}>
            <MaterialCommunityIcons color="#ffffff" name="lock" size={10} />
            <Text style={styles.nextBadgeText}>CLOSED</Text>
          </View>
        ) : null}
        <View style={styles.kitInfo}>
          <Text numberOfLines={1} style={styles.kitName}>
            {bundle.label}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.priceText,
              bundle.item.price > 0 ? null : styles.pricePending,
            ]}
          >
            {kitPriceLabel(bundle)}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.section, first ? styles.sectionFirst : null]}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly Vegetable Kits</Text>
        <Pressable hitSlop={8} onPress={() => onOpenKit()}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>
      <FlatList
        contentContainerStyle={styles.kitList}
        data={bundles}
        horizontal
        keyExtractor={kitKeyExtractor}
        renderItem={renderKit}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const softShadow = {
  elevation: 1,
  shadowColor: '#0F1B26',
  shadowOffset: { height: 2, width: 0 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
};

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
  },
  sectionFirst: {
    marginTop: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  title: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
  },
  seeAll: {
    color: GREEN,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  pricePending: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
  },
  kitList: {
    gap: 10,
    paddingHorizontal: 16,
  },
  kitCard: {
    ...softShadow,
    backgroundColor: CARD,
    borderColor: BORDER,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    width: KIT_CARD_WIDTH,
  },
  kitCardNext: {
    backgroundColor: GREEN_TINT,
    borderColor: GREEN,
  },
  kitCardLocked: {
    opacity: 0.55,
  },
  kitImage: {
    height: 72,
    width: '100%',
  },
  nextBadge: {
    alignItems: 'center',
    backgroundColor: GREEN,
    borderRadius: 4,
    flexDirection: 'row',
    gap: 2,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    position: 'absolute',
    top: 6,
  },
  lockedBadge: {
    backgroundColor: MUTED,
  },
  nextBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  kitInfo: {
    gap: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  kitName: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '700',
  },
  priceText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '800',
  },
  banner: {
    alignItems: 'center',
    backgroundColor: GREEN,
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  bannerText: {
    flex: 1,
    gap: 4,
  },
  bannerPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bannerPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '900',
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  bannerCta: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    flexDirection: 'row',
    marginTop: 6,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 5,
  },
  bannerCtaText: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '800',
  },
  bannerImage: {
    aspectRatio: 1,
    borderRadius: 14,
    height: '100%',
    maxHeight: 150,
  },
  imageBox: {
    backgroundColor: SURFACE,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    width: '100%',
  },
  collage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  collageTile: {
    height: '50%',
    width: '50%',
  },
  fallbackBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackLogo: {
    height: '50%',
    opacity: 0.9,
    width: '50%',
  },
});
