import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import React from 'react';
import {Platform, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {useCartCount} from '../hooks/useCart';
import CartScreen from '../screens/cart/CartScreen';
import {
  HAIRLINE,
  TAB_BAR,
  GREEN as ACTION_GREEN,
  TEXT_VARIANT as INACTIVE_TINT,
} from '../theme/colors';
import CategoriesStack from './stacks/CategoriesStack';
import HomeStack from './stacks/HomeStack';
import OrdersStack from './stacks/OrdersStack';
import ProfileStack from './stacks/ProfileStack';
import type {MainTabParamList} from './types';

const TAB_ICONS: Record<keyof MainTabParamList, {active: string; inactive: string}> = {
  Home: {active: 'home-variant', inactive: 'home-variant-outline'},
  Categories: {active: 'shape', inactive: 'shape-outline'},
  Cart: {active: 'shopping', inactive: 'shopping-outline'},
  Orders: {active: 'package-variant', inactive: 'package-variant-closed'},
  Profile: {active: 'account-circle', inactive: 'account-circle-outline'},
};

const TAB_BAR_HEIGHT = 44;

const Tab = createBottomTabNavigator<MainTabParamList>();

// Plain Pressable in place of the default button, so tapping a tab shows no
// Android ripple or iOS opacity flash. Content is centred vertically — the
// default top-aligns it, which leaves label-less tabs sitting high.
const tabBarButton = ({ref: _ref, style, ...props}: BottomTabBarButtonProps) => (
  <Pressable {...props} android_ripple={null} style={[style, styles.tabButton]} />
);

const tabIcon =
  (name: keyof MainTabParamList) =>
  ({focused, color, size}: {focused: boolean; color: string; size: number}) => {
    const icon = TAB_ICONS[name];
    return (
      <MaterialCommunityIcons color={color} name={focused ? icon.active : icon.inactive} size={size} />
    );
  };

export default function MainTabNavigator() {
  const cartCount = useCartCount();
  const insets = useSafeAreaInsets();
  // On iOS the bar grows by half the home-indicator inset and centres its icons
  // across the full height (no bottom padding) — the icons still end well above
  // the indicator. Android reserves the full inset so tabs never overlap the
  // system nav buttons.
  const isIOS = Platform.OS === 'ios';
  const barHeight = TAB_BAR_HEIGHT + (isIOS ? insets.bottom / 2 : insets.bottom);
  const bottomPadding = isIOS ? 0 : insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: ACTION_GREEN,
        tabBarInactiveTintColor: INACTIVE_TINT,
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          backgroundColor: TAB_BAR,
          borderTopColor: HAIRLINE,
          borderTopWidth: 1,
          // Shorter than the 49pt default.
          height: barHeight,
          paddingBottom: bottomPadding,
        },
        tabBarIcon: tabIcon(route.name),
        tabBarButton,
      })}>
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Categories" component={CategoriesStack} />
      <Tab.Screen name="Orders" component={OrdersStack} />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarBadge: cartCount > 0 ? '' : undefined,
          tabBarBadgeStyle: {
            backgroundColor: ACTION_GREEN,
            minWidth: 10,
            maxHeight: 10,
            borderRadius: 5,
            transform: [{translateX: -2}, {translateY: 2}],
          },
        }}
      />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  label: {fontSize: 11, fontWeight: '700'},
  tabButton: {justifyContent: 'center'},});
