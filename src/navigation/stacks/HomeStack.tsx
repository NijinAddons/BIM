import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';

import HomeScreen from '../../screens/home/HomeScreen';
import {APP_BACKGROUND} from '../constants';
import type {HomeStackParamList} from '../types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false, contentStyle: {backgroundColor: APP_BACKGROUND}}}>
      <Stack.Screen name="HomeFeed" component={HomeScreen} />
    </Stack.Navigator>
  );
}
