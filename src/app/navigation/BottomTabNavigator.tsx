import {
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import CartScreen from '../../features/cart/screens/CartScreen';
import HomeScreen from '../../features/home/screens/HomeScreen';
import ProfileScreen from '../../features/profile/screens/ProfileScreen';
import SearchScreen from '../../features/search/screens/SearchScreen';
import {colors} from '../../theme/colors';
import {BottomTabParamList} from './types/root-navigation.types';

const Tab = createBottomTabNavigator<BottomTabParamList>();

const TAB_CONFIG: Record<
  keyof BottomTabParamList,
  {
    activeIcon: string;
    inactiveIcon: string;
    label: string;
  }
> = {
  Home: {
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
    label: 'Home',
  },
  Search: {
    activeIcon: 'magnify',
    inactiveIcon: 'magnify',
    label: 'Search',
  },
  Cart: {
    activeIcon: 'cart',
    inactiveIcon: 'cart-outline',
    label: 'Cart',
  },
  Profile: {
    activeIcon: 'account',
    inactiveIcon: 'account-outline',
    label: 'Profile',
  },
};

function TabBarIcon({
  color,
  focused,
  routeName,
}: {
  color: string;
  focused: boolean;
  routeName: keyof BottomTabParamList;
}) {
  const tab = TAB_CONFIG[routeName];

  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <MaterialCommunityIcons
        color={color}
        name={focused ? tab.activeIcon : tab.inactiveIcon}
        size={22}
      />
    </View>
  );
}

const getScreenOptions = ({
  route,
}: {
  route: {name: keyof BottomTabParamList};
}): BottomTabNavigationOptions => ({
  headerShown: false,
  tabBarHideOnKeyboard: true,
  tabBarActiveTintColor: colors.primaryDark,
  tabBarInactiveTintColor: '#8a8376',
  tabBarIcon: ({color, focused}) => (
    <TabBarIcon color={color} focused={focused} routeName={route.name} />
  ),
  tabBarLabel: ({focused, color}) => (
    <Text style={[styles.label, focused && styles.labelActive, {color}]}>
      {TAB_CONFIG[route.name].label}
    </Text>
  ),
  tabBarItemStyle: styles.tabItem,
  tabBarStyle: styles.tabBar,
});

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator screenOptions={getScreenOptions}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    elevation: 18,
    height: 76,
    paddingBottom: 10,
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#1b1b1b',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  tabItem: {
    borderRadius: 22,
    paddingTop: 2,
  },
  iconContainer: {
    alignItems: 'center',
    borderRadius: 16,
    height: 34,
    justifyContent: 'center',
    width: 52,
  },
  iconContainerActive: {
    backgroundColor: '#fff3bf',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  labelActive: {
    fontWeight: '800',
  },
});
