import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type { OrdersStackParamList } from '../../navigation/types';
import { useSalesOrder } from '../../queries';
import { STATUS_STYLES } from './orders.data';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';

type Props = {
  navigation: NativeStackNavigationProp<OrdersStackParamList, 'OrderDetails'>;
  route: RouteProp<OrdersStackParamList, 'OrderDetails'>;
};

export default function OrderDetailsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { orderId, summary } = route.params;

  const orderQuery = useSalesOrder(orderId);
  const order = orderQuery.data ?? null;
  const loading = orderQuery.isPending;
  const error = orderQuery.isError;

  // The list row's summary paints the header and status banner on the first
  // frame, so only the line items wait on the network (no spinner → content
  // pop, no header growing when the date arrives).
  const head = order ?? summary ?? null;
  const statusStyle = head ? STATUS_STYLES[head.statusKey] : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            color="#F5FAFC"
            name="chevron-left"
            size={24}
          />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{orderId}</Text>
          <Text style={styles.headerSubtitle}>{head?.date ?? ' '}</Text>
        </View>
      </View>

      {loading && !head ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={ACCENT_TEAL} size="large" />
        </View>
      ) : !loading && (error || !order) ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons color="#C6CDD3" name="wifi-off" size={40} />
          <Text style={styles.emptyText}>Could not load this order.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {statusStyle ? (
            <View
              style={[styles.statusBanner, { backgroundColor: statusStyle.bg }]}
            >
              <MaterialCommunityIcons
                color={statusStyle.text}
                name={statusStyle.icon}
                size={20}
              />
              <Text
                style={[styles.statusBannerText, { color: statusStyle.text }]}
              >
                {head?.rawStatus}
              </Text>
            </View>
          ) : null}

          {order ? (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Items</Text>
                {order.items.length === 0 ? (
                  <Text style={styles.itemName}>No line items.</Text>
                ) : (
                  order.items.map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        styles.itemRow,
                        index === order.items.length - 1 && styles.itemRowLast,
                      ]}
                    >
                      <View style={styles.itemQtyBadge}>
                        <Text style={styles.itemQtyText}>{item.qty}x</Text>
                      </View>
                      <Text style={styles.itemName}>{item.itemName}</Text>
                      <Text style={styles.itemPrice}>{item.amount}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Payment summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>{order.subtotal}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Taxes &amp; charges</Text>
                  <Text style={styles.summaryValue}>
                    {order.taxesAndCharges}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTotalLabel}>Total</Text>
                  <Text style={styles.summaryTotalValue}>{order.total}</Text>
                </View>
              </View>

              {order.address ? (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Delivery address</Text>
                  <View style={styles.addressRow}>
                    <MaterialCommunityIcons
                      color={ACCENT_TEAL}
                      name="map-marker-outline"
                      size={18}
                    />
                    <Text style={styles.addressText}>{order.address}</Text>
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.inlineLoader}>
              <ActivityIndicator color={ACCENT_TEAL} size="small" />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerText: {
    flex: 1,
  },
  inlineLoader: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  headerTitle: {
    color: '#F5FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#9FB0BD',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  content: {
    gap: 14,
    padding: 20,
  },
  statusBanner: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#0F1B26',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  itemRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 12,
  },
  itemRowLast: {
    paddingBottom: 0,
  },
  itemQtyBadge: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 30,
    paddingVertical: 4,
  },
  itemQtyText: {
    color: BRAND_NAVY,
    fontSize: 12,
    fontWeight: '700',
  },
  itemName: {
    color: '#33404A',
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  itemPrice: {
    color: '#7A8590',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    color: '#7A8590',
    fontSize: 13,
    fontWeight: '500',
  },
  summaryValue: {
    color: '#33404A',
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    backgroundColor: '#EFF1F3',
    height: 1,
    marginBottom: 10,
  },
  summaryTotalLabel: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '800',
  },
  summaryTotalValue: {
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: '800',
  },
  addressRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  addressText: {
    color: '#33404A',
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#7A8590',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
});
