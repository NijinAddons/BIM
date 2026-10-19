import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type { CategoryItem } from '../services';
import { CARD, HAIRLINE, NAVY } from '../theme/colors';

// Same palette as the product grid screens.
const BRAND_NAVY = '#1F2E3D';
const ACCENT_TEAL = '#2ECFC0';
const MUTED = '#8A94A3';
const FIELD = '#F4F6F8';

const GUTTER = 16;

export type ProductSort = 'featured' | 'priceAsc' | 'priceDesc';

type FilterChoice = { group: string | null; sort: ProductSort };

const DEFAULT_CHOICE: FilterChoice = { group: null, sort: 'featured' };

const SORT_OPTIONS: { label: string; value: ProductSort }[] = [
  { label: 'Featured', value: 'featured' },
  { label: 'Price: low to high', value: 'priceAsc' },
  { label: 'Price: high to low', value: 'priceDesc' },
];

function applyFilters(
  items: CategoryItem[],
  query: string,
  { group, sort }: FilterChoice,
): CategoryItem[] {
  const needle = query.trim().toLowerCase();
  const filtered = items.filter(
    item =>
      (!group || item.itemGroup === group) &&
      (!needle ||
        item.name.toLowerCase().includes(needle) ||
        (item.brand ?? '').toLowerCase().includes(needle)),
  );
  if (sort === 'featured') {
    return filtered;
  }
  return [...filtered].sort((a, b) =>
    sort === 'priceAsc' ? a.price - b.price : b.price - a.price,
  );
}

/**
 * Search, category and sort state for a product grid. Pass the result to
 * `ProductFilterBar` and render `visibleItems`.
 */
export function useProductFilters(items: CategoryItem[]) {
  const [query, setQuery] = useState('');
  const [choice, setChoice] = useState<FilterChoice>(DEFAULT_CHOICE);

  // Item groups present in this list, most products first.
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach(item => {
      if (item.itemGroup) {
        counts.set(item.itemGroup, (counts.get(item.itemGroup) ?? 0) + 1);
      }
    });
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [items]);

  const visibleItems = useMemo(
    () => applyFilters(items, query, choice),
    [items, query, choice],
  );

  const clear = useCallback(() => {
    setQuery('');
    setChoice(DEFAULT_CHOICE);
  }, []);

  return {
    activeCount: (choice.group ? 1 : 0) + (choice.sort !== 'featured' ? 1 : 0),
    choice,
    clear,
    groups,
    isFiltering: query.trim() !== '' || choice.group !== null,
    items,
    query,
    setChoice,
    setQuery,
    visibleItems,
  };
}

export type ProductFilters = ReturnType<typeof useProductFilters>;

type BarProps = {
  filters: ProductFilters;
  /** Search box placeholder, e.g. "Search in Acme Store". */
  placeholder?: string;
  /** Hide the search box, leaving just the count and Filter button. */
  showSearch?: boolean;
  /** Heading shown above the product count, e.g. "All products". */
  title?: string;
  /** Replaces the product count line, e.g. while the list is reloading. */
  countText?: string;
};

/** Search box plus a "Filter" button that opens the sort/category sheet. */
export function ProductFilterBar({
  filters,
  placeholder,
  showSearch = true,
  title,
  countText,
}: BarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { activeCount, isFiltering, items, query, setQuery, visibleItems } =
    filters;

  return (
    <View>
      {showSearch ? (
        <View style={styles.searchBox}>
          <MaterialCommunityIcons color={MUTED} name="magnify" size={20} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor={MUTED}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <TouchableOpacity
              accessibilityLabel="Clear search"
              hitSlop={8}
              onPress={() => setQuery('')}
            >
              <MaterialCommunityIcons
                color={MUTED}
                name="close-circle"
                size={18}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.barRow, !showSearch && styles.barRowAlone]}>
        <View style={styles.headingBlock}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <Text style={title ? styles.subCount : styles.count}>
            {countText ??
              (isFiltering
                ? `${visibleItems.length} of ${items.length} products`
                : `${items.length} products`)}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityLabel={
            activeCount
              ? `Filters, ${activeCount} applied`
              : 'Filter and sort products'
          }
          activeOpacity={0.7}
          hitSlop={8}
          onPress={() => setSheetOpen(true)}
          style={[styles.filterButton, activeCount > 0 && styles.filterActive]}
        >
          <MaterialCommunityIcons
            color={activeCount > 0 ? '#ffffff' : BRAND_NAVY}
            name="tune-variant"
            size={15}
          />
          <Text
            style={[
              styles.filterText,
              activeCount > 0 && styles.filterTextActive,
            ]}
          >
            Filter
          </Text>
          {activeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <FilterSheet
        filters={filters}
        onClose={() => setSheetOpen(false)}
        visible={sheetOpen}
      />
    </View>
  );
}

type SheetProps = {
  filters: ProductFilters;
  onClose: () => void;
  visible: boolean;
};

/**
 * Picks are a draft until "Show N products" applies them; closing the sheet
 * any other way discards them.
 */
function FilterSheet({ filters, onClose, visible }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { choice, groups, items, query, setChoice } = filters;
  const [draft, setDraft] = useState(choice);
  const single = groups.length === 1;

  const matchCount = useMemo(
    () => applyFilters(items, query, draft).length,
    [items, query, draft],
  );

  const apply = () => {
    setChoice(draft);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setDraft(choice)}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <TouchableOpacity
              disabled={
                draft.group === null && draft.sort === DEFAULT_CHOICE.sort
              }
              hitSlop={8}
              onPress={() => setDraft(DEFAULT_CHOICE)}
            >
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>Sort by</Text>
            {SORT_OPTIONS.map(option => {
              const selected = draft.sort === option.value;
              return (
                <TouchableOpacity
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  activeOpacity={0.7}
                  key={option.value}
                  onPress={() =>
                    setDraft(current => ({ ...current, sort: option.value }))
                  }
                  style={styles.radioRow}
                >
                  <MaterialCommunityIcons
                    color={selected ? ACCENT_TEAL : MUTED}
                    name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={22}
                  />
                  <Text
                    style={[styles.radioText, selected && styles.radioTextOn]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {groups.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, styles.sectionGap]}>
                  Category
                </Text>
                <View style={styles.chipWrap}>
                  {/* A single category is shown already selected, as
                      there's nothing else to pick. */}
                  {(single
                    ? groups
                    : [{ name: null, count: items.length }, ...groups]
                  ).map(group => {
                    const selected = single || draft.group === group.name;
                    return (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={single}
                        key={group.name ?? 'all'}
                        onPress={() =>
                          setDraft(current => ({
                            ...current,
                            group: group.name,
                          }))
                        }
                        style={[styles.chip, selected && styles.chipOn]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selected && styles.chipTextOn,
                          ]}
                        >
                          {group.name ?? 'All'}
                        </Text>
                        <Text
                          style={[
                            styles.chipCount,
                            selected && styles.chipCountOn,
                          ]}
                        >
                          {group.count}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={matchCount === 0}
            onPress={apply}
            style={[styles.applyButton, matchCount === 0 && styles.applyOff]}
          >
            <Text style={styles.applyText}>
              {matchCount === 0
                ? 'No matching products'
                : `Show ${matchCount} ${
                    matchCount === 1 ? 'product' : 'products'
                  }`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /* Bar */
  searchBox: {
    alignItems: 'center',
    backgroundColor: FIELD,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: GUTTER,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: BRAND_NAVY,
    flex: 1,
    fontSize: 14,
    paddingVertical: 11,
  },
  barRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 12,
    paddingHorizontal: GUTTER,
  },
  barRowAlone: {
    marginTop: 0,
  },
  headingBlock: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    color: BRAND_NAVY,
    fontSize: 17,
    fontWeight: '900',
  },
  subCount: {
    color: MUTED,
    fontSize: 12.5,
    fontWeight: '700',
  },
  count: {
    color: BRAND_NAVY,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  filterButton: {
    alignItems: 'center',
    borderColor: '#DCE1E6',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterActive: {
    backgroundColor: BRAND_NAVY,
    borderColor: BRAND_NAVY,
  },
  filterText: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  badge: {
    alignItems: 'center',
    backgroundColor: ACCENT_TEAL,
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 5,
  },
  badgeText: {
    color: BRAND_NAVY,
    fontSize: 11,
    fontWeight: '900',
  },

  /* Sheet */
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
    maxHeight: '80%',
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
    marginBottom: 14,
    width: 40,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: {
    color: BRAND_NAVY,
    fontSize: 19,
    fontWeight: '900',
  },
  clearText: {
    color: ACCENT_TEAL,
    fontSize: 14,
    fontWeight: '800',
  },
  sheetContent: {
    paddingBottom: 16,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  sectionGap: {
    marginTop: 18,
  },
  radioRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  radioText: {
    color: BRAND_NAVY,
    fontSize: 15,
    fontWeight: '500',
  },
  radioTextOn: {
    fontWeight: '800',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: FIELD,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: BRAND_NAVY,
  },
  chipText: {
    color: BRAND_NAVY,
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextOn: {
    color: '#ffffff',
  },
  chipCount: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  chipCountOn: {
    color: ACCENT_TEAL,
  },
  applyButton: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    borderRadius: 14,
    paddingVertical: 15,
  },
  applyOff: {
    opacity: 0.45,
  },
  applyText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
