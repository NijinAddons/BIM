import React, {useEffect, useRef} from 'react';
import {Animated, Dimensions, Easing, NativeModules, Platform, StatusBar, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {splash} from '../../assets/images';
import {version as appVersion} from '../../../package.json';
import {homeFeedQuery, queryClient} from '../../queries';

const BRAND_NAVY = '#2F455C';
const ACCENT_TEAL = '#2ECFC0';
// On Android the logo must line up exactly with the native splash
// (res/drawable/launch_background.xml, 288dp) and appear already visible,
// otherwise it visibly jumps/blinks when React Native takes over.
const IS_ANDROID = Platform.OS === 'android';
const SPLASH_LOGO_SIZE = IS_ANDROID ? 288 : Dimensions.get('window').width * 0.6;
const LOADER_WIDTH = 120;
const LOADER_FILL_WIDTH = 44;
// The splash stays up until the Home feed has loaded, but always long enough
// for the logo intro to play, and never longer than the cap — on a slow or
// offline connection Home takes over with its cached feed instead.
const SPLASH_MIN_MS = 1200;
const SPLASH_MAX_MS = 10000;

type Props = {
  onFinish?: () => void;
};

export default function SplashScreen({onFinish}: Props) {
  const insets = useSafeAreaInsets();

  const logoOpacity = useRef(new Animated.Value(IS_ANDROID ? 1 : 0)).current;
  const logoScale = useRef(new Animated.Value(IS_ANDROID ? 1 : 0.9)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const loaderTrack = useRef(new Animated.Value(0)).current;

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

    const minDelay = new Promise<void>(resolve =>
      setTimeout(resolve, SPLASH_MIN_MS),
    );
    // Home renders straight from this cached result instead of refetching.
    Promise.all([queryClient.prefetchQuery(homeFeedQuery()), minDelay]).then(finish);
    const capTimer = setTimeout(finish, SPLASH_MAX_MS);

    return () => {
      done = true;
      clearTimeout(capTimer);
    };
  }, [onFinish]);

  useEffect(() => {
    const loaderLoop = Animated.loop(
      Animated.timing(loaderTrack, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.back(1.3)),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      loaderLoop.start();
    });

    return () => {
      loaderLoop.stop();
    };
  }, [footerOpacity, loaderTrack, logoOpacity, logoScale]);

  const loaderTranslateX = loaderTrack.interpolate({
    inputRange: [0, 1],
    outputRange: [-LOADER_FILL_WIDTH, LOADER_WIDTH],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_NAVY} />

      <Animated.View
        style={{opacity: logoOpacity, transform: [{scale: logoScale}]}}>
        <Animated.Image source={splash} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      <Animated.View
        style={[styles.footer, {opacity: footerOpacity, bottom: insets.bottom + 32}]}>
        <View style={styles.loaderTrack}>
          <Animated.View
            style={[styles.loaderFill, {transform: [{translateX: loaderTranslateX}]}]}
          />
        </View>
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
  loaderTrack: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    height: 4,
    marginBottom: 16,
    overflow: 'hidden',
    width: LOADER_WIDTH,
  },
  loaderFill: {
    backgroundColor: ACCENT_TEAL,
    borderRadius: 999,
    height: 4,
    width: LOADER_FILL_WIDTH,
  },
  version: {
    color: '#7C90A0',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
});
