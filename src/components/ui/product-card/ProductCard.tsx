import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { RootStackParamList } from '../../../app/navigation/types/root-navigation.types';
import { addProductToCart } from '../../../features/cart/service';
import {
  addWishlistItem,
  createWishlistItemFromProduct,
  getWishlistItems,
  loadStoredWishlist,
  subscribeWishlist,
} from '../../../features/product/service';
import { Product } from '../../../features/product/types';
import { colors } from '../../../theme/colors';

type Props = {
  item: Product;
  onPress?: () => void;
};

type ProductCardNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ProductDetails'
>;

export default function ProductCard({ item, onPress }: Props) {
  const navigation = useNavigation<ProductCardNavigationProp>();
  const wishlistItems = React.useSyncExternalStore(
    subscribeWishlist,
    getWishlistItems,
    getWishlistItems,
  );
  const isWishlisted = wishlistItems.some(
    wishlistItem => wishlistItem.id === item.id,
  );

  React.useEffect(() => {
    loadStoredWishlist();
  }, []);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={
        onPress ??
        (() => navigation.navigate('ProductDetails', { product: item }))
      }
      style={styles.card}
    >
      <View style={styles.imageWrap}>
        <View style={[styles.productImage, { backgroundColor: item.tone }]}>
          <Image
            source={{ uri: item.image }}
            style={styles.productImageAsset}
          />
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.offerTag}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={async event => {
            event.stopPropagation();
            await addWishlistItem(createWishlistItemFromProduct(item));
            navigation.navigate('Wishlist');
          }}
          style={styles.wishlistButton}
        >
          <MaterialCommunityIcons
            color={isWishlisted ? '#ef4662' : colors.mutedText}
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={18}
          />
        </TouchableOpacity>
      </View>
      <Text numberOfLines={1} style={styles.name}>
        {item.name}
      </Text>
      <Text style={styles.size}>{item.grams}</Text>
      <View style={styles.footerRow}>
        <View style={styles.metaRow}>
          <Text style={styles.price}>AED {item.price}</Text>
          <View style={styles.sellersBadge}>
            <Text style={styles.sellers}>
              Total sellers: {item.totalSellers}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={event => {
            event.stopPropagation();
            addProductToCart(item);
          }}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
        >
          {({ pressed }) => (
            <Text style={[styles.addText, pressed && styles.addTextPressed]}>
              Add to cart
            </Text>
          )}
        </Pressable>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 228,
    marginRight: 12,
    padding: 10,
    width: 180,
  },
  imageWrap: {
    marginBottom: 8,
    position: 'relative',
  },
  productImage: {
    borderRadius: 12,
    height: 82,
    overflow: 'hidden',
    width: '100%',
  },
  productImageAsset: {
    height: '100%',
    width: '100%',
  },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 6,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    top: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  wishlistButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 32,
  },
  name: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  size: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 3,
  },
  footerRow: {
    gap: 8,
    marginTop: 'auto',
  },
  metaRow: {
    gap: 2,
  },
  price: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sellers: {
    color: '#0f766e',
    fontSize: 10,
    fontWeight: '700',
  },
  sellersBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e6fffa',
    borderColor: '#99f6e4',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.tagGreen,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    width: '100%',
  },
  addButtonPressed: {
    backgroundColor: colors.tagGreen,
  },
  addText: {
    color: colors.tagGreen,
    fontSize: 12,
    fontWeight: '700',
  },
  addTextPressed: {
    color: '#ffffff',
  },
});
