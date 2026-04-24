import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {colors} from '../../../theme/colors';

type Props = {
  title: string;
  action?: string;
};

export default function SectionHeader({title, action = 'See all'}: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity>
        <Text style={styles.action}>{action}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  action: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },
});
