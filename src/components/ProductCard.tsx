import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { bim } from '../assets/images';
import { setCartQty, useCartQty } from '../hooks/useCart';
import { useDeliveryEstimate } from '../hooks/useDeliveryEstimate';
import { toggleWishlist, useIsWishlisted } from '../hooks/useWishlist';
import { isVegetableItem, type CategoryItem } from '../services';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';
const BORDER = '#EEF1F4';

// Trim trailing-zero decimals ("329.00" -> "329", "12.50" -> "12.5") so the
// price stays compact enough to sit on one row next to the cart control.
const formatPrice = (value: number) =>
  Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '');

export type ProductCardItem = CategoryItem;

type Props = {
  item: ProductCardItem;
  onPress?: (item: ProductCardItem) => void;
  onQuantityChange?: (item: ProductCardItem, quantity: number) => void;
  onToggleWishlist?: (item: ProductCardItem) => void;
};

type ImageStatus = 'error' | 'loaded' | 'loading';

function ProductCard({
  item,
  onPress,
  onQuantityChange,
  onToggleWishlist,
}: Props) {
  const [imageStatus, setImageStatus] = useState<ImageStatus>(
    item.image ? 'loading' : 'error',
  );
  const wishlisted = useIsWishlisted(item.id);
  const quantity = useCartQty(item.id);
  const deliveryTime = useDeliveryEstimate({
    latitude: item.supplierLatitude,
    longitude: item.supplierLongitude,
    address: item.supplierAddress,
  });

  // Vegetables carry their brand here instead of the supplier.
  const showBrand = isVegetableItem(item) && !!item.brand;

  const handlePress = useCallback(() => onPress?.(item), [item, onPress]);

  const handleToggleWishlist = useCallback(() => {
    toggleWishlist(item);
    onToggleWishlist?.(item);
  }, [item, onToggleWishlist]);

  const changeQuantity = useCallback(
    (next: number) => {
      setCartQty(item, next);
      onQuantityChange?.(item, Math.max(0, next));
    },
    [item, onQuantityChange],
  );

  const atMax = !item.rfqOnly && quantity >= item.stock;
  const handleAdd = useCallback(() => changeQuantity(1), [changeQuantity]);
  const handleIncrement = useCallback(
    () => changeQuantity(quantity + 1),
    [changeQuantity, quantity],
  );
  const handleDecrement = useCallback(
    () => changeQuantity(quantity - 1),
    [changeQuantity, quantity],
  );

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handlePress}
      style={styles.card}
    >
      <View style={styles.thumbnail}>
        {item.image ? (
          <FastImage
            onError={() => setImageStatus('error')}
            onLoad={() => setImageStatus('loaded')}
            resizeMode={FastImage.resizeMode.contain}
            source={{
              cache: FastImage.cacheControl.immutable,
              priority: FastImage.priority.normal,
              uri: item.image,
            }}
            style={styles.thumbnailImage}
          />
        ) : null}
        {imageStatus !== 'loaded' ? (
          <View style={styles.thumbnailOverlay}>
            {imageStatus === 'loading' ? (
              <ActivityIndicator color={MUTED} size="small" />
            ) : (
              <FastImage
                resizeMode={FastImage.resizeMode.contain}
                source={bim}
                style={styles.thumbnailFallback}
              />
            )}
          </View>
        ) : null}
        <TouchableOpacity
          hitSlop={8}
          onPress={handleToggleWishlist}
          style={styles.wishlistBadge}
        >
          <MaterialCommunityIcons
            color={wishlisted ? '#E0574F' : '#ffffff'}
            name={wishlisted ? 'heart' : 'heart-outline'}
            size={15}
          />
        </TouchableOpacity>

        {deliveryTime ? (
          <View style={styles.deliveryBadge}>
            <MaterialCommunityIcons
              color="#ffffff"
              name="clock-fast"
              size={11}
            />
            <Text style={styles.deliveryBadgeText}>{deliveryTime}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardInfo}>
        <View style={styles.itemNameBox}>
          <Text numberOfLines={2} style={styles.itemName}>
            {item.name}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <MaterialCommunityIcons
            color={MUTED}
            name={showBrand ? 'tag-outline' : 'storefront-outline'}
            size={11}
          />
          <Text numberOfLines={1} style={styles.metaText}>
            {showBrand ? item.brand : item.supplier ?? 'BuyInMinutes'}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text numberOfLines={1} style={styles.itemPrice}>
            AED {formatPrice(item.price)}
          </Text>

          {/* RFQ items start with the full-width "Request Quote" button below
              (which adds them to the cart) and aren't limited by stock. */}
          {item.rfqOnly && quantity === 0 ? null : !item.rfqOnly &&
            item.stock <= 0 ? (
            <Text style={styles.soldOutText}>Sold out</Text>
          ) : quantity === 0 ? (
            <TouchableOpacity
              activeOpacity={0.85}
              hitSlop={6}
              onPress={handleAdd}
              style={styles.addButton}
            >
              <Text numberOfLines={1} style={styles.addButtonText}>
                ADD TO CART
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.stepper}>
              <TouchableOpacity
                hitSlop={6}
                onPress={handleDecrement}
                style={styles.stepperButton}
              >
                <MaterialCommunityIcons
                  color="#ffffff"
                  name={quantity <= 1 ? 'trash-can-outline' : 'minus'}
                  size={13}
                />
              </TouchableOpacity>
              <Text style={styles.stepperCount}>{quantity}</Text>
              <TouchableOpacity
                disabled={atMax}
                hitSlop={6}
                onPress={handleIncrement}
                style={[
                  styles.stepperButton,
                  atMax ? styles.stepperButtonDisabled : null,
                ]}
              >
                <MaterialCommunityIcons color="#ffffff" name="plus" size={13} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {item.rfqOnly && quantity === 0 ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleAdd}
            style={styles.rfqButton}
          >
            <MaterialCommunityIcons
              color="#ffffff"
              name="file-document-outline"
              size={13}
            />
            <Text style={styles.rfqButtonText}>Request Quote</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(ProductCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: BORDER,
    borderRadius: 18,
    borderWidth: 1,
    // boxShadow instead of Android `elevation`, whose shadow is dark and
    // pooled under the card's bottom edge; this renders the same soft shadow
    // on both platforms.
    boxShadow: '0px 2px 8px rgba(15, 27, 38, 0.05)',
    flex: 1,
    overflow: 'hidden',
  },
  // White, not grey: card widths are fractional, so the image can round a
  // pixel short of this box and a grey background showed through as a thin
  // line under the image. The loading/fallback overlay keeps its own grey.
  thumbnail: {
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    width: '100%',
  },
  thumbnailImage: {
    height: '100%',
    width: '100%',
  },
  thumbnailFallback: {
    height: '52%',
    opacity: 0.9,
    width: '52%',
  },
  thumbnailOverlay: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  wishlistBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(31,46,61,0.55)',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    top: 6,
    width: 26,
  },
  deliveryBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,24,40,0.72)',
    borderRadius: 999,
    bottom: 6,
    flexDirection: 'row',
    gap: 3,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: 'absolute',
  },
  deliveryBadgeText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '700',
  },
  cardInfo: {
    paddingBottom: 10,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  // Reserves room for 2 lines so cards in the same grid row stay the same
  // height regardless of name length, but bottom-aligns the text inside it —
  // a 1-line name then sits right against the supplier row below instead of
  // leaving a blank line's worth of gap above it.
  itemNameBox: {
    height: 34,
    justifyContent: 'flex-end',
  },
  itemName: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  metaText: {
    color: MUTED,
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  itemPrice: {
    color: BRAND_NAVY,
    flexShrink: 1,
    fontSize: 13.5,
    fontWeight: '800',
    marginRight: 8,
  },
  // Sits on the price row, so it's kept compact: the label must fit beside
  // "AED 000.00" on a half-width grid card.
  addButton: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    borderRadius: 6,
    flexShrink: 0,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  rfqButton: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
    width: '100%',
  },
  rfqButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: ACCENT_TEAL,
    borderRadius: 999,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepperButton: {
    alignItems: 'center',
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  stepperButtonDisabled: {
    opacity: 0.35,
  },
  stepperCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    minWidth: 12,
    textAlign: 'center',
  },
  soldOutText: {
    color: '#C0392B',
    fontSize: 12,
    fontWeight: '800',
  },
});
