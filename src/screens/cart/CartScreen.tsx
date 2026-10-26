import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  ListRenderItemInfo,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  ActionButton,
  CustomAlert,
  LocationSheet,
  NotificationBell,
  nextSaturdayKitId,
} from '../../components';
import { useAuthStatus, useAuthUser } from '../../hooks/useAuth';
import {
  CartLine,
  removeCartLines,
  setCartQty,
  useCart,
} from '../../hooks/useCart';
import { useDeliveryFee } from '../../hooks/useDeliveryFee';
import { useDeliveryEstimate } from '../../hooks/useDeliveryEstimate';
import { useLocation } from '../../hooks/useLocation';
import type { RootStackScreenProps } from '../../navigation/types';
import {
  createCheckoutSession,
  createRequestForQuotation,
  placeCashOnDeliveryOrder,
  TOP_LEVEL_PARENT,
  type Category,
} from '../../services';
import {
  invalidateOrders,
  useCategories,
  useProductBundles,
} from '../../queries';
import {
  BORDER as CARD_BORDER,
  CARD,
  TEXT as INK,
  TEXT_VARIANT as INK_MUTED,
} from '../../theme/colors';

const BRAND_NAVY = '#1F2E3D';
const EMPTY_GREEN = '#167C6C';
const MAX_EMPTY_CATEGORY_CHIPS = 3;
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';
const BORDER = '#E1E5EA';

// How far ahead a delivery date can be scheduled.
const DELIVERY_MAX_AHEAD_DAYS = 90;

// Matches the web app's cart page (`frontend/src/pages/CartPage.vue`) —
// keep in sync if that list ever changes.
const DELIVERY_SLOTS = [
  '10 AM - 12 PM',
  '12 PM - 2 PM',
  '2 PM - 4 PM',
  '4 PM - 6 PM',
];

const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const firstOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

// Local Y/M/D, not `toISOString()` (which shifts to UTC and can land on the
// wrong calendar day depending on timezone).
const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Loose check only — the backend stores it as-is on the RFQ.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 7–15 digits, optionally with a leading `+` and spaces/dashes/brackets.
const PHONE_PATTERN = /^\+?[\d\s\-()]{7,20}$/;
const PHONE_DIGITS = /\d/g;

const isRfqLine = (line: CartLine) => line.item.rfqOnly;
const isOrderLine = (line: CartLine) => !line.item.rfqOnly;

const sameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const monthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const cartKeyExtractor = (line: CartLine) => line.item.id;

type CartRowProps = {
  isDelivery: boolean;
  line: CartLine;
  onFeeResolved: (itemId: string, fee: number) => void;
  onRemove: (line: CartLine) => void;
};

// Its own component (rather than a plain renderItem callback) so it can
// resolve its own supplier's distance-based delivery fee via `useDeliveryFee`
// — each line may have a different supplier — and report that fee up to the
// cart's order summary total.
const CartRow = ({
  isDelivery,
  line,
  onFeeResolved,
  onRemove,
}: CartRowProps) => {
  const { item, qty } = line;
  const isRfq = item.rfqOnly;
  const supplierLocation = {
    latitude: item.supplierLatitude,
    longitude: item.supplierLongitude,
    address: item.supplierAddress,
  };
  const resolvedFee = useDeliveryFee(supplierLocation);
  const deliveryEstimate = useDeliveryEstimate(supplierLocation);
  // No fallback fee — until the customer/supplier distance resolves, this
  // line simply doesn't contribute to the delivery fee yet.
  // Quotation items aren't delivered as part of this order, so they never
  // add a delivery fee (and aren't capped by stock).
  const itemDeliveryFee = isRfq ? 0 : resolvedFee ?? 0;
  const atMax = !isRfq && qty >= item.stock;
  const lowStock = !isRfq && item.stock > 0 && item.stock <= 5;

  useEffect(() => {
    onFeeResolved(item.id, itemDeliveryFee);
  }, [item.id, itemDeliveryFee, onFeeResolved]);

  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {item.image ? (
          <FastImage
            resizeMode={FastImage.resizeMode.cover}
            source={{ uri: item.image }}
            style={styles.thumbImage}
          />
        ) : (
          <MaterialCommunityIcons
            color={MUTED}
            name="package-variant-closed"
            size={22}
          />
        )}
      </View>

      <View style={styles.rowBody}>
        <Text numberOfLines={2} style={styles.rowName}>
          {item.name}
        </Text>
        <Text style={styles.rowUnit}>AED {item.price.toFixed(2)} each</Text>
        {item.kitRole ? (
          <View style={styles.rowMetaRow}>
            <MaterialCommunityIcons
              color={MUTED}
              name="calendar-sync"
              size={12}
            />
            <Text style={styles.rowMetaText}>
              {item.kitPlan === 'monthly'
                ? 'Monthly auto-renew · every Saturday'
                : 'One-time · next Saturday'}
            </Text>
          </View>
        ) : null}
        {isRfq ? (
          <View style={styles.rowMetaRow}>
            <MaterialCommunityIcons
              color={MUTED}
              name="file-document-outline"
              size={12}
            />
            <Text style={styles.rowMetaText}>Request for quotation</Text>
          </View>
        ) : !isDelivery || itemDeliveryFee > 0 ? (
          <View style={styles.rowMetaRow}>
            <MaterialCommunityIcons
              color={MUTED}
              name={isDelivery ? 'moped' : 'storefront-outline'}
              size={12}
            />
            <Text style={styles.rowMetaText}>
              {!isDelivery
                ? 'Store pickup'
                : `+ AED ${itemDeliveryFee.toFixed(2)} delivery`}
            </Text>
          </View>
        ) : null}
        {!isRfq && isDelivery && deliveryEstimate ? (
          <View style={styles.rowMetaRow}>
            <MaterialCommunityIcons color={MUTED} name="clock-fast" size={12} />
            <Text style={styles.rowMetaText}>
              Delivery in {deliveryEstimate}
            </Text>
          </View>
        ) : null}
        {lowStock ? (
          <Text style={styles.rowLowStock}>Only {item.stock} left</Text>
        ) : null}
      </View>

      <View style={styles.rowRight}>
        <Text style={styles.lineTotal}>
          AED {(item.price * qty).toFixed(2)}
        </Text>
        <View style={styles.stepper}>
          <TouchableOpacity
            hitSlop={8}
            onPress={() =>
              qty <= 1 ? onRemove(line) : setCartQty(item, qty - 1)
            }
            style={styles.stepperButton}
          >
            <MaterialCommunityIcons
              color={BRAND_NAVY}
              name={qty <= 1 ? 'trash-can-outline' : 'minus'}
              size={16}
            />
          </TouchableOpacity>
          <Text style={styles.stepperCount}>{qty}</Text>
          <TouchableOpacity
            disabled={atMax}
            hitSlop={8}
            onPress={() => setCartQty(item, qty + 1)}
            style={[
              styles.stepperButton,
              atMax ? styles.stepperButtonDisabled : null,
            ]}
          >
            <MaterialCommunityIcons color={BRAND_NAVY} name="plus" size={16} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

type Props = RootStackScreenProps<'Cart'>;

const CartScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const isSignedIn = useAuthStatus() === 'signedIn';
  const lines = useCart();
  const bundles = useProductBundles().data;
  const topCategories = (useCategories().data ?? [])
    .filter(
      category => category.parentId === TOP_LEVEL_PARENT && category.published,
    )
    .slice(0, MAX_EMPTY_CATEGORY_CHIPS);
  const openCategory = (category: Category) =>
    category.isGroup
      ? navigation.navigate('MainTabs', {
          screen: 'Categories',
          params: {
            screen: 'CategoriesList',
            params: { parentId: category.id, parentName: category.name },
          },
        })
      : navigation.navigate('MainTabs', {
          screen: 'Categories',
          params: {
            screen: 'CategoryItems',
            params: { categoryName: category.name, itemGroup: category.id },
          },
        });
  const { label: addressLabel, address: addressText } = useLocation();
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [fulfilment, setFulfilment] = useState<'delivery' | 'pickup'>(
    'delivery',
  );
  // Collapsed by default so the item list isn't pushed off-screen; a
  // one-line summary stays visible with a tap target to expand it.
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isRequestingQuote, setIsRequestingQuote] = useState(false);
  const authUser = useAuthUser();
  // The quotation's contact email and phone come from the signed-in profile
  // and aren't editable here.
  const rfqEmail = authUser?.email ?? '';
  const rfqPhone = authUser?.mobile_no ?? '';
  const [rfqRequiredDate, setRfqRequiredDate] = useState<Date | null>(null);

  const minDate = useMemo(startOfToday, []);
  const maxDate = useMemo(
    () => addDays(minDate, DELIVERY_MAX_AHEAD_DAYS),
    [minDate],
  );
  const [deliveryDate, setDeliveryDate] = useState<Date>(minDate);
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    firstOfMonth(startOfToday()),
  );
  const [deliverySlot, setDeliverySlot] = useState<string | null>(null);

  // Selectable days in the viewed month: today onward, up to the max date.
  const dateOptions = useMemo(() => {
    const start = sameMonth(viewMonth, minDate) ? minDate : viewMonth;
    const monthEnd = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth() + 1,
      0,
    );
    const end = monthEnd < maxDate ? monthEnd : maxDate;
    const days: Date[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      days.push(new Date(d));
    }
    return days;
  }, [viewMonth, minDate, maxDate]);

  const canPrevMonth = !sameMonth(viewMonth, minDate);
  const canNextMonth = !sameMonth(viewMonth, maxDate);
  const shiftMonth = (delta: number) =>
    setViewMonth(current =>
      firstOfMonth(
        new Date(current.getFullYear(), current.getMonth() + delta, 1),
      ),
    );

  const dayChipTitle = (date: Date) => {
    if (date.toDateString() === minDate.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === addDays(minDate, 1).toDateString()) {
      return 'Tmrw';
    }
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  };

  // Item Group `custom_rfq_only` items are submitted as a Request for
  // Quotation instead of being ordered, so the cart is split in two.
  const rfqLines = useMemo(() => lines.filter(isRfqLine), [lines]);
  const orderLines = useMemo(() => lines.filter(isOrderLine), [lines]);
  const hasRfqLines = rfqLines.length > 0;
  const hasOrderLines = orderLines.length > 0;

  // Required-by dates offered for a quotation: today onward.
  const rfqDateOptions = useMemo(
    () =>
      Array.from({ length: DELIVERY_MAX_AHEAD_DAYS + 1 }, (_, index) =>
        addDays(minDate, index),
      ),
    [minDate],
  );

  const isDelivery = fulfilment === 'delivery';
  const hasAddress = !!addressLabel;
  const needsAddress = hasOrderLines && isDelivery && !hasAddress;
  const isEmpty = lines.length === 0;
  // Always shown for now — items aren't flagged `custom_delivery_slots` in
  // the catalog yet (was gated on `lines.some(line =>
  // line.item.requiresDeliverySlot)`; re-add that gate once items opt in).

  // The line awaiting the "Remove item?" confirmation. It outlives
  // `removeAlertOpen` so the message doesn't blank while the alert fades out.
  const [pendingRemoval, setPendingRemoval] = useState<CartLine | null>(null);
  const [removeAlertOpen, setRemoveAlertOpen] = useState(false);
  const removeLine = useCallback((line: CartLine) => {
    setPendingRemoval(line);
    setRemoveAlertOpen(true);
  }, []);

  // Each line's delivery fee resolves asynchronously (it may need to geocode
  // an address) — CartRow reports its resolved fee here so the order summary
  // total can sum them once every line has settled.
  const [lineFees, setLineFees] = useState<Record<string, number>>({});
  const handleFeeResolved = useCallback((itemId: string, fee: number) => {
    setLineFees(prev =>
      prev[itemId] === fee ? prev : { ...prev, [itemId]: fee },
    );
  }, []);

  const renderCartRow = useCallback(
    ({ item: line }: ListRenderItemInfo<CartLine>) => (
      <CartRow
        isDelivery={isDelivery}
        line={line}
        onFeeResolved={handleFeeResolved}
        onRemove={removeLine}
      />
    ),
    [handleFeeResolved, isDelivery, removeLine],
  );

  // Cart is pushed on the root stack (no longer a tab), so it needs a way back.
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
      <View style={styles.headerLeft}>
        <TouchableOpacity
          hitSlop={8}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons color={INK} name="chevron-left" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
      </View>
      {isSignedIn ? <NotificationBell /> : null}
    </View>
  );

  if (isEmpty) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        {header}

        <ScrollView
          contentContainerStyle={styles.emptyContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.illustration}>
            <MaterialCommunityIcons
              color={EMPTY_GREEN}
              name="shopping-outline"
              size={64}
            />
            <View style={styles.illoBadge}>
              <MaterialCommunityIcons color={CARD} name="plus" size={22} />
            </View>
          </View>

          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Looks like you haven't added anything yet. Groceries, garments and
            daily essentials arrive in 20–30 minutes.
          </Text>

          <ActionButton
            label="Start shopping"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Categories' })}
            style={styles.primaryCta}
          />

          <TouchableOpacity
            hitSlop={8}
            onPress={() => navigation.navigate('Wishlist')}
            style={styles.secondaryCta}
          >
            <MaterialCommunityIcons
              color={INK}
              name="heart-outline"
              size={20}
            />
            <Text style={styles.secondaryCtaText}>View my wishlist</Text>
          </TouchableOpacity>

          {topCategories.length > 0 ? (
            <>
              <Text style={styles.chipsLabel}>Or jump into a category</Text>
              <View style={styles.chips}>
                {topCategories.map(category => (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => openCategory(category)}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{category.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  const subtotal = orderLines.reduce(
    (sum, line) => sum + line.item.price * line.qty,
    0,
  );
  const deliveryFee = isDelivery
    ? orderLines.reduce((sum, line) => sum + (lineFees[line.item.id] ?? 0), 0)
    : 0;
  const total = subtotal + deliveryFee;
  // Indicative only — the supplier's quotation sets the real price.
  const rfqEstimate = rfqLines.reduce(
    (sum, line) => sum + line.item.price * line.qty,
    0,
  );

  // Matches both `create_cash_on_delivery_order`'s and
  // `create_checkout_session`'s `cart_items` shape (see `orders.service.ts`
  // / `stripe.service.ts`) — `quantity`, not `qty`.
  const cartItems = orderLines.map(line => ({
    item_code: line.item.id,
    quantity: line.qty,
    rate: line.item.price,
  }));

  /**
   * Drops week kits whose ordering has closed (their Friday cutoff passed
   * since they were added) and says so. True if the cart was changed.
   */
  const dropClosedKits = () => {
    if (!bundles) {
      return false;
    }
    const openId = nextSaturdayKitId(bundles);
    const isClosedKit = (line: CartLine) =>
      line.item.kitRole === 'week' && line.item.id !== openId;
    if (!lines.some(isClosedKit)) {
      return false;
    }
    // The basic kit isn't an order on its own, so it goes too when no open
    // week kit is left.
    const keepsWeekKit = lines.some(
      line => line.item.kitRole === 'week' && !isClosedKit(line),
    );
    removeCartLines(
      line =>
        isClosedKit(line) || (!keepsWeekKit && line.item.kitRole === 'basic'),
    );
    Alert.alert(
      'Kit ordering closed',
      "Orders for that week's kit closed at 5 PM on Friday, so it was removed from your cart. You can pick the kit for the next Saturday from Weekly Kits.",
    );
    return true;
  };

  const onCashOnDelivery = async () => {
    if (isPlacingOrder || dropClosedKits()) {
      return;
    }
    if (!deliverySlot) {
      Alert.alert(
        'Choose a time slot',
        `Please choose a ${
          isDelivery ? 'delivery' : 'pickup'
        } slot before placing the order.`,
      );
      return;
    }

    setIsPlacingOrder(true);
    try {
      const order = await placeCashOnDeliveryOrder({
        items: cartItems,
        deliveryDate: toIsoDate(deliveryDate),
        deliverySlot,
        deliveryFee,
        customerPickup: !isDelivery,
        addressDisplay: isDelivery ? addressText : null,
      });
      invalidateOrders();
      removeCartLines(isOrderLine);
      Alert.alert(
        'Order placed',
        `Your order ${order.sales_order} has been placed.`,
      );
    } catch (error) {
      console.log(
        'onCashOnDelivery error:',
        error instanceof Error ? error.message : error,
      );
      Alert.alert(
        'Could not place order',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const onRequestQuotation = async () => {
    if (isRequestingQuote) {
      return;
    }
    if (!rfqRequiredDate) {
      Alert.alert(
        'Choose a required date',
        'Please choose when you need the quoted items by.',
      );
      return;
    }
    const address = addressText || addressLabel;
    if (!address) {
      Alert.alert(
        'Add a delivery address',
        'Please choose where the quoted items should be delivered.',
      );
      setAddressSheetOpen(true);
      return;
    }
    const phone = rfqPhone.trim();
    const phoneDigits = phone.match(PHONE_DIGITS)?.length ?? 0;
    if (!PHONE_PATTERN.test(phone) || phoneDigits < 7 || phoneDigits > 15) {
      Alert.alert(
        'Phone number missing',
        'Your profile has no valid phone number. Please add one to your profile to request a quotation.',
      );
      return;
    }
    const email = rfqEmail.trim();
    if (!EMAIL_PATTERN.test(email)) {
      Alert.alert(
        'Email missing',
        'Your profile has no valid email. Please add one to your profile to request a quotation.',
      );
      return;
    }

    setIsRequestingQuote(true);
    try {
      const request = await createRequestForQuotation({
        items: rfqLines.map(line => ({
          item_code: line.item.id,
          quantity: line.qty,
          supplier: line.item.supplier ?? undefined,
          supplier_name: line.item.supplier ?? undefined,
        })),
        requiredDate: toIsoDate(rfqRequiredDate),
        email,
        address,
        phone,
      });
      invalidateOrders();
      console.log(
        'onRequestQuotation response:',
        JSON.stringify(request, null, 2),
      );
      removeCartLines(isRfqLine);
      setRfqRequiredDate(null);
      Alert.alert(
        'Quotation requested',
        request?.name
          ? `Your request for quotation ${request.name} has been sent.`
          : 'Your request for quotation has been sent.',
      );
    } catch (error) {
      console.log(
        'onRequestQuotation error:',
        error instanceof Error ? error.message : error,
      );
      Alert.alert(
        'Could not request quotation',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsRequestingQuote(false);
    }
  };

  const onPayNow = async () => {
    if (isStartingPayment || dropClosedKits()) {
      return;
    }
    if (!deliverySlot) {
      Alert.alert(
        'Choose a time slot',
        `Please choose a ${
          isDelivery ? 'delivery' : 'pickup'
        } slot before checkout.`,
      );
      return;
    }
    setIsStartingPayment(true);
    try {
      const session = await createCheckoutSession({
        items: cartItems,
        deliveryDate: toIsoDate(deliveryDate),
        deliverySlot,
        deliveryFee,
        customerPickup: !isDelivery,
        addressDisplay: isDelivery ? addressText : null,
      });

      if (!session.checkout_url) {
        throw new Error('Payment setup did not return a checkout URL.');
      }

      // A root-stack screen, so leaving it lands back on the Cart tab.
      navigation.navigate('Checkout', {
        paymentCheckout: true,
        title: 'Checkout',
        url: session.checkout_url,
      });
    } catch (error) {
      console.log(
        'onPayNow error:',
        error instanceof Error ? error.message : error,
      );
      Alert.alert(
        'Could not start payment',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsStartingPayment(false);
    }
  };

  const chosenDateText =
    deliveryDate.toDateString() === minDate.toDateString()
      ? 'Today'
      : deliveryDate.toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {header}

      <FlatList
        contentContainerStyle={styles.listContent}
        data={lines}
        keyExtractor={cartKeyExtractor}
        renderItem={renderCartRow}
        style={styles.list}
        ListHeaderComponent={
          <>
            {hasOrderLines ? (
              <View style={styles.optionsCard}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setOptionsExpanded(value => !value)}
                  style={styles.optionsSummaryRow}
                >
                  <View style={styles.optionsSummaryIcon}>
                    <MaterialCommunityIcons
                      color={ACCENT_TEAL}
                      name={isDelivery ? 'moped' : 'storefront-outline'}
                      size={18}
                    />
                  </View>
                  <View style={styles.optionsSummaryBody}>
                    <Text style={styles.optionsHeading}>
                      {isDelivery ? 'Delivery' : 'Pickup'} details
                    </Text>
                    <Text numberOfLines={1} style={styles.optionsSummaryText}>
                      {chosenDateText} · {deliverySlot ?? 'Choose a slot'}
                      {isDelivery && hasAddress ? ` · ${addressLabel}` : ''}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    color={MUTED}
                    name={optionsExpanded ? 'chevron-up' : 'chevron-down'}
                    size={22}
                  />
                </TouchableOpacity>

                {optionsExpanded ? (
                  <>
                    <View style={styles.optionsDivider} />
                    <View style={styles.segment}>
                      {(['delivery', 'pickup'] as const).map(option => {
                        const active = fulfilment === option;
                        return (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            key={option}
                            onPress={() => setFulfilment(option)}
                            style={[
                              styles.segmentItem,
                              active ? styles.segmentItemActive : null,
                            ]}
                          >
                            <MaterialCommunityIcons
                              color={active ? '#ffffff' : MUTED}
                              name={
                                option === 'delivery'
                                  ? 'moped'
                                  : 'storefront-outline'
                              }
                              size={15}
                            />
                            <Text
                              style={[
                                styles.segmentText,
                                active ? styles.segmentTextActive : null,
                              ]}
                            >
                              {option === 'delivery' ? 'Delivery' : 'Pickup'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.optionsDivider} />

                    {isDelivery ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setAddressSheetOpen(true)}
                        style={styles.optionRow}
                      >
                        <MaterialCommunityIcons
                          color={ACCENT_TEAL}
                          name="map-marker-outline"
                          size={18}
                        />
                        <View style={styles.addressBody}>
                          {hasAddress ? (
                            <>
                              <Text
                                numberOfLines={1}
                                style={styles.addressLabel}
                              >
                                Deliver to · {addressLabel}
                              </Text>
                              {addressText ? (
                                <Text
                                  numberOfLines={1}
                                  style={styles.addressText}
                                >
                                  {addressText}
                                </Text>
                              ) : null}
                            </>
                          ) : (
                            <Text style={styles.addressPlaceholder}>
                              Choose delivery address
                            </Text>
                          )}
                        </View>
                        <Text style={styles.addressAction}>
                          {hasAddress ? 'Change' : 'Add'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.optionRow}>
                        <MaterialCommunityIcons
                          color={ACCENT_TEAL}
                          name="storefront-outline"
                          size={18}
                        />
                        <View style={styles.addressBody}>
                          <Text style={styles.addressLabel}>
                            Collect from store
                          </Text>
                          <Text numberOfLines={1} style={styles.addressText}>
                            You'll pick the branch at checkout.
                          </Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.optionsDivider} />

                    <View style={styles.dateHeaderRow}>
                      <View style={styles.optionRow}>
                        <MaterialCommunityIcons
                          color={ACCENT_TEAL}
                          name="calendar-month-outline"
                          size={18}
                        />
                        <Text style={styles.addressLabel}>
                          {isDelivery ? 'Delivery date' : 'Pickup date'}
                        </Text>
                      </View>
                      <View style={styles.monthNav}>
                        <TouchableOpacity
                          disabled={!canPrevMonth}
                          hitSlop={8}
                          onPress={() => shiftMonth(-1)}
                          style={styles.monthNavButton}
                        >
                          <MaterialCommunityIcons
                            color={canPrevMonth ? BRAND_NAVY : '#C7CED6'}
                            name="chevron-left"
                            size={20}
                          />
                        </TouchableOpacity>
                        <Text style={styles.monthNavLabel}>
                          {monthLabel(viewMonth)}
                        </Text>
                        <TouchableOpacity
                          disabled={!canNextMonth}
                          hitSlop={8}
                          onPress={() => shiftMonth(1)}
                          style={styles.monthNavButton}
                        >
                          <MaterialCommunityIcons
                            color={canNextMonth ? BRAND_NAVY : '#C7CED6'}
                            name="chevron-right"
                            size={20}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <ScrollView
                      contentContainerStyle={styles.dateStrip}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {dateOptions.map(date => {
                        const selected =
                          date.toDateString() === deliveryDate.toDateString();
                        return (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            key={date.toISOString()}
                            onPress={() => setDeliveryDate(date)}
                            style={[
                              styles.dateChip,
                              selected ? styles.dateChipActive : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dateChipDow,
                                selected ? styles.dateChipTextActive : null,
                              ]}
                            >
                              {dayChipTitle(date)}
                            </Text>
                            <Text
                              style={[
                                styles.dateChipDay,
                                selected ? styles.dateChipTextActive : null,
                              ]}
                            >
                              {date.getDate()}
                            </Text>
                            <Text
                              style={[
                                styles.dateChipMon,
                                selected ? styles.dateChipTextActive : null,
                              ]}
                            >
                              {date.toLocaleDateString(undefined, {
                                month: 'short',
                              })}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <View style={styles.optionsDivider} />
                    <View style={styles.optionRow}>
                      <MaterialCommunityIcons
                        color={ACCENT_TEAL}
                        name="clock-outline"
                        size={18}
                      />
                      <Text style={styles.addressLabel}>
                        {isDelivery ? 'Delivery slot' : 'Pickup slot'}
                      </Text>
                    </View>
                    <View style={styles.slotGrid}>
                      {DELIVERY_SLOTS.map(slot => {
                        const selected = deliverySlot === slot;
                        return (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            key={slot}
                            onPress={() => setDeliverySlot(slot)}
                            style={[
                              styles.slotChip,
                              selected ? styles.slotChipActive : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.slotChipText,
                                selected ? styles.slotChipTextActive : null,
                              ]}
                            >
                              {slot}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {!deliverySlot ? (
                      <Text style={styles.slotPrompt}>
                        Select a {isDelivery ? 'delivery' : 'pickup'} slot to
                        continue.
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}

            {hasRfqLines ? (
              <View style={styles.optionsCard}>
                <View style={styles.optionsSummaryRow}>
                  <View style={styles.optionsSummaryIcon}>
                    <MaterialCommunityIcons
                      color={ACCENT_TEAL}
                      name="file-document-outline"
                      size={18}
                    />
                  </View>
                  <View style={styles.optionsSummaryBody}>
                    <Text style={styles.optionsHeading}>Quotation details</Text>
                    <Text numberOfLines={2} style={styles.optionsSummaryText}>
                      {rfqLines.length === 1
                        ? '1 item is'
                        : `${rfqLines.length} items are`}{' '}
                      priced on request — suppliers will reply with a quote.
                    </Text>
                  </View>
                </View>

                <View style={styles.optionsDivider} />
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setAddressSheetOpen(true)}
                  style={styles.optionRow}
                >
                  <MaterialCommunityIcons
                    color={ACCENT_TEAL}
                    name="map-marker-outline"
                    size={18}
                  />
                  <View style={styles.addressBody}>
                    {hasAddress ? (
                      <>
                        <Text numberOfLines={1} style={styles.addressLabel}>
                          Deliver to · {addressLabel}
                        </Text>
                        {addressText ? (
                          <Text numberOfLines={1} style={styles.addressText}>
                            {addressText}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <Text style={styles.addressPlaceholder}>
                        Choose delivery address
                      </Text>
                    )}
                  </View>
                  <Text style={styles.addressAction}>
                    {hasAddress ? 'Change' : 'Add'}
                  </Text>
                </TouchableOpacity>
                <View style={[styles.optionRow, styles.rfqFieldRow]}>
                  <MaterialCommunityIcons
                    color={ACCENT_TEAL}
                    name="phone-outline"
                    size={18}
                  />
                  <Text style={styles.addressLabel}>Phone number</Text>
                </View>
                <TextInput
                  autoCorrect={false}
                  keyboardType="phone-pad"
                  editable={false}
                  placeholder="+971 50 123 4567"
                  placeholderTextColor={MUTED}
                  style={[styles.rfqEmailInput, styles.rfqInputDisabled]}
                  textContentType="telephoneNumber"
                  value={rfqPhone}
                />

                <View style={styles.optionsDivider} />
                <View style={styles.optionRow}>
                  <MaterialCommunityIcons
                    color={ACCENT_TEAL}
                    name="calendar-month-outline"
                    size={18}
                  />
                  <Text style={styles.addressLabel}>Required by</Text>
                </View>
                <ScrollView
                  contentContainerStyle={styles.dateStrip}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {rfqDateOptions.map(date => {
                    const selected =
                      rfqRequiredDate?.toDateString() === date.toDateString();
                    return (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        key={date.toISOString()}
                        onPress={() => setRfqRequiredDate(date)}
                        style={[
                          styles.dateChip,
                          selected ? styles.dateChipActive : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateChipDow,
                            selected ? styles.dateChipTextActive : null,
                          ]}
                        >
                          {dayChipTitle(date)}
                        </Text>
                        <Text
                          style={[
                            styles.dateChipDay,
                            selected ? styles.dateChipTextActive : null,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                        <Text
                          style={[
                            styles.dateChipMon,
                            selected ? styles.dateChipTextActive : null,
                          ]}
                        >
                          {date.toLocaleDateString(undefined, {
                            month: 'short',
                          })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.optionsDivider} />
                <View style={styles.optionRow}>
                  <MaterialCommunityIcons
                    color={ACCENT_TEAL}
                    name="email-outline"
                    size={18}
                  />
                  <Text style={styles.addressLabel}>
                    Email for the quotation
                  </Text>
                </View>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={false}
                  placeholder="you@example.com"
                  placeholderTextColor={MUTED}
                  style={[styles.rfqEmailInput, styles.rfqInputDisabled]}
                  value={rfqEmail}
                />
              </View>
            ) : null}
          </>
        }
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.summary}>
        {hasOrderLines ? (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>AED {subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {isDelivery ? 'Delivery' : 'Pickup'}
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  !isDelivery ? styles.summaryFree : null,
                ]}
              >
                {!isDelivery ? 'FREE' : `AED ${deliveryFee.toFixed(2)}`}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotalRow]}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>
                AED {total.toFixed(2)}
              </Text>
            </View>

            <View style={styles.reassureRow}>
              <MaterialCommunityIcons
                color={MUTED}
                name={isDelivery ? 'moped' : 'storefront-outline'}
                size={14}
              />
              <Text style={styles.reassureText}>
                {isDelivery ? 'Delivery' : 'Pickup'} · {chosenDateText}
                {isDelivery && hasAddress ? ` · ${addressLabel}` : ''}
              </Text>
            </View>
          </>
        ) : null}

        {hasRfqLines ? (
          <View
            style={[
              styles.summaryRow,
              !hasOrderLines ? styles.summaryTotalRow : null,
            ]}
          >
            <Text
              style={
                hasOrderLines ? styles.summaryLabel : styles.summaryTotalLabel
              }
            >
              Quotation estimate
            </Text>
            <Text
              style={
                hasOrderLines ? styles.summaryValue : styles.summaryTotalValue
              }
            >
              AED {rfqEstimate.toFixed(2)}
            </Text>
          </View>
        ) : null}

        {isSignedIn && hasRfqLines ? (
          <ActionButton
            disabled={isRequestingQuote}
            label={isRequestingQuote ? 'Submitting...' : 'Request Quotation'}
            loading={isRequestingQuote}
            onPress={onRequestQuotation}
            style={[
              styles.checkoutButton,
              hasOrderLines ? styles.rfqButtonStacked : null,
            ]}
            variant={hasOrderLines ? 'secondary' : 'dark'}
          />
        ) : null}

        {isSignedIn && !hasOrderLines ? null : !isSignedIn || needsAddress ? (
          <ActionButton
            label={!isSignedIn ? 'Login to proceed' : 'Add delivery address'}
            onPress={() => {
              if (!isSignedIn) {
                navigation.navigate('Login');
                return;
              }
              setAddressSheetOpen(true);
            }}
            style={styles.checkoutButton}
            variant="dark"
          />
        ) : (
          <View style={[styles.checkoutButton, styles.paymentOptionsRow]}>
            <ActionButton
              disabled={isPlacingOrder}
              label={isPlacingOrder ? 'Placing order...' : 'Cash on Delivery'}
              loading={isPlacingOrder}
              onPress={onCashOnDelivery}
              style={styles.paymentOptionButton}
              variant="secondary"
            />
            <ActionButton
              disabled={isStartingPayment}
              label={isStartingPayment ? '' : 'Pay now'}
              loading={isStartingPayment}
              onPress={onPayNow}
              style={styles.paymentOptionButton}
              variant="dark"
            />
          </View>
        )}
        <View style={styles.secureRow}>
          <MaterialCommunityIcons
            color={MUTED}
            name="shield-check-outline"
            size={13}
          />
          <Text style={styles.secureText}>Secure checkout</Text>
        </View>
        {hasOrderLines ? (
          <Text style={styles.policyText}>
            Orders cannot be cancelled once packed for delivery. In case of
            unexpected delays, a refund will be provided, if applicable.
          </Text>
        ) : null}
      </View>

      <LocationSheet
        onClose={() => setAddressSheetOpen(false)}
        visible={addressSheetOpen}
      />

      <CustomAlert
        icon="cart-remove"
        message={`Remove "${pendingRemoval?.item.name ?? ''}" from your cart?`}
        onClose={() => setRemoveAlertOpen(false)}
        onPrimaryButtonPress={() => {
          if (pendingRemoval) {
            setCartQty(pendingRemoval.item, 0);
          }
        }}
        primaryButtonLabel="Remove"
        primaryButtonVariant="destructive"
        secondaryButtonLabel="Cancel"
        title="Remove item?"
        visible={removeAlertOpen}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },

  // ---- empty state ----
  emptyContainer: {
    backgroundColor: '#ffffff',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  backButton: {
    marginLeft: -8,
    marginRight: 4,
  },
  headerTitle: {
    color: INK,
    fontSize: 26,
    fontWeight: '800',
  },
  emptyContent: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 28,
    paddingTop: 40,
  },
  illustration: {
    alignItems: 'center',
    backgroundColor: '#E6F4F1',
    borderRadius: 82,
    height: 164,
    justifyContent: 'center',
    marginBottom: 32,
    width: 164,
  },
  illoBadge: {
    alignItems: 'center',
    backgroundColor: EMPTY_GREEN,
    borderColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 4,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 10,
    width: 40,
  },
  emptyTitle: {
    color: INK,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    color: INK_MUTED,
    fontSize: 14.5,
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
  },
  primaryCta: {
    alignSelf: 'stretch',
    backgroundColor: EMPTY_GREEN,
    borderRadius: 14,
    marginTop: 28,
  },
  secondaryCta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    paddingVertical: 6,
  },
  secondaryCtaText: {
    color: INK,
    fontSize: 15.5,
    fontWeight: '700',
  },
  chipsLabel: {
    color: INK_MUTED,
    fontSize: 13.5,
    marginTop: 40,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginTop: 12,
  },
  chip: {
    borderColor: CARD_BORDER,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  chipText: {
    color: INK,
    fontSize: 14.5,
    fontWeight: '600',
  },

  // ---- populated cart ----
  list: {
    flex: 1,
  },
  listContent: {
    gap: 12,
    padding: 16,
    paddingTop: 8,
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: BORDER,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 12,
  },
  thumb: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 14,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  thumbImage: {
    height: '100%',
    width: '100%',
  },
  rowBody: {
    flex: 1,
    paddingHorizontal: 12,
  },
  rowName: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  rowUnit: {
    color: MUTED,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 3,
  },
  rowMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  rowMetaText: {
    color: MUTED,
    fontSize: 11.5,
    fontWeight: '600',
  },
  rowLowStock: {
    color: '#B26A00',
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 4,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 10,
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
  },
  stepperButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  stepperButtonDisabled: {
    opacity: 0.3,
  },
  stepperCount: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 22,
    textAlign: 'center',
  },
  lineTotal: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '800',
  },
  optionsCard: {
    backgroundColor: '#ffffff',
    borderColor: BORDER,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
    padding: 14,
  },
  optionsHeading: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  optionsSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  optionsSummaryIcon: {
    alignItems: 'center',
    backgroundColor: '#F2F4F6',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  optionsSummaryBody: {
    flex: 1,
  },
  optionsSummaryText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  optionsDivider: {
    backgroundColor: BORDER,
    height: 1,
    marginVertical: 12,
  },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  segment: {
    backgroundColor: '#F2F4F6',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  segmentItemActive: {
    backgroundColor: BRAND_NAVY,
  },
  segmentText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  addressBody: {
    flex: 1,
  },
  addressLabel: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '800',
  },
  addressText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 2,
  },
  addressPlaceholder: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '700',
  },
  addressAction: {
    color: ACCENT_TEAL,
    fontSize: 13,
    fontWeight: '800',
  },
  dateHeaderRow: {
    gap: 10,
  },
  monthNav: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthNavButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  monthNavLabel: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '800',
  },
  dateStrip: {
    gap: 8,
    paddingTop: 10,
  },
  dateChip: {
    alignItems: 'center',
    borderColor: BORDER,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dateChipActive: {
    backgroundColor: BRAND_NAVY,
    borderColor: BRAND_NAVY,
  },
  dateChipDow: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateChipDay: {
    color: BRAND_NAVY,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  dateChipMon: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
  },
  dateChipTextActive: {
    color: '#ffffff',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  slotChip: {
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  slotChipActive: {
    backgroundColor: BRAND_NAVY,
    borderColor: BRAND_NAVY,
  },
  slotChipText: {
    color: BRAND_NAVY,
    fontSize: 12.5,
    fontWeight: '700',
  },
  slotChipTextActive: {
    color: '#ffffff',
  },
  slotPrompt: {
    color: MUTED,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 8,
  },
  summary: {
    backgroundColor: '#ffffff',
    borderTopColor: BORDER,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 28,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  summaryValue: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryFree: {
    color: '#1E8E7E',
    fontWeight: '800',
  },
  summaryTotalRow: {
    borderTopColor: BORDER,
    borderTopWidth: 1,
    marginBottom: 12,
    marginTop: 4,
    paddingTop: 10,
  },
  reassureRow: {
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reassureText: {
    color: BRAND_NAVY,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  secureRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    marginTop: 10,
  },
  secureText: {
    color: MUTED,
    fontSize: 11.5,
    fontWeight: '600',
  },
  policyText: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  summaryTotalLabel: {
    color: BRAND_NAVY,
    fontSize: 15,
    fontWeight: '800',
  },
  summaryTotalValue: {
    color: BRAND_NAVY,
    fontSize: 16,
    fontWeight: '800',
  },
  // Phone sits in the address block, a little below the "Deliver to" row.
  rfqFieldRow: {
    marginTop: 14,
  },
  rfqInputDisabled: {
    backgroundColor: '#F2F4F6',
    color: MUTED,
  },
  rfqEmailInput: {
    borderColor: BORDER,
    borderRadius: 10,
    borderWidth: 1,
    color: BRAND_NAVY,
    fontSize: 14,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  checkoutButton: {
    marginTop: 4,
  },
  // Sits above the payment buttons when the cart mixes both kinds of item.
  rfqButtonStacked: {
    marginBottom: 6,
  },
  paymentOptionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentOptionButton: {
    flex: 1,
  },
});

export default CartScreen;
