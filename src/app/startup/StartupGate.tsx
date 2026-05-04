import React, {PropsWithChildren, useEffect} from 'react';

import {loadStoredCart} from '../../features/cart/service';
import {loadStoredAddresses} from '../../features/profile/service';
import {configureLocation} from '../../services/location/locationPermission.service';

export default function StartupGate({children}: PropsWithChildren) {
  useEffect(() => {
    configureLocation();
    loadStoredAddresses().catch(() => undefined);
    loadStoredCart().catch(() => undefined);
  }, []);

  return <>{children}</>;
}
