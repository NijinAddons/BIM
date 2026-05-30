import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import CategoryCard from '../components/CategoryCard';
import {getUserProfile, subscribeProfile} from '../../profile/service';
import {fetchProducts, loadStoredProductCache} from '../../product/service';
import type {Category} from '../../product/service';

const TABLET_BREAKPOINT = 768;
const COORDINATE_LOCATION_PATTERN =
  /^Current location \((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/;

type CategoriesNavProp = NativeStackNavigationProp<RootStackParamList>;

const categoryTones = ['#ececec', '#dff0ff', '#ffe7c8', '#d9f6de', '#ffe2ef', '#f7e9ce'];

const prettifyCategorySubtitle = (name: string) => {
  if (name.toLowerCase().includes('organic')) {
    return 'Organic picks';
  }

  if (name.toLowerCase().includes('fruit') || name.toLowerCase().includes('veg')) {
    return 'Fresh picks';
  }

  return 'Browse items';
};

const getCategoriesLocationLabel = (address: string) => {
  const trimmedAddress = address.trim();

  if (!trimmedAddress || COORDINATE_LOCATION_PATTERN.test(trimmedAddress)) {
    return 'Select delivery location';
  }

  if (trimmedAddress.length > 48) {
    return `${trimmedAddress.slice(0, 48).trimEnd()}...`;
  }

  return trimmedAddress;
};

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const {width: windowWidth} = useWindowDimensions();
  const navigation = useNavigation<CategoriesNavProp>();
  const profile = React.useSyncExternalStore(
    subscribeProfile,
    getUserProfile,
    getUserProfile,
  );
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categories, setCategories] = React.useState<Category[]>([]);
  const isTablet = windowWidth >= TABLET_BREAKPOINT;
  const categoryColumns = isTablet ? 5 : 3;
  const displayedLocation = getCategoriesLocationLabel(profile.address);

  React.useEffect(() => {
    let isMounted = true;

    const mapCategories = (groupNames: string[]) =>
      groupNames.map((name, index) => ({
        id: `${index}-${name}`,
        name,
        subtitle: prettifyCategorySubtitle(name),
        tone: categoryTones[index % categoryTones.length],
      }));

    const loadCategories = async () => {
      const storedProducts = await loadStoredProductCache();
      const storedGroups = Array.from(
        new Set(
          storedProducts
            .map(product => product.itemGroup?.trim())
            .filter((itemGroup): itemGroup is string => Boolean(itemGroup)),
        ),
      );

      if (isMounted && storedGroups.length > 0) {
        setCategories(mapCategories(storedGroups));
      }

      const nextProducts = await fetchProducts({fallbackToMock: true});
      const nextGroups = Array.from(
        new Set(
          nextProducts
            .map(product => product.itemGroup?.trim())
            .filter((itemGroup): itemGroup is string => Boolean(itemGroup)),
        ),
      );

      if (isMounted) {
        setCategories(mapCategories(nextGroups));
      }
    };

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleCategories = categories.filter(item =>
    searchQuery.trim()
      ? item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      : true,
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F1C309" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: insets.bottom + 28},
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.headerBlock, {paddingTop: insets.top + 6}]}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.title}>Buy In Minutes</Text>
            <Text numberOfLines={1} style={styles.locationText}>
              {displayedLocation}
            </Text>
          </View>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons color="#7d6b41" name="magnify" size={20} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchQuery}
              placeholder="Search for categories"
              placeholderTextColor="#8a8376"
              style={styles.searchInput}
              value={searchQuery}
            />
            {searchQuery.length > 0 ? (
              <Pressable
                hitSlop={8}
                onPress={() => setSearchQuery('')}
                style={styles.clearButton}>
                <MaterialCommunityIcons color="#7d6b41" name="close" size={16} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.grid}>
            {visibleCategories.map(item => (
              <View
                key={item.id}
                style={[
                  styles.cardWrap,
                  categoryColumns === 5
                    ? styles.cardWrapTablet
                    : styles.cardWrapMobile,
                ]}>
                <CategoryCard
                  item={item}
                  onPress={() =>
                    navigation.navigate('CategoryDetails', {
                      categoryTitle: item.name,
                      sectionTitle: item.subtitle,
                    })
                  }
                />
              </View>
            ))}
          </View>
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
    backgroundColor: '#F1C309',
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerTitleBlock: {
    marginBottom: 12,
  },
  title: {
    color: '#1b1b1b',
    fontSize: 24,
    fontWeight: '900',
  },
  locationText: {
    color: '#5A3D00',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: '#fff8e6',
    borderColor: '#e7d6a8',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    color: '#3a3328',
    flex: 1,
    fontSize: 14,
    marginLeft: 10,
    paddingVertical: 0,
  },
  clearButton: {
    alignItems: 'center',
    backgroundColor: '#f2e7c0',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  cardWrapMobile: {
    width: '31%',
  },
  cardWrapTablet: {
    width: '19.4%',
  },
});
