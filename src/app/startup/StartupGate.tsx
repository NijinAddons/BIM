import React, {PropsWithChildren, useEffect} from 'react';

import {configureLocation} from '../../services/location/locationPermission.service';

export default function StartupGate({children}: PropsWithChildren) {
  useEffect(() => {
    configureLocation();
  }, []);

  return <>{children}</>;
}
