import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useCart, useCartCount, useCartSubtotal } from '../hooks/useCart';
import { GREEN } from '../theme/colors';

const formatPrice = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');

type Props = {
  onPress: () => void;
  /** Positioning from the screen (the bar is absolutely positioned). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Floating "N items · AED X — View Cart" pill. Renders nothing while the cart
 * is empty, so screens can mount it unconditionally.
 */
export default function CartBar({ onPress, style }: Props) {
  const cartLines = useCart();
  const cartCount = useCartCount();
  const cartSubtotal = useCartSubtotal();
  const image = cartLines[0]?.item.image ?? null;

  if (cartCount === 0) {
    return null;
  }

  return (
    <View style={[styles.bar, style]}>
      <View style={styles.icon}>
        {image ? (
          <FastImage
            resizeMode={FastImage.resizeMode.cover}
            source={{ uri: image }}
            style={styles.image}
          />
        ) : (
          <MaterialCommunityIcons color="#FFFFFF" name="shopping" size={18} />
        )}
      </View>
      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.count}>
          {cartCount} {cartCount === 1 ? 'item' : 'items'} · AED{' '}
          {formatPrice(cartSubtotal)}
        </Text>
        <Text style={styles.hint}>plus taxes</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.85}
        onPress={onPress}
        style={styles.button}
      >
        <Text style={styles.buttonText}>View Cart</Text>
        <MaterialCommunityIcons color="#FFFFFF" name="arrow-right" size={16} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: GREEN,
    borderRadius: 999,
    bottom: 10,
    elevation: 6,
    flexDirection: 'row',
    left: 40,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'absolute',
    right: 40,
    shadowColor: '#0F1B26',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 32,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  info: {
    flex: 1,
    marginLeft: 10,
  },
  count: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
