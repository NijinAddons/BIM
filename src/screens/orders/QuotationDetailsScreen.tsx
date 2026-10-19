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
import FastImage from '@d11/react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { AppRefreshControl } from '../../components';
import type { OrdersStackParamList } from '../../navigation/types';
import { useQuotationRequest } from '../../queries';
import type { SupplierQuote } from '../../services';
import { QUOTATION_STYLE } from './orders.data';

const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#7A8590';

const RECEIVED_STYLE = {
  bg: '#E4F9F1',
  icon: 'check-circle-outline',
  text: '#1E9E6B',
};

type Props = {
  navigation: NativeStackNavigationProp<
    OrdersStackParamList,
    'QuotationDetails'
  >;
  route: RouteProp<OrdersStackParamList, 'QuotationDetails'>;
};

const DetailRow = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) => (
  <View style={styles.detailRow}>
    <MaterialCommunityIcons color={ACCENT_TEAL} name={icon} size={18} />
    <View style={styles.detailBody}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

const QuoteBreakdown = ({ quote }: { quote: SupplierQuote }) => (
  <View style={styles.quote}>
    <View style={styles.quoteHeader}>
      <Text style={styles.quoteId}>{quote.id}</Text>
      <Text
        style={[styles.quoteValidity, quote.expired && styles.quoteExpired]}
      >
        {quote.expired
          ? `Expired${quote.validTill ? ` · ${quote.validTill}` : ''}`
          : quote.validTill
          ? `Valid till ${quote.validTill}`
          : quote.date}
      </Text>
    </View>

    {quote.items.map((line, index) => (
      <View key={`${line.itemCode}-${index}`} style={styles.itemRow}>
        <View style={styles.itemQtyBadge}>
          <Text style={styles.itemQtyText}>{line.qty}x</Text>
        </View>
        <View style={styles.quoteLineBody}>
          <Text style={styles.itemName}>{line.itemName}</Text>
          <Text style={styles.itemMeta}>{line.rate} each</Text>
        </View>
        <Text style={styles.itemPrice}>{line.amount}</Text>
      </View>
    ))}

    <View style={styles.divider} />
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>Subtotal</Text>
      <Text style={styles.summaryValue}>{quote.subtotal}</Text>
    </View>
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>Taxes &amp; charges</Text>
      <Text style={styles.summaryValue}>{quote.taxes}</Text>
    </View>
    <View style={[styles.summaryRow, styles.summaryRowLast]}>
      <Text style={styles.summaryTotalLabel}>Quoted total</Text>
      <Text style={styles.summaryTotalValue}>{quote.total}</Text>
    </View>
  </View>
);

export default function QuotationDetailsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { requestId, summary } = route.params;

  const requestQuery = useQuotationRequest(requestId);
  const request = requestQuery.data ?? null;
  const loading = requestQuery.isPending;
  const error = requestQuery.isError;

  // As in `OrderDetailsScreen`, the list row's summary paints the header
  // and request details on the first frame.
  const head = request ?? summary ?? null;
  const hasActiveQuote = !!request?.suppliers.some(supplier =>
    supplier.quotes.some(quote => !quote.expired),
  );
  const banner = hasActiveQuote
    ? { ...RECEIVED_STYLE, label: 'Quote received' }
    : {
        ...QUOTATION_STYLE,
        label: request?.suppliers.some(s => s.quotes.length > 0)
          ? 'Quote expired'
          : 'Awaiting supplier quote',
      };

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
          <Text style={styles.headerTitle}>{requestId}</Text>
          <Text style={styles.headerSubtitle}>
            {head?.date ? `Requested ${head.date}` : ' '}
          </Text>
        </View>
      </View>

      {loading && !head ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={ACCENT_TEAL} size="large" />
        </View>
      ) : !loading && (error || !request) && !head ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons color="#C6CDD3" name="wifi-off" size={40} />
          <Text style={styles.emptyText}>
            Could not load this quotation request.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <AppRefreshControl onRefresh={requestQuery.refetch} />
          }
          showsVerticalScrollIndicator={false}
        >
          {request ? (
            <View style={[styles.statusBanner, { backgroundColor: banner.bg }]}>
              <MaterialCommunityIcons
                color={banner.text}
                name={banner.icon}
                size={20}
              />
              <Text style={[styles.statusBannerText, { color: banner.text }]}>
                {banner.label}
              </Text>
            </View>
          ) : null}

          {head ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Request details</Text>
              <View style={styles.details}>
                {head.requiredBy ? (
                  <DetailRow
                    icon="calendar-month-outline"
                    label="Required by"
                    value={head.requiredBy}
                  />
                ) : null}
                {head.address ? (
                  <DetailRow
                    icon="map-marker-outline"
                    label="Deliver to"
                    value={head.address}
                  />
                ) : null}
                {request?.email ? (
                  <DetailRow
                    icon="email-outline"
                    label="Quotation email"
                    value={request.email}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          {request ? (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Requested items</Text>
                {request.items.map((item, index) => (
                  <View
                    key={`${item.itemCode}-${index}`}
                    style={[
                      styles.itemRow,
                      index === request.items.length - 1 && styles.itemRowLast,
                    ]}
                  >
                    {item.image ? (
                      <FastImage
                        resizeMode={FastImage.resizeMode.cover}
                        source={{ uri: item.image }}
                        style={styles.itemImage}
                      />
                    ) : (
                      <View style={[styles.itemImage, styles.itemImageEmpty]}>
                        <MaterialCommunityIcons
                          color="#C6CDD3"
                          name="image-outline"
                          size={20}
                        />
                      </View>
                    )}
                    <View style={styles.quoteLineBody}>
                      <Text style={styles.itemName}>{item.itemName}</Text>
                      {item.description &&
                      item.description !== item.itemName ? (
                        <Text numberOfLines={3} style={styles.itemMeta}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.itemPrice}>
                      Qty {item.qty}
                      {item.uom ? ` ${item.uom}` : ''}
                    </Text>
                  </View>
                ))}
              </View>

              {request.suppliers.map(supplier => (
                <View key={supplier.supplier} style={styles.card}>
                  <View style={styles.supplierHeader}>
                    <Text style={[styles.sectionTitle, styles.supplierName]}>
                      {supplier.supplierName}
                    </Text>
                    <Text style={styles.supplierStatus}>
                      {supplier.quotes.length > 0
                        ? 'Quoted'
                        : supplier.quoteStatus === 'Received'
                        ? 'Quote received'
                        : 'Awaiting quote'}
                    </Text>
                  </View>
                  {supplier.quotes.length > 0 ? (
                    supplier.quotes.map(quote => (
                      <QuoteBreakdown key={quote.id} quote={quote} />
                    ))
                  ) : (
                    <Text style={styles.awaitingText}>
                      The supplier hasn't sent a quote yet. We'll show it here
                      as soon as they do.
                    </Text>
                  )}
                </View>
              ))}
            </>
          ) : loading ? (
            <View style={styles.inlineLoader}>
              <ActivityIndicator color={ACCENT_TEAL} size="small" />
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Could not load the quotes. Pull down to try again.
            </Text>
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
  inlineLoader: {
    alignItems: 'center',
    paddingVertical: 32,
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
  details: {
    gap: 12,
  },
  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  detailBody: {
    flex: 1,
  },
  detailLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '500',
  },
  detailValue: {
    color: '#33404A',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 2,
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
  itemImage: {
    backgroundColor: '#F2F4F6',
    borderRadius: 10,
    height: 44,
    width: 44,
  },
  itemImageEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
    fontWeight: '600',
  },
  itemMeta: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  itemPrice: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  quoteLineBody: {
    flex: 1,
  },
  supplierHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  supplierName: {
    flex: 1,
    marginRight: 8,
  },
  supplierStatus: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  awaitingText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  quote: {
    borderColor: '#EFF1F3',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    padding: 12,
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quoteId: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '700',
  },
  quoteValidity: {
    color: RECEIVED_STYLE.text,
    fontSize: 12,
    fontWeight: '600',
  },
  quoteExpired: {
    color: '#D64545',
  },
  divider: {
    backgroundColor: '#EFF1F3',
    height: 1,
    marginBottom: 10,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryRowLast: {
    marginBottom: 0,
  },
  summaryLabel: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '500',
  },
  summaryValue: {
    color: '#33404A',
    fontSize: 13,
    fontWeight: '600',
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
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
});
