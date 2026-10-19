import React, { useRef, useState } from 'react';
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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { CARD, HAIRLINE, NAVY } from '../../theme/colors';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';
const BORDER = '#E6E9ED';

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

export function Swatch({ attribute, value }: { attribute: string; value: string }) {
  const swatch = isColorAttribute(attribute) ? colorFor(value) : null;
  if (!swatch) {
    return null;
  }
  return (
    <View
      style={[
        styles.swatch,
        { backgroundColor: swatch },
        isLightColor(swatch) ? styles.swatchBorder : null,
      ]}
    />
  );
}

export type VariantAttributeChoice = {
  name: string;
  options: string[];
  value: string | null;
};

/** A fixed fact about the product, shown as a plain row under the pickers. */
export type VariantDetail = { label: string; value: string };

type Props = {
  attributes: VariantAttributeChoice[];
  /** Plain rows (Country of origin, Fabric, …) in the same card. */
  details?: VariantDetail[];
  /** Whether `value` exists alongside the other current picks. */
  isAvailable: (attribute: string, value: string) => boolean;
  onSelect: (attribute: string, value: string) => void;
};

/**
 * Variant attributes (Pack, Colour, Size, …) as one row each; tapping a row
 * opens a bottom sheet listing that attribute's values. Any `details` follow
 * as plain rows in the same card.
 */
export default function VariantPicker({
  attributes,
  details = [],
  isAvailable,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();
  const [openName, setOpenName] = useState<string | null>(null);
  const open = attributes.find(attr => attr.name === openName) ?? null;
  // Keep the last attribute's content while the sheet slides away.
  const shown = useRef(open);
  if (open) {
    shown.current = open;
  }
  const sheet = shown.current;
  const close = () => setOpenName(null);

  return (
    <>
      <View style={styles.card}>
        {attributes.map((attr, index) => {
          const single = attr.options.length < 2;
          return (
            <TouchableOpacity
              accessibilityHint={single ? undefined : `Choose ${attr.name}`}
              accessibilityLabel={`${attr.name}: ${attr.value ?? 'not set'}`}
              activeOpacity={0.7}
              disabled={single}
              key={attr.name}
              onPress={() => setOpenName(attr.name)}
              style={[styles.row, index > 0 ? styles.rowDivider : null]}
            >
              <Text style={styles.rowLabel}>{attr.name}</Text>
              <View style={styles.rowValueWrap}>
                {attr.value ? (
                  <Swatch attribute={attr.name} value={attr.value} />
                ) : null}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.rowValue,
                    !attr.value ? styles.rowPlaceholder : null,
                  ]}
                >
                  {attr.value ?? 'Select'}
                </Text>
              </View>
              {single ? null : (
                <MaterialCommunityIcons
                  color={MUTED}
                  name="chevron-right"
                  size={22}
                  style={styles.chevron}
                />
              )}
            </TouchableOpacity>
          );
        })}
        {details.map((detail, index) => (
          <View
            key={detail.label}
            style={[
              styles.row,
              attributes.length + index > 0 ? styles.rowDivider : null,
            ]}
          >
            <Text style={styles.rowLabel}>{detail.label}</Text>
            <View style={styles.rowValueWrap}>
              <Text numberOfLines={2} style={styles.rowValue}>
                {detail.value}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Modal
        animationType="slide"
        onRequestClose={close}
        transparent
        visible={open !== null}
      >
        <View style={styles.overlay}>
          <Pressable onPress={close} style={StyleSheet.absoluteFill} />
          {sheet ? (
            <View
              style={[
                styles.sheet,
                { paddingBottom: Math.max(insets.bottom, 16) + 8 },
              ]}
            >
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Select {sheet.name}</Text>
                <TouchableOpacity
                  accessibilityLabel="Close"
                  hitSlop={8}
                  onPress={close}
                >
                  <MaterialCommunityIcons
                    color={MUTED}
                    name="close"
                    size={22}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {sheet.options.map((option, index) => {
                  const selected = option === sheet.value;
                  const available = selected || isAvailable(sheet.name, option);
                  return (
                    <TouchableOpacity
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      activeOpacity={0.7}
                      key={option}
                      onPress={() => {
                        close();
                        if (!selected) {
                          onSelect(sheet.name, option);
                        }
                      }}
                      style={[
                        styles.option,
                        index > 0 ? styles.rowDivider : null,
                      ]}
                    >
                      <MaterialCommunityIcons
                        color={selected ? ACCENT_TEAL : MUTED}
                        name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                        size={22}
                      />
                      <Swatch attribute={sheet.name} value={option} />
                      <View style={styles.optionTextWrap}>
                        <Text
                          style={[
                            styles.optionText,
                            selected ? styles.optionTextSelected : null,
                            !available ? styles.optionTextMuted : null,
                          ]}
                        >
                          {option}
                        </Text>
                        {!available ? (
                          <Text style={styles.optionNote}>
                            Other options will change to match
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: BORDER,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingVertical: 12,
  },
  // The glyph has padding on its right; pull it out so the arrow ends on the
  // same edge as values in rows without one.
  chevron: {
    marginRight: -7,
  },
  rowDivider: {
    borderTopColor: BORDER,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
  },
  rowValueWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  rowValue: {
    color: BRAND_NAVY,
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 14.5,
    fontWeight: '800',
  },
  rowPlaceholder: {
    color: MUTED,
    fontWeight: '600',
  },
  swatch: {
    borderRadius: 9,
    height: 18,
    width: 18,
  },
  swatchBorder: {
    borderColor: BORDER,
    borderWidth: 1,
  },

  /* Sheet */
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
    maxHeight: '70%',
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
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetTitle: {
    color: BRAND_NAVY,
    fontSize: 19,
    fontWeight: '900',
  },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingVertical: 12,
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
  },
  optionText: {
    color: BRAND_NAVY,
    fontSize: 15,
    fontWeight: '600',
  },
  optionTextSelected: {
    fontWeight: '800',
  },
  optionTextMuted: {
    color: MUTED,
  },
  optionNote: {
    color: MUTED,
    fontSize: 12,
  },
});
