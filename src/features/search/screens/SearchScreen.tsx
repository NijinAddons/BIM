import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  RootStackParamList,
} from '../../../app/navigation/types/root-navigation.types';
import ProductCard from '../../../components/ProductCard';
import ScreenHeader from '../../../components/ScreenHeader';
import { colors } from '../../../theme/colors';
import { fetchProducts } from '../../product/service';
import { Product } from '../../product/service';

type SearchScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Search'
>;
type SearchScreenRouteProp = RouteProp<RootStackParamList, 'Search'>;

const quickSearches = ['Milk', 'Bread', 'Eggs', 'Rice', 'Snacks'];
const recentSearches = ['Banana', 'Full Cream Milk', 'Brown Bread'];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<SearchScreenNavigationProp>();
  const route = useRoute<SearchScreenRouteProp>();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);

  const normalizedQuery = query.trim().toLowerCase();
  const hasQuery = normalizedQuery.length > 0;

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      const nextProducts = await fetchProducts({ fallbackToMock: true });

      if (isMounted) {
        setProducts(nextProducts);
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (route.params?.query !== undefined) {
      setQuery(route.params.query);
    }
  }, [route.params?.query, route.params?.submittedAt]);

  const filteredProducts = useMemo(() => {
    if (!hasQuery) {
      return [];
    }

    return products
      .filter(
        product =>
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.grams.toLowerCase().includes(normalizedQuery) ||
          product.itemGroup?.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 8);
  }, [hasQuery, normalizedQuery, products]);

  const resultTitle = `Results for "${query.trim()}"`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerBlock, { paddingTop: insets.top + 18 }]}>
          <View style={styles.header}>
            <ScreenHeader
              onBackPress={() => navigation.goBack()}
              title="Search"
              titleStyle={styles.headerTitle}
            />
            <View style={styles.headerCopy}>
              <Text style={styles.subtitle}>Find products in seconds</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons color="#68625a" name="magnify" size={22} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search for groceries"
              placeholderTextColor="#8a8376"
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            {query.length > 0 ? (
              <Pressable
                hitSlop={8}
                onPress={() => setQuery('')}
                style={styles.clearButton}
              >
                <MaterialCommunityIcons color="#68625a" name="close" size={16} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
        <View style={styles.quickRow}>
          {quickSearches.map(item => (
            <Pressable
              key={item}
              onPress={() => setQuery(item)}
              style={styles.quickChip}
            >
              <Text style={styles.quickChipText}>{item}</Text>
            </Pressable>
          ))}
        </View>

        {!hasQuery ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent searches</Text>
            <View style={styles.recentList}>
              {recentSearches.map(item => (
                <Pressable
                  key={item}
                  onPress={() => setQuery(item)}
                  style={styles.recentRow}
                >
                  <MaterialCommunityIcons
                    color="#8a8376"
                    name="history"
                    size={18}
                  />
                  <Text style={styles.recentText}>{item}</Text>
                  <MaterialCommunityIcons
                    color="#b0a89c"
                    name="arrow-top-left"
                    size={17}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {hasQuery ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{resultTitle}</Text>
              <Text style={styles.resultCount}>{filteredProducts.length}</Text>
            </View>

            {filteredProducts.length > 0 ? (
              <View style={styles.resultList}>
                {filteredProducts.map(item => (
                  <View key={item.id} style={styles.resultCardWrap}>
                    <ProductCard item={item} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  color="#8a8376"
                  name="magnify-close"
                  size={30}
                />
                <Text style={styles.emptyTitle}>No results found</Text>
                <Text style={styles.emptyText}>Try another product name.</Text>
              </View>
            )}
          </View>
        ) : null}
        </View>
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
    paddingBottom: 0,
  },
  headerBlock: {
    backgroundColor: '#f7e7a6',
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  body: {
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
  },
  headerCopy: {
    marginTop: -4,
    paddingLeft: 48,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: '#fff8e6',
    borderColor: '#e7d6a8',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  clearButton: {
    alignItems: 'center',
    backgroundColor: '#f2eee5',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  quickChip: {
    backgroundColor: '#fff4cf',
    borderColor: '#ebdcae',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  quickChipText: {
    color: '#3d3020',
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  resultCount: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
  },
  recentList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    overflow: 'hidden',
  },
  recentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  recentText: {
    color: '#3d3020',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  resultList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  resultCardWrap: {
    marginBottom: 12,
    width: '48%',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 13,
    marginTop: 6,
  },
});
