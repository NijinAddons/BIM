import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import LoginScreen from '../../features/auth/screens/LoginScreen';
import OtpScreen from '../../features/auth/screens/OtpScreen';
import SplashScreen from '../../features/auth/screens/SplashScreen';
import AddressSelectionScreen from '../../features/checkout/screens/AddressSelectionScreen';
import CategoryDetailsScreen from '../../features/home/screens/CategoryDetailsScreen';
import ProductDetailsScreen from '../../features/product/screens/ProductDetailsScreen';
import WishlistScreen from '../../features/product/screens/WishlistScreen';
import ConfirmLocationScreen from '../../features/profile/screens/ConfirmLocationScreen';
import EditProfileScreen from '../../features/profile/screens/EditProfileScreen';
import MyAddressesScreen from '../../features/profile/screens/MyAddressesScreen';
import ProfileDetailsScreen from '../../features/profile/screens/ProfileDetailsScreen';
import BottomTabNavigator from './BottomTabNavigator';
import { RootStackParamList } from './types/root-navigation.types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash">
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Otp"
          component={OtpScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ProfileDetails"
          component={ProfileDetailsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MainTabs"
          component={BottomTabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ProductDetails"
          component={ProductDetailsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CategoryDetails"
          component={CategoryDetailsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddressSelection"
          component={AddressSelectionScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ConfirmLocation"
          component={ConfirmLocationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyAddresses"
          component={MyAddressesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Wishlist"
          component={WishlistScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
