import React, { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';

import { appConfig } from '../config/appConfig';

export default function AppProviders({ children }: PropsWithChildren) {
  const appContent = <SafeAreaProvider>{children}</SafeAreaProvider>;

  if (!appConfig.stripePublishableKey) {
    return appContent;
  }

  return (
    <StripeProvider
      merchantIdentifier={appConfig.stripeMerchantIdentifier}
      publishableKey={appConfig.stripePublishableKey}
      urlScheme={appConfig.stripeUrlScheme}
    >
      {appContent}
    </StripeProvider>
  );
}
