import React, {useCallback} from 'react';
import {Dimensions, FlatList, ListRenderItemInfo, StatusBar, StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {ProductCard, ScreenHeader} from '../../components';
import {useWishlist, WishlistItem} from '../../hooks/useWishlist';
import type {RootStackScreenProps} from '../../navigation/types';

const BRAND_NAVY = '#1F2E3D';
const MUTED = '#8A94A3';

const NUM_COLUMNS = 2;
const GRID_PADDING = 16;
const GRID_GAP = 14;
const CARD_WIDTH = (Dimensions.get('window').width - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const keyExtractor = (item: WishlistItem) => item.id;

type Props = RootStackScreenProps<'Wishlist'>;

const WishlistScreen = ({navigation}: Props) => {
  const items = useWishlist();

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<WishlistItem>) => (
      <View style={styles.cardWrapper}>
        <ProductCard item={item} onPress={() => navigation.navigate('ProductDetail', {item})} />
      </View>
    ),
    [navigation],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />
      <ScreenHeader onBack={() => navigation.goBack()} title="Wishlist" />

      {items.length === 0 ? (
        <View style={styles.centeredState}>
          <MaterialCommunityIcons color="#C6CDD3" name="heart-outline" size={44} />
          <Text style={styles.emptyText}>No saved items yet.</Text>
          <Text style={styles.emptyHint}>Tap the heart on any product to save it here.</Text>
        </View>
      ) : (
        <FlatList
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          renderItem={renderItem}
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
  centeredState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: BRAND_NAVY,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyHint: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  listContent: {
    gap: GRID_GAP,
    padding: GRID_PADDING,
    paddingBottom: 32,
  },
  row: {
    gap: GRID_GAP,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
});

export default WishlistScreen;
