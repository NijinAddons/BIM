import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {colors} from '../theme/colors';

type ScreenHeaderProps = {
  title: string;
  titleIcon?: ImageSourcePropType;
  leadingIcon?: ImageSourcePropType;
  collapseLeadingSpace?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  titleStyle?: object;
  onBackPress?: () => void;
  plainBackButton?: boolean;
  actions?: {
    icon: string;
    label: string;
    color?: string;
    onPress: () => void;
  }[];
};

export default function ScreenHeader({
  title,
  titleIcon,
  leadingIcon,
  collapseLeadingSpace = false,
  containerStyle,
  titleStyle,
  onBackPress,
  plainBackButton = false,
  actions = [],
}: ScreenHeaderProps) {
  return (
    <View style={[styles.header, containerStyle]}>
      {onBackPress ? (
        <Pressable
          hitSlop={10}
          onPress={onBackPress}
          style={plainBackButton ? styles.backButtonPlain : styles.backButton}>
          <MaterialCommunityIcons color={colors.text} name="arrow-left" size={22} />
        </Pressable>
      ) : leadingIcon ? (
        <Image source={leadingIcon} style={styles.leadingIcon} />
      ) : (
        <View style={collapseLeadingSpace ? styles.headerSpacerCollapsed : styles.headerSpacer} />
      )}
      <View style={styles.titleWrap}>
        {titleIcon ? <Image source={titleIcon} style={styles.titleIcon} /> : null}
        <Text numberOfLines={1} style={[styles.headerTitle, titleStyle]}>
          {title}
        </Text>
      </View>
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
  backButtonPlain: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  titleWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    marginHorizontal: 12,
  },
  titleIcon: {
    borderRadius: 10,
    height: 28,
    marginRight: 8,
    width: 28,
  },
  leadingIcon: {
    borderRadius: 10,
    height: 36,
    width: 36,
  },
  headerTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'left',
  },
  headerSpacer: {
    width: 36,
  },
  headerSpacerCollapsed: {
    width: 0,
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
