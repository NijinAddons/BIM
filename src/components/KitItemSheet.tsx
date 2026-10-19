import React, { useRef } from 'react';
import {
  ActivityIndicator,
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

import { useKitItemDetails } from '../queries';
import { formatComponentQty, type BundleComponent } from '../services';
import {
  BORDER,
  CARD,
  GREEN,
  GREEN_TINT,
  HAIRLINE,
  MUTED,
  NAVY,
  SURFACE,
  TEXT,
  TEXT_VARIANT,
} from '../theme/colors';

type Props = {
  /** The tapped kit item; `null` hides the sheet. */
  component: BundleComponent | null;
  /** The kit it belongs to, e.g. "Week 1 – Kerala Regular Kit". */
  kitLabel?: string;
  onClose: () => void;
};

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <MaterialCommunityIcons color={MUTED} name={icon} size={18} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Bottom sheet with one kit item's details — opened by tapping an item tile
 * on a weekly kit. The tile's own data (name, image, qty) shows at once; the
 * description and other Item fields load in underneath.
 */
export default function KitItemSheet({ component: openComponent, kitLabel: openKitLabel, onClose }: Props) {
  const insets = useSafeAreaInsets();
  // Keep showing the last item while the sheet slides away, so its content
  // doesn't blank out mid-animation.
  const last = useRef({ component: openComponent, kitLabel: openKitLabel });
  if (openComponent) {
    last.current = { component: openComponent, kitLabel: openKitLabel };
  }
  const { component, kitLabel } = last.current;
  const details = useKitItemDetails(component?.itemCode ?? null);
  const info = details.data;
  const image = component?.image ?? info?.images[0] ?? null;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={openComponent !== null}
    >
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        {component ? (
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.handle} />
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.imageBox}>
                {image ? (
                  <FastImage
                    resizeMode={FastImage.resizeMode.cover}
                    source={{ uri: image }}
                    style={styles.imageFill}
                  />
                ) : (
                  <MaterialCommunityIcons color={MUTED} name="sprout" size={56} />
                )}
              </View>

              <View style={styles.titleBlock}>
                <Text style={styles.title}>{info?.name ?? component.name}</Text>
                {kitLabel ? (
                  <Text style={styles.kitLabel}>In {kitLabel}</Text>
                ) : null}
              </View>

              <View style={styles.qtyPill}>
                <MaterialCommunityIcons color={GREEN} name="scale" size={16} />
                <Text style={styles.qtyText}>
                  {formatComponentQty(component.qty, component.uom)} per kit
                </Text>
              </View>

              {details.isPending ? (
                <ActivityIndicator color={GREEN} style={styles.loader} />
              ) : details.isError ? (
                <Text style={styles.errorText}>
                  Couldn't load more details for this item.
                </Text>
              ) : info ? (
                <>
                  {info.itemGroup || info.brand || info.countryOfOrigin ? (
                    <View style={styles.detailsBox}>
                      {info.itemGroup ? (
                        <DetailRow icon="shape-outline" label="Category" value={info.itemGroup} />
                      ) : null}
                      {info.brand ? (
                        <DetailRow icon="tag-outline" label="Brand" value={info.brand} />
                      ) : null}
                      {info.countryOfOrigin ? (
                        <DetailRow icon="earth" label="Origin" value={info.countryOfOrigin} />
                      ) : null}
                    </View>
                  ) : null}
                  {info.description ? (
                    <View style={styles.descriptionBlock}>
                      <Text style={styles.sectionTitle}>About this item</Text>
                      <Text style={styles.description}>{info.description}</Text>
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>

            <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
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
    maxHeight: '85%',
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
    marginBottom: 16,
    width: 40,
  },
  content: {
    gap: 16,
    paddingBottom: 16,
  },
  imageBox: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: SURFACE,
    borderRadius: 20,
    height: 180,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 180,
  },
  imageFill: {
    height: '100%',
    width: '100%',
  },
  titleBlock: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  kitLabel: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  qtyPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: GREEN_TINT,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  qtyText: {
    color: GREEN,
    fontSize: 14,
    fontWeight: '800',
  },
  loader: {
    marginVertical: 12,
  },
  errorText: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'center',
  },
  detailsBox: {
    backgroundColor: SURFACE,
    borderColor: BORDER,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  detailLabel: {
    color: TEXT_VARIANT,
    fontSize: 14,
    width: 72,
  },
  detailValue: {
    color: TEXT,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  descriptionBlock: {
    gap: 6,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '800',
  },
  description: {
    color: TEXT_VARIANT,
    fontSize: 14,
    lineHeight: 21,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 14,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
