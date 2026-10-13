/* eslint-env jest */

import 'react-native-gesture-handler/jestSetup';

jest.mock(
  '@react-native-async-storage/async-storage',
  () => {
    let store = {};

    return {
      __esModule: true,
      default: {
        clear: jest.fn(() => {
          store = {};
          return Promise.resolve();
        }),
        getItem: jest.fn(key => Promise.resolve(store[key] ?? null)),
        removeItem: jest.fn(key => {
          delete store[key];
          return Promise.resolve();
        }),
        setItem: jest.fn((key, value) => {
          store[key] = value;
          return Promise.resolve();
        }),
      },
    };
  },
);

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  requestAuthorization: jest.fn(),
  setRNConfiguration: jest.fn(),
  stopObserving: jest.fn(),
  watchPosition: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const {View} = require('react-native');
  const MockMapView = props => React.createElement(View, props, props.children);
  const MockMarker = props => React.createElement(View, props, props.children);

  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    getTokens: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
  isErrorWithCode: jest.fn(() => false),
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    name: '[DEFAULT]',
  })),
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    signInWithCredential: jest.fn(),
  })),
  GoogleAuthProvider: {
    credential: jest.fn(),
  },
}));

jest.mock('@stripe/stripe-react-native', () => ({
  StripeProvider: ({children}) => children,
  useStripe: () => ({
    initPaymentSheet: jest.fn(),
    presentPaymentSheet: jest.fn(),
  }),
}));
