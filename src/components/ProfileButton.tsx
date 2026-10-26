import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAuthUser } from '../hooks/useAuth';
import { useProfileDrawer } from '../hooks/useProfileDrawer';
import { BORDER, CARD, TEXT } from '../theme/colors';
import { iconBox } from '../theme/layout';

type Props = {
  // `dark` for headers on a navy background (Home).
  variant?: 'light' | 'dark';
};

// Header avatar that opens the Profile drawer.
export default function ProfileButton({ variant = 'light' }: Props) {
  const { open } = useProfileDrawer();
  const photo = useAuthUser()?.user_image;
  const dark = variant === 'dark';

  return (
    <TouchableOpacity
      accessibilityLabel="Open profile"
      hitSlop={8}
      onPress={open}
      style={[styles.button, dark ? styles.buttonDark : styles.buttonLight]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} />
      ) : (
        <MaterialCommunityIcons
          color={dark ? '#FFFFFF' : TEXT}
          name="account-outline"
          size={20}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    ...iconBox(36, 18),
    borderWidth: 1,
    overflow: 'hidden',
  },
  buttonLight: {
    backgroundColor: CARD,
    borderColor: BORDER,
  },
  buttonDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  photo: {
    height: '100%',
    width: '100%',
  },
});
