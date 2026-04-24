import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Image, Platform, StyleSheet, Text, View} from 'react-native';

import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import {appicon} from '../../../assets/images';
import {loadStoredProfile} from '../../profile/service';

type SplashNavProp = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

type Props = {
  navigation: SplashNavProp;
};

export default function SplashScreen({navigation}: Props) {
  const logoScale = useRef(new Animated.Value(0.75)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(18)).current;
  const navigationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.08,
          duration: 550,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 350,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(250),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    const bootstrapProfile = async () => {
      const hasFullName = await loadStoredProfile();

      navigationTimeout.current = setTimeout(() => {
        navigation.replace(hasFullName ? 'MainTabs' : 'Login');
      }, 3000);
    };

    bootstrapProfile();

    return () => {
      if (navigationTimeout.current) {
        clearTimeout(navigationTimeout.current);
      }
    };
  }, [logoOpacity, logoScale, navigation, textOpacity, textTranslateY]);

  return (
    <View style={styles.container}>
      <View style={styles.heroCanvas} />
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />
      <View style={styles.arcLeft} />
      <View style={styles.arcRight} />
      <View style={styles.sparkOne} />
      <View style={styles.sparkTwo} />

      <Animated.View
        style={[
          styles.badge,
          {
            opacity: logoOpacity,
            transform: [{scale: logoScale}],
          },
        ]}>
        <View style={styles.badgeHalo} />
        <Image source={appicon} style={styles.badgeIcon} />
      </Animated.View>

      <Animated.Text
        style={[
          styles.brand,
          {opacity: textOpacity, transform: [{translateY: textTranslateY}]},
        ]}>
        Buy In Minutes
      </Animated.Text>
      <Animated.Text
        style={[
          styles.caption,
          {opacity: textOpacity, transform: [{translateY: textTranslateY}]},
        ]}>
        Your daily needs, delivered instantly.
      </Animated.Text>
      <View style={styles.brandRule} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#eef7fb',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 24,
  },
  heroCanvas: {
    backgroundColor: '#dff2f8',
    borderRadius: 64,
    height: 340,
    opacity: 0.96,
    position: 'absolute',
    width: 330,
  },
  blobTop: {
    backgroundColor: '#bdeefe',
    borderRadius: 160,
    height: 160,
    opacity: 0.95,
    position: 'absolute',
    right: -28,
    top: 86,
    width: 160,
  },
  blobBottom: {
    backgroundColor: '#c9f3ea',
    borderRadius: 180,
    bottom: 102,
    height: 180,
    left: -40,
    opacity: 0.92,
    position: 'absolute',
    width: 180,
  },
  arcLeft: {
    borderColor: 'rgba(41, 184, 241, 0.34)',
    borderRadius: 120,
    borderWidth: 14,
    height: 120,
    left: 44,
    opacity: 0.75,
    position: 'absolute',
    top: 154,
    width: 120,
  },
  arcRight: {
    borderColor: 'rgba(31, 203, 210, 0.3)',
    borderRadius: 104,
    borderWidth: 12,
    height: 104,
    position: 'absolute',
    right: 54,
    top: 198,
    width: 104,
  },
  sparkOne: {
    backgroundColor: '#1fcbd2',
    borderRadius: 999,
    height: 14,
    opacity: 0.9,
    position: 'absolute',
    right: 82,
    top: 136,
    width: 14,
  },
  sparkTwo: {
    backgroundColor: '#29b8f1',
    borderRadius: 999,
    height: 10,
    left: 90,
    opacity: 0.75,
    position: 'absolute',
    top: 258,
    width: 10,
  },
  badge: {
    alignItems: 'center',
    height: 150,
    justifyContent: 'center',
    width: 150,
  },
  badgeHalo: {
    backgroundColor: 'rgba(31, 203, 210, 0.14)',
    borderRadius: 999,
    height: 138,
    position: 'absolute',
    width: 138,
  },
  badgeIcon: {
    borderRadius: 30,
    height: 124,
    width: 124,
  },
  brand: {
    alignSelf: 'stretch',
    color: '#24374d',
    fontFamily: Platform.select({ios: 'Georgia', android: 'serif'}),
    fontSize: 33,
    fontWeight: '900',
    letterSpacing: 0.2,
    lineHeight: 38,
    marginTop: 8,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  brandRule: {
    backgroundColor: '#2ecfc0',
    borderRadius: 999,
    height: 5,
    marginTop: 16,
    width: 64,
  },
  caption: {
    alignSelf: 'center',
    color: '#496075',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 260,
    textAlign: 'center',
  },
});
