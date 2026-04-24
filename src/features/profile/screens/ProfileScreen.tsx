import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useSyncExternalStore } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootStackParamList } from '../../../app/navigation/types/root-navigation.types';
import { bag, support, wallet } from '../../../assets/images';
import { colors } from '../../../theme/colors';
import { APP_NAME, APP_VERSION } from '../../../utils/constants/app.constants';
import { getUserProfile, subscribeProfile } from '../service';

type InfoItemRoute = Extract<
  keyof RootStackParamList,
  'EditProfile' | 'MyAddresses' | 'Wishlist'
>;

type InfoItem = {
  label: string;
  icon: string;
  route?: InfoItemRoute;
};

const INFO_ITEMS: readonly InfoItem[] = [
  { label: 'Address book', icon: 'map-marker-outline', route: 'MyAddresses' },
  { label: 'Your wishlist', icon: 'heart-outline', route: 'Wishlist' },
  { label: 'Coupons', icon: 'ticket-percent-outline' },
  {
    label: 'Edit Profile',
    icon: 'account-edit-outline',
    route: 'EditProfile',
  },
  { label: 'Privacy Center', icon: 'shield-account-outline' },
] as const;

const OTHER_INFO_ITEMS: readonly InfoItem[] = [
  { label: 'About us', icon: 'information-outline' },
  { label: 'Notification preferences', icon: 'bell-outline' },
  { label: 'Logout', icon: 'logout' },
  { label: 'Delete account', icon: 'delete-outline' },
] as const;

type ProfileNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ProfileNavProp>();
  const profile = useSyncExternalStore(
    subscribeProfile,
    getUserProfile,
    getUserProfile,
  );

  const onPressInfoItem = (item: InfoItem) => {
    if (item.route) {
      navigation.navigate(item.route);
    }
  };

  const onPressOtherInfoItem = (item: InfoItem) => {
    if (item.label !== 'Logout') {
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => navigation.replace('Login'),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.topSection,
            {
              paddingTop: insets.top + 24,
            },
          ]}
        >
          <View style={styles.avatarCircle}>
            <View style={styles.avatarHead} />
            <View style={styles.avatarBody} />
          </View>
          <Text style={styles.nameText}>{profile.name}</Text>
          {profile.mobile.trim() ? (
            <Text style={styles.phoneText}>{profile.mobile}</Text>
          ) : null}
        </View>

        <View style={styles.cardRow}>
          <View style={[styles.infoCard, styles.ordersCard]}>
            <View style={[styles.cardAccent, styles.ordersAccent]} />
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, styles.ordersIconWrap]}>
                <Image source={bag} style={styles.cardIconImage} />
              </View>
              <Text style={styles.cardTitle}>Your Orders</Text>
            </View>
          </View>

          <View style={[styles.infoCard, styles.moneyCard]}>
            <View style={[styles.cardAccent, styles.moneyAccent]} />
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, styles.moneyIconWrap]}>
                <Image source={wallet} style={styles.cardIconImage} />
              </View>
              <Text style={styles.cardTitle}>BIM Money</Text>
            </View>
          </View>

          <View style={[styles.infoCard, styles.helpCard]}>
            <View style={[styles.cardAccent, styles.helpAccent]} />
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, styles.helpIconWrap]}>
                <Image source={support} style={styles.cardIconImage} />
              </View>
              <Text style={styles.cardTitle}>Help Center</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Your Information</Text>

          <View style={styles.infoList}>
            {INFO_ITEMS.map((item, index) => (
              <React.Fragment key={item.label}>
                <Pressable
                  disabled={!item.route}
                  onPress={() => onPressInfoItem(item)}
                  style={styles.infoRow}
                >
                  <View style={styles.infoRowLeft}>
                    <View style={styles.infoRowIconWrap}>
                      <MaterialCommunityIcons
                        color={colors.text}
                        name={item.icon}
                        size={18}
                      />
                    </View>
                    <Text style={styles.infoRowText}>{item.label}</Text>
                  </View>
                  <MaterialCommunityIcons
                    color={colors.mutedText}
                    name="chevron-right"
                    size={20}
                  />
                </Pressable>
                {index < INFO_ITEMS.length - 1 ? (
                  <View style={styles.infoDivider} />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        </View>
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Other Information</Text>

          <View style={styles.infoList}>
            {OTHER_INFO_ITEMS.map((item, index) => (
              <React.Fragment key={item.label}>
                <Pressable
                  onPress={() => onPressOtherInfoItem(item)}
                  style={styles.infoRow}
                >
                  <View style={styles.infoRowLeft}>
                    <View style={styles.infoRowIconWrap}>
                      <MaterialCommunityIcons
                        color={
                          item.label === 'Delete account'
                            ? '#dc2626'
                            : colors.text
                        }
                        name={item.icon}
                        size={18}
                      />
                    </View>
                    <Text
                      style={[
                        styles.infoRowText,
                        item.label === 'Delete account'
                          ? styles.deleteAccountText
                          : null,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    color={colors.mutedText}
                    name="chevron-right"
                    size={20}
                  />
                </Pressable>
                {index < OTHER_INFO_ITEMS.length - 1 ? (
                  <View style={styles.infoDivider} />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        </View>
        <View style={styles.appVersionWrap}>
          <Text style={styles.appNameText}>{APP_NAME}</Text>
          <Text style={styles.appVersionText}>Version {APP_VERSION}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topSection: {
    alignItems: 'center',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
    paddingHorizontal: 16,
  },
  infoSection: {
    marginTop: 28,
    paddingHorizontal: 16,
  },
  avatarCircle: {
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 44,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  avatarHead: {
    backgroundColor: '#9ca3af',
    borderRadius: 11,
    height: 22,
    marginBottom: 6,
    width: 22,
  },
  avatarBody: {
    backgroundColor: '#9ca3af',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    height: 20,
    width: 36,
  },
  nameText: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 14,
  },
  phoneText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  infoCard: {
    alignItems: 'center',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 18,
    elevation: 2,
    flex: 1,
    justifyContent: 'center',
    minHeight: 108,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#111827',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  cardHeader: {
    alignItems: 'center',
  },
  ordersCard: {
    backgroundColor: '#f8fbff',
  },
  moneyCard: {
    backgroundColor: '#fff6ea',
  },
  helpCard: {
    backgroundColor: '#eff9ff',
  },
  cardAccent: {
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  ordersAccent: {
    backgroundColor: '#4f46e5',
  },
  moneyAccent: {
    backgroundColor: '#f59e0b',
  },
  helpAccent: {
    backgroundColor: '#0891b2',
  },
  cardTitle: {
    color: '#1f2937',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 10,
  },
  cardIconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  ordersIconWrap: {
    backgroundColor: '#e8eafe',
  },
  moneyIconWrap: {
    backgroundColor: '#ffedd5',
  },
  helpIconWrap: {
    backgroundColor: '#dff4ff',
  },
  cardIconImage: {
    height: 22,
    resizeMode: 'contain',
    width: 22,
  },
  infoList: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  infoRowLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 12,
  },
  infoRowIconWrap: {
    alignItems: 'center',
    backgroundColor: '#f8f4e8',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  infoRowText: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '500',
  },
  deleteAccountText: {
    color: '#dc2626',
  },
  appVersionWrap: {
    alignItems: 'center',
    marginTop: 28,
    paddingHorizontal: 16,
  },
  appNameText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  appVersionText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  infoDivider: {
    backgroundColor: '#eef2f7',
    height: 1,
    marginHorizontal: 16,
  },
});
