import {
  GoogleSignin,
  isCancelledResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';

import {appConfig} from '../../app/config/appConfig';
import {apiClient} from '../api/apiClient';
import {GoogleAuthResponse, GoogleLoginResponse} from './auth.types';

let isGoogleSigninConfigured = false;

const getTrimmedWebClientId = () => appConfig.firebaseGoogleWebClientId.trim();

const configureGoogleSignin = () => {
  if (isGoogleSigninConfigured) {
    return;
  }

  GoogleSignin.configure({
    iosClientId: appConfig.firebaseGoogleIosClientId.trim() || undefined,
    webClientId: getTrimmedWebClientId() || undefined,
  });

  isGoogleSigninConfigured = true;
};

export const googleAuthService = {
  configure: () => {
    configureGoogleSignin();
  },

  isConfigured: () => Boolean(getTrimmedWebClientId()),

  signIn: async (): Promise<GoogleAuthResponse> => {
    if (!getTrimmedWebClientId()) {
      throw new Error(
        'Add the Firebase Web Client ID in appConfig and re-download google-services.json after enabling Google sign-in and SHA-1 in Firebase.',
      );
    }

    configureGoogleSignin();
    await GoogleSignin.hasPlayServices();

    if (auth().currentUser) {
      try {
        await auth().signOut();
      } catch {
        // Ignore pre-login Firebase sign-out failures and continue to the account chooser.
      }
    }

    try {
      // Clear the previously selected Google account so the chooser is shown every time.
      await GoogleSignin.signOut();
    } catch {
      // Ignore if there is no active Google session yet.
    }

    const signInResult = await GoogleSignin.signIn();

    if (isCancelledResponse(signInResult)) {
      const cancelledError = new Error('Google sign-in was cancelled.');
      Object.assign(cancelledError, {code: statusCodes.SIGN_IN_CANCELLED});
      throw cancelledError;
    }

    console.log('[Google Login] signIn result', signInResult);

    const googleUser = signInResult.data?.user;
    console.log('[Google Login] Google user details', googleUser);

    let googleIdToken = signInResult.data?.idToken;

    if (!googleIdToken) {
      const tokenResponse = await GoogleSignin.getTokens();
      console.log('[Google Login] token response', tokenResponse);
      googleIdToken = tokenResponse.idToken;
    }

    if (!googleIdToken) {
      throw new Error('Google sign-in did not return an ID token.');
    }

    const credential = auth.GoogleAuthProvider.credential(googleIdToken);
    const userCredential = await auth().signInWithCredential(credential);
    const idToken = String(await userCredential.user.getIdToken(true));

    if (!idToken) {
      throw new Error('Firebase sign-in did not return an ID token.');
    }

    console.log('[Google Login] Firebase ID token', idToken);
    console.log('[Google Login] Firebase user details', {
      displayName: userCredential.user.displayName,
      email: userCredential.user.email,
      phoneNumber: userCredential.user.phoneNumber,
      photoURL: userCredential.user.photoURL,
      providerId: userCredential.user.providerId,
      uid: userCredential.user.uid,
    });
    console.log('[Google Login] Normalized profile', {
      email: googleUser?.email ?? '',
      mobile: '',
      name: googleUser?.name ?? 'BIM User',
    });

    const backendResponse = await apiClient.post<GoogleLoginResponse>(
      appConfig.googleLoginUrl,
      {
        body: {
          id_token: idToken,
        },
        logLabel: 'Google login response',
      },
    );

    console.log('[Google Login] backend response', backendResponse.data);

    return {
      backendResponse: backendResponse.data,
      idToken,
      profile: {
        email: googleUser?.email ?? '',
        mobile: '',
        name: googleUser?.name ?? 'BIM User',
      },
    };
  },

  signOut: async () => {
    configureGoogleSignin();

    if (auth().currentUser) {
      await auth().signOut();
    }

    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignore if there is no active Google session.
    }
  },
};
