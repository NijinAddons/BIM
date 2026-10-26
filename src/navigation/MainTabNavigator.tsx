import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Drawer } from 'react-native-drawer-layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ProfileDrawerContext } from '../hooks/useProfileDrawer';
import ExploreScreen from '../screens/explore/ExploreScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import ServicesScreen from '../screens/services/ServicesScreen';
import {
  HAIRLINE,
  TAB_BAR,
  GREEN as ACTION_GREEN,
  TEXT_VARIANT as INACTIVE_TINT,
} from '../theme/colors';
import CategoriesStack from './stacks/CategoriesStack';
import HomeStack from './stacks/HomeStack';
import type { MainTabParamList } from './types';

const TAB_ICONS: Record<
  keyof MainTabParamList,
  { active: string; inactive: string }
> = {
  Home: { active: 'home-variant', inactive: 'home-variant-outline' },
  Categories: { active: 'shape', inactive: 'shape-outline' },
  Explore: { active: 'compass', inactive: 'compass-outline' },
  Services: { active: 'toolbox', inactive: 'toolbox-outline' },
};

const TAB_BAR_HEIGHT = 44;

const Tab = createBottomTabNavigator<MainTabParamList>();

// Plain Pressable in place of the default button, so tapping a tab shows no
// Android ripple or iOS opacity flash. Content is centred vertically — the
// default top-aligns it, which leaves label-less tabs sitting high.
const tabBarButton = ({
  ref: _ref,
  style,
  ...props
}: BottomTabBarButtonProps) => (
  <Pressable
    {...props}
    android_ripple={null}
    style={[style, styles.tabButton]}
  />
);

const tabIcon =
  (name: keyof MainTabParamList) =>
  ({
    focused,
    color,
    size,
  }: {
    focused: boolean;
    color: string;
    size: number;
  }) => {
    const icon = TAB_ICONS[name];
    return (
      <MaterialCommunityIcons
        color={color}
        name={focused ? icon.active : icon.inactive}
        size={size}
      />
    );
  };

const renderProfile = () => <ProfileScreen />;

export default function MainTabNavigator() {
  const [profileOpen, setProfileOpen] = useState(false);
  const { width } = useWindowDimensions();
  const drawerControls = useMemo(
    () => ({
      open: () => setProfileOpen(true),
      close: () => setProfileOpen(false),
    }),
    [],
  );

  // Android back closes the drawer before it leaves the tabs.
  useEffect(() => {
    if (!profileOpen) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setProfileOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [profileOpen]);

  const insets = useSafeAreaInsets();
  // On iOS the bar grows by half the home-indicator inset and centres its icons
  // across the full height (no bottom padding) — the icons still end well above
  // the indicator. Android reserves the full inset so tabs never overlap the
  // system nav buttons.
  const isIOS = Platform.OS === 'ios';
  const barHeight =
    TAB_BAR_HEIGHT + (isIOS ? insets.bottom / 2 : insets.bottom);
  const bottomPadding = isIOS ? 0 : insets.bottom;

  return (
    <ProfileDrawerContext.Provider value={drawerControls}>
      <Drawer
        drawerStyle={{ width: Math.min(width * 0.86, 380) }}
        drawerType="front"
        onClose={drawerControls.close}
        onOpen={drawerControls.open}
        open={profileOpen}
        renderDrawerContent={renderProfile}
        // Swipe-to-open stays off so it can't fight horizontal carousels.
        swipeEnabled={profileOpen}
      >
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: ACTION_GREEN,
            tabBarInactiveTintColor: INACTIVE_TINT,
            tabBarLabelStyle: styles.label,
            tabBarStyle: {
              backgroundColor: TAB_BAR,
              borderTopColor: HAIRLINE,
              borderTopWidth: 1,
              // Shorter than the 49pt default.
              height: barHeight,
              paddingBottom: bottomPadding,
            },
            tabBarIcon: tabIcon(route.name),
            tabBarButton,
          })}
        >
          <Tab.Screen name="Home" component={HomeStack} />
          <Tab.Screen name="Categories" component={CategoriesStack} />
          <Tab.Screen name="Explore" component={ExploreScreen} />
          <Tab.Screen name="Services" component={ServicesScreen} />
        </Tab.Navigator>
      </Drawer>
    </ProfileDrawerContext.Provider>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700' },
  tabButton: { justifyContent: 'center' },
});
