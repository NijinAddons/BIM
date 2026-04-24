import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserProfile = {
  address: string;
  email: string;
  mobile: string;
  name: string;
};

const PROFILE_STORAGE_KEY = '@buy_in_minutes_profile';

const defaultUserProfile: UserProfile = {
  address: '',
  email: 'name@example.com',
  mobile: '',
  name: 'BIM User',
};

type StoredProfilePayload = {
  profile: UserProfile;
  profileCompleted: boolean;
};

let currentUserProfile: UserProfile = defaultUserProfile;
let hasCompletedProfile = false;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

export function getUserProfile() {
  return currentUserProfile;
}

export function subscribeProfile(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isUserProfileCompleted() {
  return hasCompletedProfile;
}

export async function loadStoredProfile() {
  try {
    const rawValue = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);

    if (!rawValue) {
      currentUserProfile = defaultUserProfile;
      hasCompletedProfile = false;
      notify();
      return false;
    }

    const parsedValue = JSON.parse(rawValue) as StoredProfilePayload;

    if (!parsedValue?.profile) {
      currentUserProfile = defaultUserProfile;
      hasCompletedProfile = false;
      notify();
      return false;
    }

    currentUserProfile = parsedValue.profile;
    hasCompletedProfile =
      Boolean(parsedValue.profileCompleted) ||
      (Boolean(currentUserProfile.name.trim()) &&
        currentUserProfile.name !== defaultUserProfile.name);
    notify();
    return hasCompletedProfile;
  } catch {
    currentUserProfile = defaultUserProfile;
    hasCompletedProfile = false;
    notify();
    return false;
  }
}

export async function setUserProfile(
  profile: UserProfile,
  options?: {profileCompleted?: boolean},
) {
  currentUserProfile = profile;
  hasCompletedProfile =
    options?.profileCompleted !== undefined
      ? options.profileCompleted
      : hasCompletedProfile;

  const payload: StoredProfilePayload = {
    profile: currentUserProfile,
    profileCompleted: hasCompletedProfile,
  };

  await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(payload));
  notify();
}
