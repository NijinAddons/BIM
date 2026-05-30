import React, {PropsWithChildren, useEffect} from 'react';

import {loadStoredCart} from '../../features/cart/service';
import {loadStoredProductCache, prefetchProducts} from '../../features/product/service';
import {loadStoredAddresses} from '../../features/profile/service';
import {loadStoredFrappeAuthCredentials} from '../../services/frappe/frappeAuth';
import {configureLocation} from '../../services/location/locationPermission.service';

export default function StartupGate({children}: PropsWithChildren) {
  useEffect(() => {
    configureLocation();

    const bootstrap = async () => {
      await loadStoredFrappeAuthCredentials().catch(() => undefined);
      loadStoredAddresses().catch(() => undefined);
      loadStoredCart().catch(() => undefined);
      loadStoredProductCache().catch(() => undefined);
      prefetchProducts().catch(() => undefined);
    };

    bootstrap().catch(() => undefined);
  }, []);

  return <>{children}</>;
}
