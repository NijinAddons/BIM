import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CommonActions,
  useNavigation,
  type RouteProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ActionButton, ScreenHeader } from '../../components';
import { removeCartLines } from '../../hooks/useCart';
import type { AppParamList } from '../../navigation/types';
import { finalizeStripeCheckout } from '../../services';
import { invalidateOrders } from '../../queries';
import { BORDER, TEXT } from '../../theme/colors';

const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';

// Mounted as the root `WebView` (help pages) and as the root `Checkout`
// screen (Stripe payment), so it takes its navigation from context.
type Props = { route: RouteProp<AppParamList, 'Checkout' | 'WebView'> };

const getCheckoutSessionId = (url: string): string | null => {
  const match = url.match(/[?&]session_id=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export default function WebViewScreen({ route }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { paymentCheckout, title, url } = route.params;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const handledPaymentRedirect = useRef(false);

  const retry = () => {
    setFailed(false);
    setLoading(true);
    setReloadKey(key => key + 1);
  };

  const handlePaymentRedirect = async (nextUrl: string) => {
    if (!paymentCheckout || handledPaymentRedirect.current) {
      return;
    }

    if (nextUrl.includes('/payment/cancel')) {
      handledPaymentRedirect.current = true;
      Alert.alert('Payment canceled', 'Your checkout was canceled.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    if (!nextUrl.includes('/payment/success')) {
      return;
    }

    const sessionId = getCheckoutSessionId(nextUrl);
    if (!sessionId) {
      return;
    }

    handledPaymentRedirect.current = true;
    setLoading(true);
    try {
      const order = await finalizeStripeCheckout(sessionId);
      invalidateOrders();
      // Quotation (RFQ) lines were never part of the payment, so keep them.
      removeCartLines(line => !line.item.rfqOnly);
      Alert.alert(
        'Payment successful',
        `Your order ${order.sales_order} has been placed.`,
        [
          {
            text: 'View orders',
            onPress: () =>
              // Drop Cart + Checkout and land on Orders, so back returns
              // to the tabs rather than the now-empty cart.
              navigation.dispatch(state => {
                const tabsIndex = state.routes.findIndex(
                  r => r.name === 'MainTabs',
                );
                const routes = [
                  ...state.routes.slice(0, tabsIndex + 1),
                  { name: 'Orders', params: { screen: 'OrdersList' } },
                ];
                return CommonActions.reset({
                  ...state,
                  routes,
                  index: routes.length - 1,
                });
              }),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Could not confirm payment',
        error instanceof Error ? error.message : 'Please contact support.',
      );
    } finally {
      setLoading(false);
    }
  };

  const shouldStartLoad = (nextUrl: string) => {
    if (
      paymentCheckout &&
      (nextUrl.includes('/payment/cancel') ||
        nextUrl.includes('/payment/success'))
    ) {
      handlePaymentRedirect(nextUrl);
      return false;
    }

    return true;
  };

  return (
    <View
      style={[
        styles.container,
        paymentCheckout ? { paddingTop: insets.top } : null,
      ]}
    >
      {paymentCheckout ? (
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      ) : null}

      {paymentCheckout ? (
        <View style={styles.checkoutHeader}>
          <MaterialCommunityIcons color={MUTED} name="lock-outline" size={18} />
          <Text style={styles.checkoutTitle}>{title}</Text>
          <TouchableOpacity
            accessibilityLabel="Close checkout"
            hitSlop={8}
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons color={TEXT} name="close" size={22} />
          </TouchableOpacity>
        </View>
      ) : (
        <ScreenHeader onBack={() => navigation.goBack()} title={title} />
      )}

      {failed ? (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons color="#C6CDD3" name="wifi-off" size={40} />
          <Text style={styles.errorText}>
            Could not load this page. Check your connection and try again.
          </Text>
          <ActionButton
            label="Retry"
            onPress={retry}
            style={styles.retryButton}
            variant="dark"
          />
        </View>
      ) : (
        <>
          <WebView
            key={reloadKey}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
            onLoadEnd={() => setLoading(false)}
            onLoadStart={() => setLoading(true)}
            onNavigationStateChange={event => {
              handlePaymentRedirect(event.url);
            }}
            onShouldStartLoadWithRequest={request =>
              shouldStartLoad(request.url)
            }
            source={{ uri: url }}
            style={styles.webview}
          />
          {loading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={ACCENT_TEAL} size="large" />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  checkoutHeader: {
    alignItems: 'center',
    borderBottomColor: BORDER,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  checkoutTitle: {
    color: TEXT,
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  closeButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  centeredState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: MUTED,
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
});
