import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { bim } from '../../assets/images';
import { ActionButton, ProductCard, ScreenHeader } from '../../components';
import { addToCart, setCartQty, useCartQty } from '../../hooks/useCart';
import { useDeliveryEstimate } from '../../hooks/useDeliveryEstimate';
import { toggleWishlist, useIsWishlisted } from '../../hooks/useWishlist';
import type { RootStackScreenProps } from '../../navigation/types';
import { useItemsByBrand, useItemsByGroup } from '../../queries';
import { CategoryItem, isOutOfStockForSupplier } from '../../services';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';
const BORDER = '#E6E9ED';

const IMAGE_MARGIN = 16;
const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_WIDTH = SCREEN_WIDTH - IMAGE_MARGIN * 2;
const RELATED_CARD_WIDTH = (SCREEN_WIDTH - 46) / 2;
const MAX_RELATED = 12;
const EMPTY_ITEMS: CategoryItem[] = [];

type Props = RootStackScreenProps<'ProductDetail'>;

const imageKeyExtractor = (uri: string, index: number) => `${index}-${uri}`;
const relatedKeyExtractor = (related: CategoryItem) => related.id;

function attributesMatch(
  candidate: CategoryItem,
  selections: Record<string, string>,
): boolean {
  return Object.entries(selections).every(([name, value]) =>
    (candidate.variantAttributes ?? []).some(
      attr => attr.name === name && attr.value === value,
    ),
  );
}

type DropdownProps = {
  label: string;
  icon: string;
  placeholder: string;
  value: string | null;
  open: boolean;
  options: string[];
  loading?: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
};

function Dropdown({
  label,
  icon,
  placeholder,
  value,
  open,
  options,
  loading = false,
  onToggle,
  onSelect,
}: DropdownProps) {
  const disabled = loading || options.length === 0;
  const displayText = value ?? (loading ? 'Loading…' : placeholder);

  return (
    <View style={styles.dropdownBlock}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={onToggle}
        style={[
          styles.dropdownField,
          open ? styles.dropdownFieldOpen : null,
          disabled ? styles.dropdownFieldDisabled : null,
        ]}
      >
        <MaterialCommunityIcons color={MUTED} name={icon} size={18} />
        <Text
          style={[
            styles.dropdownValue,
            !value ? styles.dropdownPlaceholder : null,
          ]}
        >
          {displayText}
        </Text>
        {loading ? (
          <ActivityIndicator color={MUTED} size="small" />
        ) : (
          <MaterialCommunityIcons
            color={MUTED}
            name={open ? 'chevron-up' : 'chevron-down'}
            size={22}
          />
        )}
      </TouchableOpacity>

      {open && !disabled ? (
        <View style={styles.dropdownMenu}>
          {options.map((name, index) => {
            const selected = name === value;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                key={name}
                onPress={() => onSelect(name)}
                style={[
                  styles.dropdownOption,
                  index === options.length - 1
                    ? styles.dropdownOptionLast
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    selected ? styles.dropdownOptionSelected : null,
                  ]}
                >
                  {name}
                </Text>
                {selected ? (
                  <MaterialCommunityIcons
                    color={ACCENT_TEAL}
                    name="check-circle"
                    size={18}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

type PillGroupProps = {
  label: string;
  options: string[];
  value: string | null;
  onSelect: (value: string) => void;
};

const COLOR_SWATCHES: Record<string, string> = {
  black: '#1A1A1A',
  white: '#FFFFFF',
  ivory: '#F6F2E8',
  cream: '#F3EAD3',
  beige: '#E4D5B7',
  grey: '#8A8F98',
  gray: '#8A8F98',
  silver: '#C4C8CE',
  charcoal: '#36393F',
  red: '#D0342C',
  maroon: '#7B241C',
  pink: '#E48AA8',
  orange: '#E67E22',
  yellow: '#F2C94C',
  gold: '#C9A227',
  green: '#2E8B57',
  olive: '#7A7B2E',
  teal: '#2ECFC0',
  blue: '#2F6FED',
  navy: '#1F2E4D',
  purple: '#7A4FBF',
  brown: '#7A4B2B',
  tan: '#C8A878',
  khaki: '#B7A57A',
};

function colorFor(name: string): string | null {
  const key = name.trim().toLowerCase();
  if (COLOR_SWATCHES[key]) {
    return COLOR_SWATCHES[key];
  }
  for (const part of key.split(/[\s/_-]+/)) {
    if (COLOR_SWATCHES[part]) {
      return COLOR_SWATCHES[part];
    }
  }
  return null;
}

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 186;
}

const isColorAttribute = (label: string) => /colou?r/i.test(label);

function PillGroup({ label, options, value, onSelect }: PillGroupProps) {
  const colorMode = isColorAttribute(label);

  return (
    <View style={styles.optionBlock}>
      <View style={styles.optionHeader}>
        <Text style={styles.dropdownLabel}>{label}</Text>
        {value ? <Text style={styles.optionSelectedValue}>{value}</Text> : null}
      </View>

      <View style={styles.optionWrap}>
        {options.map(option => {
          const selected = option === value;
          const swatch = colorMode ? colorFor(option) : null;

          return (
            <TouchableOpacity
              accessibilityLabel={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              activeOpacity={0.8}
              key={option}
              onPress={() => onSelect(option)}
              style={[
                styles.pill,
                swatch ? styles.colorPill : null,
                selected ? styles.pillSelected : null,
              ]}
            >
              {swatch ? (
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: swatch },
                    isLightColor(swatch) ? styles.colorDotBorder : null,
                  ]}
                />
              ) : null}
              <Text
                numberOfLines={1}
                style={[
                  styles.pillText,
                  selected ? styles.pillTextSelected : null,
                ]}
              >
                {option}
              </Text>
              {selected ? (
                <MaterialCommunityIcons
                  color="#ffffff"
                  name="check"
                  size={14}
                />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const ProductDetailScreen = ({ navigation, route }: Props) => {
  const { item } = route.params;
  const insets = useSafeAreaInsets();
  const wishlisted = useIsWishlisted(item.id);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  const images =
    item.images.length > 0 ? item.images : item.image ? [item.image] : [];
  const hasMultiple = images.length > 1;
  const cartQty = useCartQty(item.id);

  // Suppliers this item is assigned to (from the backend `supplier_options`).
  const assignedSuppliers = useMemo(
    () => item.supplierOptions ?? [],
    [item.supplierOptions],
  );
  const supplierOptions =
    assignedSuppliers.length > 0
      ? assignedSuppliers.map(option => option.displayName)
      : item.supplier
      ? [item.supplier]
      : [];
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(
    item.supplier ?? supplierOptions[0] ?? null,
  );
  const supplierIsChoice = supplierOptions.length > 1;

  // Out-of-stock status follows the selected supplier, since one supplier
  // assigned to this item can be out while another still has it.
  const inStock = !isOutOfStockForSupplier(item, selectedSupplier);
  const lowStock = inStock && item.stock > 0 && item.stock <= 5;

  // True when the picked attribute combo doesn't map to a real variant.
  const [comboUnavailable, setComboUnavailable] = useState(false);

  // Delivery ETA from the customer's location to the chosen supplier's location.
  const selectedSupplierLocation = useMemo(() => {
    const match = assignedSuppliers.find(
      option => option.displayName === selectedSupplier,
    );
    if (
      match &&
      ((match.latitude != null && match.longitude != null) || match.address)
    ) {
      return {
        latitude: match.latitude,
        longitude: match.longitude,
        address: match.address,
      };
    }
    return {
      latitude: item.supplierLatitude,
      longitude: item.supplierLongitude,
      address: item.supplierAddress,
    };
  }, [
    assignedSuppliers,
    selectedSupplier,
    item.supplierLatitude,
    item.supplierLongitude,
    item.supplierAddress,
  ]);

  const deliveryEstimate = useDeliveryEstimate(selectedSupplierLocation);
  const deliveryText = deliveryEstimate
    ? `Delivery in ${deliveryEstimate}`
    : null;

  // One pill group per ERPNext variant attribute (Colour, Design, Size, …).
  const variantAttributes = item.variantAttributes ?? [];
  const [attributeSelections, setAttributeSelections] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(variantAttributes.map(attr => [attr.name, attr.value])),
  );

  // Hold off the related/variant fetches until the push animation finishes:
  // results landing mid-transition re-render the whole page and flicker.
  // Already-cached results (e.g. from Home's rails) still show immediately.
  const [transitionDone, setTransitionDone] = useState(false);

  useEffect(() => {
    const fallback = setTimeout(() => setTransitionDone(true), 600);
    const unsubscribe = navigation.addListener('transitionEnd', event => {
      if (!event.data.closing) {
        setTransitionDone(true);
      }
    });
    return () => {
      clearTimeout(fallback);
      unsubscribe();
    };
  }, [navigation]);

  const groupItems =
    useItemsByGroup(item.itemGroup, { enabled: transitionDone }).data ??
    EMPTY_ITEMS;
  // Same-brand items top up "You might also like" when the category alone
  // has little or nothing else in it.
  const brandItems =
    useItemsByBrand(item.brand, { enabled: transitionDone }).data ??
    EMPTY_ITEMS;

  // Category first, then brand. One card per product: other variants of
  // the item being viewed are already offered by the option pickers above,
  // and a product with several variants shouldn't fill the whole rail.
  const related = useMemo(() => {
    const productKey = (member: CategoryItem) => member.variantOf ?? member.id;
    const seen = new Set<string>([productKey(item)]);
    const list: CategoryItem[] = [];
    for (const other of [...groupItems, ...brandItems]) {
      const key = productKey(other);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      list.push(other);
      if (list.length >= MAX_RELATED) {
        break;
      }
    }
    return list;
  }, [groupItems, brandItems, item]);

  // Distinct values for each attribute across every variant of the same template.
  const attributeOptions = useMemo(() => {
    const family = [item, ...groupItems].filter(
      member =>
        member.id === item.id ||
        (item.variantOf != null && member.variantOf === item.variantOf),
    );

    const values = new Map<string, string[]>();
    for (const member of family) {
      for (const attr of member.variantAttributes ?? []) {
        const list = values.get(attr.name) ?? [];
        if (!list.includes(attr.value)) {
          list.push(attr.value);
        }
        values.set(attr.name, list);
      }
    }
    for (const [name, list] of values) {
      list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      values.set(name, list);
    }
    return values;
  }, [groupItems, item]);

  // Sibling variants of the same template (includes the current item).
  const variantFamily = useMemo(
    () =>
      item.variantOf == null
        ? [item]
        : groupItems.filter(member => member.variantOf === item.variantOf),
    [groupItems, item],
  );

  // Changing an attribute swaps the whole screen to the matching variant.
  const handleAttributeSelect = useCallback(
    (attributeName: string, value: string) => {
      const desired = { ...attributeSelections, [attributeName]: value };

      const target =
        variantFamily.find(member => attributesMatch(member, desired)) ??
        variantFamily.find(member =>
          (member.variantAttributes ?? []).some(
            attr => attr.name === attributeName && attr.value === value,
          ),
        );

      if (!target) {
        setAttributeSelections(desired);
        setComboUnavailable(true);
        return;
      }

      setComboUnavailable(false);
      setAttributeSelections(
        Object.fromEntries(
          (target.variantAttributes ?? []).map(attr => [attr.name, attr.value]),
        ),
      );
      if (target.id !== item.id) {
        navigation.setParams({ item: target });
      }
    },
    [attributeSelections, item.id, navigation, variantFamily],
  );

  // Reset the gallery when the variant changes.
  useEffect(() => {
    setActiveIndex(0);
    setFailed({});
    setComboUnavailable(false);
  }, [item.id]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setActiveIndex(
        Math.round(event.nativeEvent.contentOffset.x / IMAGE_WIDTH),
      );
    },
    [],
  );

  const renderImage = useCallback(
    ({ item: uri, index }: ListRenderItemInfo<string>) => (
      <View style={styles.slide}>
        {failed[index] ? (
          <Image
            resizeMode="contain"
            source={bim}
            style={styles.fallbackLogo}
          />
        ) : (
          <FastImage
            onError={() => setFailed(prev => ({ ...prev, [index]: true }))}
            resizeMode={FastImage.resizeMode.contain}
            source={{ uri }}
            style={styles.image}
          />
        )}
      </View>
    ),
    [failed],
  );

  const renderRelated = useCallback(
    ({ item: relatedItem }: ListRenderItemInfo<CategoryItem>) => (
      <View style={styles.relatedCard}>
        <ProductCard
          item={relatedItem}
          onPress={() =>
            navigation.push('ProductDetail', { item: relatedItem })
          }
        />
      </View>
    ),
    [navigation],
  );

  // RFQ-only items (Item Group `custom_rfq_only`) are priced by the supplier
  // on request, so stock doesn't gate them — they go to the cart and are
  // submitted from there as a Request for Quotation.
  const isRfq = item.rfqOnly;

  const stockLabel = isRfq
    ? 'Quote on request'
    : !inStock
    ? 'Out of stock'
    : lowStock
    ? `Only ${item.stock} left`
    : `${item.stock} in stock`;

  const canAddToCart = (isRfq || inStock) && !comboUnavailable;
  const atMaxQty = !isRfq && cartQty >= item.stock;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />
      <ScreenHeader
        onBack={() => navigation.goBack()}
        rightAccessory={
          <TouchableOpacity
            accessibilityLabel={
              wishlisted ? 'Remove from wishlist' : 'Add to wishlist'
            }
            hitSlop={8}
            onPress={() => toggleWishlist(item)}
            style={styles.wishButton}
          >
            <MaterialCommunityIcons
              color={wishlisted ? '#E0574F' : '#ffffff'}
              name={wishlisted ? 'heart' : 'heart-outline'}
              size={20}
            />
          </TouchableOpacity>
        }
        title={
          item.name.length > 22 ? `${item.name.slice(0, 22)}...` : item.name
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Gallery */}
        <View style={styles.gallery}>
          {images.length === 0 ? (
            <View style={styles.slide}>
              <Image
                resizeMode="contain"
                source={bim}
                style={styles.fallbackLogo}
              />
            </View>
          ) : (
            <>
              <FlatList
                key={item.id}
                data={images}
                decelerationRate="fast"
                horizontal
                keyExtractor={imageKeyExtractor}
                onMomentumScrollEnd={handleScroll}
                pagingEnabled
                renderItem={renderImage}
                scrollEnabled={hasMultiple}
                showsHorizontalScrollIndicator={false}
                snapToInterval={IMAGE_WIDTH}
              />
              {hasMultiple ? (
                <>
                  <View style={styles.counter}>
                    <Text style={styles.counterText}>
                      {activeIndex + 1}/{images.length}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    {images.map((uri, index) => (
                      <View
                        key={imageKeyExtractor(uri, index)}
                        style={[
                          styles.dot,
                          index === activeIndex ? styles.dotActive : null,
                        ]}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )}
        </View>

        {/* Title + price */}
        <View style={[styles.section, styles.priceSection]}>
          <Text style={styles.name}>{item.name}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>AED {item.price.toFixed(2)}</Text>
            <View
              style={[
                styles.stockPill,
                isRfq
                  ? styles.stockPillIn
                  : !inStock
                  ? styles.stockPillOut
                  : lowStock
                  ? styles.stockPillLow
                  : styles.stockPillIn,
              ]}
            >
              <Text
                style={[
                  styles.stockPillText,
                  isRfq
                    ? styles.stockTextIn
                    : !inStock
                    ? styles.stockTextOut
                    : lowStock
                    ? styles.stockTextLow
                    : styles.stockTextIn,
                ]}
              >
                {stockLabel}
              </Text>
            </View>
          </View>

          {item.itemGroup || item.brand ? (
            <View style={styles.chipRow}>
              {item.itemGroup ? (
                <View style={styles.chip}>
                  <MaterialCommunityIcons
                    color={MUTED}
                    name="shape-outline"
                    size={13}
                  />
                  <Text style={styles.chipText}>{item.itemGroup}</Text>
                </View>
              ) : null}
              {item.brand ? (
                <View style={styles.chip}>
                  <MaterialCommunityIcons
                    color={MUTED}
                    name="tag-outline"
                    size={13}
                  />
                  <Text style={styles.chipText}>{item.brand}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        {/* Delivery & seller */}
        <View style={[styles.section, styles.deliverySection]}>
          <View style={styles.infoPanel}>
            {deliveryText ? (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons
                  color={ACCENT_TEAL}
                  name="clock-fast"
                  size={18}
                />
                <Text style={styles.infoText}>{deliveryText}</Text>
              </View>
            ) : null}
            {selectedSupplier ? (
              <>
                {deliveryText ? <View style={styles.infoLine} /> : null}
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons
                    color={MUTED}
                    name="storefront-outline"
                    size={18}
                  />
                  <Text style={styles.infoText} numberOfLines={1}>
                    Sold by {selectedSupplier}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Options */}
        {supplierIsChoice || variantAttributes.length > 0 ? (
          <View style={styles.section}>
            {supplierIsChoice ? (
              <Dropdown
                icon="storefront-outline"
                label="Sold by"
                onSelect={name => {
                  setSelectedSupplier(name);
                  setSupplierOpen(false);
                }}
                onToggle={() => setSupplierOpen(open => !open)}
                open={supplierOpen}
                options={supplierOptions}
                placeholder="Choose a store"
                value={selectedSupplier}
              />
            ) : null}

            {variantAttributes.map(attr => (
              <PillGroup
                key={attr.name}
                label={attr.name}
                onSelect={value => handleAttributeSelect(attr.name, value)}
                options={attributeOptions.get(attr.name) ?? [attr.value]}
                value={attributeSelections[attr.name] ?? null}
              />
            ))}

            {comboUnavailable ? (
              <View style={styles.comboNote}>
                <MaterialCommunityIcons
                  color="#B26A00"
                  name="information-outline"
                  size={16}
                />
                <Text style={styles.comboNoteText}>
                  That combination isn't available. Try a different option.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Related */}
        {related.length > 0 ? (
          <>
            <View style={styles.divider} />
            <View style={styles.relatedSection}>
              <Text style={[styles.sectionTitle, styles.relatedHeading]}>
                You might also like
              </Text>
              <FlatList
                contentContainerStyle={styles.relatedList}
                data={related}
                horizontal
                keyExtractor={relatedKeyExtractor}
                renderItem={renderRelated}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) + 12 },
        ]}
      >
        {(isRfq || inStock) && cartQty > 0 ? (
          <>
            <View style={styles.footerPriceBlock}>
              <Text style={styles.footerLabel}>In cart · {cartQty}</Text>
              <Text numberOfLines={1} style={styles.footerPrice}>
                AED {(item.price * cartQty).toFixed(2)}
              </Text>
            </View>
            {/* Once added, the Add to Cart button itself turns into the
                quantity control — same size and spot, no extra section. */}
            <View style={[styles.footerButton, styles.stepper]}>
              <TouchableOpacity
                accessibilityLabel={
                  cartQty <= 1 ? 'Remove from cart' : 'Decrease quantity'
                }
                hitSlop={8}
                onPress={() => setCartQty(item, cartQty - 1)}
                style={styles.stepperButton}
              >
                <MaterialCommunityIcons
                  color="#ffffff"
                  name={cartQty <= 1 ? 'trash-can-outline' : 'minus'}
                  size={20}
                />
              </TouchableOpacity>
              <Text style={styles.stepperCount}>{cartQty}</Text>
              <TouchableOpacity
                accessibilityLabel="Increase quantity"
                disabled={atMaxQty}
                hitSlop={8}
                onPress={() => addToCart(item, 1)}
                style={[
                  styles.stepperButton,
                  atMaxQty ? styles.stepperButtonDisabled : null,
                ]}
              >
                <MaterialCommunityIcons color="#ffffff" name="plus" size={20} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View>
              <Text style={styles.footerLabel}>Total</Text>
              <Text style={styles.footerPrice}>
                AED {item.price.toFixed(2)}
              </Text>
            </View>
            <ActionButton
              disabled={!canAddToCart}
              label={
                comboUnavailable
                  ? 'Unavailable'
                  : isRfq
                  ? 'Request Quote'
                  : !inStock
                  ? 'Out of Stock'
                  : 'Add to Cart'
              }
              onPress={() => addToCart(item, 1)}
              style={styles.footerButton}
              variant="dark"
            />
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },

  wishButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },

  /* Gallery */
  gallery: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: IMAGE_MARGIN,
    marginTop: 14,
    overflow: 'hidden',
  },
  slide: {
    alignItems: 'center',
    aspectRatio: 1,
    justifyContent: 'center',
    width: IMAGE_WIDTH,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  fallbackLogo: {
    height: '45%',
    opacity: 0.9,
    width: '45%',
  },
  counter: {
    backgroundColor: 'rgba(31,46,61,0.72)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    position: 'absolute',
    right: 10,
    top: 10,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  dots: {
    alignItems: 'center',
    bottom: 10,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  dot: {
    backgroundColor: 'rgba(31,46,61,0.25)',
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  dotActive: {
    backgroundColor: BRAND_NAVY,
    width: 16,
  },

  /* Sections */
  section: {
    paddingHorizontal: IMAGE_MARGIN,
    paddingVertical: 16,
  },
  priceSection: {
    paddingBottom: 8,
  },
  deliverySection: {
    paddingBottom: 4,
    paddingTop: 0,
  },
  divider: {
    backgroundColor: BORDER,
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  sectionTitle: {
    color: BRAND_NAVY,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 14,
  },

  /* Title + price */
  name: {
    color: BRAND_NAVY,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
  },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  price: {
    color: BRAND_NAVY,
    fontSize: 24,
    fontWeight: '900',
  },
  stockPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stockPillIn: {
    backgroundColor: 'rgba(30,142,126,0.12)',
  },
  stockPillLow: {
    backgroundColor: 'rgba(178,106,0,0.14)',
  },
  stockPillOut: {
    backgroundColor: 'rgba(192,57,43,0.12)',
  },
  stockPillText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: '#F1F3F6',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    color: BRAND_NAVY,
    fontSize: 12,
    fontWeight: '600',
  },

  /* Delivery & availability */
  infoPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  infoLine: {
    backgroundColor: BORDER,
    height: StyleSheet.hairlineWidth,
  },
  infoText: {
    color: BRAND_NAVY,
    fontSize: 13.5,
    fontWeight: '700',
  },
  stockTextIn: {
    color: '#1E8E7E',
  },
  stockTextLow: {
    color: '#B26A00',
  },
  stockTextOut: {
    color: '#C0392B',
  },

  /* Dropdowns */
  dropdownBlock: {
    marginBottom: 14,
  },
  dropdownLabel: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  optionBlock: {
    marginBottom: 20,
  },
  optionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  optionSelectedValue: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  comboNote: {
    alignItems: 'center',
    backgroundColor: 'rgba(178,106,0,0.10)',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  comboNoteText: {
    color: '#8A5300',
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    alignItems: 'center',
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  colorPill: {
    paddingLeft: 10,
  },
  colorDot: {
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  colorDotBorder: {
    borderColor: BORDER,
    borderWidth: 1,
  },
  pillSelected: {
    backgroundColor: BRAND_NAVY,
    borderColor: BRAND_NAVY,
  },
  pillText: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '700',
  },
  pillTextSelected: {
    color: '#ffffff',
  },
  dropdownField: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: BORDER,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dropdownFieldOpen: {
    borderColor: ACCENT_TEAL,
  },
  dropdownFieldDisabled: {
    backgroundColor: '#F7F8FA',
    opacity: 0.7,
  },
  dropdownValue: {
    color: BRAND_NAVY,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownPlaceholder: {
    color: MUTED,
    fontWeight: '500',
  },
  dropdownMenu: {
    borderColor: BORDER,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownOption: {
    alignItems: 'center',
    borderBottomColor: '#EEF1F4',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionText: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownOptionSelected: {
    color: ACCENT_TEAL,
  },

  /* Related */
  relatedSection: {
    paddingBottom: 8,
    paddingTop: 16,
  },
  relatedHeading: {
    paddingHorizontal: IMAGE_MARGIN,
  },
  relatedList: {
    gap: 12,
    paddingHorizontal: IMAGE_MARGIN,
  },
  relatedCard: {
    width: RELATED_CARD_WIDTH,
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopColor: BORDER,
    borderTopWidth: 1,
    elevation: 12,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingHorizontal: IMAGE_MARGIN,
    paddingTop: 12,
    shadowColor: '#0F1B26',
    shadowOffset: { height: -3, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  footerLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  footerPrice: {
    color: BRAND_NAVY,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  footerButton: {
    width: 160,
  },
  footerPriceBlock: {
    flexShrink: 1,
  },
  // Matches ActionButton's dark variant so it reads as the same button.
  stepper: {
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  stepperButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 44,
  },
  stepperButtonDisabled: {
    opacity: 0.35,
  },
  stepperCount: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'center',
  },
});

export default ProductDetailScreen;
