import React, {
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { CustomAlert } from '../../../components';
import { colors } from '../../../theme/colors';
import { appConfig } from '../../../app/config/appConfig';
import { RootStackParamList } from '../../../app/navigation/types/root-navigation.types';
import { stripePaymentService } from '../../../services/payments';
import { logger } from '../../../utils/logger';
import {
  clearLinkedSalesOrder,
  clearCart,
  ensureSalesOrderForCart,
  getCartItems,
  generateSalesInvoiceForSalesOrder,
  getLinkedSalesOrderName,
  placeOrder,
  getSalesOrderPaymentDetails,
  getSalesOrderSyncErrorMessage,
  scheduleCartSalesOrderSync,
  subscribeCart,
  updateCartItemQuantity,
} from '../service';
import {createLocalOrder, updateLocalOrder} from '../../orders';
import {
  buildSavedAddressDetailLines,
  getSavedAddresses,
  getSavedAddressIconName,
  getSavedAddressType,
  getUserProfile,
  loadStoredAddresses,
  setUserProfile,
  subscribeProfile,
  subscribeSavedAddresses,
} from '../../profile/service';

const formatMoney = (value: number) => `AED ${value.toFixed(2)}`;
const getStripeCustomerName = (name: string) => {
  const trimmedName = name.trim();
  return trimmedName && trimmedName !== 'BIM User' ? trimmedName : undefined;
};

const getStripeCustomerEmail = (email: string) => {
  const trimmedEmail = email.trim();
  return trimmedEmail && trimmedEmail !== 'name@example.com'
    ? trimmedEmail
    : undefined;
};

const getStripeCustomerPhone = (mobile: string) => {
  const trimmedMobile = mobile.trim();
  return trimmedMobile || undefined;
};

const getWhatsAppPhoneNumber = (mobile: string) => {
  const digits = mobile.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  if (digits.startsWith('971')) {
    return digits;
  }

  if (digits.startsWith('0')) {
    return `971${digits.slice(1)}`;
  }

  return digits;
};

type CartScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<CartScreenNavigationProp>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const cartItems = useSyncExternalStore(
    subscribeCart,
    getCartItems,
    getCartItems,
  );
  const savedAddresses = useSyncExternalStore(
    subscribeSavedAddresses,
    getSavedAddresses,
    getSavedAddresses,
  );
  const profile = useSyncExternalStore(
    subscribeProfile,
    getUserProfile,
    getUserProfile,
  );
  const [isAddressModalVisible, setIsAddressModalVisible] = useState(false);
  const [isProfileAlertVisible, setIsProfileAlertVisible] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [isPaymentSheetReady, setIsPaymentSheetReady] = useState(false);
  const [linkedSalesOrderName, setLinkedSalesOrderName] = useState<string | null>(null);

  useEffect(() => {
    setIsPaymentSheetReady(false);
    if (cartItems.length === 0) {
      setLinkedSalesOrderName(null);
      clearLinkedSalesOrder().catch(() => undefined);
    }
  }, [
    cartItems,
    profile.address,
    profile.customer,
    profile.email,
    profile.mobile,
    profile.name,
  ]);

  useEffect(() => {
    loadStoredAddresses().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (cartItems.length === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      scheduleCartSalesOrderSync(cartItems)
        .then(nextLinkedSalesOrderName => {
          if (nextLinkedSalesOrderName) {
            setLinkedSalesOrderName(nextLinkedSalesOrderName);
          }
        })
        .catch(error => {
          logger.log('[Sales Order] background cart sync failed', {
            error,
          });
        });
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    cartItems,
    profile.address,
    profile.customer,
    profile.email,
    profile.mobile,
    profile.name,
  ]);

  const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const deliveryFee = subtotal > 10 ? 0 : 1.5;
  const grandTotal = subtotal + deliveryFee;
  const deliveryAddress =
    profile.address || 'Add your delivery address in profile';
  const hasSavedAddresses = savedAddresses.length > 0;
  const shouldEditFetchedLocation = Boolean(profile.address.trim()) && !hasSavedAddresses;
  const stripeCustomerName = getStripeCustomerName(profile.name);
  const stripeCustomerEmail = getStripeCustomerEmail(profile.email);
  const stripeCustomerPhone = getStripeCustomerPhone(profile.mobile);
  const whatsappPhoneNumber = getWhatsAppPhoneNumber(profile.mobile);
  const requiresLoginToProceed =
    !profile.mobile.trim() ||
    !profile.email.trim() ||
    profile.email === 'name@example.com' ||
    !profile.name.trim() ||
    profile.name === 'BIM User';

  const onPlaceOrder = async () => {
    const clickPayload = {
      address: profile.address,
      amount: grandTotal,
      currency: 'aed',
      itemCount,
      items: cartItems,
      stripeConfigured: stripePaymentService.isConfigured(),
    };

    logger.log('[Place Order] button clicked', clickPayload);
    console.log('[Place Order] button clicked', clickPayload);

    if (!profile.address.trim()) {
      const blockedPayload = {
        message:
          'Please add your delivery address in profile before placing the order.',
        reason: 'missing_address',
      };
      logger.log('[Place Order] blocked', blockedPayload);
      console.warn('[Place Order] blocked', blockedPayload);
      return;
    }

    const signupPayload = {
      email: profile.email,
      full_name: profile.name,
      phone: profile.mobile,
    };

    if (
      !signupPayload.email.trim() ||
      !signupPayload.full_name.trim() ||
      !signupPayload.phone.trim()
    ) {
      const blockedPayload = {
        message:
          'Please complete your profile details before placing the order.',
        payload: signupPayload,
        reason: 'missing_profile_details',
      };
      logger.log('[Place Order] blocked', blockedPayload);
      console.warn('[Place Order] blocked', blockedPayload);
      setIsProfileAlertVisible(true);
      return;
    }

    try {
      setIsPaymentProcessing(true);
      const cartSnapshot = cartItems.map(item => ({...item}));
      const localOrder = await createLocalOrder({
        address: profile.address,
        customerEmail: profile.email,
        customerMobile: profile.mobile,
        customerName: profile.name,
        deliveryFee,
        items: cartSnapshot,
        subtotal,
        total: grandTotal,
      });

      clearCart();
      setIsPaymentSheetReady(false);
      setLinkedSalesOrderName(null);
      navigation.navigate('Orders');

      void updateLocalOrder(localOrder.id, {
        backendStatus: 'Syncing with ERPNext',
        syncState: 'syncing',
      });

      void placeOrder(cartSnapshot)
        .then(async salesOrderPayload => {
          logger.log('[Place Order] background sales order ready', salesOrderPayload);
          await updateLocalOrder(localOrder.id, {
            backendOrderName: salesOrderPayload.linkedSalesOrderName,
            backendStatus:
              salesOrderPayload.salesOrder?.status?.toString().trim() || 'Order placed',
            errorMessage: '',
            syncState: 'confirmed',
          });
          await clearLinkedSalesOrder();
        })
        .catch(async error => {
          const salesOrderErrorMessage = getSalesOrderSyncErrorMessage(error);

          logger.log('[Stripe] Place Order background error', error);
          console.error('[Stripe] Place Order background error', error);
          await updateLocalOrder(localOrder.id, {
            backendStatus: 'ERPNext sync failed',
            errorMessage: salesOrderErrorMessage,
            syncState: 'failed',
          });
          await clearLinkedSalesOrder();
        });
    } catch (error) {
      const salesOrderErrorMessage = getSalesOrderSyncErrorMessage(error);

      logger.log('[Stripe] Place Order error', error);
      console.error('[Stripe] Place Order error', error);
      Alert.alert('Unable to place order', salesOrderErrorMessage);
    } finally {
      setIsPaymentProcessing(false);
    }
  };

  const onPayNow = async () => {
    try {
      setIsPaymentProcessing(true);
      logger.log('[Pay Now] button clicked', {
        address: profile.address,
        cartItems,
        itemCount,
        linkedSalesOrderName,
      });

      const currentLinkedSalesOrderName =
        linkedSalesOrderName ?? (await getLinkedSalesOrderName());

      if (!currentLinkedSalesOrderName) {
        throw new Error('Sales Order reference is missing for payment.');
      }

      const paymentReference = await getSalesOrderPaymentDetails(
        currentLinkedSalesOrderName,
      );

      logger.log('[Pay Now] sales order payment details', paymentReference);

      const paymentSheet = await stripePaymentService.createPaymentSheet({
        address: profile.address,
        amount: paymentReference.amount,
        currency: paymentReference.currency,
        customer: profile.customer,
        customerEmail: stripeCustomerEmail,
        customerName: stripeCustomerName,
        customerPhone: stripeCustomerPhone,
        items: cartItems,
        referenceDoctype: paymentReference.referenceDoctype,
        referenceName: paymentReference.referenceName,
      });

      logger.log('[Stripe] Pay Now payment sheet data', {
        paymentSheet,
        referenceDoctype: paymentReference.referenceDoctype,
        referenceName: paymentReference.referenceName,
      });

      const initPaymentSheetResponse = await initPaymentSheet({
        merchantDisplayName: 'Buy In Minutes',
        paymentIntentClientSecret: paymentSheet.paymentIntentClientSecret,
        customerId: paymentSheet.customer,
        customerEphemeralKeySecret: paymentSheet.ephemeralKey,
        applePay: {
          merchantCountryCode: 'AE',
        },
        defaultBillingDetails: {
          name: stripeCustomerName,
          email: stripeCustomerEmail,
          phone: stripeCustomerPhone,
          address: {
            country: 'AE',
          },
        },
        googlePay: {
          merchantCountryCode: 'AE',
          testEnv: __DEV__,
        },
        returnURL: `${appConfig.stripeUrlScheme}://stripe-redirect`,
      });

      logger.log('[Stripe] Pay Now initPaymentSheet response', initPaymentSheetResponse);

      const {error: initError} = initPaymentSheetResponse;

      if (initError) {
        logger.log('[Stripe] Pay Now initPaymentSheet error', initError);
        console.error('[Stripe] Pay Now initPaymentSheet error', initError);
        throw new Error(initError.message);
      }

      logger.log('[Pay Now] presenting payment sheet', {
        referenceDoctype: paymentReference.referenceDoctype,
        referenceName: paymentReference.referenceName,
      });

      const presentPaymentSheetResponse = await presentPaymentSheet();
      const {error: paymentError} = presentPaymentSheetResponse;

      if (paymentError) {
        logger.log('[Stripe] presentPaymentSheet result', {
          code: paymentError.code,
          message: paymentError.message,
          paymentOption: presentPaymentSheetResponse.paymentOption ?? null,
          referenceDoctype: paymentReference.referenceDoctype,
          referenceName: paymentReference.referenceName,
          status: paymentError.code === 'Canceled' ? 'canceled' : 'failed',
        });
        if (paymentError.code !== 'Canceled') {
          logger.log('[Stripe] presentPaymentSheet error', paymentError);
          console.error('[Stripe] presentPaymentSheet error', paymentError);
        }
        return;
      }

      logger.log('[Stripe] presentPaymentSheet result', {
        didCancel: presentPaymentSheetResponse.didCancel ?? false,
        paymentOption: presentPaymentSheetResponse.paymentOption ?? null,
        referenceDoctype: paymentReference.referenceDoctype,
        referenceName: paymentReference.referenceName,
        status: 'success',
      });

      logger.log('[Pay Now] payment completed successfully', {
        referenceDoctype: paymentReference.referenceDoctype,
        referenceName: paymentReference.referenceName,
      });
      setIsSuccessModalVisible(true);
    } catch (error) {
      logger.log('[Stripe] Pay Now error', error);
      console.error('[Stripe] Pay Now error', error);
      Alert.alert('Unable to pay now', getSalesOrderSyncErrorMessage(error));
    } finally {
      setIsPaymentProcessing(false);
    }
  };

  const openAddressModal = () => {
    setIsAddressModalVisible(true);
  };

  const closeAddressModal = () => {
    setIsAddressModalVisible(false);
  };

  const onSelectSavedAddress = async (nextAddress: string) => {
    const trimmedAddress = nextAddress.trim();

    if (!trimmedAddress) {
      Alert.alert('Address required', 'Select a saved delivery address.');
      return;
    }

    await setUserProfile(
      {
        ...profile,
        address: trimmedAddress,
      },
      { profileCompleted: true },
    );
    closeAddressModal();
  };

  const addNewAddress = () => {
    closeAddressModal();
    navigation.navigate('ConfirmLocation', {
      mode: 'search',
      ...(shouldEditFetchedLocation ? { address: profile.address } : {}),
    });
  };

  const editSavedAddress = (
    item: ReturnType<typeof getSavedAddresses>[number],
  ) => {
    closeAddressModal();
    navigation.navigate('ConfirmLocation', {
      address: item.address,
      details: item.details,
      mode: 'search',
      savedAddressId: item.id,
    });
  };

  const closeSuccessModal = () => {
    setIsSuccessModalVisible(false);
    setIsPaymentSheetReady(false);
    setLinkedSalesOrderName(null);
    clearCart();
    clearLinkedSalesOrder().catch(() => undefined);
  };

  const closeProfileAlert = () => {
    setIsProfileAlertVisible(false);
  };

  const completeProfile = () => {
    setIsProfileAlertVisible(false);
    navigation.navigate('Login');
  };

  const onGenerateSalesInvoice = async () => {
    if (!whatsappPhoneNumber) {
      Alert.alert(
        'Mobile number required',
        'Please complete your profile mobile number before sending the sales invoice.',
      );
      return;
    }

    try {
      setIsPaymentProcessing(true);

      const currentLinkedSalesOrderName =
        linkedSalesOrderName ?? (await ensureSalesOrderForCart(cartItems));

      if (!currentLinkedSalesOrderName) {
        throw new Error('Sales Order reference is missing for invoice generation.');
      }

      const {pdfUrl, salesInvoice} = await generateSalesInvoiceForSalesOrder(
        currentLinkedSalesOrderName,
      );
      const invoiceName = salesInvoice.name ?? 'Sales Invoice';
      const message = [
        `Hello ${stripeCustomerName ?? 'Customer'},`,
        `Your sales invoice ${invoiceName} is ready.`,
        pdfUrl,
      ].join('\n');
      const whatsappUrl = `whatsapp://send?phone=${whatsappPhoneNumber}&text=${encodeURIComponent(message)}`;
      const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);

      if (!canOpenWhatsApp) {
        throw new Error('WhatsApp is not available on this device to send the invoice PDF link.');
      }

      await Linking.openURL(whatsappUrl);

      Alert.alert(
        'Sales invoice ready',
        `Sales invoice ${invoiceName} was generated and prepared for ${profile.mobile}.`,
      );
    } catch (error) {
      logger.log('[Sales Invoice] generate/send error', error);
      console.error('[Sales Invoice] generate/send error', error);
      Alert.alert(
        'Unable to generate invoice',
        getSalesOrderSyncErrorMessage(error),
      );
    } finally {
      setIsPaymentProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Cart</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          styles.contentSpacing,
          {
            paddingBottom: insets.bottom + (itemCount > 0 ? 112 : 18),
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
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={openAddressModal}
              style={styles.addressCard}
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
                <Text numberOfLines={1} style={styles.addressText}>
                  {deliveryAddress}
                </Text>
              </View>
              <View style={styles.addressActionPill}>
                <Text style={styles.checkoutAddressAction}>
                  {shouldEditFetchedLocation ? 'Edit' : profile.address ? 'Edit' : 'Add'}
                </Text>
              </View>
            </TouchableOpacity>

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

                  <View style={styles.itemDetailsColumn}>
                    <View style={styles.itemBody}>
                      <Text numberOfLines={1} style={styles.itemName}>
                        {item.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.itemMeta}>
                        {item.description || item.grams}
                      </Text>
                    </View>

                    <View style={styles.itemFooterRow}>
                      <Text numberOfLines={1} style={styles.itemPrice}>
                        {formatMoney(item.price)}
                      </Text>

                      <View style={styles.stepper}>
                        <TouchableOpacity
                          onPress={() => updateCartItemQuantity(item.id, -1)}
                          style={[styles.stepperButton, styles.stepperButtonSecondary]}
                        >
                          <Text style={styles.stepperSecondaryText}>-</Text>
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
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.billCard}>
              <Text style={styles.cardTitle}>Bill Summary</Text>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Item Total</Text>
                <Text style={styles.billValue}>{formatMoney(subtotal)}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Delivery Fee</Text>
                <Text style={deliveryFee === 0 ? styles.billFreeValue : styles.billValue}>
                  {deliveryFee === 0 ? 'FREE' : formatMoney(deliveryFee)}
                </Text>
              </View>
              <View style={styles.billDivider} />
              <View style={styles.billRow}>
                <Text style={styles.billTotalLabel}>Grand Total</Text>
                <Text style={styles.billTotalValue}>
                  {formatMoney(grandTotal)}
                </Text>
              </View>
            </View>
          </>
        )}

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
            <Text style={styles.modalTitle}>Saved Addresses</Text>
            <Text style={styles.modalSubtitle}>
              Choose a saved address for this order or add a new one.
            </Text>
            <ScrollView
              contentContainerStyle={styles.addressPickerList}
              showsVerticalScrollIndicator={false}>
              {savedAddresses.length > 0 ? (
                savedAddresses.map(item => {
                  const detailLines = buildSavedAddressDetailLines(item);

                  return (
                    <View key={item.id} style={styles.savedAddressCard}>
                      <Pressable
                        onPress={() => onSelectSavedAddress(item.address)}
                        style={styles.savedAddressSelectArea}>
                        <View style={styles.savedAddressIconWrap}>
                          <MaterialCommunityIcons
                            color="#2563eb"
                            name={getSavedAddressIconName(item)}
                            size={18}
                          />
                        </View>
                        <View style={styles.savedAddressBody}>
                          <Text style={styles.savedAddressType}>
                            {getSavedAddressType(item)}
                          </Text>
                          {item.details ? (
                            <Text style={styles.savedAddressDetailsLabel}>
                              Delivery details
                            </Text>
                          ) : null}
                          {detailLines.map((line, index) => (
                            <Text
                              key={`${item.id}-${index}`}
                              numberOfLines={index === 0 ? 1 : 2}
                              style={
                                index === 0
                                  ? styles.savedAddressPrimaryText
                                  : styles.savedAddressText
                              }>
                              {line}
                            </Text>
                          ))}
                        </View>
                        <MaterialCommunityIcons
                          color="#8d8579"
                          name="chevron-right"
                          size={18}
                        />
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => editSavedAddress(item)}
                        style={styles.savedAddressEditButton}>
                        <Text style={styles.savedAddressEditText}>Edit</Text>
                      </Pressable>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptySavedAddressText}>
                  {profile.address.trim()
                    ? 'Use Edit Address Details to complete this fetched location.'
                    : 'No saved addresses yet.'}
                </Text>
              )}
            </ScrollView>
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
                onPress={addNewAddress}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {shouldEditFetchedLocation ? 'Edit Address Details' : 'Add New Address'}
                </Text>
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

      <CustomAlert
        buttonLabel="Complete Profile"
        message="Please complete your name, email, and mobile number before placing the order."
        onButtonPress={completeProfile}
        onClose={closeProfileAlert}
        title="Profile incomplete"
        visible={isProfileAlertVisible}
      />

      {itemCount > 0 ? (
        <View style={styles.checkoutBar}>
          <View
            style={[
              styles.checkoutActionRow,
              requiresLoginToProceed && styles.checkoutLoginActionWrap,
            ]}>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={isPaymentProcessing}
              onPress={requiresLoginToProceed ? completeProfile : onGenerateSalesInvoice}
              style={[
                styles.invoiceButton,
                requiresLoginToProceed && styles.invoiceButtonDisabledState,
                isPaymentProcessing && styles.checkoutBuyButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.invoiceButtonText,
                  requiresLoginToProceed && styles.checkoutLoginButtonText,
                ]}>
                {requiresLoginToProceed
                  ? 'Login for invoice'
                  : 'Generate Sales Invoice'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={isPaymentProcessing}
              onPress={
                requiresLoginToProceed
                  ? completeProfile
                  : isPaymentSheetReady
                    ? onPayNow
                    : onPlaceOrder
              }
              style={[
                styles.checkoutBuyButton,
                requiresLoginToProceed && styles.checkoutLoginButton,
                isPaymentProcessing && styles.checkoutBuyButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.checkoutBuyText,
                  requiresLoginToProceed && styles.checkoutLoginButtonText,
                ]}>
                {requiresLoginToProceed
                  ? 'Login to proceed'
                  : isPaymentSheetReady
                    ? 'Pay Now'
                    : 'Place Order'}
              </Text>
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
    paddingTop: 22,
  },
  headerBar: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#eceff7',
    borderBottomWidth: 1,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  headerTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  headerTitle: {
    color: '#083d2e',
    fontSize: 22,
    fontWeight: '800',
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
    gap: 26,
    marginTop: 18,
  },
  cartCard: {
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    flexDirection: 'row',
    padding: 10,
    elevation: 6,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  imageWrap: {
    borderRadius: 14,
    height: 76,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 76,
  },
  itemImage: {
    height: '100%',
    width: '100%',
  },
  itemBody: {
    gap: 4,
    width: '100%',
  },
  itemDetailsColumn: {
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'space-between',
    marginLeft: 12,
    minHeight: 76,
  },
  itemName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  itemMeta: {
    color: '#26382f',
    fontSize: 13,
    marginTop: 1,
  },
  itemPrice: {
    color: '#0f5f47',
    fontSize: 15,
    fontWeight: '500',
  },
  itemFooterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: '#cff2e0',
    borderRadius: 999,
    flexDirection: 'row',
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: '#0b6149',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  stepperButtonSecondary: {
    backgroundColor: '#ffffff',
  },
  stepperText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
  },
  stepperSecondaryText: {
    color: '#0b6149',
    fontSize: 18,
    fontWeight: '500',
  },
  quantityText: {
    color: '#0b6149',
    fontSize: 15,
    fontWeight: '500',
    marginHorizontal: 16,
    minWidth: 12,
    textAlign: 'center',
  },
  addressCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 18,
    elevation: 5,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  cardTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
  },
  addressText: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 2,
  },
  addressActionPill: {
    backgroundColor: '#ffffff',
    borderColor: '#bfd0c7',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  billCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginTop: 40,
    paddingHorizontal: 22,
    paddingVertical: 24,
    elevation: 5,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  billRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  billLabel: {
    color: '#23352d',
    fontSize: 17,
  },
  billValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  billFreeValue: {
    color: '#0b6149',
    fontSize: 17,
    fontWeight: '800',
  },
  billDivider: {
    backgroundColor: '#e8edf3',
    height: 1,
    marginTop: 18,
  },
  billTotalLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  billTotalValue: {
    color: '#0b6149',
    fontSize: 20,
    fontWeight: '900',
  },
  checkoutBar: {
    backgroundColor: '#ffffff',
    bottom: 0,
    left: 0,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
    position: 'absolute',
    right: 0,
  },
  checkoutAddressIcon: {
    alignItems: 'center',
    backgroundColor: '#bfeccf',
    borderRadius: 20,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  checkoutAddressBody: {
    flex: 1,
  },
  checkoutAddressLabel: {
    color: '#4e5f58',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  checkoutAddressAction: {
    color: '#0f5f31',
    fontSize: 16,
    fontWeight: '700',
  },
  checkoutActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  checkoutLoginActionWrap: {
    backgroundColor: '#ffffff',
  },
  invoiceButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#0a5a44',
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  invoiceButtonDisabledState: {
    backgroundColor: '#0a5a44',
  },
  invoiceButtonText: {
    color: '#0a5a44',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  checkoutBuyButton: {
    alignItems: 'center',
    backgroundColor: '#0a5a44',
    borderRadius: 14,
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
  checkoutLoginButton: {
    backgroundColor: '#0a5a44',
  },
  checkoutBuyText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  checkoutLoginButtonText: {
    color: '#ffffff',
    fontWeight: '500',
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
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 'auto',
    maxHeight: '72%',
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
  addressPickerList: {
    gap: 12,
    marginTop: 16,
    paddingBottom: 4,
  },
  savedAddressCard: {
    backgroundColor: '#fffdf7',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  savedAddressSelectArea: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  savedAddressIconWrap: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    marginRight: 12,
    width: 32,
  },
  savedAddressBody: {
    flex: 1,
  },
  savedAddressType: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  savedAddressDetailsLabel: {
    color: '#4b5563',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  savedAddressPrimaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 2,
  },
  savedAddressText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  savedAddressEditButton: {
    alignItems: 'center',
    borderColor: '#dbe4f0',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  savedAddressEditText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
  },
  emptySavedAddressText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 12,
    textAlign: 'center',
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
});
