import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {colors} from '../../../theme/colors';

type ScreenHeaderProps = {
  title: string;
  onBackPress?: () => void;
  actions?: {
    icon: string;
    label: string;
    color?: string;
    onPress: () => void;
  }[];
};

export default function ScreenHeader({title, onBackPress, actions = []}: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      {onBackPress ? (
        <Pressable hitSlop={10} onPress={onBackPress} style={styles.backButton}>
          <MaterialCommunityIcons color={colors.text} name="arrow-left" size={22} />
        </Pressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}
      <Text numberOfLines={1} style={styles.headerTitle}>
        {title}
      </Text>
      {actions.length > 0 ? (
        <View style={styles.actionsRow}>
          {actions.map(action => (
            <Pressable
              accessibilityLabel={action.label}
              accessibilityRole="button"
              hitSlop={8}
              key={action.label}
              onPress={action.onPress}
              style={styles.actionButton}>
              <MaterialCommunityIcons
                color={action.color ?? colors.text}
                name={action.icon}
                size={21}
              />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    marginHorizontal: 12,
    textAlign: 'left',
  },
  headerSpacer: {
    width: 36,
  },
  actionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
