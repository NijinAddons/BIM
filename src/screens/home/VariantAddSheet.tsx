import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { bim } from '../../assets/images';
import { addToCart, useCartQty } from '../../hooks/useCart';
import type { CategoryItem } from '../../services';
import { CARD, HAIRLINE, NAVY } from '../../theme/colors';
import { Swatch } from './VariantPicker';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';
const BORDER = '#E6E9ED';

// Colour and Size lead; any other attribute that varies follows.
const ATTRIBUTE_ORDER = ['colour', 'color', 'size'];

const rank = (name: string) => {
  const index = ATTRIBUTE_ORDER.indexOf(name.toLowerCase());
  return index === -1 ? ATTRIBUTE_ORDER.length : index;
};

const formatPrice = (value: number) =>
  Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '');

const selectionsOf = (member: CategoryItem) =>
  Object.fromEntries(
    (member.variantAttributes ?? []).map(attr => [attr.name, attr.value]),
  );

const matches = (member: CategoryItem, wanted: Record<string, string>) =>
  Object.entries(wanted).every(([name, value]) =>
    (member.variantAttributes ?? []).some(
      attr => attr.name === name && attr.value === value,
    ),
  );

/** Every attribute that differs across the family, with its values. */
function variantOptions(family: CategoryItem[]) {
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
  return [...values.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([name, list]) => ({
      name,
      options: [...list].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    }))
    .sort((a, b) => rank(a.name) - rank(b.name));
}

type Props = {
  /** The card that was tapped; null hides the sheet. */
  item: CategoryItem | null;
  /** All variants of the same product, including `item`. */
  family: CategoryItem[];
  onClose: () => void;
};

/**
 * ADD TO CART for a product with variants: pick its colour / size in a
 * bottom sheet, then add the matching variant.
 */
export default function VariantAddSheet({ item, family, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<CategoryItem | null>(item);
  // Keep the last content while the sheet slides away.
  const [shown, setShown] = useState(item);

  useEffect(() => {
    if (item) {
      setSelected(item);
      setShown(item);
    }
  }, [item]);

  const options = useMemo(() => variantOptions(family), [family]);
  const variant = selected ?? shown;
  const picks = variant ? selectionsOf(variant) : {};
  const inCart = useCartQty(variant?.id ?? '');

  const pick = (name: string, value: string) => {
    const wanted = { ...picks, [name]: value };
    // Keep the other picks if that combination exists, else take the first
    // variant with this value.
    const target =
      family.find(member => matches(member, wanted)) ??
      family.find(member => matches(member, { [name]: value }));
    if (target) {
      setSelected(target);
    }
  };

  const soldOut = !!variant && !variant.rfqOnly && variant.stock <= 0;
  const atMax = !!variant && !variant.rfqOnly && inCart >= variant.stock;

  const add = () => {
    if (variant && !soldOut && !atMax) {
      addToCart(variant);
      onClose();
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={item !== null}
    >
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        {variant ? (
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}
          >
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.thumb}>
                <FastImage
                  resizeMode={FastImage.resizeMode.contain}
                  source={variant.image ? { uri: variant.image } : bim}
                  style={styles.thumbImage}
                />
              </View>
              <View style={styles.headerText}>
                <Text numberOfLines={2} style={styles.name}>
                  {variant.name}
                </Text>
                <Text style={styles.price}>
                  AED {formatPrice(variant.price)}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Close"
                hitSlop={8}
                onPress={onClose}
              >
                <MaterialCommunityIcons color={MUTED} name="close" size={22} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map(option => (
                <View key={option.name} style={styles.group}>
                  <Text style={styles.groupLabel}>
                    {option.name}
                    {picks[option.name] ? (
                      <Text style={styles.groupValue}>
                        {'  '}
                        {picks[option.name]}
                      </Text>
                    ) : null}
                  </Text>
                  <View style={styles.chips}>
                    {option.options.map(value => {
                      const active = picks[option.name] === value;
                      // Whether this value exists alongside the other picks.
                      const available = family.some(member =>
                        matches(member, { ...picks, [option.name]: value }),
                      );
                      return (
                        <TouchableOpacity
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          activeOpacity={0.75}
                          key={value}
                          onPress={() => pick(option.name, value)}
                          style={[
                            styles.chip,
                            active ? styles.chipActive : null,
                            !available && !active ? styles.chipMuted : null,
                          ]}
                        >
                          <Swatch attribute={option.name} value={value} />
                          <Text
                            style={[
                              styles.chipText,
                              active ? styles.chipTextActive : null,
                            ]}
                          >
                            {value}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={soldOut || atMax}
              onPress={add}
              style={[
                styles.addButton,
                soldOut || atMax ? styles.addButtonDisabled : null,
              ]}
            >
              <Text style={styles.addButtonText}>
                {soldOut
                  ? 'SOLD OUT'
                  : atMax
                  ? 'MAX QUANTITY IN CART'
                  : inCart > 0
                  ? `ADD ANOTHER (${inCart} IN CART)`
                  : 'ADD TO CART'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(8, 24, 40, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 16,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 14,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: HAIRLINE,
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 40,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  thumb: {
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    height: 64,
    overflow: 'hidden',
    width: 64,
  },
  thumbImage: {
    height: '100%',
    width: '100%',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: BRAND_NAVY,
    fontSize: 15,
    fontWeight: '700',
  },
  price: {
    color: BRAND_NAVY,
    fontSize: 16,
    fontWeight: '900',
  },
  group: {
    marginTop: 16,
  },
  groupLabel: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  groupValue: {
    color: BRAND_NAVY,
    fontWeight: '800',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    borderColor: BORDER,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
    minWidth: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: 'rgba(46,207,192,0.10)',
    borderColor: ACCENT_TEAL,
  },
  chipMuted: {
    opacity: 0.4,
  },
  chipText: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    fontWeight: '800',
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    borderRadius: 14,
    marginTop: 20,
    paddingVertical: 15,
  },
  addButtonDisabled: {
    opacity: 0.45,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
