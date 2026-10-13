import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  ActionButton,
  KitImage,
  ScreenHeader,
  nextSaturdayKitId,
} from '../../components';
import { setCartQty, useCart } from '../../hooks/useCart';
import type { RootStackScreenProps } from '../../navigation/types';
import { useManualRefresh, useProductBundles } from '../../queries';
import {
  formatComponentQty,
  formatKg,
  kitOrderCutoff,
  nextKitDeliveryDate,
  type BundleComponent,
  type KitPlan,
  type ProductBundle,
} from '../../services';
import {
  BORDER,
  CARD,
  GREEN,
  MUTED,
  SURFACE,
  TEXT,
  TEXT_VARIANT,
} from '../../theme/colors';

type Props = RootStackScreenProps<'WeeklyKits'>;

const BRAND_NAVY = '#1F2E3D';
// The kit picker's own palette, from the design.
const KIT_GREEN = '#1F5F25';
const KIT_BUTTON = '#2E7D32';
const KIT_SELECTED_BG = '#EEF7E9';
const KIT_PAGE_BG = '#F2F3F7';
const LINK_BLUE = '#0B63C5';
const ERROR = '#C62828';
// TODO: confirm the published Terms & Conditions page.
const TERMS_URL = 'https://buyinminutes.u.frappe.cloud/terms';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "Sat, 10 Oct". */
const formatDay = (date: Date) =>
  `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;

/** "Fri, 9 Oct, 5:00 PM". */
const formatDayTime = (date: Date) => {
  const hours = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = date.getHours() < 12 ? 'AM' : 'PM';
  return `${formatDay(date)}, ${hours}:${minutes} ${period}`;
};

function ComponentTile({ component }: { component: BundleComponent }) {
  return (
    <View style={styles.componentTile}>
      <View style={styles.componentImage}>
        {component.image ? (
          <FastImage
            resizeMode={FastImage.resizeMode.cover}
            source={{ uri: component.image }}
            style={styles.componentImageFill}
          />
        ) : (
          <MaterialCommunityIcons color={MUTED} name="sprout" size={22} />
        )}
      </View>
      <Text numberOfLines={2} style={styles.componentName}>
        {component.name}
      </Text>
      <Text numberOfLines={1} style={styles.componentQty}>
        {formatComponentQty(component.qty, component.uom)}
      </Text>
    </View>
  );
}

type CheckboxProps = {
  checked: boolean;
  error?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

function Checkbox({ checked, error = false, onToggle, children }: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={6}
      onPress={onToggle}
      style={styles.checkboxRow}
    >
      <MaterialCommunityIcons
        color={checked ? GREEN : error ? ERROR : MUTED}
        name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={22}
      />
      <View style={styles.checkboxBody}>{children}</View>
    </Pressable>
  );
}

type KitCardProps = {
  bundle: ProductBundle;
  isNext?: boolean;
  /** A week kit whose ordering window isn't open: shown, not selectable. */
  locked?: boolean;
  selected?: boolean;
  /** Omitted for the basic kit, which is always included and not tappable. */
  onToggle?: (bundle: ProductBundle) => void;
};

function KitCard({
  bundle,
  isNext = false,
  locked = false,
  selected = false,
  onToggle,
}: KitCardProps) {
  const isBasic = bundle.role === 'basic';
  return (
    <Pressable
      accessibilityState={onToggle ? { disabled: locked, selected } : undefined}
      disabled={!onToggle || locked}
      onPress={() => onToggle?.(bundle)}
      style={[
        styles.kitCard,
        selected ? styles.kitCardSelected : null,
        locked ? styles.kitCardLocked : null,
      ]}
    >
      <View style={styles.kitHeader}>
        <KitImage bundle={bundle} style={styles.kitImage} />
        <View style={styles.kitBody}>
          <Text style={styles.kitTitle}>{bundle.label}</Text>
          {isNext ? (
            <View style={styles.nextBadge}>
              <Text style={styles.nextBadgeText}>NEXT SATURDAY</Text>
            </View>
          ) : null}
          {isBasic ? (
            <View style={styles.nextBadge}>
              <Text style={styles.nextBadgeText}>INCLUDED EVERY WEEK</Text>
            </View>
          ) : null}
          {bundle.weightKg !== null ? (
            <Text style={styles.kitWeight}>
              {formatKg(bundle.weightKg)} / Week
            </Text>
          ) : null}
        </View>

        {onToggle && locked ? (
          <View style={[styles.selectButton, styles.selectButtonLocked]}>
            <MaterialCommunityIcons color={MUTED} name="lock" size={18} />
            <Text style={[styles.selectButtonText, styles.selectButtonTextLocked]}>
              Closed
            </Text>
          </View>
        ) : onToggle ? (
          <View
            style={[styles.selectButton, selected ? styles.selectButtonOn : null]}
          >
            {selected ? (
              <MaterialCommunityIcons color={KIT_BUTTON} name="check" size={18} />
            ) : null}
            <Text
              style={[
                styles.selectButtonText,
                selected ? styles.selectButtonTextOn : null,
              ]}
            >
              {selected ? 'Selected' : 'Select\nKit'}
            </Text>
          </View>
        ) : null}
      </View>

      {bundle.components.length > 0 ? (
        <>
          <Text style={styles.kitLineLabel}>
            {isBasic ? 'Fixed Essentials' : 'Rotating Items'} ·{' '}
            {bundle.components.length}
          </Text>
          <ScrollView
            contentContainerStyle={styles.componentList}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {bundle.components.map(component => (
              <ComponentTile component={component} key={component.itemCode} />
            ))}
          </ScrollView>
        </>
      ) : null}
    </Pressable>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryRowLabel}>{label}</Text>
      <Text style={styles.summaryRowValue}>{value}</Text>
    </View>
  );
}

/**
 * Weekly vegetable kit picker: the basic kit is always included, the
 * customer picks one week's kit on top, one-time or auto-renewing monthly,
 * then goes on to the normal cart checkout.
 */
export default function WeeklyKitsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const bundlesQuery = useProductBundles();
  const bundles = useMemo(() => bundlesQuery.data ?? [], [bundlesQuery.data]);
  const basic = bundles.find(bundle => bundle.role === 'basic') ?? null;
  const weeks = useMemo(
    () => bundles.filter(bundle => bundle.role === 'week'),
    [bundles],
  );
  const { refreshing, onRefresh } = useManualRefresh(bundlesQuery.refetch);
  // Only the kit for the next open Saturday can be picked; it closes at the
  // Friday cutoff and the following week's kit opens.
  const nextId = nextSaturdayKitId(bundles);
  const deliveryDate = nextKitDeliveryDate();
  const orderCutoff = kitOrderCutoff(deliveryDate);

  const cart = useCart();
  const cartKits = cart.filter(line => line.item.kitRole).map(line => line.item);
  const cartWeeks = cartKits.filter(item => item.kitRole === 'week');
  const askedId = route.params?.kitId === nextId ? nextId : undefined;

  // `undefined` until the user taps: start from the kit asked for plus
  // what's in the cart, else next Saturday's week kit.
  const [weekPicks, setWeekPicks] = useState<string[] | undefined>();
  const startIds = [
    ...new Set([
      ...(weeks.some(week => week.item.id === askedId) && askedId
        ? [askedId]
        : []),
      ...cartWeeks.map(item => item.id).filter(id => id === nextId),
    ]),
  ];
  const weekIds = (
    weekPicks ?? (startIds.length > 0 ? startIds : nextId ? [nextId] : [])
  ).filter(id => id === nextId);
  const selectedWeeks = weeks.filter(week => weekIds.includes(week.item.id));
  const selectedKits = [...(basic ? [basic] : []), ...selectedWeeks];
  const totalPrice = selectedKits.reduce((sum, kit) => sum + kit.item.price, 0);
  const weights = selectedKits
    .map(kit => kit.weightKg)
    .filter((kg): kg is number => kg !== null);
  const totalKg =
    weights.length > 0 ? weights.reduce((sum, kg) => sum + kg, 0) : null;
  // At least one week's kit is required — the basic kit alone isn't an order. Kits
  // without a selling price can still be ordered; the price is simply not
  // shown until one is set.
  const purchasable = selectedWeeks.length > 0;
  const hasPrice = totalPrice > 0;

  const [autoRenew, setAutoRenew] = useState(
    cartKits[0]?.kitPlan === 'monthly',
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const summaryY = useRef(0);

  const toggleWeek = (bundle: ProductBundle) => {
    const id = bundle.item.id;
    if (id !== nextId) {
      return;
    }
    setWeekPicks(
      weekIds.includes(id)
        ? weekIds.filter(other => other !== id)
        : [...weekIds, id],
    );
  };

  const toggleTerms = useCallback(() => {
    setTermsAccepted(current => !current);
    setTermsError(false);
  }, []);

  const openTerms = useCallback(() => {
    Linking.openURL(TERMS_URL).catch(() => {});
  }, []);

  const confirm = useCallback(() => {
    if (!purchasable) {
      return;
    }
    if (!termsAccepted) {
      setTermsError(true);
      scrollRef.current?.scrollTo({ y: summaryY.current, animated: true });
      return;
    }
    // The cutoff may have passed while the screen was open.
    if (nextSaturdayKitId(bundles) !== nextId) {
      setWeekPicks([]);
      Alert.alert(
        'Ordering closed',
        "This week's kit is no longer available. Please pick the kit for the next Saturday.",
      );
      return;
    }
    // The cart ends up holding exactly the kits picked here.
    const kitPlan: KitPlan = autoRenew ? 'monthly' : 'one-time';
    for (const item of cartWeeks) {
      if (!selectedWeeks.some(week => week.item.id === item.id)) {
        setCartQty(item, 0);
      }
    }
    for (const week of selectedWeeks) {
      setCartQty({ ...week.item, kitPlan }, 1);
    }
    if (basic) {
      setCartQty({ ...basic.item, kitPlan }, 1);
    }
    navigation.navigate('MainTabs', { screen: 'Cart' });
  }, [
    autoRenew,
    basic,
    bundles,
    navigation,
    nextId,
    cartWeeks,
    purchasable,
    selectedWeeks,
    termsAccepted,
  ]);

  const renderBody = () => {
    if (bundlesQuery.isPending) {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator color={GREEN} size="large" />
        </View>
      );
    }
    if (bundlesQuery.isError && !bundlesQuery.data) {
      return (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons color="#C6CDD3" name="wifi-off" size={40} />
          <Text style={styles.stateText}>
            Could not load the weekly kits. Check your connection and try again.
          </Text>
          <ActionButton
            label="Retry"
            onPress={() => bundlesQuery.refetch()}
            style={styles.retryButton}
            variant="dark"
          />
        </View>
      );
    }
    if (bundles.length === 0) {
      return (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons color="#C6CDD3" name="basket-outline" size={40} />
          <Text style={styles.stateText}>
            No weekly kits right now. Check back soon.
          </Text>
        </View>
      );
    }
    return (
      <>
        <Text style={styles.heading}>Select Vegetable Subscription Kit</Text>

        {basic ? (
          <>
            <Text style={styles.groupLabel}>Basic kit · same every week</Text>
            <KitCard bundle={basic} />
          </>
        ) : null}

        {weeks.length > 0 ? (
          <>
            <Text style={styles.groupLabel}>Weekly kits</Text>
            <View style={styles.cutoffNote}>
              <MaterialCommunityIcons
                color={KIT_GREEN}
                name="clock-outline"
                size={16}
              />
              <Text style={styles.cutoffText}>
                Order by {formatDayTime(orderCutoff)} for delivery on{' '}
                {formatDay(deliveryDate)}. Other weeks open after their
                previous Saturday's cutoff.
              </Text>
            </View>
            {weeks.map(week => (
              <KitCard
                bundle={week}
                isNext={week.item.id === nextId}
                key={week.item.id}
                locked={week.item.id !== nextId}
                onToggle={toggleWeek}
                selected={weekIds.includes(week.item.id)}
              />
            ))}
          </>
        ) : null}

        {selectedKits.length > 0 ? (
          <View
            onLayout={event => {
              summaryY.current = event.nativeEvent.layout.y;
            }}
            style={styles.summary}
          >
            <Text style={styles.summaryTitle}>Your Kit</Text>
            <Text style={styles.summarySubtitle}>Selected for delivery</Text>

            <Text style={styles.summaryLabel}>
              {selectedKits.length > 1 ? 'Selected Kits:' : 'Selected Kit:'}
            </Text>
            {selectedKits.map(kit => (
              <Text key={kit.item.id} style={styles.summaryKit}>
                {kit.label}
              </Text>
            ))}

            <Text style={styles.summaryLabel}>Purchase Type:</Text>
            <Text style={styles.summaryPlan}>
              {autoRenew
                ? 'Monthly Subscription (4 Deliveries)'
                : 'One-Time Order (1 Week Only)'}
            </Text>

            <View style={styles.summaryDivider} />
            {totalKg !== null ? (
              <SummaryRow label="Weekly Box Weight" value={formatKg(totalKg)} />
            ) : null}
            <SummaryRow label="Delivery Schedule" value="Every Saturday" />
            <SummaryRow
              label={autoRenew ? 'First Delivery' : 'Delivery'}
              value={formatDay(deliveryDate)}
            />
            {hasPrice ? (
              <SummaryRow
                label="Price"
                value={`AED ${totalPrice.toFixed(2)} / week`}
              />
            ) : null}
            <View style={styles.summaryDivider} />

            <View style={styles.renewBox}>
              <Checkbox
                checked={autoRenew}
                onToggle={() => setAutoRenew(current => !current)}
              >
                <Text style={styles.renewTitle}>
                  Auto-renew monthly subscription
                </Text>
                <Text style={styles.renewHint}>
                  Check this to enable a 1-month recurring subscription (4
                  deliveries, auto-renews every 30 days). Unchecked = 1 week
                  only.
                </Text>
              </Checkbox>
            </View>

            <Checkbox
              checked={termsAccepted}
              error={termsError}
              onToggle={toggleTerms}
            >
              <Text style={[styles.termsText, termsError ? styles.termsError : null]}>
                I accept the{' '}
                <Text onPress={openTerms} style={styles.termsLink}>
                  Terms &amp; Conditions
                </Text>{' '}
                (including flight delay replacement policy).
              </Text>
            </Checkbox>
          </View>
        ) : null}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title="Weekly Kits"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        ref={scrollRef}
        refreshControl={
          <RefreshControl
            colors={[GREEN]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={GREEN}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderBody()}
      </ScrollView>

      {bundles.length > 0 ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 12) + 12 },
          ]}
        >
          <View style={styles.footerPriceBlock}>
            <Text numberOfLines={1} style={styles.footerLabel}>
              {selectedKits.length > 0
                ? selectedKits.map(kit => kit.label).join(' + ')
                : 'No kit selected'}
            </Text>
            {hasPrice ? (
              <Text numberOfLines={1} style={styles.footerPrice}>
                AED {totalPrice.toFixed(2)}
                <Text style={styles.footerPer}> / week</Text>
              </Text>
            ) : null}
          </View>
          <ActionButton
            disabled={!purchasable}
            label={purchasable ? 'Confirm & Checkout' : 'Select a weekly kit'}
            onPress={confirm}
            style={styles.footerButton}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: KIT_PAGE_BG,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  heading: {
    color: KIT_GREEN,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 14,
    marginTop: 18,
  },
  groupLabel: {
    color: TEXT_VARIANT,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  kitCard: {
    backgroundColor: CARD,
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1.5,
    elevation: 2,
    gap: 10,
    marginBottom: 14,
    padding: 14,
    shadowColor: '#0F1B26',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  kitHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  kitImage: {
    borderRadius: 10,
    height: 76,
    width: 76,
  },
  kitCardSelected: {
    backgroundColor: KIT_SELECTED_BG,
    borderColor: KIT_GREEN,
  },
  kitCardLocked: {
    opacity: 0.55,
  },
  cutoffNote: {
    alignItems: 'flex-start',
    backgroundColor: KIT_SELECTED_BG,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    padding: 10,
  },
  cutoffText: {
    color: KIT_GREEN,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  kitBody: {
    alignItems: 'flex-start',
    flex: 1,
    gap: 4,
  },
  kitTitle: {
    color: KIT_GREEN,
    fontSize: 16,
    fontWeight: '800',
  },
  nextBadge: {
    backgroundColor: KIT_GREEN,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nextBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  kitLineLabel: {
    color: TEXT_VARIANT,
    fontSize: 13,
    fontWeight: '800',
  },
  componentList: {
    gap: 10,
  },
  componentTile: {
    width: 64,
  },
  componentImage: {
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 10,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  componentImageFill: {
    height: '100%',
    width: '100%',
  },
  componentName: {
    color: TEXT,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    marginTop: 4,
  },
  componentQty: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '600',
  },
  kitWeight: {
    color: KIT_GREEN,
    fontSize: 14,
    fontWeight: '800',
  },
  selectButton: {
    alignItems: 'center',
    backgroundColor: KIT_BUTTON,
    borderColor: KIT_BUTTON,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    minWidth: 84,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectButtonOn: {
    backgroundColor: CARD,
  },
  selectButtonLocked: {
    backgroundColor: SURFACE,
    borderColor: BORDER,
  },
  selectButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
  selectButtonTextOn: {
    color: KIT_BUTTON,
  },
  selectButtonTextLocked: {
    color: MUTED,
  },
  summary: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    marginTop: 8,
    padding: 16,
  },
  summaryTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '800',
  },
  summarySubtitle: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  summaryLabel: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
  },
  summaryKit: {
    color: GREEN,
    fontSize: 15,
    fontWeight: '800',
  },
  summaryIncludes: {
    color: TEXT_VARIANT,
    fontSize: 13,
    fontWeight: '600',
  },
  summaryPlan: {
    color: LINK_BLUE,
    fontSize: 15,
    fontWeight: '800',
  },
  summaryDivider: {
    backgroundColor: BORDER,
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryRowLabel: {
    color: TEXT_VARIANT,
    fontSize: 14,
  },
  summaryRowValue: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '600',
  },
  renewBox: {
    backgroundColor: SURFACE,
    borderColor: BORDER,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  checkboxRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  checkboxBody: {
    flex: 1,
  },
  renewTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
  },
  renewHint: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  termsText: {
    color: TEXT,
    fontSize: 13,
    lineHeight: 19,
  },
  termsError: {
    color: ERROR,
  },
  termsLink: {
    color: LINK_BLUE,
    textDecorationLine: 'underline',
  },
  centeredState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stateText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    width: 140,
  },
  footer: {
    alignItems: 'center',
    backgroundColor: CARD,
    borderTopColor: BORDER,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  footerPriceBlock: {
    flexShrink: 1,
  },
  footerLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  footerPrice: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  footerPer: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  footerButton: {
    backgroundColor: KIT_BUTTON,
    borderColor: KIT_BUTTON,
    width: 180,
  },
});
