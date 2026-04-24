import {RouteProp, useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useState} from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {addProductToCart} from '../../cart/service';
import {
  addWishlistItem,
  getWishlistItems,
  loadStoredWishlist,
  subscribeWishlist,
} from '../../product/service';
import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';

type CategoryDetailsRouteProp = RouteProp<RootStackParamList, 'CategoryDetails'>;
type CategoryDetailsNavProp = NativeStackNavigationProp<
  RootStackParamList,
  'CategoryDetails'
>;

const sidebarItems = [
  {
    id: 'all',
    title: 'All',
    image: 'https://loremflickr.com/120/120/fruits,basket?lock=1001',
  },
  {
    id: 'fresh-veg',
    title: 'Fresh\nVegetables',
    image: 'https://loremflickr.com/120/120/vegetables,green?lock=1002',
  },
  {
    id: 'fresh-fruits',
    title: 'Fresh Fruits',
    image: 'https://loremflickr.com/120/120/mango,apple?lock=1003',
  },
  {
    id: 'exotics',
    title: 'Exotics',
    image: 'https://loremflickr.com/120/120/exotic,fruit?lock=1004',
  },
  {
    id: 'coriander',
    title: 'Coriander &\nOthers',
    image: 'https://loremflickr.com/120/120/coriander,herbs?lock=1005',
  },
  {
    id: 'sprouts',
    title: 'Fresh Cut &\nSprouts',
    image: 'https://loremflickr.com/120/120/sprouts,salad?lock=1006',
  },
  {
    id: 'organic',
    title: 'Trusted\nOrganics',
    image: 'https://loremflickr.com/120/120/organic,tomato?lock=1007',
  },
];

const filterChips = [
  {key: 'Filters', icon: 'tune-variant'},
  {key: 'Sort', icon: 'swap-vertical'},
  {key: 'Type', icon: undefined},
  {key: 'Price', icon: undefined},
];

const INITIAL_PRODUCTS_COUNT = 4;
const PRODUCT_BATCH_SIZE = 4;

const products = [
  {
    id: 'p1',
    image: 'https://loremflickr.com/400/400/mango,alphonso?lock=1101',
    name: 'Ratnagiri Alphonso Mango',
    price: 189,
    mrp: 240,
    unit: '175 g',
    pack: '1 pc',
    eta: '12 mins',
    stock: '11 left',
  },
  {
    id: 'p2',
    image: 'https://loremflickr.com/400/400/fruit,chaat?lock=1102',
    name: 'Delight Fruit Chaat (Hannina Chaatu)',
    price: 109,
    mrp: 125,
    unit: '250 g',
    pack: '1 pack',
    eta: '12 mins',
    stock: '11 left',
  },
  {
    id: 'p3',
    image: 'https://loremflickr.com/400/400/mango,safeda?lock=1103',
    name: 'Safeda / Banganapalli Mango (Maavin Hannu)',
    price: 146,
    mrp: 179,
    unit: '550 g',
    pack: '2 pcs',
    eta: '13 mins',
    stock: '2 left',
  },
  {
    id: 'p4',
    image: 'https://loremflickr.com/400/400/watermelon,fresh?lock=1104',
    name: 'Kiran - Watermelon (Kallangadi)',
    price: 77,
    mrp: 94,
    unit: '2.25 kg',
    pack: '1 pc',
    eta: '12 mins',
    stock: '6 left',
  },
  {
    id: 'p5',
    image: 'https://loremflickr.com/400/400/apple,red?lock=1105',
    name: 'Premium Royal Gala Apple',
    price: 129,
    mrp: 155,
    unit: '4 pcs',
    pack: '1 pack',
    eta: '10 mins',
    stock: '8 left',
  },
  {
    id: 'p6',
    image: 'https://loremflickr.com/400/400/banana,yellow?lock=1106',
    name: 'Fresh Banana Robusta',
    price: 54,
    mrp: 68,
    unit: '500 g',
    pack: '1 bunch',
    eta: '11 mins',
    stock: '14 left',
  },
  {
    id: 'p7',
    image: 'https://loremflickr.com/400/400/tomato,market?lock=1107',
    name: 'Farm Fresh Tomato',
    price: 32,
    mrp: 44,
    unit: '500 g',
    pack: '1 pack',
    eta: '9 mins',
    stock: '17 left',
  },
  {
    id: 'p8',
    image: 'https://loremflickr.com/400/400/potato,basket?lock=1108',
    name: 'Daily Value Potato',
    price: 38,
    mrp: 49,
    unit: '1 kg',
    pack: '1 bag',
    eta: '10 mins',
    stock: '12 left',
  },
  {
    id: 'p9',
    image: 'https://loremflickr.com/400/400/orange,citrus?lock=1109',
    name: 'Imported Valencia Orange',
    price: 99,
    mrp: 122,
    unit: '600 g',
    pack: '1 pack',
    eta: '12 mins',
    stock: '9 left',
  },
  {
    id: 'p10',
    image: 'https://loremflickr.com/400/400/cucumber,green?lock=1110',
    name: 'Crunchy Cucumber',
    price: 27,
    mrp: 34,
    unit: '500 g',
    pack: '1 pack',
    eta: '8 mins',
    stock: '20 left',
  },
  {
    id: 'p11',
    image: 'https://loremflickr.com/400/400/pomegranate,fruit?lock=1111',
    name: 'Pomegranate Premium',
    price: 149,
    mrp: 179,
    unit: '2 pcs',
    pack: '1 box',
    eta: '11 mins',
    stock: '5 left',
  },
  {
    id: 'p12',
    image: 'https://loremflickr.com/400/400/carrot,orange?lock=1112',
    name: 'Fresh Orange Carrot',
    price: 36,
    mrp: 48,
    unit: '500 g',
    pack: '1 pack',
    eta: '9 mins',
    stock: '13 left',
  },
];

const filterSections = [
  'Brand',
  'Price',
  'Type',
  'Sugar Profile',
  'Flavour Family',
  'Taste Profile',
  'Quantity',
];

const filterOptionsBySection: Record<
  string,
  {id: string; title: string; count: number; image?: string}[]
> = {
  Brand: [
    {id: 'banana', title: 'Banana', count: 9, image: 'https://loremflickr.com/120/120/banana,fruit?lock=1301'},
    {id: 'tomato', title: 'Tomato', count: 11, image: 'https://loremflickr.com/120/120/tomato,fresh?lock=1302'},
    {id: 'coconut', title: 'Coconut', count: 7, image: 'https://loremflickr.com/120/120/coconut,whole?lock=1303'},
    {id: 'vegetable', title: 'Vegetable', count: 215, image: 'https://loremflickr.com/120/120/vegetable,basket?lock=1304'},
    {id: 'apple', title: 'Apple', count: 16, image: 'https://loremflickr.com/120/120/apple,fruit?lock=1305'},
    {id: 'carrot', title: 'Carrot', count: 8, image: 'https://loremflickr.com/120/120/carrot,fresh?lock=1306'},
    {id: 'watermelon', title: 'Watermelon', count: 6, image: 'https://loremflickr.com/120/120/watermelon,slice?lock=1307'},
    {id: 'snacks', title: 'Snacks', count: 7, image: 'https://loremflickr.com/120/120/snacks,pack?lock=1308'},
    {id: 'orange', title: 'Orange', count: 7, image: 'https://loremflickr.com/120/120/orange,fruit?lock=1309'},
  ],
  Price: [
    {id: 'price-1', title: 'Below ₹99', count: 110},
    {id: 'price-2', title: '₹100 - ₹199', count: 146},
    {id: 'price-3', title: '₹200 - ₹499', count: 86},
    {id: 'price-4', title: 'Above ₹500', count: 9},
  ],
  Type: [
    {id: 'fresh', title: 'Fresh', count: 42},
    {id: 'packaged', title: 'Packaged', count: 18},
    {id: 'combo', title: 'Combo', count: 11},
  ],
  'Sugar Profile': [
    {id: 'no-sugar', title: 'No Sugar Added', count: 8},
    {id: 'low-sugar', title: 'Low Sugar', count: 15},
    {id: 'regular-sugar', title: 'Regular', count: 39},
  ],
  'Flavour Family': [
    {id: 'citrus', title: 'Citrus', count: 12},
    {id: 'berry', title: 'Berry', count: 6},
    {id: 'cola', title: 'Cola', count: 9},
  ],
  'Taste Profile': [
    {id: 'sweet', title: 'Sweet', count: 20},
    {id: 'salty', title: 'Salty', count: 9},
    {id: 'mixed', title: 'Mixed', count: 11},
  ],
  Quantity: [
    {id: 'single', title: 'Single Pack', count: 32},
    {id: 'multi', title: 'Multi Pack', count: 21},
    {id: 'family', title: 'Family Pack', count: 10},
  ],
};

const sortOptions = [
  'Relevance (default)',
  'Price (low to high)',
  'Price (high to low)',
  'Rating (high to low)',
  'Discount (high to low)',
];

export default function CategoryDetailsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<CategoryDetailsNavProp>();
  const route = useRoute<CategoryDetailsRouteProp>();
  const {categoryTitle} = route.params;
  const [selectedSidebar, setSelectedSidebar] = useState('all');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [selectedFilterSection, setSelectedFilterSection] = useState('Price');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [selectedSort, setSelectedSort] = useState('Relevance (default)');
  const [visibleProductCount, setVisibleProductCount] = useState(INITIAL_PRODUCTS_COUNT);
  const [wishlistIds, setWishlistIds] = useState<string[]>(
    getWishlistItems().map(item => item.id),
  );
  const [wishlistToastVisible, setWishlistToastVisible] = useState(false);

  const screenTitle = useMemo(() => {
    if (categoryTitle.toLowerCase().includes('fruit')) {
      return 'Fruits & Vegetables';
    }
    return categoryTitle;
  }, [categoryTitle]);

  const toggleFilter = (id: string) => {
    setSelectedFilters(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id],
    );
  };

  const currentFilterOptions =
    filterOptionsBySection[selectedFilterSection] ?? [];
  const visibleProducts = products.slice(0, visibleProductCount);
  const hasMoreProducts = visibleProductCount < products.length;

  useEffect(() => {
    setVisibleProductCount(INITIAL_PRODUCTS_COUNT);
  }, [categoryTitle]);

  React.useEffect(() => {
    if (!wishlistToastVisible) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setWishlistToastVisible(false);
    }, 4000);

    return () => clearTimeout(timeoutId);
  }, [wishlistToastVisible]);

  useFocusEffect(
    React.useCallback(() => {
      const syncWishlist = async () => {
        const items = await loadStoredWishlist();
        setWishlistIds(items.map(item => item.id));
      };

      syncWishlist();

      return subscribeWishlist(() => {
        setWishlistIds(getWishlistItems().map(item => item.id));
      });
    }, []),
  );

  const onPressWishlist = async (product: (typeof products)[number]) => {
    await addWishlistItem(product);
    setWishlistIds(current =>
      current.includes(product.id) ? current : [...current, product.id],
    );
    setWishlistToastVisible(true);
  };

  const onAddToCart = (product: (typeof products)[number]) => {
    addProductToCart({
      id: product.id,
      image: product.image,
      name: product.name,
      price: product.price.toString(),
      grams: product.unit,
      eta: product.eta,
      tone: '#f3eadc',
      offerTag: product.mrp > product.price ? `${product.mrp - product.price} OFF` : 'Fresh',
      totalSellers: 1,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={[styles.header, {paddingTop: insets.top + 6}]}>
        <View style={styles.headerTopRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <View style={styles.headerTextWrap}>
            <Text numberOfLines={1} style={styles.headerTitle}>
              {screenTitle}
            </Text>
            <Text numberOfLines={1} style={styles.headerSubtitle}>
              Delivering to Work: Nijn Joy, Impitors Pv...
            </Text>
          </View>
          <Pressable style={styles.headerActionButton}>
            <MaterialCommunityIcons color="#303030" name="magnify" size={20} />
          </Pressable>
          <Pressable style={styles.headerActionButton}>
            <MaterialCommunityIcons color="#303030" name="share-variant-outline" size={18} />
          </Pressable>
        </View>
      </View>

      <View style={styles.contentWrap}>
        <View style={styles.sidebar}>
          <ScrollView
            contentContainerStyle={styles.sidebarContent}
            showsVerticalScrollIndicator={false}>
            {sidebarItems.map(item => {
              const isActive = item.id === selectedSidebar;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedSidebar(item.id)}
                  style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}>
                  {isActive ? <View style={styles.sidebarActiveBar} /> : null}
                  <View style={[styles.sidebarImageWrap, isActive && styles.sidebarImageWrapActive]}>
                    <Image source={{uri: item.image}} style={styles.sidebarImage} />
                  </View>
                  <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}>
                    {item.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.mainContent}>
          <ScrollView
            bounces={false}
            contentContainerStyle={[
              styles.mainScrollContent,
              {paddingBottom: insets.bottom + 24},
            ]}
            showsVerticalScrollIndicator={false}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterRow}
              contentContainerStyle={styles.filterRowContent}>
              {filterChips.map(chip => (
                <Pressable
                  key={chip.key}
                  onPress={() => {
                    if (chip.key === 'Filters') {
                      setSelectedFilterSection('Price');
                      setSelectedFilters([]);
                      setFiltersVisible(true);
                    }
                    if (chip.key === 'Sort') {
                      setSortVisible(true);
                    }
                    if (chip.key === 'Price') {
                      setSelectedFilterSection('Price');
                      setSelectedFilters([]);
                      setFiltersVisible(true);
                    }
                  }}
                  style={styles.filterChip}>
                  {chip.icon ? (
                    <MaterialCommunityIcons
                      color="#343434"
                      name={chip.icon}
                      size={16}
                    />
                  ) : null}
                  <Text style={styles.filterChipText}>{chip.key}</Text>
                  <MaterialCommunityIcons
                    color="#555555"
                    name="chevron-down"
                    size={16}
                  />
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.banner}>
              <View style={styles.bannerTextWrap}>
                <Text style={styles.bannerTitle}>Fresh seasonal fruits</Text>
                <Text style={styles.bannerSubtitle}>Nutritional goodness in every bite</Text>
              </View>
              <Image
                source={{uri: 'https://loremflickr.com/260/180/fruits,basket?lock=1200'}}
                style={styles.bannerImage}
              />
            </View>

            <View style={styles.productGrid}>
              {visibleProducts.map(product => (
                <View key={product.id} style={styles.productCard}>
                  <View style={styles.productImageWrap}>
                    <Image source={{uri: product.image}} style={styles.productImage} />
                    <Pressable
                      onPress={() => onPressWishlist(product)}
                      style={styles.wishlistButton}>
                      <MaterialCommunityIcons
                        color={wishlistIds.includes(product.id) ? '#ef4662' : '#7a7a7a'}
                        name={wishlistIds.includes(product.id) ? 'heart' : 'heart-outline'}
                        size={16}
                      />
                    </Pressable>
                  </View>

                  <View style={styles.productMetaHeader}>
                    <View>
                      <Text style={styles.productUnit}>{product.unit}</Text>
                      <Text style={styles.productPack}>{product.pack}</Text>
                    </View>
                    <Pressable onPress={() => onAddToCart(product)} style={styles.addButton}>
                      <Text style={styles.addButtonText}>ADD</Text>
                    </Pressable>
                  </View>

                  <View style={styles.priceRow}>
                    <Text style={styles.priceText}>₹{product.price}</Text>
                    <Text style={styles.mrpText}>₹{product.mrp}</Text>
                  </View>

                  <Text numberOfLines={2} style={styles.productName}>
                    {product.name}
                  </Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoText}>◔ {product.eta}</Text>
                    <Text style={styles.infoText}>◫ {product.stock}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Pressable
              disabled={!hasMoreProducts}
              onPress={() =>
                setVisibleProductCount(current =>
                  Math.min(current + PRODUCT_BATCH_SIZE, products.length),
                )
              }
              style={[styles.seeAllButton, !hasMoreProducts && styles.seeAllButtonDisabled]}>
              <Text style={[styles.seeAllText, !hasMoreProducts && styles.seeAllTextDisabled]}>
                {hasMoreProducts ? 'See all products ›' : 'All products loaded'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setFiltersVisible(false)}
        transparent
        visible={filtersVisible}>
        <View style={styles.modalOverlay}>
          <Pressable
            onPress={() => setFiltersVisible(false)}
            style={styles.modalBackdrop}
          />
          <Pressable
            onPress={() => setFiltersVisible(false)}
            style={styles.floatingCloseButton}>
            <MaterialCommunityIcons color="#ffffff" name="close" size={20} />
          </Pressable>
          <View style={[styles.filterSheet, {paddingBottom: insets.bottom + 18}]}>
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Filters</Text>
            </View>
            <View style={styles.filterSearchBox}>
              <MaterialCommunityIcons color="#747474" name="magnify" size={20} />
              <Text style={styles.filterSearchPlaceholder}>Search across filters...</Text>
            </View>
            {selectedFilters.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.selectedFiltersRow}
                contentContainerStyle={styles.selectedFiltersContent}>
                {selectedFilters.map(filterId => {
                  const selectedOption = Object.values(filterOptionsBySection)
                    .flat()
                    .find(option => option.id === filterId);

                  if (!selectedOption) {
                    return null;
                  }

                  return (
                    <Pressable
                      key={filterId}
                      onPress={() => toggleFilter(filterId)}
                      style={styles.selectedFilterChip}>
                      <Text style={styles.selectedFilterChipText}>
                        {selectedOption.title}
                      </Text>
                      <MaterialCommunityIcons
                        color="#2f9a35"
                        name="close"
                        size={14}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <View style={styles.filterBody}>
              <View style={styles.filterSidebarPane}>
                {filterSections.map(section => {
                  const isActive = section === selectedFilterSection;

                  return (
                    <Pressable
                      key={section}
                      onPress={() => setSelectedFilterSection(section)}
                      style={[
                        styles.filterSidebarItem,
                        isActive && styles.filterSidebarItemActive,
                      ]}>
                      {isActive ? <View style={styles.filterSidebarActiveBar} /> : null}
                      <Text
                        style={[
                          styles.filterSidebarText,
                          isActive && styles.filterSidebarTextActive,
                        ]}>
                        {section}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <ScrollView
                contentContainerStyle={styles.filterOptionsList}
                showsVerticalScrollIndicator={false}
                style={styles.filterOptionsPane}>
                {currentFilterOptions.map(option => (
                  <View key={option.id} style={styles.filterOptionRow}>
                    <View style={styles.filterOptionInfo}>
                      {option.image ? (
                        <Image source={{uri: option.image}} style={styles.filterOptionImage} />
                      ) : null}
                      <Text
                        style={[
                          styles.filterOptionText,
                          !option.image && styles.filterOptionTextNoImage,
                        ]}>
                        {option.title} ({option.count})
                      </Text>
                    </View>
                    <Pressable
                      hitSlop={8}
                      onPress={() => toggleFilter(option.id)}
                      style={[
                        styles.filterCheckbox,
                        selectedFilters.includes(option.id) && styles.filterCheckboxSelected,
                      ]}>
                      {selectedFilters.includes(option.id) ? (
                        <MaterialCommunityIcons color="#ffffff" name="check" size={14} />
                      ) : null}
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterFooter}>
              <Pressable
                onPress={() => setSelectedFilters([])}
                style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Clear Filter</Text>
              </Pressable>
              <Pressable
                onPress={() => setFiltersVisible(false)}
                style={
                  selectedFilters.length > 0
                    ? styles.applyButton
                    : styles.applyButtonDisabled
                }>
                <Text
                  style={
                    selectedFilters.length > 0
                      ? styles.applyButtonText
                      : styles.applyButtonDisabledText
                  }>
                  Apply
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setSortVisible(false)}
        transparent
        visible={sortVisible}>
        <View style={styles.modalOverlay}>
          <Pressable
            onPress={() => setSortVisible(false)}
            style={styles.modalBackdrop}
          />
          <Pressable
            onPress={() => setSortVisible(false)}
            style={styles.floatingCloseButton}>
            <MaterialCommunityIcons color="#ffffff" name="close" size={20} />
          </Pressable>
          <View style={[styles.sortSheet, {paddingBottom: insets.bottom + 16}]}>
            <Text style={styles.sortSheetTitle}>Sort by</Text>
            <View style={styles.sortDivider} />

            {sortOptions.map(option => {
              const isSelected = option === selectedSort;

              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    setSelectedSort(option);
                    setSortVisible(false);
                  }}
                  style={styles.sortOptionRow}>
                  <View style={styles.sortRadioOuter}>
                    {isSelected ? <View style={styles.sortRadioInner} /> : null}
                  </View>
                  <Text
                    style={[
                      styles.sortOptionText,
                      isSelected && styles.sortOptionTextSelected,
                    ]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {wishlistToastVisible ? (
        <View
          pointerEvents="box-none"
          style={[styles.toastWrap, {bottom: insets.bottom + 18}]}>
          <View style={styles.toast}>
            <Text style={styles.toastText}>Added to wishlist</Text>
            <Pressable
              onPress={() => {
                setWishlistToastVisible(false);
                navigation.navigate('Wishlist');
              }}
              style={styles.toastAction}>
              <Text style={styles.toastActionText}>See all items</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#efefef',
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  headerTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  iconButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  backArrow: {
    color: '#212121',
    fontSize: 30,
    lineHeight: 30,
    marginTop: -3,
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 6,
    marginRight: 8,
  },
  headerTitle: {
    color: '#232323',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#5f8d3b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  headerActionButton: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    marginLeft: 4,
    width: 34,
  },
  contentWrap: {
    backgroundColor: '#edf5d8',
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    backgroundColor: '#f4f5f8',
    borderRightColor: '#e4e7eb',
    borderRightWidth: 1,
    width: 74,
  },
  sidebarContent: {
    paddingBottom: 18,
    paddingTop: 10,
  },
  sidebarItem: {
    alignItems: 'center',
    minHeight: 86,
    paddingHorizontal: 6,
    paddingVertical: 8,
    position: 'relative',
  },
  sidebarItemActive: {
    backgroundColor: '#ffffff',
  },
  sidebarActiveBar: {
    backgroundColor: '#249b2d',
    borderRadius: 10,
    bottom: 6,
    position: 'absolute',
    right: 0,
    top: 6,
    width: 4,
  },
  sidebarImageWrap: {
    alignItems: 'center',
    backgroundColor: '#eef1f7',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  sidebarImageWrapActive: {
    backgroundColor: '#fff7e9',
  },
  sidebarImage: {
    borderRadius: 20,
    height: 34,
    width: 34,
  },
  sidebarLabel: {
    color: '#7d7f84',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  sidebarLabelActive: {
    color: '#1f1f1f',
    fontWeight: '700',
  },
  mainContent: {
    flex: 1,
  },
  mainScrollContent: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  filterRow: {
    flexGrow: 0,
  },
  filterRowContent: {
    gap: 8,
    paddingBottom: 8,
    paddingRight: 8,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e9e9e9',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 38,
    paddingHorizontal: 14,
  },
  filterChipText: {
    color: '#343434',
    fontSize: 13,
    fontWeight: '500',
  },
  banner: {
    alignItems: 'center',
    backgroundColor: '#eaf5c8',
    borderRadius: 14,
    flexDirection: 'row',
    marginBottom: 10,
    overflow: 'hidden',
    paddingLeft: 12,
  },
  bannerTextWrap: {
    flex: 1,
    paddingVertical: 14,
  },
  bannerTitle: {
    color: '#212121',
    fontSize: 17,
    fontWeight: '800',
  },
  bannerSubtitle: {
    color: '#5a5e52',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  bannerImage: {
    height: 82,
    marginRight: -4,
    width: 108,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderColor: '#d7e3c0',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
    paddingBottom: 10,
    width: '48.5%',
  },
  productImageWrap: {
    backgroundColor: '#f3e5cf',
    height: 148,
    position: 'relative',
  },
  productImage: {
    height: '100%',
    width: '100%',
  },
  wishlistButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 28,
  },
  wishlistIcon: {
    color: '#7a7a7a',
    fontSize: 14,
  },
  productMetaHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  productUnit: {
    color: '#363636',
    fontSize: 11,
    fontWeight: '700',
  },
  productPack: {
    color: '#767676',
    fontSize: 11,
    marginTop: 2,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#8fc66c',
    borderRadius: 12,
    borderWidth: 1.5,
    height: 38,
    justifyContent: 'center',
    minWidth: 60,
  },
  addButtonText: {
    color: '#2c9f3b',
    fontSize: 14,
    fontWeight: '800',
  },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  priceText: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 30,
  },
  mrpText: {
    color: '#888888',
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  productName: {
    color: '#343434',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
    minHeight: 38,
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  infoText: {
    color: '#6a6a6a',
    fontSize: 10,
    fontWeight: '500',
  },
  seeAllButton: {
    alignItems: 'center',
    backgroundColor: '#f6f1ff',
    borderRadius: 12,
    marginTop: 6,
    paddingVertical: 14,
  },
  seeAllButtonDisabled: {
    backgroundColor: '#efefef',
  },
  seeAllText: {
    color: '#595089',
    fontSize: 13,
    fontWeight: '700',
  },
  seeAllTextDisabled: {
    color: '#7e7e7e',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  floatingCloseButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#31343b',
    borderRadius: 24,
    height: 46,
    justifyContent: 'center',
    marginBottom: 10,
    width: 46,
  },
  filterSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '78%',
    paddingTop: 16,
  },
  filterSheetHeader: {
    paddingHorizontal: 10,
  },
  filterSheetTitle: {
    color: '#202020',
    fontWeight: '700',
    fontSize: 28,
  },
  filterSearchBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e6e6e6',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: 10,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  filterSearchPlaceholder: {
    color: '#9b9b9b',
    fontSize: 15,
    marginLeft: 8,
  },
  selectedFiltersRow: {
    flexGrow: 0,
    marginTop: 10,
  },
  selectedFiltersContent: {
    gap: 8,
    paddingHorizontal: 10,
  },
  selectedFilterChip: {
    alignItems: 'center',
    backgroundColor: '#eef8e9',
    borderColor: '#79b86b',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedFilterChipText: {
    color: '#2f9a35',
    fontSize: 13,
    fontWeight: '600',
  },
  filterBody: {
    backgroundColor: '#ffffff',
    borderColor: '#ececec',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    marginHorizontal: 10,
    marginTop: 12,
    overflow: 'hidden',
  },
  filterSidebarPane: {
    backgroundColor: '#f5f5f7',
    width: 96,
  },
  filterSidebarItem: {
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 14,
    position: 'relative',
  },
  filterSidebarItemActive: {
    backgroundColor: '#eef8e9',
  },
  filterSidebarActiveBar: {
    backgroundColor: '#2ba12f',
    borderRadius: 10,
    bottom: 8,
    position: 'absolute',
    right: 0,
    top: 8,
    width: 4,
  },
  filterSidebarText: {
    color: '#4e4e4e',
    fontSize: 13,
    fontWeight: '500',
  },
  filterSidebarTextActive: {
    color: '#2f9a35',
    fontWeight: '700',
  },
  filterOptionsPane: {
    flex: 1,
  },
  filterOptionsList: {
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  filterOptionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  filterOptionInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    paddingRight: 10,
  },
  filterOptionImage: {
    borderRadius: 9,
    height: 28,
    marginRight: 10,
    width: 28,
  },
  filterOptionText: {
    color: '#3e3e3e',
    fontSize: 14,
    fontWeight: '500',
  },
  filterOptionTextNoImage: {
    marginLeft: 0,
  },
  filterCheckbox: {
    borderColor: '#5aa73d',
    borderRadius: 2,
    borderWidth: 2,
    justifyContent: 'center',
    height: 20,
    alignItems: 'center',
    width: 20,
  },
  filterCheckboxSelected: {
    backgroundColor: '#56aa39',
  },
  filterFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 10,
  },
  clearButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#79b86b',
    borderRadius: 16,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  clearButtonText: {
    color: '#b4b4b4',
    fontSize: 14,
    fontWeight: '700',
  },
  applyButtonDisabled: {
    alignItems: 'center',
    backgroundColor: '#d7dde9',
    borderRadius: 16,
    flex: 1.2,
    justifyContent: 'center',
    minHeight: 50,
  },
  applyButtonDisabledText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  sortSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
  },
  sortSheetTitle: {
    color: '#212121',
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 12,
  },
  sortDivider: {
    backgroundColor: '#ececec',
    height: 1,
    marginTop: 16,
  },
  sortOptionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 12,
  },
  sortRadioOuter: {
    alignItems: 'center',
    borderColor: '#3ca236',
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    marginRight: 14,
    width: 22,
  },
  sortRadioInner: {
    backgroundColor: '#3ca236',
    borderRadius: 6,
    height: 10,
    width: 10,
  },
  sortOptionText: {
    color: '#5a5a5a',
    fontSize: 15,
    fontWeight: '500',
  },
  sortOptionTextSelected: {
    color: '#1e1e1e',
    fontWeight: '600',
  },
  applyButton: {
    alignItems: 'center',
    backgroundColor: '#2ea83c',
    borderRadius: 16,
    flex: 1.2,
    justifyContent: 'center',
    minHeight: 50,
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  toastWrap: {
    left: 0,
    paddingHorizontal: 14,
    position: 'absolute',
    right: 0,
  },
  toast: {
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  toastAction: {
    marginLeft: 14,
  },
  toastActionText: {
    color: '#f5c400',
    fontSize: 14,
    fontWeight: '800',
  },
});
