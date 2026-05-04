import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import {ScreenHeader} from '../../../components/ui';
import {addProductToCart} from '../../cart/service';
import {
  addWishlistItem,
  fetchProducts,
  getWishlistItems,
  removeWishlistItem,
  subscribeWishlist,
  WishlistItem,
} from '../service';
import {colors} from '../../../theme/colors';
import {logger} from '../../../utils/logger';

type ProductDetailsRoute = RouteProp<RootStackParamList, 'ProductDetails'>;
type ProductDetailsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ProductDetails'
>;

export default function ProductDetailsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ProductDetailsNavigationProp>();
  const route = useRoute<ProductDetailsRoute>();
  const {product} = route.params;
  const [similarProducts, setSimilarProducts] = React.useState<typeof product[]>([]);
  const wishlistItems = React.useSyncExternalStore(
    subscribeWishlist,
    getWishlistItems,
    getWishlistItems,
  );
  const isWishlisted = wishlistItems.some(item => item.id === product.id);

  const wishlistItem: WishlistItem = {
    id: product.id,
    image: product.image,
    name: product.name,
    price: Number(product.price) || 0,
    mrp: Number(product.price) || 0,
    unit: product.grams,
    pack: '1 pack',
    eta: product.eta,
    stock: 'In stock',
  };

  const onToggleWishlist = async () => {
    if (isWishlisted) {
      await removeWishlistItem(product.id);
      return;
    }

    await addWishlistItem(wishlistItem);
  };

  const onShareProduct = async () => {
    await Share.share({
      message: `${product.name} - AED ${product.price}`,
      title: product.name,
    });
  };

  React.useEffect(() => {
    let isMounted = true;

    const loadSimilarProducts = async () => {
      try {
        const products = await fetchProducts({fallbackToMock: false});
        const currentGroup = product.itemGroup?.trim().toLowerCase();
        const sameGroupProducts = products.filter(item => {
          const itemGroup = item.itemGroup?.trim().toLowerCase();
          return item.id !== product.id && Boolean(currentGroup) && itemGroup === currentGroup;
        });
        const fallbackProducts = products.filter(item => item.id !== product.id);
        const nextProducts = (sameGroupProducts.length > 0 ? sameGroupProducts : fallbackProducts)
          .slice(0, 10);

        if (isMounted) {
          setSimilarProducts(nextProducts);
        }
      } catch (error) {
        logger.warn('Unable to load similar products.', error);

        if (isMounted) {
          setSimilarProducts([]);
        }
      }
    };

    loadSimilarProducts();

    return () => {
      isMounted = false;
    };
  }, [product.id, product.itemGroup]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={[styles.headerWrap, {paddingTop: insets.top + 12}]}>
        <ScreenHeader
          actions={[
            {
              icon: 'magnify',
              label: 'Search products',
              onPress: () => navigation.navigate('MainTabs', {screen: 'Search'}),
            },
            {
              icon: 'share-variant-outline',
              label: 'Share product',
              onPress: onShareProduct,
            },
            {
              color: isWishlisted ? '#ef4662' : colors.text,
              icon: isWishlisted ? 'heart' : 'heart-outline',
              label: isWishlisted ? 'Remove from wishlist' : 'Add to wishlist',
              onPress: onToggleWishlist,
            },
          ]}
          title="Product Details"
          onBackPress={() => navigation.goBack()}
        />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + 120},
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.imageCard, {backgroundColor: product.tone}]}>
          <Image source={{uri: product.image}} style={styles.productImage} />
          <View style={styles.offerBadge}>
            <Text style={styles.offerText}>{product.offerTag}</Text>
          </View>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.categoryLabel}>Fresh grocery</Text>
              <Text style={styles.name}>{product.name}</Text>
              <Text style={styles.meta}>{product.grams}</Text>
            </View>
            <View style={styles.pricePill}>
              <Text style={styles.priceLabel}>AED</Text>
              <Text style={styles.priceValue}>{product.price}</Text>
            </View>
          </View>

          <View style={styles.promiseRow}>
            <View style={styles.promiseCard}>
              <View style={styles.promiseIconWrap}>
                <MaterialCommunityIcons color="#167a3f" name="clock-fast" size={18} />
              </View>
              <Text style={styles.promiseTitle}>{product.eta}</Text>
              <Text style={styles.promiseText}>Delivery</Text>
            </View>
            <View style={styles.promiseCard}>
              <View style={styles.promiseIconWrap}>
                <MaterialCommunityIcons color="#167a3f" name="storefront-outline" size={18} />
              </View>
              <Text style={styles.promiseTitle}>{product.totalSellers}</Text>
              <Text style={styles.promiseText}>Sellers</Text>
            </View>
            <View style={styles.promiseCard}>
              <View style={styles.promiseIconWrap}>
                <MaterialCommunityIcons color="#167a3f" name="shield-check-outline" size={18} />
              </View>
              <Text style={styles.promiseTitle}>Fresh</Text>
              <Text style={styles.promiseText}>Stock</Text>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Why customers pick this</Text>
            <View style={styles.benefitRow}>
              <MaterialCommunityIcons color="#1f9d55" name="check-circle" size={18} />
              <Text style={styles.benefitText}>Fast doorstep delivery from nearby sellers.</Text>
            </View>
            <View style={styles.benefitRow}>
              <MaterialCommunityIcons color="#1f9d55" name="check-circle" size={18} />
              <Text style={styles.benefitText}>Clear pack size and price before adding to cart.</Text>
            </View>
            <View style={styles.benefitRow}>
              <MaterialCommunityIcons color="#1f9d55" name="check-circle" size={18} />
              <Text style={styles.benefitText}>Fresh stock selected for everyday essentials.</Text>
            </View>
          </View>
        </View>

        {similarProducts.length > 0 ? (
          <View style={styles.similarSection}>
            <View style={styles.similarHeader}>
              <Text style={styles.similarTitle}>Similar products</Text>
              <Text style={styles.similarSubtitle}>You may also like</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarProductsRow}>
              {similarProducts.map(item => (
                <Pressable
                  key={item.id}
                  onPress={() => navigation.push('ProductDetails', {product: item})}
                  style={styles.similarProductCard}>
                  <View style={[styles.similarImageWrap, {backgroundColor: item.tone}]}>
                    <Image source={{uri: item.image}} style={styles.similarImage} />
                  </View>
                  <Text numberOfLines={2} style={styles.similarName}>
                    {item.name}
                  </Text>
                  <Text style={styles.similarMeta}>{item.grams}</Text>
                  <View style={styles.similarFooter}>
                    <Text style={styles.similarPrice}>AED {item.price}</Text>
                    <Pressable
                      hitSlop={8}
                      onPress={event => {
                        event.stopPropagation();
                        addProductToCart(item);
                      }}
                      style={styles.similarAddButton}>
                      <MaterialCommunityIcons color="#ffffff" name="plus" size={17} />
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, {paddingBottom: insets.bottom + 14}]}>
        <View>
          <Text style={styles.footerPriceLabel}>Price</Text>
          <Text style={styles.footerPrice}>AED {product.price}</Text>
        </View>
        <Pressable
          onPress={() => addProductToCart(product)}
          style={({pressed}) => [styles.buyButton, pressed && styles.buyButtonPressed]}>
          <Text style={styles.buyText}>Add to cart</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  headerWrap: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  imageCard: {
    alignItems: 'center',
    borderRadius: 28,
    marginBottom: 16,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 22,
    position: 'relative',
  },
  productImage: {
    height: 260,
    resizeMode: 'contain',
    width: '100%',
  },
  offerBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 999,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'absolute',
    top: 14,
  },
  offerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    borderColor: '#efe8dc',
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#593b16',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
  },
  categoryLabel: {
    color: '#167a3f',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  meta: {
    color: colors.mutedText,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  pricePill: {
    alignItems: 'center',
    backgroundColor: '#f0fbf4',
    borderColor: '#cdebd7',
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 86,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  priceLabel: {
    color: '#167a3f',
    fontSize: 11,
    fontWeight: '800',
  },
  priceValue: {
    color: '#0f5f31',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  promiseRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  promiseCard: {
    backgroundColor: '#fbf7ef',
    borderRadius: 18,
    flex: 1,
    padding: 12,
  },
  promiseIconWrap: {
    alignItems: 'center',
    backgroundColor: '#e4f7ea',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    marginBottom: 10,
    width: 32,
  },
  promiseTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  promiseText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  sectionBlock: {
    borderTopColor: '#f0eadf',
    borderTopWidth: 1,
    marginTop: 20,
    paddingTop: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  benefitRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  benefitText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
  similarSection: {
    marginTop: 22,
  },
  similarHeader: {
    marginBottom: 12,
  },
  similarTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  similarSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  similarProductsRow: {
    paddingRight: 8,
  },
  similarProductCard: {
    backgroundColor: '#ffffff',
    borderColor: '#efe8dc',
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 12,
    padding: 10,
    width: 150,
  },
  similarImageWrap: {
    borderRadius: 14,
    height: 98,
    marginBottom: 10,
    overflow: 'hidden',
    width: '100%',
  },
  similarImage: {
    height: '100%',
    resizeMode: 'contain',
    width: '100%',
  },
  similarName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    minHeight: 34,
  },
  similarMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  similarFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  similarPrice: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    marginRight: 8,
  },
  similarAddButton: {
    alignItems: 'center',
    backgroundColor: '#1f9d55',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  footer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    position: 'absolute',
    right: 0,
  },
  footerPriceLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
  },
  footerPrice: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  buyButton: {
    alignItems: 'center',
    backgroundColor: '#1f9d55',
    borderRadius: 14,
    minWidth: 160,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  buyButtonPressed: {
    opacity: 0.88,
  },
  buyText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
