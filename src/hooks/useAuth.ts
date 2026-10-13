import {useSyncExternalStore} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

import type {AuthUser} from '../services/otpLogin.service';

export type AuthStatus = 'signedOut' | 'signedIn';

// iOS Keychain / Android Keystore item the session token is stored under —
// encrypted at rest, unlike AsyncStorage. A fixed placeholder username is
// used since there's only ever one active session per device.
const KEYCHAIN_SERVICE = 'com.buyinminutes.session';
const SESSION_USERNAME = 'session';

// Profile fields (name/email/phone) aren't secret, so they're cached in
// AsyncStorage — just enough to show Profile instantly on cold start before
// any refresh, alongside the actual credential in the Keychain.
const USER_STORAGE_KEY = '@bim/auth_user';

/**
 * The app is browsable as a guest; screens that require a real login (e.g.
 * Cart's checkout button) read `useAuthStatus()` to decide what to show.
 * `status`/`user` are kept in memory for synchronous reads; the session
 * token lives in the Keychain and both are restored once at startup via
 * `hydrate()`.
 */
let status: AuthStatus = 'signedOut';
let sessionToken: string | null = null;
let user: AuthUser | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getStatus(): AuthStatus {
  return status;
}

function getUser(): AuthUser | null {
  return user;
}

// Restore a persisted session (if any) once at app start, so a signed-in
// user isn't dropped back to guest browsing on every cold start.
let hydrated = false;
function hydrate() {
  if (hydrated) {
    return;
  }
  hydrated = true;
  Keychain.getGenericPassword({service: KEYCHAIN_SERVICE})
    .then(result => {
      if (!result) {
        return;
      }
      sessionToken = result.password;
      status = 'signedIn';
      emit();
    })
    .catch(() => {
      // Treat an unreadable Keychain (e.g. after a device restore) as
      // signed out rather than throwing — the user just logs in again.
    });

  AsyncStorage.getItem(USER_STORAGE_KEY)
    .then(raw => {
      if (!raw) {
        return;
      }
      user = JSON.parse(raw) as AuthUser;
      emit();
    })
    .catch(() => {});
}
hydrate();

export function signIn(token: string, signedInUser?: AuthUser): void {
  sessionToken = token;
  status = 'signedIn';
  if (signedInUser) {
    user = signedInUser;
    AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(signedInUser)).catch(
      () => {},
    );
  }
  emit();
  Keychain.setGenericPassword(SESSION_USERNAME, token, {
    service: KEYCHAIN_SERVICE,
  }).catch(() => {});
}

export function signOut(): void {
  sessionToken = null;
  user = null;
  status = 'signedOut';
  emit();
  Keychain.resetGenericPassword({service: KEYCHAIN_SERVICE}).catch(() => {});
  AsyncStorage.removeItem(USER_STORAGE_KEY).catch(() => {});
}

/** Patch the cached profile's photo after a successful upload elsewhere. */
export function updateAuthUserImage(imageUrl: string): void {
  if (!user) {
    return;
  }
  user = {...user, user_image: imageUrl};
  AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user)).catch(() => {});
  emit();
}

/**
 * The current session token, or null when signed out. Not yet wired into
 * outgoing API requests — the backend's expected mechanism for presenting it
 * (header name/scheme, cookie, etc.) hasn't been confirmed.
 */
export function getSessionToken(): string | null {
  return sessionToken;
}

export function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(subscribe, getStatus);
}

/** The signed-in user's profile fields (name/email/phone), or null as a guest. */
export function useAuthUser(): AuthUser | null {
  return useSyncExternalStore(subscribe, getUser);
}
