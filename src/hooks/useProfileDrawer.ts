import { createContext, useContext } from 'react';

type ProfileDrawerControls = {
  open: () => void;
  close: () => void;
};

const noop = () => {};

// Provided by MainTabNavigator, which hosts the Profile drawer over the tabs.
// Outside it (e.g. a screen pushed on the root stack) both calls are no-ops.
export const ProfileDrawerContext = createContext<ProfileDrawerControls>({
  open: noop,
  close: noop,
});

export const useProfileDrawer = () => useContext(ProfileDrawerContext);
