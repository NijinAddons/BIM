import React from 'react';

import RootNavigator from './navigation/RootNavigator';
import AppProviders from './providers/AppProviders';
import StartupGate from './startup/StartupGate';

export default function App() {
  return (
    <AppProviders>
      <StartupGate>
        <RootNavigator />
      </StartupGate>
    </AppProviders>
  );
}
