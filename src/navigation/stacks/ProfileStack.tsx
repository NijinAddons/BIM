import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';

import ProfileScreen from '../../screens/profile/ProfileScreen';
import SavedAddressesScreen from '../../screens/profile/SavedAddressesScreen';
import WebViewScreen from '../../screens/profile/WebViewScreen';
import {APP_BACKGROUND} from '../constants';
import type {ProfileStackParamList} from '../types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false, contentStyle: {backgroundColor: APP_BACKGROUND}}}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="SavedAddresses" component={SavedAddressesScreen} />
      <Stack.Screen name="WebView" component={WebViewScreen} />
    </Stack.Navigator>
  );
}
