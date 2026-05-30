import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Pressable, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import {getCartItems, getLastCartAddition, subscribeCartAdditions} from '../service';

export default function CartAddToast() {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [addition, setAddition] = React.useState(getLastCartAddition());
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    return subscribeCartAdditions(() => {
      setAddition(getLastCartAddition());
      setVisible(true);
    });
  }, []);

  if (!visible || !addition) {
    return null;
  }

  const totalItemCount = getCartItems().reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View style={[styles.wrap, {bottom: insets.bottom + 84}]}>
        <View
          accessibilityRole="alert"
          style={[styles.toast, {maxWidth: Math.min(width - 24, 360)}]}>
          <View style={styles.copyWrap}>
            <Text numberOfLines={1} style={styles.title}>
              View Cart
            </Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} in cart
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setVisible(false);
              navigation.navigate('MainTabs', {screen: 'Cart'});
            }}
            style={({pressed}) => [styles.action, pressed && styles.actionPressed]}>
            <Text style={styles.actionText}>View Cart</Text>
          </Pressable>
        </View>
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
    alignItems: 'center',
    backgroundColor: '#1f9d55',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minWidth: 220,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  copyWrap: {
    flex: 1,
    marginRight: 12,
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
  action: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  actionPressed: {
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  actionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
