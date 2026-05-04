import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Image, Platform, StyleSheet, Text, View} from 'react-native';
import Geolocation from '@react-native-community/geolocation';

import {appConfig} from '../../../app/config/appConfig';
import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import {appicon} from '../../../assets/images';
import {logger} from '../../../utils/logger';
import {
  configureLocation,
  requestLocationPermission,
} from '../../../services/location/locationPermission.service';
import {getUserProfile, loadStoredProfile, setUserProfile} from '../../profile/service';

type SplashNavProp = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

type Props = {
  navigation: SplashNavProp;
};

type GeoPosition = {
  coords: {
    latitude: number;
    longitude: number;
  };
};

type GeoPositionError = {
  code?: number;
  message?: string;
};

type GoogleGeocodeResponse = {
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
  }>;
  status?: string;
};

type OpenStreetMapReverseGeocodeResponse = {
  address?: {
    city?: string;
    city_district?: string;
    neighbourhood?: string;
    road?: string;
    state?: string;
    suburb?: string;
    town?: string;
    village?: string;
  };
  display_name?: string;
  name?: string;
};

const SPLASH_LOCATION_TIMEOUT_MS = 12000;
const SPLASH_GEOCODE_TIMEOUT_MS = 8000;

const getSplashPosition = () =>
  new Promise<GeoPosition>((resolve, reject) => {
    let isSettled = false;
    const timeout = setTimeout(() => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      reject(new Error('Splash location request timed out.'));
    }, SPLASH_LOCATION_TIMEOUT_MS);

    Geolocation.getCurrentPosition(
      position => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        clearTimeout(timeout);
        resolve(position);
      },
      (error: GeoPositionError) => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        clearTimeout(timeout);
        reject(
          new Error(
            error.message || `Location failed with code ${error.code ?? 'unknown'}.`,
          ),
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 10000,
      },
    );
  });

const getGoogleLocationLabel = async (latitude: number, longitude: number) => {
  const response = await Promise.race([
    fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${appConfig.googleMapsApiKey}`,
    ),
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Splash Google Maps geocoding timed out.')),
        SPLASH_GEOCODE_TIMEOUT_MS,
      );
    }),
  ]);

  const data = (await response.json()) as GoogleGeocodeResponse;

  if (!response.ok || data.status !== 'OK' || !data.results?.[0]?.formatted_address) {
    throw new Error(
      data.error_message || `Google Maps could not resolve location: ${data.status}`,
    );
  }

  return data.results[0].formatted_address;
};

const getFallbackLocationLabel = async (latitude: number, longitude: number) => {
  const response = await Promise.race([
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    ),
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Splash fallback geocoding timed out.')),
        SPLASH_GEOCODE_TIMEOUT_MS,
      );
    }),
  ]);

  const data = (await response.json()) as OpenStreetMapReverseGeocodeResponse;

  if (data.display_name) {
    return data.display_name;
  }

  const addressParts = [
    data.address?.road,
    data.address?.neighbourhood,
    data.address?.suburb,
    data.address?.city_district,
    data.address?.city || data.address?.town || data.address?.village,
    data.address?.state,
  ].filter(Boolean);

  if (addressParts.length) {
    return addressParts.join(', ');
  }

  if (data.name) {
    return data.name;
  }

  throw new Error('Fallback reverse geocoder did not return an address.');
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
      let nextRoute: keyof RootStackParamList = hasFullName ? 'MainTabs' : 'Login';

      if (hasFullName) {
        const profile = getUserProfile();

        if (!profile.address.trim()) {
          configureLocation();

          try {
            const hasPermission = await requestLocationPermission();

            if (hasPermission) {
              const position = await getSplashPosition();
              const {latitude, longitude} = position.coords;

              let locationLabel = '';

              try {
                locationLabel = await getGoogleLocationLabel(latitude, longitude);
              } catch (error) {
                logger.log('Splash Google Maps reverse geocode failed', error);
                locationLabel = await getFallbackLocationLabel(latitude, longitude);
              }

              await setUserProfile(
                {
                  ...getUserProfile(),
                  address: locationLabel,
                },
                {profileCompleted: true},
              );
            }
          } catch (error) {
            logger.log('Splash location bootstrap failed', error);
          }
        }
      }

      navigationTimeout.current = setTimeout(() => {
        navigation.replace(nextRoute);
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
