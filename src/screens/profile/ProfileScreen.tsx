import React, { useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { version as appVersion } from '../../../package.json';
import {
  ActionButton,
  CustomAlert,
  ListCard,
  NotificationBell,
  SectionTitle,
} from '../../components';
import { signOut, useAuthStatus, useAuthUser } from '../../hooks/useAuth';
import { useAddresses } from '../../hooks/useAddresses';
import { useProfileDrawer } from '../../hooks/useProfileDrawer';
import { useProfilePhoto } from '../../hooks/useProfilePhoto';
import { useWishlist } from '../../hooks/useWishlist';
import type { RootStackScreenProps } from '../../navigation/types';
import { useOrdersForUser } from '../../queries';
import { BORDER, CARD, MUTED, TEXT } from '../../theme/colors';
import { iconBox } from '../../theme/layout';
import {
  AccountHeroCard,
  GuestHeroCard,
  OrderShortcuts,
  PerksRow,
} from './ProfileCards';
import { DESTRUCTIVE, MENU_SECTIONS, type MenuItem } from './profile.data';

// Rendered as the drawer over MainTabs, so it navigates on the root stack.
type ProfileNavProp = RootStackScreenProps<'MainTabs'>['navigation'];

export default function ProfileScreen() {
  const rootNavigation = useNavigation<ProfileNavProp>();
  const { close: closeDrawer } = useProfileDrawer();
  // Close the drawer on the way out, so going back lands on the tab itself.
  const navigation = {
    navigate: ((...args: Parameters<ProfileNavProp['navigate']>) => {
      closeDrawer();
      rootNavigation.navigate(...args);
    }) as ProfileNavProp['navigate'],
  };
  const insets = useSafeAreaInsets();
  const isSignedIn = useAuthStatus() === 'signedIn';
  const user = useAuthUser();
  const wishlistCount = useWishlist().length;
  const addressCount = useAddresses().length;
  const orders = useOrdersForUser(user, { enabled: isSignedIn && !!user })
    .data?.[0];
  const photo = useProfilePhoto(user);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  const openLogin = () => navigation.navigate('Login');
  const openOrders = () =>
    navigation.navigate('Orders', { screen: 'OrdersList' });

  const onMenuPress = (item: MenuItem) => {
    if (item.comingSoon) {
      setComingSoon(item.comingSoon);
    } else if (item.web) {
      navigation.navigate('WebView', item.web);
    } else if (item.route) {
      navigation.navigate(item.route);
    }
  };

  const stats = [
    { label: 'Orders', onPress: openOrders, value: orders?.length },
    {
      label: 'Wishlist',
      onPress: () => navigation.navigate('Wishlist'),
      value: wishlistCount,
    },
    {
      label: 'Addresses',
      onPress: () => navigation.navigate('SavedAddresses'),
      value: addressCount,
    },
  ];
  const visible = (entry: { signedInOnly?: boolean }) =>
    isSignedIn || !entry.signedInOnly;

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={CARD} barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>My Account</Text>
        <View style={styles.headerActions}>
          {isSignedIn ? <NotificationBell /> : null}
          <TouchableOpacity
            accessibilityLabel="Close profile"
            hitSlop={8}
            onPress={closeDrawer}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons color={TEXT} name="close" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isSignedIn ? (
          <>
            <AccountHeroCard
              onEditPhoto={photo.pickPhoto}
              stats={stats}
              uploading={photo.uploading}
              user={user}
            />
            <OrderShortcuts onPress={openOrders} orders={orders} />
          </>
        ) : (
          <>
            <GuestHeroCard onLogin={openLogin} />
            <PerksRow onPress={openLogin} />
          </>
        )}

        {MENU_SECTIONS.filter(visible).map(section => (
          <React.Fragment key={section.title}>
            <SectionTitle title={section.title} />
            <ListCard
              items={section.items.filter(visible)}
              onPress={onMenuPress}
              values={{
                addresses: addressCount ? `${addressCount} saved` : undefined,
              }}
            />
          </React.Fragment>
        ))}

        {isSignedIn ? (
          <ActionButton
            accessory={
              <MaterialCommunityIcons
                color={DESTRUCTIVE}
                name="logout"
                size={20}
              />
            }
            label="Log out"
            onPress={() => setLogoutVisible(true)}
            style={styles.logoutButton}
            textStyle={styles.logoutText}
            variant="secondary"
          />
        ) : null}

        <Text style={styles.version}>BIM · Version {appVersion}</Text>
      </ScrollView>

      <CustomAlert
        icon="logout"
        message="Are you sure you want to log out of your account?"
        onClose={() => setLogoutVisible(false)}
        onPrimaryButtonPress={() => {
          setLogoutVisible(false);
          signOut();
          openLogin();
        }}
        primaryButtonLabel="Log Out"
        primaryButtonVariant="destructive"
        secondaryButtonLabel="Cancel"
        title="Log Out"
        visible={logoutVisible}
      />

      <CustomAlert
        icon="rocket-launch-outline"
        message={`${comingSoon} is on its way. Stay tuned!`}
        onClose={() => setComingSoon(null)}
        primaryButtonLabel="Got it"
        title="Coming Soon"
        visible={comingSoon !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: CARD,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  closeButton: {
    ...iconBox(44, 12, CARD),
    borderColor: BORDER,
    borderWidth: 1,
  },
  title: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '800',
  },
  scrollContent: {
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  logoutButton: {
    borderColor: '#F4C7B5',
    marginTop: 24,
  },
  logoutText: {
    color: DESTRUCTIVE,
  },
  version: {
    color: MUTED,
    fontSize: 12.5,
    marginTop: 20,
    textAlign: 'center',
  },
});
