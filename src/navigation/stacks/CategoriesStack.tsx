import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';

import CategoriesScreen from '../../screens/home/CategoriesScreen';
import CategoryItemsScreen from '../../screens/home/CategoryItemsScreen';
import {APP_BACKGROUND} from '../constants';
import type {CategoriesStackParamList} from '../types';

const Stack = createNativeStackNavigator<CategoriesStackParamList>();

export default function CategoriesStack() {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false, contentStyle: {backgroundColor: APP_BACKGROUND}}}>
      <Stack.Screen name="CategoriesList" component={CategoriesScreen} />
      <Stack.Screen name="CategoryItems" component={CategoryItemsScreen} />
    </Stack.Navigator>
  );
}
