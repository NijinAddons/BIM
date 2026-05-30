import {RouteProp, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
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
  openLocationServicesSettings,
  requestLocationPermission,
} from '../../../services/location/locationPermission.service';
import {colors} from '../../../theme/colors';
import {
  addSavedAddress,
  getUserProfile,
  setUserProfile,
  type SavedAddressDetails,
} from '../service';

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
    address_components?: Array<{
      long_name?: string;
      short_name?: string;
      types?: string[];
    }>;
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

type GeocodeResult = NonNullable<GoogleGeocodeResponse['results']>[number];
type AddressComponent = NonNullable<GeocodeResult['address_components']>[number];

type GeoPosition = {
  coords: {
    latitude: number;
    longitude: number;
  };
};

type LocationSuggestion = {
  address: string;
  components: AddressComponent[] | undefined;
  latitude: number;
  longitude: number;
};

type GeoPositionError = {
  code?: number;
  message?: string;
};

const HIGH_ACCURACY_LOCATION_TIMEOUT_MS = 8000;
const HIGH_ACCURACY_LOCATION_MAX_AGE_MS = 60000;
const QUICK_LOCATION_TIMEOUT_MS = 2500;
const QUICK_LOCATION_MAX_AGE_MS = 900000;
const FALLBACK_LOCATION_TIMEOUT_MS = 6000;
const FALLBACK_LOCATION_MAX_AGE_MS = 600000;

let lastResolvedMapLocation:
  | {
      address: string;
      latitude: number;
      longitude: number;
    }
  | null = null;

const isLocationServicesDisabledError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.trim().toLowerCase();

  return (
    message.includes('location provider is disabled') ||
    message.includes('provider disabled') ||
    message.includes('no location provider available') ||
    message.includes('location services are disabled')
  );
};

const getAddressComponent = (
  components: AddressComponent[] | undefined,
  type: string,
) => {
  if (!Array.isArray(components)) {
    return '';
  }

  const match = components.find(component => component.types?.includes(type));
  return match?.long_name?.trim() ?? '';
};

const getAddressComponentByPriority = (
  components: AddressComponent[] | undefined,
  types: string[],
) => {
  for (const type of types) {
    const value = getAddressComponent(components, type);

    if (value) {
      return value;
    }
  }

  return '';
};

const buildAddressDetailsFromComponents = (
  components: AddressComponent[] | undefined,
): Partial<SavedAddressDetails> => {
  const streetNumber = getAddressComponent(components, 'street_number');
  const route = getAddressComponentByPriority(components, [
    'route',
    'intersection',
  ]);
  const premise = getAddressComponentByPriority(components, [
    'premise',
    'subpremise',
    'establishment',
  ]);
  const subpremise = getAddressComponent(components, 'subpremise');
  const landmark = getAddressComponentByPriority(components, [
    'point_of_interest',
    'establishment',
    'premise',
  ]);
  const neighborhood = getAddressComponentByPriority(components, [
    'neighborhood',
    'sublocality_level_1',
    'sublocality',
    'sublocality_level_2',
    'sublocality_level_3',
  ]);
  const locality = getAddressComponentByPriority(components, [
    'locality',
    'postal_town',
    'administrative_area_level_2',
  ]);
  const state = getAddressComponentByPriority(components, [
    'administrative_area_level_1',
    'administrative_area_level_2',
  ]);
  const postalCode = getAddressComponent(components, 'postal_code');
  const country = getAddressComponent(components, 'country');
  const apartment = subpremise || premise || streetNumber;
  const buildingNumber = streetNumber || premise;
  const area = neighborhood || locality;
  const place =
    landmark ||
    premise ||
    neighborhood ||
    locality;

  return {
    apartment,
    area,
    buildingNumber,
    city: locality,
    country,
    landmark,
    place,
    postalCode,
    state,
    street: route,
  };
};

const buildLocationLabelFromResult = (result?: GeocodeResult) => {
  if (!result) {
    return '';
  }

  const parsedDetails = buildAddressDetailsFromComponents(result.address_components);
  const parts = [
    parsedDetails.area,
    parsedDetails.city,
    parsedDetails.state,
    parsedDetails.country,
  ]
    .map(part => part?.trim() ?? '')
    .filter(Boolean)
    .filter((part, index, array) => array.indexOf(part) === index);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return result.formatted_address?.trim() ?? '';
};

const getPrimaryGeocodeResult = (data: GoogleGeocodeResponse): GeocodeResult | undefined =>
  data.results?.[0];

export default function ConfirmLocationScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const mode = route.params.mode ?? 'current';
  const isSearchMode = mode === 'search';
  const profile = getUserProfile();
  const initialDetails = route.params.details;
  const initialLatitude = route.params.latitude ?? lastResolvedMapLocation?.latitude ?? 0;
  const initialLongitude = route.params.longitude ?? lastResolvedMapLocation?.longitude ?? 0;
  const [address, setAddress] = React.useState(
    route.params.address ?? lastResolvedMapLocation?.address ?? '',
  );
  const [latitude, setLatitude] = React.useState(initialLatitude);
  const [longitude, setLongitude] = React.useState(initialLongitude);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(false);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = React.useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = React.useState(false);
  const [isAddressDetailsVisible, setIsAddressDetailsVisible] = React.useState(
    false,
  );
  const [isUpdatingDraggedLocation, setIsUpdatingDraggedLocation] =
    React.useState(false);
  const [locationError, setLocationError] = React.useState('');
  const [isLoadingLocation, setIsLoadingLocation] = React.useState(
    !(route.params.latitude || lastResolvedMapLocation?.latitude) ||
      !(route.params.longitude || lastResolvedMapLocation?.longitude),
  );
  const [formValues, setFormValues] = React.useState<SavedAddressDetails>({
    addressType: initialDetails?.addressType ?? 'Home',
    apartment: initialDetails?.apartment ?? '',
    area: initialDetails?.area ?? '',
    buildingNumber: initialDetails?.buildingNumber ?? '',
    city: initialDetails?.city ?? '',
    country: initialDetails?.country ?? '',
    fullName:
      initialDetails?.fullName ?? (profile.name === 'BIM User' ? '' : profile.name),
    landmark: initialDetails?.landmark ?? '',
    place: initialDetails?.place ?? '',
    phoneNumber: initialDetails?.phoneNumber ?? profile.mobile,
    postalCode: initialDetails?.postalCode ?? '',
    state: initialDetails?.state ?? '',
    street: initialDetails?.street ?? '',
  });
  const hasLocation = Boolean(latitude && longitude);
  const selectedRegion: Region | undefined = hasLocation
    ? {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : undefined;
  const mapRegion = selectedRegion;
  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

  const cacheResolvedMapLocation = React.useCallback(
    (nextLatitude: number, nextLongitude: number, nextAddress: string) => {
      if (!nextAddress.trim()) {
        return;
      }

      lastResolvedMapLocation = {
        address: nextAddress.trim(),
        latitude: nextLatitude,
        longitude: nextLongitude,
      };
    },
    [],
  );

  React.useEffect(() => {
    configureLocation();
  }, []);

  React.useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 3) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      setIsSuggestionsVisible(false);
      return;
    }

    let isActive = true;
    const timeout = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      setIsSuggestionsVisible(true);

      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          trimmedQuery,
        )}&key=${appConfig.googleMapsApiKey}`;
        const response = await fetch(url);
        const data = (await response.json()) as GoogleGeocodeResponse;

        if (!isActive || !response.ok || data.status !== 'OK') {
          if (isActive && data.status === 'ZERO_RESULTS') {
            setSuggestions([]);
          }
          return;
        }

        const nextSuggestions = (data.results ?? [])
          .map(result => {
            const nextLatitude = result.geometry?.location?.lat;
            const nextLongitude = result.geometry?.location?.lng;
            const nextAddress = result.formatted_address?.trim();

            if (
              !nextAddress ||
              typeof nextLatitude !== 'number' ||
              typeof nextLongitude !== 'number'
            ) {
              return null;
            }

            return {
              address: buildLocationLabelFromResult(result) || nextAddress,
              components: result.address_components,
              latitude: nextLatitude,
              longitude: nextLongitude,
            };
          })
          .filter(
            (item): item is LocationSuggestion =>
              item !== null,
          )
          .slice(0, 5);

        if (isActive) {
          setSuggestions(nextSuggestions);
          setIsSuggestionsVisible(true);
        }
      } catch {
        if (isActive) {
          setSuggestions([]);
          setIsSuggestionsVisible(false);
        }
      } finally {
        if (isActive) {
          setIsLoadingSuggestions(false);
        }
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  React.useEffect(() => {
    if (hasLocation) {
      if (!address.trim()) {
        getExactLocationLabel(latitude, longitude).then(setAddress);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLocation, address, latitude, longitude]);

  useFocusEffect(
    React.useCallback(() => {
      configureLocation();

      if (route.params.savedAddressId) {
        return undefined;
      }

      if (isSearchMode || !hasLocation) {
        void loadCurrentLocation();
      }

      return undefined;
    }, [hasLocation, isSearchMode, route.params.savedAddressId]),
  );

  const fetchGeocodeResultByCoordinates = async (
    nextLatitude: number,
    nextLongitude: number,
  ) => {
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

    const result = getPrimaryGeocodeResult(data);

    console.log(
      'Fetched map location',
      buildLocationLabelFromResult(result) || result?.formatted_address || null,
    );

    return result;
  };

  const getExactLocationLabel = async (nextLatitude: number, nextLongitude: number) => {
    try {
      const result = await fetchGeocodeResultByCoordinates(nextLatitude, nextLongitude);
      return buildLocationLabelFromResult(result) || 'Current location detected';
    } catch (error) {
      console.log('Current location reverse geocode failed', error);
      return 'Current location detected';
    }
  };

  const updateFormFromGoogleResult = React.useCallback(
    (result?: GeocodeResult) => {
      if (!result) {
        return;
      }

      const parsedDetails = buildAddressDetailsFromComponents(result.address_components);

      setFormValues(current => ({
        ...current,
        apartment: parsedDetails.apartment ?? '',
        area: parsedDetails.area ?? '',
        buildingNumber: parsedDetails.buildingNumber ?? '',
        city: parsedDetails.city ?? '',
        country: parsedDetails.country ?? '',
        landmark: parsedDetails.landmark ?? '',
        place: parsedDetails.place ?? '',
        postalCode: parsedDetails.postalCode ?? '',
        state: parsedDetails.state ?? '',
        street: parsedDetails.street ?? '',
      }));
    },
    [],
  );

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
    try {
      const result = await fetchGeocodeResultByCoordinates(nextLatitude, nextLongitude);
      updateFormFromGoogleResult(result);
      const nextAddress =
        buildLocationLabelFromResult(result) || 'Current location detected';
      setAddress(nextAddress);
      cacheResolvedMapLocation(nextLatitude, nextLongitude, nextAddress);
    } catch {
      setAddress('Current location detected');
    }
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
      const result = await fetchGeocodeResultByCoordinates(nextLatitude, nextLongitude);
      updateFormFromGoogleResult(result);
      const nextAddress =
        buildLocationLabelFromResult(result) || 'Pinned location selected';
      setAddress(nextAddress);
      cacheResolvedMapLocation(nextLatitude, nextLongitude, nextAddress);
    } catch {
      setAddress('Pinned location selected');
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
      console.log('Current location quick lookup started');
      try {
        const quickPosition = await getPosition({
          enableHighAccuracy: false,
          timeout: QUICK_LOCATION_TIMEOUT_MS,
          maximumAge: QUICK_LOCATION_MAX_AGE_MS,
        });

        console.log('Current location quick lookup succeeded', {
          latitude: quickPosition.coords.latitude,
          longitude: quickPosition.coords.longitude,
        });
        await applyCurrentPosition(quickPosition);
        setIsLoadingLocation(false);

        void (async () => {
          try {
            console.log('Current location high accuracy refinement started');
            const exactPosition = await getPosition({
              enableHighAccuracy: true,
              timeout: HIGH_ACCURACY_LOCATION_TIMEOUT_MS,
              maximumAge: HIGH_ACCURACY_LOCATION_MAX_AGE_MS,
            });

            console.log('Current location high accuracy refinement succeeded', {
              latitude: exactPosition.coords.latitude,
              longitude: exactPosition.coords.longitude,
            });
            await applyCurrentPosition(exactPosition);
          } catch (exactError) {
            console.log('Current location high accuracy refinement failed.', exactError);
          }
        })();
        return;
      } catch (quickError) {
        console.log('Quick location failed, trying fallback.', quickError);
      }

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
      }
    } catch (error) {
      console.log('Unable to resolve any current location lookup.', error);
      if (isLocationServicesDisabledError(error)) {
        setLocationError('Turn on device location to detect your current address.');
        Alert.alert(
          'Turn on location',
          'Location services are off. Enable location on your device to fetch your current address on the map.',
          [
            {text: 'Not now', style: 'cancel'},
            {
              text: 'Open settings',
              onPress: () => {
                void openLocationServicesSettings();
              },
            },
          ],
        );
        return;
      }

      setLocationError(
        'Unable to detect your location. Search your area above or try again.',
      );
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

      const firstResult = getPrimaryGeocodeResult(data);
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
      setSuggestions([]);
      setIsSuggestionsVisible(false);
      updateFormFromGoogleResult(firstResult);
      const nextAddress =
        buildLocationLabelFromResult(firstResult) || 'Selected location';
      setAddress(nextAddress);
      cacheResolvedMapLocation(nextLatitude, nextLongitude, nextAddress);
    } catch (error) {
      Alert.alert(
        'Unable to search location',
        error instanceof Error ? error.message : 'Please try again in a moment.',
      );
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const onSelectSuggestion = (suggestion: LocationSuggestion) => {
    setSearchQuery(suggestion.address);
    setLatitude(suggestion.latitude);
    setLongitude(suggestion.longitude);
    setAddress(suggestion.address);
    cacheResolvedMapLocation(
      suggestion.latitude,
      suggestion.longitude,
      suggestion.address,
    );
    updateFormFromGoogleResult(
      suggestion.components
        ? {
            address_components: suggestion.components,
            formatted_address: suggestion.address,
          }
        : undefined,
    );
    setLocationError('');
    setSuggestions([]);
    setIsSuggestionsVisible(false);
  };

  const updateFormValue = (field: keyof SavedAddressDetails, value: string) => {
    setFormValues(current => ({
      ...current,
      [field]: value,
    }));
  };

  const openAddressDetails = () => {
    if (!address.trim()) {
      Alert.alert('Location required', 'Select a location on the map before adding details.');
      return;
    }

    setIsAddressDetailsVisible(true);
  };

  const onConfirm = async () => {
    const trimmedAddress = address.trim();

    if (!trimmedAddress) {
      Alert.alert(
        isSearchMode ? 'Address required' : 'Location required',
        isSearchMode
          ? 'Search and select an address before saving.'
          : 'Please wait for your location to load.',
      );
      return;
    }

    if (isSearchMode) {
      if (!formValues.fullName?.trim()) {
        Alert.alert('Name required', 'Please enter the customer name.');
        return;
      }

      if (!formValues.phoneNumber?.trim()) {
        Alert.alert('Phone required', 'Please enter the phone number.');
        return;
      }
    }

    await setUserProfile(
      {
        ...profile,
        address: trimmedAddress,
        mobile: formValues.phoneNumber?.trim() || profile.mobile,
        name: formValues.fullName?.trim() || profile.name,
      },
      {profileCompleted: true},
    );
    await addSavedAddress({
      address: trimmedAddress,
      id: route.params.savedAddressId,
      details: isSearchMode ? formValues : undefined,
    });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={[styles.header, {paddingTop: insets.top + 10}]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons color={colors.text} name="arrow-left" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isSearchMode
            ? route.params.savedAddressId
              ? 'Edit address'
              : 'Add new address'
            : 'Use current location'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.searchWrap}>
        <View style={styles.searchField}>
          <MaterialCommunityIcons color={colors.mutedText} name="magnify" size={20} />
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={text => {
              setSearchQuery(text);
              setIsSuggestionsVisible(text.trim().length >= 3);
            }}
            onFocus={() => setIsSuggestionsVisible(searchQuery.trim().length >= 3)}
            onSubmitEditing={searchLocation}
            placeholder="Search for area, street or building"
            placeholderTextColor={colors.mutedText}
            returnKeyType="search"
            style={styles.searchInput}
            value={searchQuery}
          />
          {isSearchingLocation || isLoadingSuggestions ? (
            <ActivityIndicator color="#1f9d55" size="small" />
          ) : (
            <Pressable
              disabled={!searchQuery.trim()}
              hitSlop={10}
              onPress={() => {
                setSearchQuery('');
                setSuggestions([]);
                setIsSuggestionsVisible(false);
              }}
              style={!searchQuery.trim() && styles.searchButtonDisabled}>
              <MaterialCommunityIcons
                color={searchQuery.trim() ? colors.text : colors.mutedText}
                name="close"
                size={18}
              />
            </Pressable>
          )}
        </View>
        {isSuggestionsVisible && suggestions.length > 0 ? (
          <View style={styles.suggestionsDropdown}>
            {suggestions.map(suggestion => (
              <Pressable
                key={`${suggestion.latitude}-${suggestion.longitude}`}
                onPress={() => onSelectSuggestion(suggestion)}
                style={styles.suggestionItem}>
                <MaterialCommunityIcons
                  color="#1f9d55"
                  name="map-marker-outline"
                  size={18}
                />
                <Text numberOfLines={2} style={styles.suggestionText}>
                  {suggestion.address}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {isSuggestionsVisible &&
        !isLoadingSuggestions &&
        searchQuery.trim().length >= 3 &&
        suggestions.length === 0 ? (
          <View style={styles.suggestionsDropdown}>
            <View style={styles.emptySuggestionState}>
              <MaterialCommunityIcons
                color={colors.mutedText}
                name="map-search-outline"
                size={18}
              />
              <Text style={styles.emptySuggestionText}>No matching addresses found.</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.mapArea}>
        {mapRegion ? (
          <MapView
            initialRegion={mapRegion}
            mapType="standard"
            onMapReady={() => console.log('Google map view ready')}
            onRegionChangeComplete={applyMapCenterPosition}
            provider={mapProvider}
            region={mapRegion}
            showsCompass
            showsMyLocationButton
            showsUserLocation={hasLocation}
            style={styles.mapView}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <MaterialCommunityIcons
              color="#1f9d55"
              name="map-search-outline"
              size={32}
            />
            <Text style={styles.mapPlaceholderTitle}>Detecting your location</Text>
            <Text style={styles.mapPlaceholderText}>
              The map will center on your current country and area once location is available.
            </Text>
          </View>
        )}
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

      {isSearchMode ? (
        <View
          style={[
            styles.bottomSheet,
            isAddressDetailsVisible && styles.bottomSheetExpanded,
            {paddingBottom: insets.bottom + 16},
          ]}>
          {isAddressDetailsVisible ? (
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.bottomSheetContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}>
              <View style={styles.addressCard}>
                <View style={styles.addressIconWrap}>
                  <MaterialCommunityIcons color="#1f9d55" name="map-marker-outline" size={20} />
                </View>
                <View style={styles.addressTextWrap}>
                  <Text style={styles.addressTitle}>Deliver to</Text>
                  <Text style={styles.addressText}>
                    {address || 'Search above to select an address.'}
                  </Text>
                </View>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Delivery details</Text>
                <Text style={styles.formSubtitle}>
                  Google Maps fills the location. Complete the remaining customer and building details below.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full name</Text>
                  <TextInput
                    autoCapitalize="words"
                    onChangeText={value => updateFormValue('fullName', value)}
                    placeholder="Customer name"
                    placeholderTextColor={colors.mutedText}
                    style={styles.textInput}
                    value={formValues.fullName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile number</Text>
                  <TextInput
                    keyboardType="phone-pad"
                    onChangeText={value => updateFormValue('phoneNumber', value)}
                    placeholder="Mobile number"
                    placeholderTextColor={colors.mutedText}
                    style={styles.textInput}
                    value={formValues.phoneNumber}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Flat / Building name</Text>
                  <TextInput
                    onChangeText={value => updateFormValue('apartment', value)}
                    placeholder="Flat / Building name"
                    placeholderTextColor={colors.mutedText}
                    style={styles.textInput}
                    value={formValues.apartment}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Street</Text>
                  <TextInput
                    onChangeText={value => updateFormValue('street', value)}
                    placeholder="Street or road"
                    placeholderTextColor={colors.mutedText}
                    style={styles.textInput}
                    value={formValues.street}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Area / Sector / Locality</Text>
                  <TextInput
                    onChangeText={value => updateFormValue('area', value)}
                    placeholder="Area / Sector / Locality"
                    placeholderTextColor={colors.mutedText}
                    style={styles.textInput}
                    value={formValues.area}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.rowItem]}>
                    <Text style={styles.inputLabel}>Landmark</Text>
                    <TextInput
                      onChangeText={value => updateFormValue('landmark', value)}
                      placeholder="Nearby landmark"
                      placeholderTextColor={colors.mutedText}
                      style={styles.textInput}
                      value={formValues.landmark}
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.rowItem]}>
                    <Text style={styles.inputLabel}>Pincode</Text>
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={value => updateFormValue('postalCode', value)}
                      placeholder="Pincode"
                      placeholderTextColor={colors.mutedText}
                      style={styles.textInput}
                      value={formValues.postalCode}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Type of address</Text>
                  <View style={styles.typeRow}>
                    {(['Home', 'Office'] as const).map(type => {
                      const isActive = formValues.addressType === type;

                      return (
                        <Pressable
                          key={type}
                          onPress={() => updateFormValue('addressType', type)}
                          style={[styles.typeChip, isActive && styles.typeChipActive]}>
                          <Text style={[styles.typeChipText, isActive && styles.typeChipTextActive]}>
                            {type}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
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
                <Text style={styles.confirmButtonText}>Save address</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <View style={styles.deliveryModal}>
              <Text style={styles.deliveryModalTitle}>Deliver to</Text>
              <View style={styles.addressCard}>
                <View style={styles.addressIconWrap}>
                  <MaterialCommunityIcons color="#1f9d55" name="map-marker-outline" size={20} />
                </View>
                <View style={styles.addressTextWrap}>
                  <Text style={styles.addressText}>
                    {address || 'Search above to select an address.'}
                  </Text>
                </View>
              </View>

              <Pressable
                disabled={!address.trim() || isLoadingLocation}
                onPress={openAddressDetails}
                style={[
                  styles.confirmButton,
                  (!address.trim() || isLoadingLocation) && styles.confirmButtonDisabled,
                ]}>
                <Text style={styles.confirmButtonText}>
                  {route.params.savedAddressId ? 'Edit address details' : 'Add address details'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View
          style={[
            styles.bottomSheet,
            {paddingBottom: insets.bottom + 16},
          ]}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.bottomSheetContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}>
        <View style={styles.addressCard}>
          <View style={styles.addressIconWrap}>
            <MaterialCommunityIcons color="#1f9d55" name="crosshairs-gps" size={20} />
          </View>
          <View style={styles.addressTextWrap}>
            <Text style={styles.addressTitle}>
              {isUpdatingDraggedLocation
                ? 'Updating address'
                : isSearchMode
                  ? 'Selected address'
                  : 'Detected address'}
            </Text>
            <Text style={styles.addressText}>
              {isUpdatingDraggedLocation
                ? 'Reading the pinned location...'
                : address ||
                  locationError ||
                  (isSearchMode
                    ? 'Search above to select an address.'
                    : 'Waiting for your current location...')}
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
          <Text style={styles.confirmButtonText}>
            {isSearchMode ? 'Save address' : 'Use current location'}
          </Text>
        </Pressable>
        </ScrollView>
      </View>
      )}
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
    zIndex: 10,
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
  suggestionsDropdown: {
    backgroundColor: '#ffffff',
    borderColor: '#e8eadf',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  suggestionItem: {
    alignItems: 'center',
    borderBottomColor: '#f0f2ea',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionText: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  emptySuggestionState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptySuggestionText: {
    color: colors.mutedText,
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
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
  mapArea: {
    backgroundColor: '#f5fbf7',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  mapPlaceholder: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  mapPlaceholderTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  mapPlaceholderText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
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
    minHeight: 116,
    padding: 18,
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
  bottomSheetExpanded: {
    maxHeight: '52%',
  },
  bottomSheetContent: {
    gap: 18,
  },
  deliveryModal: {
    gap: 18,
    minHeight: 220,
  },
  deliveryModalTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
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
    minHeight: 72,
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
    minHeight: 56,
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
  formCard: {
    borderColor: '#e8eadf',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  formTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  formSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  inputGroup: {
    marginTop: 14,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  textInput: {
    borderColor: '#e8eadf',
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeChip: {
    borderColor: '#dbe4f0',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  typeChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  typeChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  typeChipTextActive: {
    color: '#2563eb',
  },
  rowItem: {
    flex: 1,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#1f9d55',
    borderRadius: 16,
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
