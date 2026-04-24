import Geolocation from '@react-native-community/geolocation';
import {Alert, Linking, PermissionsAndroid, Platform} from 'react-native';

const LOCATION_PERMISSION_MESSAGE =
  'Buy In Minutes uses your location to set your delivery location.';

export const configureLocation = () => {
  Geolocation.setRNConfiguration({
    authorizationLevel: 'whenInUse',
    enableBackgroundLocationUpdates: false,
    locationProvider: 'auto',
    skipPermissionRequests: Platform.OS === 'android',
  });
};

const showLocationSettingsAlert = () => {
  Alert.alert(
    'Location permission needed',
    'Enable location access in settings to use your current location.',
    [
      {text: 'Not now', style: 'cancel'},
      {text: 'Open settings', onPress: () => Linking.openSettings()},
    ],
  );
};

const requestIosLocationPermission = () =>
  new Promise<boolean>(resolve => {
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => {
        showLocationSettingsAlert();
        resolve(false);
      },
    );
  });

export const requestLocationPermission = async () => {
  if (Platform.OS === 'ios') {
    return requestIosLocationPermission();
  }

  const hasPermission = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );

  if (hasPermission) {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Location permission',
      message: LOCATION_PERMISSION_MESSAGE,
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    },
  );

  if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    return true;
  }

  if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    showLocationSettingsAlert();
  }

  return false;
};
