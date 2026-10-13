import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {BORDER, CARD, MUTED, TEXT} from '../theme/colors';
import {iconBox} from '../theme/layout';

export type ListCardItem = {
  caption?: string;
  icon: string;
  key: string;
  label: string;
};

type Props<T extends ListCardItem> = {
  items: T[];
  onPress: (item: T) => void;
  /** Right-aligned text per row, keyed by `item.key`. */
  values?: Partial<Record<string, string>>;
};

/** A bordered card of tappable rows: icon, label, optional caption/value. */
export default function ListCard<T extends ListCardItem>({
  items,
  onPress,
  values,
}: Props<T>) {
  return (
    <View style={styles.card}>
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onPress(item)}
            style={styles.row}>
            <View style={styles.icon}>
              <MaterialCommunityIcons color={TEXT} name={item.icon} size={20} />
            </View>
            <View style={styles.text}>
              <Text style={styles.label}>{item.label}</Text>
              {item.caption ? (
                <Text style={styles.caption}>{item.caption}</Text>
              ) : null}
            </View>
            {values?.[item.key] ? (
              <Text style={styles.value}>{values[item.key]}</Text>
            ) : null}
            <MaterialCommunityIcons
              color={MUTED}
              name="chevron-right"
              size={20}
            />
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
}

export function SectionTitle({title}: {title: string}) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderRadius: 18,
    borderWidth: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  icon: {
    ...iconBox(38, 10, '#F1F3F5'),
    marginRight: 14,
  },
  text: {
    flex: 1,
  },
  label: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '600',
  },
  caption: {
    color: MUTED,
    fontSize: 12.5,
    marginTop: 2,
  },
  value: {
    color: MUTED,
    fontSize: 13.5,
    marginRight: 8,
  },
  divider: {
    backgroundColor: '#EEF0F2',
    height: 1,
  },
  sectionTitle: {
    color: MUTED,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 12,
    marginTop: 18,
    textTransform: 'uppercase',
  },
});
