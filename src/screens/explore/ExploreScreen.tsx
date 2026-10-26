import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { NotificationBell, ProfileButton } from '../../components';
import { useAuthStatus } from '../../hooks/useAuth';
import { TEXT, TEXT_VARIANT } from '../../theme/colors';

// Placeholder until the Explore tab's content is designed.
const ExploreScreen = () => {
  const insets = useSafeAreaInsets();
  const isSignedIn = useAuthStatus() === 'signedIn';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerLeft}>
          <ProfileButton />
          <Text style={styles.title}>Explore</Text>
        </View>
        {isSignedIn ? <NotificationBell /> : null}
      </View>

      <View style={styles.centeredState}>
        <MaterialCommunityIcons
          color="#C6CDD3"
          name="compass-outline"
          size={44}
        />
        <Text style={styles.emptyText}>Coming soon</Text>
        <Text style={styles.emptyHint}>
          Discover new products, brands and ideas here.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  title: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '800',
  },
  centeredState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyHint: {
    color: TEXT_VARIANT,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
});

export default ExploreScreen;
