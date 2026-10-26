import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { signIn } from '../hooks/useAuth';
import {
  completeApplePhoneSignIn,
  completeGooglePhoneSignIn,
  requestGooglePhoneOtp,
} from '../services';
import LoginScreen from '../screens/auth/LoginScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import PhoneEntryScreen from '../screens/auth/PhoneEntryScreen';
import ProfileDetailsScreen from '../screens/auth/ProfileDetailsScreen';
import SplashScreen from '../screens/auth/SplashScreen';
import CartScreen from '../screens/cart/CartScreen';
import BrandCategoryItemsScreen from '../screens/home/BrandCategoryItemsScreen';
import BrandScreen from '../screens/home/BrandScreen';
import WeeklyKitsScreen from '../screens/home/WeeklyKitsScreen';
import ProductDetailScreen from '../screens/home/ProductDetailScreen';
import StoreScreen from '../screens/home/StoreScreen';
import SearchScreen from '../screens/search/SearchScreen';
import SavedAddressesScreen from '../screens/profile/SavedAddressesScreen';
import WebViewScreen from '../screens/profile/WebViewScreen';
import WishlistScreen from '../screens/wishlist/WishlistScreen';
import MainTabNavigator from './MainTabNavigator';
import OrdersStack from './stacks/OrdersStack';
import { APP_BACKGROUND } from './constants';
import type { RootStackParamList, RootStackScreenProps } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function SplashRoute({ navigation }: RootStackScreenProps<'Splash'>) {
  return <SplashScreen onFinish={() => navigation.replace('MainTabs')} />;
}

// Screens still take plain callbacks; adapt them to the navigator here so the
// screen components stay navigator-agnostic. Reached on demand (e.g. Cart's
// "Login to proceed"), not as a forced boot-time gate — the app is otherwise
// browsable as a guest.
// After any successful sign-in: drop the auth screens and land on Home,
// whichever tab the login was opened from.
function goHomeAfterSignIn(
  navigation: RootStackScreenProps<keyof RootStackParamList>['navigation'],
) {
  navigation.popTo('MainTabs', { screen: 'Home' });
}

function LoginRoute({ navigation }: RootStackScreenProps<'Login'>) {
  return (
    <LoginScreen
      onSkip={() => navigation.goBack()}
      onContinue={(phone, authFlowToken) =>
        navigation.navigate('Otp', { phone, authFlowToken })
      }
      onSignedIn={(sessionToken, user) => {
        signIn(sessionToken, user);
        goHomeAfterSignIn(navigation);
      }}
      onNeedsPhone={(idToken, user, provider) =>
        navigation.navigate('PhoneEntry', { idToken, user, provider })
      }
    />
  );
}

// Google/Apple sign-ins without a verified mobile number land here first. A
// new user's account is created only after the OTP
// (complete_phone_profile_with_google / complete_phone_profile_with_apple).
function PhoneEntryRoute({
  navigation,
  route,
}: RootStackScreenProps<'PhoneEntry'>) {
  const { idToken, user, provider } = route.params;

  return (
    <PhoneEntryScreen
      requestOtp={requestGooglePhoneOtp}
      onBack={() => navigation.goBack()}
      onCodeSent={(phone, authFlowToken) =>
        navigation.navigate('Otp', {
          phone,
          authFlowToken,
          socialIdToken: idToken,
          socialUser: user,
          socialProvider: provider,
        })
      }
    />
  );
}

function OtpRoute({ navigation, route }: RootStackScreenProps<'Otp'>) {
  const phone = route.params?.phone;
  const socialIdToken = route.params?.socialIdToken;
  const socialUser = route.params?.socialUser;
  const completeSocialPhoneSignIn =
    route.params?.socialProvider === 'apple'
      ? completeApplePhoneSignIn
      : completeGooglePhoneSignIn;

  if (socialIdToken && socialUser) {
    return (
      <OtpScreen
        authFlowToken={route.params?.authFlowToken}
        onBack={() => navigation.goBack()}
        onSubmitOtp={async (verifiedPhone, otp, authFlowToken) => {
          const response = await completeSocialPhoneSignIn(
            socialIdToken,
            socialUser.full_name,
            verifiedPhone,
            otp,
            authFlowToken,
          );
          if (!response.success || !response.session_token) {
            throw new Error(
              response.message || 'Could not finish signing in. Please try again.',
            );
          }
          signIn(
            response.session_token,
            response.user ?? { ...socialUser, mobile_no: verifiedPhone },
          );
          goHomeAfterSignIn(navigation);
        }}
        requestOtp={requestGooglePhoneOtp}
        phone={phone}
      />
    );
  }

  return (
    <OtpScreen
      authFlowToken={route.params?.authFlowToken}
      onBack={() => navigation.goBack()}
      onVerified={(isNewUser, profileToken, sessionToken, user) => {
        if (isNewUser) {
          navigation.replace('ProfileDetails', {
            phone,
            profileToken,
            sessionToken,
            user,
          });
          return;
        }
        if (sessionToken) {
          signIn(sessionToken, user);
        }
        goHomeAfterSignIn(navigation);
      }}
      phone={phone}
    />
  );
}

function ProfileDetailsRoute({
  navigation,
  route,
}: RootStackScreenProps<'ProfileDetails'>) {
  return (
    <ProfileDetailsScreen
      onSubmitted={(sessionToken, user) => {
        if (sessionToken) {
          signIn(sessionToken, user);
        }
        goHomeAfterSignIn(navigation);
      }}
      phone={route.params?.phone}
      profileToken={route.params?.profileToken}
      sessionToken={route.params?.sessionToken}
    />
  );
}

/**
 * Root stack for the app. Screens placed here (not inside a tab stack) are
 * reachable from every tab and from deep links — put shared detail screens,
 * search, checkout, and the on-demand sign-in flow here.
 */
export default function MainNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: APP_BACKGROUND },
      }}
    >
      <Stack.Screen name="Splash" component={SplashRoute} />
      <Stack.Screen
        name="MainTabs"
        component={MainTabNavigator}
        options={{ animation: 'default' }}
      />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Orders" component={OrdersStack} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="WeeklyKits" component={WeeklyKitsScreen} />
      <Stack.Screen name="BrandDetail" component={BrandScreen} />
      <Stack.Screen
        name="BrandCategoryItems"
        component={BrandCategoryItemsScreen}
      />
      <Stack.Screen name="StoreDetail" component={StoreScreen} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} />
      <Stack.Screen name="SavedAddresses" component={SavedAddressesScreen} />
      <Stack.Screen name="WebView" component={WebViewScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Checkout" component={WebViewScreen} />
      <Stack.Screen
        name="Login"
        component={LoginRoute}
        options={{ animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="PhoneEntry"
        component={PhoneEntryRoute}
        options={{ animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen
        name="Otp"
        component={OtpRoute}
        options={{ animation: 'slide_from_right', gestureEnabled: true }}
      />
      <Stack.Screen name="ProfileDetails" component={ProfileDetailsRoute} />
    </Stack.Navigator>
  );
}
