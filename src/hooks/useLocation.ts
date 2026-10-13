import {useSyncExternalStore} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  LocationPermissionBlockedError,
  LocationPermissionError,
  LocationServicesDisabledError,
  resolveCurrentLocation,
  type Coords,
  type ResolvedLocation,
} from '../services/location';

export type LocationStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  // Permission just denied — the OS will still show its dialog again, so a
  // retry can happen entirely in-app (no need to send the user to Settings).
  | 'denied'
  // Permission permanently refused (Android "don't ask again", or any iOS
  // denial) — only Settings can fix this, an in-app retry does nothing.
  | 'blocked'
  | 'servicesOff'
  | 'error';

export type LocationState = {
  status: LocationStatus;
  label: string | null;
  address: string | null;
  coords: Coords | null;
};

const STORAGE_KEY = '@bim/location';

let state: LocationState = {
  status: 'idle',
  label: null,
  address: null,
  coords: null,
};
const listeners = new Set<() => void>();

function setState(next: Partial<LocationState>) {
  state = {...state, ...next};
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): LocationState {
  return state;
}

// Show the last resolved location immediately on cold start.
let hydrated = false;
function hydrate() {
  if (hydrated) {
    return;
  }
  hydrated = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then(saved => {
      if (!saved || state.label !== null) {
        return;
      }
      try {
        const parsed = JSON.parse(saved) as {
          label?: string;
          address?: string;
        };
        setState({
          label: parsed.label ?? null,
          address: parsed.address ?? parsed.label ?? null,
        });
      } catch {
        setState({label: saved, address: saved});
      }
    })
    .catch(() => {});
}
hydrate();

let inFlight: Promise<void> | null = null;

/**
 * Fetch the device location and reverse-geocode it into `state.label`.
 * De-duped: concurrent calls share one request; a no-op once `ready` unless
 * `force` is passed.
 */
export function loadCurrentLocation(force = false): Promise<void> {
  if (inFlight) {
    return inFlight;
  }
  if (!force && state.status === 'ready') {
    return Promise.resolve();
  }

  setState({status: 'loading'});

  const persistAndApply = ({coords, label, address}: ResolvedLocation) => {
    setState({status: 'ready', coords, label, address});
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({label, address})).catch(
      () => {},
    );
  };

  inFlight = resolveCurrentLocation(persistAndApply)
    .then(persistAndApply)
    .catch(error => {
      let status: LocationStatus = 'error';
      if (error instanceof LocationPermissionBlockedError) {
        status = 'blocked';
      } else if (error instanceof LocationPermissionError) {
        status = 'denied';
      } else if (error instanceof LocationServicesDisabledError) {
        status = 'servicesOff';
      }
      setState({status});
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * Record a permission outcome the caller already got from the OS dialog,
 * without going through loadCurrentLocation() (which would request again).
 */
export function setLocationStatus(status: LocationStatus): void {
  setState({status});
}

/**
 * True when the active location is an address the user picked (saved
 * address / search), not a GPS fix — those carry no coords.
 */
export function isManualLocation(): boolean {
  return state.status === 'ready' && state.coords === null && state.label !== null;
}

/** Set the active delivery location from a manually chosen address. */
export function setManualLocation(location: {
  label: string;
  address: string;
}): void {
  setState({
    status: 'ready',
    label: location.label,
    address: location.address,
    coords: null,
  });
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({label: location.label, address: location.address}),
  ).catch(() => {});
}

export function useLocation(): LocationState {
  return useSyncExternalStore(subscribe, getSnapshot);
}
