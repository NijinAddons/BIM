import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import OrdersScreen from '../../screens/orders/OrdersScreen';
import OrderDetailsScreen from '../../screens/orders/OrderDetailsScreen';
import QuotationDetailsScreen from '../../screens/orders/QuotationDetailsScreen';
import { APP_BACKGROUND } from '../constants';
import type { OrdersStackParamList } from '../types';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export default function OrdersStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        // Android's default push is a cross-fade; both screens go
        // translucent mid-transition and the white behind them flashes.
        // An opaque slide avoids that.
        animation: 'slide_from_right',
        headerShown: false,
        contentStyle: { backgroundColor: APP_BACKGROUND },
      }}
    >
      <Stack.Screen name="OrdersList" component={OrdersScreen} />
      <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
      <Stack.Screen
        name="QuotationDetails"
        component={QuotationDetailsScreen}
      />
    </Stack.Navigator>
  );
}
