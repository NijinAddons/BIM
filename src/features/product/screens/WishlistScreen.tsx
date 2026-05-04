import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  addProductToCart,
  getCartItems,
  subscribeCart,
  updateCartItemQuantity,
} from '../../cart/service';
import {getUserProfile, subscribeProfile} from '../../profile/service';
import type {Product} from '../types';
import {
  getWishlistItems,
  loadStoredWishlist,
  removeWishlistItem,
  subscribeWishlist,
  WishlistItem,
} from '../service';
import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';

type WishlistNavProp = NativeStackNavigationProp<RootStackParamList, 'Wishlist'>;

const COORDINATE_LOCATION_PATTERN =
  /^Current location \((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/;

const getWishlistLocationLabel = (address: string) => {
  const trimmedAddress = address.trim();

  if (!trimmedAddress || COORDINATE_LOCATION_PATTERN.test(trimmedAddress)) {
    return 'Select delivery location';
  }

  if (trimmedAddress.length > 40) {
    return `${trimmedAddress.slice(0, 40).trimEnd()}...`;
  }

  return trimmedAddress;
};

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<WishlistNavProp>();
  const profile = React.useSyncExternalStore(
    subscribeProfile,
    getUserProfile,
    getUserProfile,
  );
  const cartItems = React.useSyncExternalStore(
    subscribeCart,
    getCartItems,
    getCartItems,
  );
  const [items, setItems] = React.useState<WishlistItem[]>(getWishlistItems());
  const [wishlistToastVisible, setWishlistToastVisible] = React.useState(false);
  const [wishlistToastMessage, setWishlistToastMessage] = React.useState('Removed from wishlist');
  const displayedLocation = getWishlistLocationLabel(profile.address);

  useFocusEffect(
    React.useCallback(() => {
      const syncWishlist = async () => {
        const storedItems = await loadStoredWishlist();
        setItems(storedItems);
      };

      syncWishlist();

      return subscribeWishlist(() => {
        setItems(getWishlistItems());
      });
    }, []),
  );

  const onRemove = async (id: string) => {
    const updatedItems = await removeWishlistItem(id);
    setItems(updatedItems);
    setWishlistToastMessage('Removed from wishlist');
    setWishlistToastVisible(true);
  };

  const onAddToCart = (item: WishlistItem) => {
    addProductToCart({
      id: item.id,
      image: item.image,
      name: item.name,
      price: item.price.toString(),
      grams: item.unit,
      eta: item.eta,
      tone: '#f3eadc',
      offerTag: item.mrp > item.price ? `AED ${item.mrp - item.price} OFF` : 'Saved',
      totalSellers: 1,
    });
  };

  const toProductDetailsItem = (item: WishlistItem): Product => {
    const price = item.price.toFixed(item.price % 1 === 0 ? 0 : 2);

    return {
      id: item.id,
      image: item.image,
      name: item.name,
      price,
      grams: item.unit,
      eta: item.eta,
      tone: '#f3eadc',
      offerTag: item.mrp > item.price ? `AED ${item.mrp - item.price} OFF` : 'Saved',
      totalSellers: 1,
    };
  };

  const getCartQuantity = (id: string) =>
    cartItems.find(cartItem => cartItem.id === id)?.quantity ?? 0;

  React.useEffect(() => {
    if (!wishlistToastVisible) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setWishlistToastVisible(false);
    }, 4000);

    return () => clearTimeout(timeoutId);
  }, [wishlistToastVisible]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={[styles.header, {paddingTop: insets.top + 6}]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Your wishlist</Text>
            <Text numberOfLines={1} style={styles.headerSubtitle}>
              {displayedLocation}
            </Text>
          </View>
          <Pressable style={styles.actionButton}>
            <MaterialCommunityIcons color="#303030" name="magnify" size={20} />
          </Pressable>
          <Pressable style={styles.actionButton}>
            <MaterialCommunityIcons color="#303030" name="share-variant-outline" size={18} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + 28},
        ]}
        showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptySubtitle}>
              Tap the heart on any product to save it here.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map(item => (
              <Pressable
                key={item.id}
                onPress={() =>
                  navigation.navigate('ProductDetails', {
                    product: toProductDetailsItem(item),
                  })
                }
                style={styles.card}>
                <View style={styles.imageWrap}>
                  <Image source={{uri: item.image}} style={styles.image} />
                  <Pressable
                    onPress={event => {
                      event.stopPropagation();
                      onRemove(item.id);
                    }}
                    style={styles.heartButton}>
                    <MaterialCommunityIcons color="#ef4662" name="heart" size={16} />
                  </Pressable>
                  {getCartQuantity(item.id) > 0 ? (
                    <View style={styles.stepper}>
                      <Pressable
                        onPress={event => {
                          event.stopPropagation();
                          updateCartItemQuantity(item.id, -1);
                        }}
                        style={({pressed}) => [
                          styles.stepperButton,
                          pressed && styles.stepperButtonPressed,
                        ]}>
                        <Text style={styles.stepperText}>-</Text>
                      </Pressable>
                      <Text style={styles.stepperQuantity}>
                        {getCartQuantity(item.id)}
                      </Text>
                      <Pressable
                        onPress={event => {
                          event.stopPropagation();
                          updateCartItemQuantity(item.id, 1);
                        }}
                        style={({pressed}) => [
                          styles.stepperButton,
                          pressed && styles.stepperButtonPressed,
                        ]}>
                        <Text style={styles.stepperText}>+</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={event => {
                        event.stopPropagation();
                        onAddToCart(item);
                      }}
                      style={({pressed}) => [
                        styles.addButton,
                        pressed && styles.addButtonPressed,
                      ]}>
                      {({pressed}) => (
                        <Text
                          style={[
                            styles.addButtonText,
                            pressed && styles.addButtonTextPressed,
                          ]}>
                          ADD
                        </Text>
                      )}
                    </Pressable>
                  )}
                </View>

                <View style={styles.metaTop}>
                  <Text style={styles.unitText}>{item.unit}</Text>
                  <Text style={styles.packText}>{item.pack}</Text>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.priceText}>₹{item.price}</Text>
                  <Text style={styles.mrpText}>₹{item.mrp}</Text>
                </View>

                <Text style={styles.offerText}>₹{Math.max(item.mrp - item.price, 0)} OFF</Text>

                <Text numberOfLines={2} style={styles.nameText}>
                  {item.name}
                </Text>

                <View style={styles.ratingRow}>
                  <MaterialCommunityIcons color="#f7c847" name="star" size={11} />
                  <MaterialCommunityIcons color="#f7c847" name="star" size={11} />
                  <MaterialCommunityIcons color="#f7c847" name="star" size={11} />
                  <MaterialCommunityIcons color="#f7c847" name="star" size={11} />
                  <MaterialCommunityIcons color="#d8d8d8" name="star" size={11} />
                  <Text style={styles.ratingText}>(3,223)</Text>
                </View>

                <View style={styles.deliveryRow}>
                  <Text style={styles.deliveryText}>◔ 16 mins</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {wishlistToastVisible ? (
        <View
          pointerEvents="box-none"
          style={[styles.toastWrap, {bottom: insets.bottom + 18}]}>
          <View style={styles.toast}>
            <Text style={styles.toastText}>{wishlistToastMessage}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#eeeeee',
    borderBottomWidth: 1,
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  iconButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  backArrow: {
    color: '#222222',
    fontSize: 30,
    lineHeight: 30,
    marginTop: -3,
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 6,
    marginRight: 8,
  },
  headerTitle: {
    color: '#222222',
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#568937',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    marginLeft: 4,
    width: 34,
  },
  content: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    borderColor: '#ececec',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  emptyTitle: {
    color: '#222222',
    fontSize: 20,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#6b6b6b',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    marginBottom: 12,
    width: '49%',
  },
  imageWrap: {
    backgroundColor: '#ffffff',
    borderColor: '#ebebeb',
    borderRadius: 14,
    borderWidth: 1,
    height: 154,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  heartButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    top: 6,
    width: 24,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#7fbf69',
    borderRadius: 12,
    borderWidth: 1.5,
    bottom: 8,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    width: 76,
  },
  addButtonPressed: {
    backgroundColor: '#2e9a39',
  },
  addButtonText: {
    color: '#2e9a39',
    fontSize: 14,
    fontWeight: '800',
  },
  addButtonTextPressed: {
    color: '#ffffff',
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#7fbf69',
    borderRadius: 12,
    borderWidth: 1.5,
    bottom: 8,
    flexDirection: 'row',
    height: 40,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'absolute',
    right: 8,
    width: 92,
  },
  stepperButton: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: 28,
  },
  stepperButtonPressed: {
    backgroundColor: '#e8f6ea',
  },
  stepperText: {
    color: '#2e9a39',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  stepperQuantity: {
    color: '#2e9a39',
    fontSize: 14,
    fontWeight: '800',
  },
  metaTop: {
    paddingTop: 8,
  },
  unitText: {
    color: '#3c3c3c',
    fontSize: 12,
    fontWeight: '700',
  },
  packText: {
    color: '#707070',
    fontSize: 11,
    marginTop: 2,
  },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  priceText: {
    color: '#141414',
    fontSize: 18,
    fontWeight: '800',
  },
  mrpText: {
    color: '#9a9a9a',
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  offerText: {
    color: '#5b8de0',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  nameText: {
    color: '#2c2c2c',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 2,
    minHeight: 34,
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 1,
    marginTop: 3,
  },
  ratingText: {
    color: '#8d8d8d',
    fontSize: 11,
    marginLeft: 2,
  },
  deliveryRow: {
    marginTop: 4,
  },
  deliveryText: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '500',
  },
  toastWrap: {
    left: 12,
    position: 'absolute',
    right: 12,
  },
  toast: {
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
