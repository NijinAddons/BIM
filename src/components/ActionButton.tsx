import React, {ReactNode} from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

type ActionButtonVariant = 'primary' | 'secondary' | 'dark';

type Props = {
  accessory?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  loadingColor?: string;
  onPress?: ((event: GestureResponderEvent) => void) | undefined;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: ActionButtonVariant;
};

const variantStyles: Record<
  ActionButtonVariant,
  {
    button: ViewStyle;
    text: TextStyle;
  }
> = {
  primary: {
    button: {
      backgroundColor: '#171717',
      borderWidth: 0,
    },
    text: {
      color: '#ffffff',
    },
  },
  secondary: {
    button: {
      backgroundColor: '#ffffff',
      borderColor: '#e8e8e8',
      borderWidth: 1,
    },
    text: {
      color: '#202020',
    },
  },
  dark: {
    button: {
      backgroundColor: '#111111',
      borderColor: '#111111',
      borderWidth: 1,
    },
    text: {
      color: '#ffffff',
    },
  },
};

export default function ActionButton({
  accessory,
  active = true,
  disabled = false,
  label,
  loading = false,
  loadingColor,
  onPress,
  style,
  textStyle,
  variant = 'primary',
}: Props) {
  const resolvedVariant = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.button,
        resolvedVariant.button,
        variant === 'primary' && !active ? styles.primaryInactive : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}>
      <View style={styles.content}>
        {accessory}
        {loading ? (
          <ActivityIndicator
            color={loadingColor ?? (variant === 'secondary' ? '#163322' : '#ffffff')}
            size="small"
          />
        ) : null}
        <Text numberOfLines={1} style={[styles.text, resolvedVariant.text, textStyle]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.7,
  },
  primaryInactive: {
    backgroundColor: '#a2a8b9',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
});
