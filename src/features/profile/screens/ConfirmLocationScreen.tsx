import {RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import MapView, {PROVIDER_GOOGLE, type Region} from 'react-native-maps';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {appConfig} from '../../../app/config/appConfig';
import {RootStackParamList} from '../../../app/navigation/types/root-navigation.types';
import {
  configureLocation,
  requestLocationPermission,
} from '../../../services/location/locationPermission.service';
import {colors} from '../../../theme/colors';
import {getUserProfile, setUserProfile} from '../service';

type ConfirmLocationNavProp = NativeStackNavigationProp<
  RootStackParamList,
  'ConfirmLocation'
>;
type ConfirmLocationRouteProp = RouteProp<RootStackParamList, 'ConfirmLocation'>;

type Props = {
  navigation: ConfirmLocationNavProp;
  route: ConfirmLocationRouteProp;
};

type GoogleGeocodeResponse = {
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
  status?: string;
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

const DEFAULT_MAP_REGION: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 18,
  longitudeDelta: 18,
};
const HIGH_ACCURACY_LOCATION_TIMEOUT_MS = 18000;
const HIGH_ACCURACY_LOCATION_MAX_AGE_MS = 60000;
const FALLBACK_LOCATION_TIMEOUT_MS = 12000;
const FALLBACK_LOCATION_MAX_AGE_MS = 600000;

export default function ConfirmLocationScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const [address, setAddress] = React.useState(route.params.address ?? '');
  const [latitude, setLatitude] = React.useState(route.params.latitude ?? 0);
  const [longitude, setLongitude] = React.useState(route.params.longitude ?? 0);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchingLocation, setIsSearchingLocation] = React.useState(false);
  const [isUpdatingDraggedLocation, setIsUpdatingDraggedLocation] =
    React.useState(false);
  const [locationError, setLocationError] = React.useState('');
  const [isLoadingLocation, setIsLoadingLocation] = React.useState(
    !route.params.latitude || !route.params.longitude,
  );
  const hasLocation = Boolean(latitude && longitude);
  const selectedRegion: Region | undefined = hasLocation
    ? {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : undefined;
  const mapRegion = selectedRegion ?? DEFAULT_MAP_REGION;

  React.useEffect(() => {
    configureLocation();
  }, []);

  React.useEffect(() => {
    if (hasLocation) {
      if (!address.trim()) {
        getExactLocationLabel(latitude, longitude).then(setAddress);
      }
      return;
    }

    loadCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLocation, address, latitude, longitude]);

  const getExactLocationLabel = async (nextLatitude: number, nextLongitude: number) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${nextLatitude},${nextLongitude}&key=${appConfig.googleMapsApiKey}`,
      );
      const data = (await response.json()) as GoogleGeocodeResponse;

      console.log('Current location reverse geocode response', {
        ok: response.ok,
        status: response.status,
        googleStatus: data.status,
        errorMessage: data.error_message,
        count: data.results?.length ?? 0,
      });

      return data.results?.[0]?.formatted_address || 'Current location detected';
    } catch (error) {
      console.log('Current location reverse geocode failed', error);
      return 'Current location detected';
    }
  };

  const getPosition = (
    options: Parameters<typeof Geolocation.getCurrentPosition>[2],
  ) =>
    new Promise<GeoPosition>((resolve, reject) => {
      let isSettled = false;
      const timeoutMs = (options?.timeout ?? 10000) + 2000;
      const timeout = setTimeout(() => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        reject(new Error(`Location request did not respond within ${timeoutMs / 1000}s.`));
      }, timeoutMs);

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
          reject(new Error(error.message || `Location failed with code ${error.code ?? 'unknown'}.`));
        },
        options,
      );
    });

  const applyCurrentPosition = async (position: GeoPosition) => {
    const nextLatitude = position.coords.latitude;
    const nextLongitude = position.coords.longitude;

    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    setAddress(await getExactLocationLabel(nextLatitude, nextLongitude));
    setLocationError('');
  };

  const applyMapCenterPosition = async (region: Region) => {
    if (!hasLocation || isLoadingLocation) {
      return;
    }

    const nextLatitude = region.latitude;
    const nextLongitude = region.longitude;

    if (
      Math.abs(nextLatitude - latitude) < 0.00001 &&
      Math.abs(nextLongitude - longitude) < 0.00001
    ) {
      return;
    }

    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    setLocationError('');
    setIsUpdatingDraggedLocation(true);

    try {
      setAddress(await getExactLocationLabel(nextLatitude, nextLongitude));
    } catch {
      setAddress(
        `Pinned location (${nextLatitude.toFixed(5)}, ${nextLongitude.toFixed(5)})`,
      );
    } finally {
      setIsUpdatingDraggedLocation(false);
    }
  };

  const loadCurrentLocation = async () => {
    console.log('Current location request started', {platform: Platform.OS});

    const hasPermission = await requestLocationPermission();

    if (!hasPermission) {
      console.log('Current location permission denied');
      setIsLoadingLocation(false);
      setLocationError('Allow location access or search your location manually.');
      return;
    }

    setIsLoadingLocation(true);
    setLocationError('');

    try {
      console.log('Current location high accuracy lookup started');
      const exactPosition = await getPosition({
        enableHighAccuracy: true,
        timeout: HIGH_ACCURACY_LOCATION_TIMEOUT_MS,
        maximumAge: HIGH_ACCURACY_LOCATION_MAX_AGE_MS,
      });

      console.log('Current location high accuracy lookup succeeded', {
        latitude: exactPosition.coords.latitude,
        longitude: exactPosition.coords.longitude,
      });
      await applyCurrentPosition(exactPosition);
    } catch (exactError) {
      console.log('High accuracy location failed, trying fallback.', exactError);

      try {
        console.log('Current location fallback lookup started');
        const fallbackPosition = await getPosition({
          enableHighAccuracy: false,
          timeout: FALLBACK_LOCATION_TIMEOUT_MS,
          maximumAge: FALLBACK_LOCATION_MAX_AGE_MS,
        });

        console.log('Current location fallback lookup succeeded', {
          latitude: fallbackPosition.coords.latitude,
          longitude: fallbackPosition.coords.longitude,
        });
        await applyCurrentPosition(fallbackPosition);
      } catch (fallbackError) {
        console.log('Fallback location failed.', fallbackError);
        setLocationError(
          'Unable to detect your location. Search your area above or try again.',
        );
      }
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const searchLocation = async () => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      Alert.alert('Search location', 'Enter a location to search.');
      return;
    }

    setIsSearchingLocation(true);

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        trimmedQuery,
      )}&key=${appConfig.googleMapsApiKey}`;
      const response = await fetch(url);
      const data = (await response.json()) as GoogleGeocodeResponse;

      console.log('Location search response', {
        ok: response.ok,
        status: response.status,
        googleStatus: data.status,
        errorMessage: data.error_message,
        count: data.results?.length ?? 0,
      });

      if (!response.ok) {
        throw new Error(`Location search failed with status ${response.status}.`);
      }

      if (data.status === 'ZERO_RESULTS') {
        Alert.alert('No location found', 'Try searching with a more specific address.');
        return;
      }

      if (data.status !== 'OK') {
        throw new Error(data.error_message || `Google geocoding failed: ${data.status}`);
      }

      const firstResult = data.results?.[0];
      const nextLatitude = firstResult?.geometry?.location?.lat;
      const nextLongitude = firstResult?.geometry?.location?.lng;

      if (
        !firstResult ||
        typeof nextLatitude !== 'number' ||
        typeof nextLongitude !== 'number'
      ) {
        Alert.alert('No location found', 'Try searching with a more specific address.');
        return;
      }

      setLatitude(nextLatitude);
      setLongitude(nextLongitude);
      setLocationError('');
      setAddress(
        firstResult.formatted_address ||
          `Searched location (${nextLatitude.toFixed(5)}, ${nextLongitude.toFixed(5)})`,
      );
    } catch (error) {
      Alert.alert(
        'Unable to search location',
        error instanceof Error ? error.message : 'Please try again in a moment.',
      );
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const onConfirm = async () => {
    if (!address.trim()) {
      Alert.alert('Location required', 'Please wait for your location to load.');
      return;
    }

    await setUserProfile(
      {
        ...getUserProfile(),
        address,
      },
      {profileCompleted: true},
    );
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={[styles.header, {paddingTop: insets.top + 10}]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons color={colors.text} name="arrow-left" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Use current location</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.searchWrap}>
        <View style={styles.searchField}>
          <MaterialCommunityIcons color={colors.mutedText} name="magnify" size={20} />
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchLocation}
            placeholder="Search for area, street or building"
            placeholderTextColor={colors.mutedText}
            returnKeyType="search"
            style={styles.searchInput}
            value={searchQuery}
          />
          {isSearchingLocation ? (
            <ActivityIndicator color="#1f9d55" size="small" />
          ) : (
            <Pressable
              disabled={!searchQuery.trim()}
              hitSlop={10}
              onPress={searchLocation}
              style={!searchQuery.trim() && styles.searchButtonDisabled}>
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.mapArea}>
        <MapView
          mapType="standard"
          onMapReady={() => console.log('Google map view ready')}
          onRegionChangeComplete={applyMapCenterPosition}
          provider={PROVIDER_GOOGLE}
          region={mapRegion}
          showsCompass
          showsMyLocationButton
          showsUserLocation={hasLocation}
          style={styles.mapView}
        />
        {hasLocation ? (
          <View pointerEvents="none" style={styles.centerPin}>
            <MaterialCommunityIcons color="#1f9d55" name="map-marker" size={44} />
          </View>
        ) : null}
        {isLoadingLocation ? (
          <View pointerEvents="none" style={styles.mapLoading}>
            <ActivityIndicator color="#1f9d55" size="large" />
            <Text style={styles.mapLoadingText}>Fetching your location...</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.bottomSheet, {paddingBottom: insets.bottom + 16}]}>
        <View style={styles.addressCard}>
          <View style={styles.addressIconWrap}>
            <MaterialCommunityIcons color="#1f9d55" name="crosshairs-gps" size={20} />
          </View>
          <View style={styles.addressTextWrap}>
            <Text style={styles.addressTitle}>
              {isUpdatingDraggedLocation ? 'Updating address' : 'Detected address'}
            </Text>
            <Text style={styles.addressText}>
              {isUpdatingDraggedLocation
                ? 'Reading the pinned location...'
                : address || locationError || 'Waiting for your current location...'}
            </Text>
            {hasLocation && !locationError ? (
              <Text style={styles.dragHint}>Move the map to adjust the pin spot.</Text>
            ) : null}
            {locationError ? (
              <Pressable onPress={loadCurrentLocation} style={styles.retryLocationButton}>
                <Text style={styles.retryLocationText}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Pressable
          disabled={isLoadingLocation || isUpdatingDraggedLocation || !address.trim()}
          onPress={onConfirm}
          style={[
            styles.confirmButton,
            (isLoadingLocation || !address.trim() || isUpdatingDraggedLocation) &&
              styles.confirmButtonDisabled,
          ]}>
          <Text style={styles.confirmButtonText}>Use current location</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#eeeeee',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  searchWrap: {
    backgroundColor: '#ffffff',
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: '#f6f8f3',
    borderColor: '#e8eadf',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  searchButtonDisabled: {
    opacity: 0.45,
  },
  searchButtonText: {
    color: '#1f9d55',
    fontSize: 13,
    fontWeight: '900',
  },
  mapArea: {
    backgroundColor: '#f5fbf7',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  mapView: {
    height: '100%',
    width: '100%',
  },
  mapLoading: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  mapLoadingText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  centerPin: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -26,
    marginTop: -48,
    position: 'absolute',
    top: '50%',
    width: 52,
  },
  addressCard: {
    alignItems: 'flex-start',
    borderColor: '#e8eadf',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 16,
  },
  bottomSheet: {
    backgroundColor: '#ffffff',
    borderTopColor: '#eeeeee',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: -6},
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 8,
  },
  addressIconWrap: {
    alignItems: 'center',
    backgroundColor: '#e8f8ee',
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    marginRight: 12,
    width: 42,
  },
  addressTextWrap: {
    flex: 1,
  },
  addressTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  addressText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  dragHint: {
    color: '#1f9d55',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  retryLocationButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  retryLocationText: {
    color: '#1f9d55',
    fontSize: 13,
    fontWeight: '800',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#1f9d55',
    borderRadius: 16,
    marginTop: 18,
    paddingVertical: 15,
  },
  confirmButtonDisabled: {
    backgroundColor: '#aeb7aa',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
