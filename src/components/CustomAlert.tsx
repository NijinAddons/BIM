import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  BORDER,
  CARD,
  GREEN,
  GREEN_TINT,
  MUTED,
  SURFACE,
  TEXT,
} from '../theme/colors';

const DANGER = '#D92D20';
const DANGER_TINT = '#FEECEB';

type Variant = 'primary' | 'destructive';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  /** MaterialCommunityIcons name; defaults to one matching the variant. */
  icon?: string;
  buttonLabel?: string;
  primaryButtonLabel?: string;
  secondaryButtonLabel?: string;
  primaryButtonVariant?: Variant;
  onButtonPress?: () => void;
  onPrimaryButtonPress?: () => void;
  onSecondaryButtonPress?: () => void;
  onClose: () => void;
};

const DEFAULT_ICON: Record<Variant, string> = {
  primary: 'information-variant',
  destructive: 'trash-can-outline',
};

export default function CustomAlert({
  visible,
  title,
  message,
  icon,
  buttonLabel,
  primaryButtonLabel = 'Okay',
  secondaryButtonLabel,
  primaryButtonVariant = 'primary',
  onButtonPress,
  onPrimaryButtonPress,
  onSecondaryButtonPress,
  onClose,
}: Props) {
  const resolvedPrimaryButtonLabel = buttonLabel ?? primaryButtonLabel;
  const resolvedPrimaryButtonPress = onPrimaryButtonPress ?? onButtonPress;
  const destructive = primaryButtonVariant === 'destructive';
  const accent = destructive ? DANGER : GREEN;

  // The card pops in slightly scaled down while the Modal fades the backdrop.
  const scale = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    if (visible) {
      scale.setValue(0.9);
      Animated.spring(scale, {
        friction: 7,
        tension: 90,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [scale, visible]);

  const handlePrimaryButtonPress = () => {
    onClose();
    resolvedPrimaryButtonPress?.();
  };

  const handleSecondaryButtonPress = () => {
    onClose();
    onSecondaryButtonPress?.();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <TouchableOpacity
            accessibilityLabel="Close"
            hitSlop={10}
            onPress={onClose}
            style={styles.closeButton}>
            <MaterialCommunityIcons color={MUTED} name="close" size={20} />
          </TouchableOpacity>

          <View
            style={[
              styles.iconRing,
              { backgroundColor: destructive ? DANGER_TINT : GREEN_TINT },
            ]}>
            <View style={[styles.iconCore, { backgroundColor: accent }]}>
              <MaterialCommunityIcons
                color="#ffffff"
                name={icon ?? DEFAULT_ICON[primaryButtonVariant]}
                size={26}
              />
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {secondaryButtonLabel ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSecondaryButtonPress}
                style={[styles.button, styles.secondaryButton]}>
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  {secondaryButtonLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePrimaryButtonPress}
              style={[styles.button, { backgroundColor: accent }]}>
              <Text style={styles.buttonText}>{resolvedPrimaryButtonLabel}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 24, 40, 0.5)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 24,
    elevation: 16,
    maxWidth: 340,
    paddingBottom: 20,
    paddingHorizontal: 22,
    paddingTop: 28,
    shadowColor: '#081828',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    width: '100%',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
    top: 14,
    width: 32,
  },
  iconRing: {
    alignItems: 'center',
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    marginBottom: 18,
    width: 80,
  },
  iconCore: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  title: {
    color: TEXT,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  button: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  secondaryButton: {
    backgroundColor: SURFACE,
    borderColor: BORDER,
    borderWidth: 1,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: TEXT,
  },
});
