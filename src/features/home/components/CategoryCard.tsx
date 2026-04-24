import React from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {colors} from '../../../theme/colors';
import {Category} from '../../product/types';

type Props = {
  item: Category;
  onPress?: () => void;
  selected?: boolean;
};

export default function CategoryCard({item, onPress, selected = false}: Props) {
  const imageByCategory: Record<string, string> = {
    All: 'https://loremflickr.com/200/200/grocery,store',
    'Dairy & Eggs': 'https://loremflickr.com/200/200/dairy,eggs,milk',
    Fruits: 'https://loremflickr.com/200/200/fresh,fruits',
    Beverages: 'https://loremflickr.com/200/200/beverages,drinks',
    Snacks: 'https://loremflickr.com/200/200/snacks,chips',
    'Meat & Seafood': 'https://loremflickr.com/200/200/meat,seafood',
    Bakery: 'https://loremflickr.com/200/200/bakery,bread',
    Vegetables: 'https://loremflickr.com/200/200/vegetables,fresh',
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View
        style={[
          styles.thumb,
          {backgroundColor: item.tone},
          selected && styles.thumbSelected,
        ]}>
        <Image
          source={{uri: imageByCategory[item.name]}}
          style={styles.coverImage}
        />
      </View>
      <Text style={[styles.name, selected && styles.nameSelected]}>{item.name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    marginRight: 12,
    width: 84,
  },
  thumb: {
    alignItems: 'center',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    width: 64,
  },
  thumbSelected: {
    borderColor: '#121212',
    borderWidth: 2,
  },
  coverImage: {
    height: '100%',
    width: '100%',
  },
  name: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  nameSelected: {
    color: '#121212',
  },
});
