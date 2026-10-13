import {NavigationContainer} from '@react-navigation/native';
import React from 'react';

import {linking} from './linking';
import MainNavigator from './MainNavigator';

/**
 * The single NavigationContainer for the app. The app is browsable as a
 * guest — sign-in is a screen pushed on demand (see `MainNavigator`) rather
 * than a whole separate tree, so signing out never kicks the user out of
 * where they were.
 */
export default function RootNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <MainNavigator />
    </NavigationContainer>
  );
}
