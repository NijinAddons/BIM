import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { BORDER, CARD, TEXT } from '../theme/colors';
import { iconBox } from '../theme/layout';
import CustomAlert from './CustomAlert';

// Header bell; notifications aren't built yet, so it shows a coming-soon alert.
export default function NotificationBell() {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        accessibilityLabel="Notifications"
        onPress={() => setVisible(true)}
        style={styles.button}
      >
        <MaterialCommunityIcons color={TEXT} name="bell-outline" size={20} />
      </TouchableOpacity>
      <CustomAlert
        icon="rocket-launch-outline"
        message="Notifications is on its way. Stay tuned!"
        onClose={() => setVisible(false)}
        primaryButtonLabel="Got it"
        title="Coming Soon"
        visible={visible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    ...iconBox(44, 12, CARD),
    borderColor: BORDER,
    borderWidth: 1,
  },
});
