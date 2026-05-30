import React, {useEffect, useState, useSyncExternalStore} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {
  getSalesOrderSyncErrorMessage,
  updateExistingPosInvoiceItems,
  updateExistingSalesOrderItems,
} from '../../cart/service';
import {colors} from '../../../theme/colors';
import {
  loadStoredOrders,
  getOrders,
  subscribeOrders,
  LocalOrder,
  updateLocalOrder,
  updateLocalOrderItems,
} from '../service';

const formatMoney = (value: number) => `AED ${value.toFixed(2)}`;

const formatOrderDate = (timestamp: number) =>
  new Date(timestamp).toLocaleString('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });

const getOrderStatusTone = (order: LocalOrder) => {
  if (order.syncState === 'confirmed') {
    return {
      backgroundColor: '#e7f8eb',
      borderColor: '#b7e6c0',
      textColor: '#1f7a36',
    };
  }

  if (order.syncState === 'failed') {
    return {
      backgroundColor: '#fff0ec',
      borderColor: '#ffd1c4',
      textColor: '#b4431d',
    };
  }

  return {
    backgroundColor: '#fff6db',
    borderColor: '#f1df95',
    textColor: '#8a6400',
  };
};

const getOrderStatusLabel = (order: LocalOrder) => {
  if (order.syncState === 'confirmed') {
    return order.backendStatus || 'Confirmed';
  }

  if (order.syncState === 'failed') {
    return 'Sync failed';
  }

  if (order.syncState === 'syncing') {
    return 'Syncing with ERPNext';
  }

  return 'Saved locally';
};

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const orders = useSyncExternalStore(subscribeOrders, getOrders, getOrders);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadStoredOrders().catch(() => undefined);
  }, []);

  const updateOrderQuantity = async (
    order: LocalOrder,
    itemId: string,
    delta: number,
  ) => {
    const nextItems = order.items
      .map(item =>
        item.id === itemId
          ? {...item, quantity: Math.max(1, item.quantity + delta)}
          : item,
      )
      .filter(item => item.quantity > 0);

    const hasChanged = nextItems.some((item, index) => item.quantity !== order.items[index]?.quantity);

    if (!hasChanged) {
      return;
    }

    setUpdatingOrderIds(current => ({...current, [order.id]: true}));
    await updateLocalOrderItems(order.id, nextItems);
    await updateLocalOrder(order.id, {
      backendStatus: 'Updating ERPNext order',
      errorMessage: '',
      syncState: 'syncing',
    });

    if (!order.backendOrderName.trim()) {
      await updateLocalOrder(order.id, {
        backendStatus: 'Saved locally. Waiting for ERPNext order number.',
        syncState: 'pending',
      });
      setUpdatingOrderIds(current => ({...current, [order.id]: false}));
      return;
    }

    try {
      const updatedDocument =
        order.backendDoctype === 'POS Invoice'
          ? await updateExistingPosInvoiceItems(order.backendOrderName, nextItems)
          : await updateExistingSalesOrderItems(order.backendOrderName, nextItems);

      await updateLocalOrder(order.id, {
        backendStatus: updatedDocument?.status?.toString().trim() || 'Order updated',
        errorMessage: '',
        syncState: 'confirmed',
      });
    } catch (error) {
      await updateLocalOrder(order.id, {
        backendStatus: 'ERPNext update failed',
        errorMessage: getSalesOrderSyncErrorMessage(error),
        syncState: 'failed',
      });
    } finally {
      setUpdatingOrderIds(current => ({...current, [order.id]: false}));
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + 28, paddingTop: insets.top + 18},
        ]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>
          Recent orders appear instantly from local storage while ERPNext status keeps updating in the background.
        </Text>

        {orders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>
              Your next checkout will be saved here immediately.
            </Text>
          </View>
        ) : (
          orders.map(order => {
            const tone = getOrderStatusTone(order);
            const isUpdatingOrder = updatingOrderIds[order.id] === true;

            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>
                      {order.backendOrderName || `Local ${order.id.slice(-6).toUpperCase()}`}
                    </Text>
                    <Text style={styles.orderDate}>{formatOrderDate(order.createdAt)}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: tone.backgroundColor,
                        borderColor: tone.borderColor,
                      },
                    ]}>
                    <Text style={[styles.statusText, {color: tone.textColor}]}>
                      {getOrderStatusLabel(order)}
                    </Text>
                  </View>
                </View>

                <Text numberOfLines={2} style={styles.addressText}>
                  {order.address}
                </Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    {order.itemCount} item{order.itemCount > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.metaText}>{formatMoney(order.total)}</Text>
                </View>

                <View style={styles.itemList}>
                  {order.items.map(item => (
                    <View key={`${order.id}-${item.id}`} style={styles.itemRow}>
                      <View style={styles.itemContent}>
                        <Text numberOfLines={1} style={styles.itemName}>
                          {item.name}
                        </Text>
                        <Text style={styles.itemMeta}>{formatMoney(item.price)}</Text>
                      </View>
                      <View style={styles.stepper}>
                        <Pressable
                          disabled={isUpdatingOrder || item.quantity <= 1}
                          onPress={() => {
                            updateOrderQuantity(order, item.id, -1).catch(() => undefined);
                          }}
                          style={[
                            styles.stepperButton,
                            (isUpdatingOrder || item.quantity <= 1) && styles.stepperButtonDisabled,
                          ]}>
                          <Text style={styles.stepperButtonText}>-</Text>
                        </Pressable>
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        <Pressable
                          disabled={isUpdatingOrder}
                          onPress={() => {
                            updateOrderQuantity(order, item.id, 1).catch(() => undefined);
                          }}
                          style={[
                            styles.stepperButton,
                            isUpdatingOrder && styles.stepperButtonDisabled,
                          ]}>
                          <Text style={styles.stepperButtonText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>

                {isUpdatingOrder ? (
                  <View style={styles.syncRow}>
                    <ActivityIndicator color="#8a6400" size="small" />
                    <Text style={styles.syncText}>Updating order in ERPNext</Text>
                  </View>
                ) : null}

                {order.errorMessage ? (
                  <Text style={styles.errorText}>{order.errorMessage}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
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
  title: {
    color: '#083d2e',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#fff8df',
    borderColor: '#f1df95',
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
  },
  emptyTitle: {
    color: '#1b1b1b',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderColor: '#ece7d8',
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  orderHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  orderId: {
    color: '#1b1b1b',
    fontSize: 16,
    fontWeight: '800',
  },
  orderDate: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 4,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addressText: {
    color: '#3d3d3d',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  metaText: {
    color: '#1b1b1b',
    fontSize: 14,
    fontWeight: '700',
  },
  itemList: {
    marginTop: 14,
  },
  itemRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  itemContent: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    color: '#1b1b1b',
    fontSize: 14,
  },
  itemMeta: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: '#fff3bf',
    borderRadius: 10,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  stepperButtonDisabled: {
    opacity: 0.45,
  },
  stepperButtonText: {
    color: '#5A3D00',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  quantityText: {
    color: '#1b1b1b',
    fontSize: 14,
    fontWeight: '700',
    marginHorizontal: 12,
    minWidth: 18,
    textAlign: 'center',
  },
  syncRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 14,
  },
  syncText: {
    color: '#8a6400',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorText: {
    color: '#b4431d',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 14,
  },
});
