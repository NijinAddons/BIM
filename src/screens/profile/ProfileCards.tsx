import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ActionButton } from '../../components';
import type { AuthUser, SalesOrderSummary } from '../../services';
import { BORDER, CARD, GREEN_TINT, MUTED, NAVY, TEXT } from '../../theme/colors';
import { iconBox } from '../../theme/layout';
import { ORDER_SHORTCUTS, PERKS, PROFILE_GREEN } from './profile.data';

const getInitials = (fullName: string): string => {
  const initials = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase())
    .join('');
  return initials || '?';
};

export function GuestHeroCard({ onLogin }: { onLogin: () => void }) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroRow}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons
            color={CARD}
            name="account-outline"
            size={28}
          />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Welcome to BIM</Text>
          <Text style={styles.heroSubtitle}>
            Sign in to track orders, save addresses and check out faster.
          </Text>
        </View>
      </View>
      <View style={styles.authButtons}>
        <ActionButton
          label="Log in"
          onPress={onLogin}
          style={[styles.authButton, styles.loginButton]}
        />
        <ActionButton
          label="Sign up"
          onPress={onLogin}
          style={[styles.authButton, styles.signupButton]}
        />
      </View>
    </View>
  );
}

export function AccountHeroCard({
  onEditPhoto,
  stats,
  uploading,
  user,
}: {
  onEditPhoto: () => void;
  stats: { label: string; onPress: () => void; value?: number }[];
  uploading: boolean;
  user: AuthUser | null;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroRow}>
        <View style={[styles.avatar, styles.avatarFilled]}>
          {user?.user_image ? (
            <Image source={{ uri: user.user_image }} style={styles.photo} />
          ) : (
            <Text style={styles.initials}>
              {getInitials(user?.full_name ?? '')}
            </Text>
          )}
        </View>
        <View style={styles.heroText}>
          <Text numberOfLines={1} style={styles.heroTitle}>
            {user?.full_name || 'Your account'}
          </Text>
          {[user?.email, user?.mobile_no].filter(Boolean).map(line => (
            <Text key={line} numberOfLines={1} style={styles.heroSubtitle}>
              {line}
            </Text>
          ))}
        </View>
        <TouchableOpacity
          disabled={uploading}
          onPress={onEditPhoto}
          style={styles.editButton}
        >
          {uploading ? (
            <ActivityIndicator color={CARD} size="small" />
          ) : (
            <MaterialCommunityIcons
              color={CARD}
              name="pencil-outline"
              size={18}
            />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.statsStrip}>
        {stats.map((stat, index) => (
          <React.Fragment key={stat.label}>
            {index > 0 ? <View style={styles.statDivider} /> : null}
            <TouchableOpacity onPress={stat.onPress} style={styles.stat}>
              <Text style={styles.statValue}>{stat.value ?? '–'}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export function PerksRow({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.perksRow}>
      {PERKS.map(perk => (
        <TouchableOpacity
          key={perk.icon}
          onPress={onPress}
          style={[styles.perkCard, { backgroundColor: perk.tint }]}
        >
          <View style={styles.perkIcon}>
            <MaterialCommunityIcons
              color={perk.accent}
              name={perk.icon}
              size={22}
            />
          </View>
          <Text style={styles.perkLabel}>{perk.label}</Text>
          <Text style={styles.perkCaption}>{perk.caption}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function OrderShortcuts({
  onPress,
  orders,
}: {
  onPress: () => void;
  orders?: SalesOrderSummary[];
}) {
  return (
    <View style={styles.ordersCard}>
      <View style={styles.ordersHeader}>
        <Text style={styles.ordersTitle}>My Orders</Text>
        <TouchableOpacity hitSlop={8} onPress={onPress}>
          <Text style={styles.viewAll}>View all</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.shortcuts}>
        {ORDER_SHORTCUTS.map(shortcut => {
          const count = shortcut.showCount
            ? orders?.filter(order => order.statusKey === shortcut.status)
                .length ?? 0
            : 0;
          return (
            <TouchableOpacity
              key={shortcut.status}
              onPress={onPress}
              style={styles.shortcut}
            >
              <View style={styles.shortcutIcon}>
                <MaterialCommunityIcons
                  color={PROFILE_GREEN}
                  name={shortcut.icon}
                  size={22}
                />
                {count > 0 ? (
                  <Text style={styles.badge}>{count}</Text>
                ) : null}
              </View>
              <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const ON_DARK_MUTED = 'rgba(255,255,255,0.75)';
const ON_DARK_FILL = 'rgba(255,255,255,0.12)';

const styles = StyleSheet.create({
  hero: {
    backgroundColor: NAVY,
    borderRadius: 22,
    marginBottom: 16,
    padding: 20,
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 18,
  },
  avatar: {
    ...iconBox(64, 32, ON_DARK_FILL),
    marginRight: 14,
    overflow: 'hidden',
  },
  avatarFilled: {
    backgroundColor: PROFILE_GREEN,
  },
  photo: {
    height: 64,
    width: 64,
  },
  initials: {
    color: CARD,
    fontSize: 24,
    fontWeight: '800',
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    color: CARD,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 2,
  },
  heroSubtitle: {
    color: ON_DARK_MUTED,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  editButton: {
    ...iconBox(44, 12, ON_DARK_FILL),
    marginLeft: 10,
  },
  authButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  authButton: {
    borderRadius: 12,
    flex: 1,
  },
  loginButton: {
    backgroundColor: PROFILE_GREEN,
  },
  signupButton: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
  },
  statsStrip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    flexDirection: 'row',
    paddingVertical: 12,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    backgroundColor: ON_DARK_FILL,
    width: 1,
  },
  statValue: {
    color: CARD,
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: ON_DARK_MUTED,
    fontSize: 12.5,
    marginTop: 2,
  },
  perksRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  perkCard: {
    borderRadius: 18,
    flex: 1,
    minHeight: 140,
    padding: 12,
  },
  perkIcon: {
    ...iconBox(44, 12, CARD),
    marginBottom: 'auto',
  },
  perkLabel: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12,
  },
  perkCaption: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  ordersCard: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 8,
    padding: 16,
  },
  ordersHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  ordersTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '800',
  },
  viewAll: {
    color: PROFILE_GREEN,
    fontSize: 13.5,
    fontWeight: '700',
  },
  shortcuts: {
    flexDirection: 'row',
  },
  shortcut: {
    alignItems: 'center',
    flex: 1,
  },
  shortcutIcon: iconBox(48, 14, GREEN_TINT),
  badge: {
    backgroundColor: '#E8590C',
    borderColor: CARD,
    borderRadius: 10,
    borderWidth: 2,
    color: CARD,
    fontSize: 10.5,
    fontWeight: '800',
    minWidth: 20,
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 1,
    position: 'absolute',
    right: -6,
    textAlign: 'center',
    top: -6,
  },
  shortcutLabel: {
    color: TEXT,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 8,
  },
});
