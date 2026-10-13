import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ActionButton } from '../../components';
import { useAuthStatus, useAuthUser } from '../../hooks/useAuth';
import type { OrdersStackScreenProps } from '../../navigation/types';
import { useManualRefresh, useOrdersForUser } from '../../queries';
import type {
  QuotationRequestSummary,
  SalesOrderSummary,
} from '../../services';
import { QUOTATION_STYLE, STATUS_STYLES } from './orders.data';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';

type Props = OrdersStackScreenProps<'OrdersList'>;

const GUEST_PERKS = [
  { icon: 'truck-fast-outline', label: 'Track deliveries in real time' },
  { icon: 'history', label: 'View your past orders' },
  { icon: 'file-document-outline', label: 'Follow up on quotation requests' },
];

// Orders and submitted quotation requests share one newest-first list.
type ListEntry =
  | { kind: 'order'; order: SalesOrderSummary }
  | { kind: 'quotation'; request: QuotationRequestSummary };

const entryKey = (entry: ListEntry) =>
  entry.kind === 'order'
    ? `order:${entry.order.id}`
    : `rfq:${entry.request.id}`;
const entryDate = (entry: ListEntry) =>
  entry.kind === 'order' ? entry.order.isoDate : entry.request.isoDate;

const MAX_QUOTATION_LINES = 3;

const QuotationCard = ({
  onPress,
  request,
}: {
  onPress: () => void;
  request: QuotationRequestSummary;
}) => {
  const shown = request.items.slice(0, MAX_QUOTATION_LINES);
  const hidden = request.items.length - shown.length;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View
        style={[styles.accentBar, { backgroundColor: QUOTATION_STYLE.text }]}
      />
      <View style={styles.cardTopRow}>
        <View>
          <Text style={styles.orderId}>{request.id}</Text>
          {request.date ? (
            <Text style={styles.orderDate}>{request.date}</Text>
          ) : null}
        </View>
        <View
          style={[styles.statusBadge, { backgroundColor: QUOTATION_STYLE.bg }]}
        >
          <MaterialCommunityIcons
            color={QUOTATION_STYLE.text}
            name={QUOTATION_STYLE.icon}
            size={13}
          />
          <Text style={[styles.statusText, { color: QUOTATION_STYLE.text }]}>
            Quotation requested
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.quoteLines}>
        {shown.map((line, index) => (
          <View key={`${line.itemCode}-${index}`} style={styles.cardBottomRow}>
            <Text
              numberOfLines={1}
              style={[styles.itemsText, styles.quoteName]}
            >
              {line.itemName}
            </Text>
            <Text style={styles.itemCount}>Qty {line.qty}</Text>
          </View>
        ))}
        {hidden > 0 ? (
          <Text style={styles.itemCount}>
            +{hidden} more {hidden === 1 ? 'item' : 'items'}
          </Text>
        ) : null}
      </View>

      {request.address ? (
        <View style={[styles.itemsInfo, styles.quoteAddress]}>
          <MaterialCommunityIcons
            color="#8A94A3"
            name="map-marker-outline"
            size={16}
          />
          <Text numberOfLines={2} style={styles.itemsText}>
            {request.address}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.totalLabel}>
          {request.requiredBy ? 'Required by' : ''}
        </Text>
        <Text style={styles.totalValue}>{request.requiredBy}</Text>
        <View style={styles.trackButton}>
          <Text style={styles.trackButtonText}>View details</Text>
          <MaterialCommunityIcons
            color={ACCENT_TEAL}
            name="chevron-right"
            size={16}
          />
        </View>
      </View>
    </Pressable>
  );
};

const OrderCard = ({
  onPress,
  order,
}: {
  onPress: () => void;
  order: SalesOrderSummary;
}) => {
  const statusStyle = STATUS_STYLES[order.statusKey];

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: statusStyle.text }]} />
      <View style={styles.cardTopRow}>
        <View>
          <Text style={styles.orderId}>{order.id}</Text>
          {order.date ? (
            <Text style={styles.orderDate}>{order.date}</Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <MaterialCommunityIcons
            color={statusStyle.text}
            name={statusStyle.icon}
            size={13}
          />
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {order.rawStatus}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBottomRow}>
        <View style={styles.itemsInfo}>
          <MaterialCommunityIcons
            color="#8A94A3"
            name="account-outline"
            size={16}
          />
          <Text numberOfLines={1} style={styles.itemsText}>
            {order.customerName || order.customer || 'Customer'}
          </Text>
        </View>
        <Text style={styles.itemCount}>
          {order.itemQty} {order.itemQty === 1 ? 'item' : 'items'}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{order.total}</Text>
        <View style={styles.trackButton}>
          <Text style={styles.trackButtonText}>View details</Text>
          <MaterialCommunityIcons
            color={ACCENT_TEAL}
            name="chevron-right"
            size={16}
          />
        </View>
      </View>
    </Pressable>
  );
};

const OrdersScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const isSignedIn = useAuthStatus() === 'signedIn';
  const authUser = useAuthUser();
  const ordersQuery = useOrdersForUser(authUser, {
    enabled: isSignedIn && !!authUser,
  });
  const loading = isSignedIn && !!authUser && ordersQuery.isPending;
  // A failed refetch keeps showing the list we already have.
  const error =
    ordersQuery.isError && !ordersQuery.data
      ? 'Could not load orders. Pull down to try again.'
      : null;
  const entries = useMemo<ListEntry[]>(() => {
    if (!ordersQuery.data) {
      return [];
    }
    const [orders, requests] = ordersQuery.data;
    return [
      ...orders.map(order => ({ kind: 'order' as const, order })),
      ...requests.map(request => ({ kind: 'quotation' as const, request })),
    ].sort((a, b) => entryDate(b).localeCompare(entryDate(a)));
  }, [ordersQuery.data]);
  const { refetch } = ordersQuery;
  const load = useCallback(() => {
    refetch();
  }, [refetch]);
  const { refreshing, onRefresh } = useManualRefresh(refetch);

  if (!isSignedIn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.guestState}>
          <View style={styles.guestArt}>
            <View style={styles.guestArtRing}>
              <MaterialCommunityIcons
                color={BRAND_NAVY}
                name="package-variant-closed"
                size={56}
              />
            </View>
            <View style={styles.guestArtBadge}>
              <MaterialCommunityIcons color="#ffffff" name="lock" size={16} />
            </View>
          </View>

          <Text style={styles.guestTitle}>Your orders live here</Text>
          <Text style={styles.guestSubtitle}>
            Login to see your order history and track your deliveries.
          </Text>

          <View style={styles.guestPerks}>
            {GUEST_PERKS.map(perk => (
              <View key={perk.label} style={styles.guestPerk}>
                <View style={styles.guestPerkIcon}>
                  <MaterialCommunityIcons
                    color={ACCENT_TEAL}
                    name={perk.icon}
                    size={18}
                  />
                </View>
                <Text style={styles.guestPerkText}>{perk.label}</Text>
              </View>
            ))}
          </View>

          <ActionButton
            label="Login"
            onPress={() => navigation.navigate('Login')}
            style={styles.guestButton}
            variant="dark"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {loading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={ACCENT_TEAL} size="large" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
            entries.length === 0 ? styles.listContentEmpty : null,
          ]}
          data={entries}
          keyExtractor={entryKey}
          refreshControl={
            <RefreshControl
              onRefresh={onRefresh}
              refreshing={refreshing}
              tintColor={ACCENT_TEAL}
            />
          }
          renderItem={({ item }) =>
            item.kind === 'quotation' ? (
              <QuotationCard
                onPress={() =>
                  navigation.navigate('QuotationDetails', {
                    requestId: item.request.id,
                    summary: item.request,
                  })
                }
                request={item.request}
              />
            ) : (
              <OrderCard
                onPress={() =>
                  navigation.navigate('OrderDetails', {
                    orderId: item.order.id,
                    summary: item.order,
                  })
                }
                order={item.order}
              />
            )
          }
          ListEmptyComponent={
            <View style={styles.centeredState}>
              <MaterialCommunityIcons
                color="#C6CDD3"
                name={error ? 'wifi-off' : 'package-variant'}
                size={40}
              />
              <Text style={styles.stateText}>
                {error ?? 'You have no orders yet.'}
              </Text>
              {error ? (
                <ActionButton
                  label="Retry"
                  onPress={() => load()}
                  style={styles.retryButton}
                  variant="dark"
                />
              ) : null}
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  listContent: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  centeredState: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  stateText: {
    color: '#8A94A3',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    minWidth: 140,
    paddingHorizontal: 24,
  },
  guestState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  guestArt: {
    marginBottom: 24,
  },
  guestArtRing: {
    alignItems: 'center',
    backgroundColor: 'rgba(46,207,192,0.12)',
    borderRadius: 64,
    height: 128,
    justifyContent: 'center',
    width: 128,
  },
  guestArtBadge: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    borderColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 3,
    bottom: 4,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    width: 36,
  },
  guestTitle: {
    color: BRAND_NAVY,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  guestSubtitle: {
    color: '#8A94A3',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  guestPerks: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 28,
  },
  guestPerk: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  guestPerkIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(46,207,192,0.12)',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  guestPerkText: {
    color: BRAND_NAVY,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  guestButton: {
    alignSelf: 'stretch',
    marginTop: 32,
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
  cardTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderId: {
    color: BRAND_NAVY,
    fontSize: 15,
    fontWeight: '700',
  },
  orderDate: {
    color: '#94A0AB',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  statusBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    backgroundColor: '#EFF1F3',
    height: 1,
    marginVertical: 14,
  },
  cardBottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemsInfo: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    marginRight: 8,
  },
  itemsText: {
    color: '#4B5561',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  itemCount: {
    color: '#94A0AB',
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 14,
  },
  totalLabel: {
    color: '#94A0AB',
    fontSize: 12,
    fontWeight: '500',
  },
  totalValue: {
    color: BRAND_NAVY,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 6,
  },
  accentBar: {
    borderBottomRightRadius: 4,
    borderTopRightRadius: 4,
    bottom: 18,
    left: 0,
    opacity: 0.85,
    position: 'absolute',
    top: 18,
    width: 4,
  },
  trackButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(46,207,192,0.12)',
    borderRadius: 999,
    flexDirection: 'row',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  quoteLines: {
    gap: 8,
  },
  quoteAddress: {
    marginRight: 0,
    marginTop: 14,
  },
  quoteName: {
    flex: 1,
    marginRight: 8,
  },
  trackButtonText: {
    color: ACCENT_TEAL,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default OrdersScreen;
