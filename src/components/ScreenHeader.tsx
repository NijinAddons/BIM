import React, {ReactNode} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const BRAND_NAVY = '#1F2E3D';

type Props = {
  onBack?: () => void;
  rightAccessory?: ReactNode;
  subtitle?: string;
  title: string;
};

export default function ScreenHeader({onBack, rightAccessory, subtitle, title}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, {paddingTop: insets.top + 6}]}>
      {onBack ? (
        <Pressable hitSlop={8} onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons color="#F5FAFC" name="chevron-left" size={24} />
        </Pressable>
      ) : null}
      <View style={styles.textBlock}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: 12,
    width: 36,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    color: '#F5FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9FB0BD',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  accessory: {
    marginLeft: 12,
  },
});
