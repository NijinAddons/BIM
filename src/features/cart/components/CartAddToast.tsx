import React from 'react';
import {Pressable, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {getLastCartAddition, subscribeCartAdditions} from '../service';

export default function CartAddToast() {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const [addition, setAddition] = React.useState(getLastCartAddition());
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    return subscribeCartAdditions(() => {
      setAddition(getLastCartAddition());
      setVisible(true);
    });
  }, []);

  React.useEffect(() => {
    if (!visible || !addition) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setVisible(false);
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [addition, visible]);

  if (!visible || !addition) {
    return null;
  }

  const compactName =
    addition.name.length > 28 ? `${addition.name.slice(0, 28).trimEnd()}...` : addition.name;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View style={[styles.wrap, {bottom: insets.bottom + 18}]}>
        <Pressable
          accessibilityRole="alert"
          onPress={() => setVisible(false)}
          style={[styles.toast, {maxWidth: Math.min(width - 24, 360)}]}>
          <Text numberOfLines={1} style={styles.title}>
            Added to cart
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {compactName} • Qty {addition.quantity}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    left: 12,
    position: 'absolute',
    right: 12,
  },
  toast: {
    backgroundColor: '#1f9d55',
    borderRadius: 14,
    minWidth: 220,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
