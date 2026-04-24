import React, {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ProductCard from '../../../components/ui/product-card/ProductCard';
import { colors } from '../../../theme/colors';
import { appConfig } from '../../../app/config/appConfig';
import { fetchProducts } from '../../product/service';
import { Product } from '../../product/types';
import { stripePaymentService } from '../../../services/payments';
import { logger } from '../../../utils/logger';
import {
  clearCart,
  getCartItems,
  subscribeCart,
  updateCartItemQuantity,
} from '../service';
import { getUserProfile, setUserProfile } from '../../profile/service';

const formatMoney = (value: number) => `AED ${value.toFixed(2)}`;

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const cartItems = useSyncExternalStore(
    subscribeCart,
    getCartItems,
    getCartItems,
  );
  const [isAddressModalVisible, setIsAddressModalVisible] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [, setProfileVersion] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const profile = getUserProfile();

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      const nextProducts = await fetchProducts({ fallbackToMock: false });

      if (isMounted) {
        setProducts(nextProducts);
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  const recommendationItems = useMemo(
    () => [products[2], products[0], products[1]].filter(Boolean),
    [products],
  );

  const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const offerDiscount = subtotal > 0 ? Math.min(2, subtotal * 0.1) : 0;
  const deliveryFee = subtotal > 10 ? 0 : 1.5;
  const handlingFee = 0.99;
  const grandTotal = subtotal - offerDiscount + deliveryFee + handlingFee;
  const deliveryAddress =
    profile.address || 'Add your delivery address in profile';

  const onBuyNow = async () => {
    logger.log('[Buy Now] button clicked', {
      address: profile.address,
      amount: grandTotal,
      currency: 'aed',
      itemCount,
      items: cartItems,
      stripeConfigured: stripePaymentService.isConfigured(),
    });

    if (!profile.address.trim()) {
      logger.log('[Buy Now] blocked', {
        reason: 'missing_address',
      });

      Alert.alert(
        'Address required',
        'Please add your delivery address in profile before placing the order.',
      );
      return;
    }

    if (!stripePaymentService.isConfigured()) {
      const missingConfig = stripePaymentService.getMissingConfig();

      logger.log('[Buy Now] blocked', {
        missingConfig,
        reason: 'missing_stripe_config',
      });

      Alert.alert(
        'Stripe not configured',
        `Add ${missingConfig.join(
          ' and ',
        )} in appConfig before accepting payments.`,
      );
      return;
    }

    try {
      setIsPaymentProcessing(true);
      const paymentSheet = await stripePaymentService.createPaymentSheet({
        address: profile.address,
        amount: grandTotal,
        currency: 'aed',
        items: cartItems,
      });
      logger.log('[Stripe] Buy Now payment sheet data', paymentSheet);

      const initPaymentSheetResponse = await initPaymentSheet({
        merchantDisplayName: 'Buy In Minutes',
        paymentIntentClientSecret: paymentSheet.paymentIntentClientSecret,
        customerId: paymentSheet.customer,
        customerEphemeralKeySecret: paymentSheet.ephemeralKey,
        defaultBillingDetails: {
          name: profile.name,
          email: profile.email,
          phone: profile.mobile,
          address: {
            country: 'AE',
          },
        },
        returnURL: `${appConfig.stripeUrlScheme}://stripe-redirect`,
      });
      logger.log(
        '[Stripe] initPaymentSheet response',
        initPaymentSheetResponse,
      );

      const { error: initError } = initPaymentSheetResponse;

      if (initError) {
        Alert.alert('Payment unavailable', initError.message);
        return;
      }

      const presentPaymentSheetResponse = await presentPaymentSheet();
      logger.log(
        '[Stripe] presentPaymentSheet response',
        presentPaymentSheetResponse,
      );

      const { error: paymentError } = presentPaymentSheetResponse;

      if (paymentError) {
        if (paymentError.code !== 'Canceled') {
          Alert.alert('Payment failed', paymentError.message);
        }
        return;
      }

      setIsSuccessModalVisible(true);
    } catch (error) {
      logger.log('[Stripe] Buy Now error', error);
      Alert.alert(
        'Payment failed',
        error instanceof Error
          ? error.message
          : 'Unable to start Stripe payment.',
      );
    } finally {
      setIsPaymentProcessing(false);
    }
  };

  const openAddressModal = () => {
    setAddressInput(profile.address);
    setIsAddressModalVisible(true);
  };

  const closeAddressModal = () => {
    setIsAddressModalVisible(false);
    setAddressInput('');
  };

  const onSaveAddress = async () => {
    const trimmedAddress = addressInput.trim();

    if (!trimmedAddress) {
      Alert.alert('Address required', 'Please enter your delivery address.');
      return;
    }

    await setUserProfile(
      {
        ...profile,
        address: trimmedAddress,
      },
      { profileCompleted: true },
    );
    setProfileVersion(current => current + 1);
    closeAddressModal();
  };

  const closeSuccessModal = () => {
    setIsSuccessModalVisible(false);
    clearCart();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f5f31" />
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + 10,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Cart</Text>

          <View style={styles.headerActions}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.headerIconButton}
            >
              <MaterialCommunityIcons
                color="#ffffff"
                name="magnify"
                size={20}
              />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.headerIconButton}
            >
              <MaterialCommunityIcons
                color="#ffffff"
                name="share-variant-outline"
                size={18}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          styles.contentSpacing,
          {
            paddingBottom: insets.bottom + (itemCount > 0 ? 170 : 18),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {itemCount === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.illustrationCard}>
              <View style={styles.glowCircle} />
              <View style={styles.cartIconWrap}>
                <View style={styles.cartHandle} />
                <View style={styles.cartBasket} />
                <View style={styles.cartLine} />
                <View style={styles.cartWheelRow}>
                  <View style={styles.cartWheel} />
                  <View style={styles.cartWheel} />
                </View>
              </View>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>0 items</Text>
              </View>
            </View>

            <Text style={styles.emptyTitle}>Your cart is waiting</Text>
            <Text style={styles.emptySubtitle}>
              Add groceries, fruits, or snacks and they will appear here
              instantly.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.cartList}>
              {cartItems.map(item => (
                <View key={item.id} style={styles.cartCard}>
                  <View
                    style={[styles.imageWrap, { backgroundColor: item.tone }]}
                  >
                    <Image
                      source={{ uri: item.image }}
                      style={styles.itemImage}
                    />
                  </View>

                  <View style={styles.itemBody}>
                    <Text numberOfLines={1} style={styles.itemName}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemMeta}>{item.grams}</Text>
                    <Text style={styles.itemPrice}>
                      {formatMoney(item.price)}
                    </Text>
                  </View>

                  <View style={styles.stepper}>
                    <TouchableOpacity
                      onPress={() => updateCartItemQuantity(item.id, -1)}
                      style={styles.stepperButton}
                    >
                      <Text style={styles.stepperText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => updateCartItemQuantity(item.id, 1)}
                      style={styles.stepperButton}
                    >
                      <Text style={styles.stepperText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatMoney(subtotal)}</Text>
            </View>

            <View style={styles.billCard}>
              <Text style={styles.cardTitle}>Bill details</Text>
              <View style={styles.billRow}>
                <View style={styles.billLabelWrap}>
                  <View style={styles.billIconBox}>
                    <View style={styles.billIconSquare} />
                  </View>
                  <Text style={styles.billLabel}>Items total</Text>
                </View>
                <Text style={styles.billValue}>{formatMoney(subtotal)}</Text>
              </View>
              <View style={styles.billRow}>
                <View style={styles.billLabelWrap}>
                  <View style={styles.billIconBox}>
                    <View style={styles.billIconTruckBody} />
                    <View style={styles.billIconTruckTop} />
                    <View style={styles.billIconWheelRow}>
                      <View style={styles.billIconWheel} />
                      <View style={styles.billIconWheel} />
                    </View>
                  </View>
                  <Text style={styles.billLabel}>Delivery fee</Text>
                </View>
                <Text style={styles.billValue}>
                  {deliveryFee === 0 ? 'FREE' : formatMoney(deliveryFee)}
                </Text>
              </View>
              <View style={styles.billRow}>
                <View style={styles.billLabelWrap}>
                  <View style={styles.billIconBox}>
                    <View style={styles.billIconBag} />
                    <View style={styles.billIconBagHandle} />
                  </View>
                  <Text style={styles.billLabel}>Handling charge</Text>
                </View>
                <Text style={styles.billValue}>{formatMoney(handlingFee)}</Text>
              </View>
              <View style={styles.billRow}>
                <View style={styles.billLabelWrap}>
                  <View style={styles.billIconBox}>
                    <View style={styles.billIconTag} />
                    <View style={styles.billIconTagHole} />
                  </View>
                  <Text style={styles.billLabel}>Offer applied</Text>
                </View>
                <Text style={styles.billOfferValue}>
                  - {formatMoney(offerDiscount)}
                </Text>
              </View>
              <View style={styles.billDivider} />
              <View style={styles.billRow}>
                <View style={styles.billLabelWrap}>
                  <View style={styles.billIconBox}>
                    <View style={styles.billIconCoinOuter} />
                    <View style={styles.billIconCoinInner} />
                  </View>
                  <Text style={styles.billTotalLabel}>To pay</Text>
                </View>
                <Text style={styles.billTotalValue}>
                  {formatMoney(grandTotal)}
                </Text>
              </View>
            </View>

            <View style={styles.policyCard}>
              <Text style={styles.policyTitle}>Cancellation policy</Text>
              <Text style={styles.policyText}>
                Orders can be cancelled before packing starts. Once packed,
                cancellation or refund depends on item condition and store
                approval.
              </Text>
            </View>
          </>
        )}

        <View style={styles.recommendSection}>
          <Text style={styles.recommendTitle}>Recommended for you</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.productCardsRow}>
              {recommendationItems.map(item => (
                <ProductCard item={item} key={item.id} />
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={closeAddressModal}
        transparent
        visible={isAddressModalVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable onPress={closeAddressModal} style={styles.modalBackdrop} />
          <View
            style={[styles.modalSheet, { paddingBottom: insets.bottom + 18 }]}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Customer address</Text>
            <Text style={styles.modalSubtitle}>
              Add or update your delivery address for this order.
            </Text>
            <TextInput
              multiline
              onChangeText={setAddressInput}
              placeholder="Flat / Villa, Building, Street, Area, City"
              placeholderTextColor="#8c8c8c"
              style={styles.addressInput}
              textAlignVertical="top"
              value={addressInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={closeAddressModal}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onSaveAddress}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeSuccessModal}
        transparent
        visible={isSuccessModalVisible}
      >
        <View style={styles.successRoot}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <View style={styles.successCheckStem} />
              <View style={styles.successCheckTick} />
            </View>
            <Text style={styles.successTitle}>Order placed successfully</Text>
            <Text style={styles.successSubtitle}>
              Your order for {itemCount} item{itemCount > 1 ? 's' : ''} is
              confirmed and will be prepared shortly.
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={closeSuccessModal}
              style={styles.successButton}
            >
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {itemCount > 0 ? (
        <View style={styles.checkoutBar}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={openAddressModal}
            style={styles.checkoutAddressCard}
          >
            <View style={styles.checkoutAddressIcon}>
              <MaterialCommunityIcons
                color="#0f5f31"
                name="map-marker-outline"
                size={20}
              />
            </View>
            <View style={styles.checkoutAddressBody}>
              <Text style={styles.checkoutAddressLabel}>
                {profile.address ? 'Delivering to' : 'Delivery address'}
              </Text>
              <Text numberOfLines={1} style={styles.checkoutAddressText}>
                {deliveryAddress}
              </Text>
            </View>
            <Text style={styles.checkoutAddressAction}>
              {profile.address ? 'Change' : 'Add'}
            </Text>
          </TouchableOpacity>

          <View style={styles.checkoutActionRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={isPaymentProcessing}
              onPress={onBuyNow}
              style={[
                styles.checkoutBuyButton,
                isPaymentProcessing && styles.checkoutBuyButtonDisabled,
              ]}
            >
              <Text style={styles.checkoutBuyText}>Select payment option</Text>
            </TouchableOpacity>
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
  content: {
    paddingHorizontal: 16,
  },
  contentSpacing: {
    paddingTop: 16,
  },
  headerBar: {
    backgroundColor: '#0f5f31',
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerIconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  illustrationCard: {
    alignItems: 'center',
    backgroundColor: '#fff6d7',
    borderColor: '#f1df95',
    borderRadius: 28,
    borderWidth: 1,
    height: 220,
    justifyContent: 'center',
    marginBottom: 26,
    overflow: 'hidden',
    width: '100%',
  },
  glowCircle: {
    backgroundColor: '#ffe38a',
    borderRadius: 90,
    height: 180,
    opacity: 0.55,
    position: 'absolute',
    width: 180,
  },
  cartIconWrap: {
    alignItems: 'center',
    height: 110,
    justifyContent: 'center',
    position: 'relative',
    width: 110,
  },
  cartHandle: {
    borderColor: '#121212',
    borderLeftWidth: 3,
    borderTopWidth: 3,
    height: 18,
    left: 22,
    position: 'absolute',
    top: 20,
    transform: [{ skewX: '-20deg' }],
    width: 18,
  },
  cartBasket: {
    backgroundColor: '#ffffff',
    borderColor: '#121212',
    borderRadius: 12,
    borderWidth: 3,
    height: 36,
    left: 34,
    position: 'absolute',
    top: 34,
    width: 42,
  },
  cartLine: {
    backgroundColor: '#121212',
    height: 3,
    left: 42,
    position: 'absolute',
    top: 50,
    width: 26,
  },
  cartWheelRow: {
    flexDirection: 'row',
    gap: 18,
    left: 40,
    position: 'absolute',
    top: 78,
  },
  cartWheel: {
    backgroundColor: '#121212',
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  badgePill: {
    backgroundColor: '#121212',
    borderRadius: 999,
    bottom: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'absolute',
  },
  badgeText: {
    color: '#ffe38a',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 300,
    textAlign: 'center',
  },
  cartList: {
    gap: 12,
    marginTop: 8,
  },
  cartCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 12,
  },
  imageWrap: {
    borderRadius: 14,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 72,
  },
  itemImage: {
    height: '100%',
    width: '100%',
  },
  itemBody: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  itemMeta: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 4,
  },
  itemPrice: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: '#1f9d55',
    borderRadius: 10,
    flexDirection: 'row',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  stepperButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  stepperText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  quantityText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginHorizontal: 8,
    minWidth: 14,
    textAlign: 'center',
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryLabel: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  addressCard: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  addressText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  addressAction: {
    color: '#121212',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  billCard: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  billRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  billLabelWrap: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  billIconBox: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    marginRight: 8,
    position: 'relative',
    width: 18,
  },
  billIconSquare: {
    backgroundColor: '#121212',
    borderRadius: 4,
    height: 10,
    width: 10,
  },
  billIconTruckBody: {
    backgroundColor: '#121212',
    borderRadius: 3,
    bottom: 3,
    height: 8,
    left: 1,
    position: 'absolute',
    width: 9,
  },
  billIconTruckTop: {
    backgroundColor: '#121212',
    borderRadius: 2,
    height: 6,
    position: 'absolute',
    right: 1,
    top: 5,
    width: 5,
  },
  billIconWheelRow: {
    bottom: 1,
    flexDirection: 'row',
    gap: 4,
    position: 'absolute',
  },
  billIconWheel: {
    backgroundColor: '#121212',
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  billIconBag: {
    backgroundColor: '#121212',
    borderRadius: 4,
    height: 10,
    position: 'absolute',
    top: 5,
    width: 10,
  },
  billIconBagHandle: {
    borderColor: '#121212',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderTopWidth: 2,
    height: 5,
    position: 'absolute',
    top: 2,
    width: 6,
  },
  billIconCoinOuter: {
    backgroundColor: '#121212',
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  billIconCoinInner: {
    backgroundColor: '#ffffff',
    borderRadius: 2,
    height: 4,
    position: 'absolute',
    width: 4,
  },
  billIconTag: {
    backgroundColor: '#121212',
    borderRadius: 3,
    height: 10,
    transform: [{ rotate: '-18deg' }],
    width: 12,
  },
  billIconTagHole: {
    backgroundColor: '#ffffff',
    borderRadius: 2,
    height: 3,
    left: 4,
    position: 'absolute',
    top: 6,
    width: 3,
  },
  billLabel: {
    color: colors.mutedText,
    fontSize: 14,
  },
  billValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  billOfferValue: {
    color: '#1f9d55',
    fontSize: 14,
    fontWeight: '800',
  },
  billDivider: {
    backgroundColor: colors.border,
    height: 1,
    marginTop: 14,
  },
  billTotalLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  billTotalValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  buyNowButton: {
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 16,
    marginTop: 14,
    paddingVertical: 15,
  },
  buyNowText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  checkoutBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e8e2d8',
    borderTopWidth: 1,
    bottom: 0,
    elevation: 18,
    left: 0,
    paddingBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
    shadowColor: '#2c1d08',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  checkoutAddressCard: {
    alignItems: 'center',
    backgroundColor: '#f6fbf7',
    borderColor: '#dbeee0',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  checkoutAddressIcon: {
    alignItems: 'center',
    backgroundColor: '#e5f7eb',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: 10,
    width: 36,
  },
  checkoutAddressBody: {
    flex: 1,
    marginRight: 10,
  },
  checkoutAddressLabel: {
    color: '#0f5f31',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  checkoutAddressText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  checkoutAddressAction: {
    color: '#0f5f31',
    fontSize: 13,
    fontWeight: '900',
  },
  checkoutActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  checkoutBuyButton: {
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  checkoutBuyButtonDisabled: {
    opacity: 0.62,
  },
  checkoutBuyText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  policyCard: {
    backgroundColor: '#fff4db',
    borderRadius: 18,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  policyTitle: {
    color: '#6b5100',
    fontSize: 15,
    fontWeight: '800',
  },
  policyText: {
    color: '#866b18',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  modalRoot: {
    backgroundColor: 'rgba(0,0,0,0.24)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#d9d9d9',
    borderRadius: 999,
    height: 4,
    marginBottom: 16,
    width: 48,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  addressInput: {
    backgroundColor: '#fffdf7',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    marginTop: 16,
    minHeight: 110,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#f4f1e8',
    borderRadius: 14,
    flex: 1,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#5f5a4d',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 14,
    flex: 1,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  successRoot: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
  },
  successIconWrap: {
    alignItems: 'center',
    backgroundColor: '#eaf9ef',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    marginBottom: 18,
    position: 'relative',
    width: 72,
  },
  successCheckStem: {
    backgroundColor: '#1f9d55',
    borderRadius: 3,
    height: 10,
    left: 28,
    position: 'absolute',
    top: 35,
    transform: [{ rotate: '45deg' }],
    width: 4,
  },
  successCheckTick: {
    backgroundColor: '#1f9d55',
    borderRadius: 3,
    height: 4,
    left: 31,
    position: 'absolute',
    top: 33,
    transform: [{ rotate: '-45deg' }],
    width: 18,
  },
  successTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  successSubtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
  },
  successButton: {
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 16,
    marginTop: 22,
    paddingVertical: 14,
    width: '100%',
  },
  successButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  recommendSection: {
    marginTop: 24,
  },
  recommendTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  productCardsRow: {
    flexDirection: 'row',
    paddingRight: 10,
  },
});
