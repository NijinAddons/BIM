import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  primaryButtonLabel?: string;
  secondaryButtonLabel?: string;
  primaryButtonVariant?: 'primary' | 'destructive';
  onButtonPress?: () => void;
  onPrimaryButtonPress?: () => void;
  onSecondaryButtonPress?: () => void;
  onClose: () => void;
};

export default function CustomAlert({
  visible,
  title,
  message,
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
      transparent
      visible={visible}>
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={styles.backdrop} />
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <View style={styles.iconCore}>
              <Text style={styles.iconMark}>!</Text>
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actionsRow}>
            {secondaryButtonLabel ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleSecondaryButtonPress}
                style={[styles.button, styles.secondaryButton]}>
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  {secondaryButtonLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handlePrimaryButtonPress}
              style={[
                styles.button,
                primaryButtonVariant === 'destructive'
                  ? styles.destructiveButton
                  : styles.primaryButton,
                !secondaryButtonLabel && styles.singleButton,
              ]}>
              <Text style={styles.buttonText}>{resolvedPrimaryButtonLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 16, 13, 0.28)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#fffdf7',
    borderColor: '#e7dcc5',
    borderRadius: 28,
    borderWidth: 1,
    elevation: 12,
    maxWidth: 360,
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 22,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.15,
    shadowRadius: 22,
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#fff1bf',
    borderColor: '#f4d77f',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    marginBottom: 16,
    width: 48,
  },
  iconCore: {
    alignItems: 'center',
    backgroundColor: '#0f5c45',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  iconMark: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  title: {
    color: '#15392d',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    color: '#5a655f',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  singleButton: {
    flexGrow: 0,
    minWidth: 140,
  },
  primaryButton: {
    backgroundColor: '#0f5c45',
  },
  destructiveButton: {
    backgroundColor: '#c2410c',
  },
  secondaryButton: {
    backgroundColor: '#fff7e8',
    borderColor: '#ead7b5',
    borderWidth: 1,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: '#15392d',
  },
});
