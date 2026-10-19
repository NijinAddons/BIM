import React, {useEffect, useRef} from 'react';
import {Animated, Dimensions, Easing, NativeModules, StatusBar, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {splash} from '../../assets/images';
import {version as appVersion} from '../../../package.json';
import {homeFeedQuery, queryClient} from '../../queries';

const BRAND_NAVY = '#2F455C';
const SPLASH_LOGO_SIZE = Dimensions.get('window').width * 0.6;
// The logo grows from small to full size, then Home takes over. The native
// splash (launch_background.xml) is plain navy so the growth starts cleanly.
const LOGO_MIN_SCALE = 0.3;
const LOGO_GROW_MS = 1200;
// If the Home feed is still loading once the logo is full size, the splash
// waits for it, but never longer than the cap — on a slow or offline
// connection Home takes over with its cached feed instead.
const SPLASH_MAX_MS = 10000;

type Props = {
  onFinish?: () => void;
};

export default function SplashScreen({onFinish}: Props) {
  const insets = useSafeAreaInsets();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(LOGO_MIN_SCALE)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  // This screen now covers the native splash, so the window background
  // underneath can go back to plain white (see AppWindowModule.kt).
  useEffect(() => {
    NativeModules.AppWindow?.resetBackground();
  }, []);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        onFinish?.();
      }
    };

    const grown = new Promise<void>(resolve => {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: LOGO_GROW_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(footerOpacity, {
          toValue: 1,
          duration: 350,
          delay: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });
    // Home renders straight from this cached result instead of refetching.
    Promise.all([queryClient.prefetchQuery(homeFeedQuery()), grown]).then(finish);
    const capTimer = setTimeout(finish, SPLASH_MAX_MS);

    return () => {
      done = true;
      clearTimeout(capTimer);
    };
  }, [footerOpacity, logoOpacity, logoScale, onFinish]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />

      <Animated.View
        style={{opacity: logoOpacity, transform: [{scale: logoScale}]}}>
        <Animated.Image source={splash} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      <Animated.View
        style={[styles.footer, {opacity: footerOpacity, bottom: insets.bottom + 32}]}>
        <Animated.Text style={styles.version}>v{appVersion}</Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: BRAND_NAVY,
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    alignSelf: 'center',
    height: SPLASH_LOGO_SIZE,
    width: SPLASH_LOGO_SIZE,
  },
  footer: {
    alignItems: 'center',
    position: 'absolute',
  },
  version: {
    color: '#7C90A0',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
});
