import {NavigatorScreenParams} from '@react-navigation/native';

import {Product} from '../../../features/product/service';
import {SavedAddressDetails} from '../../../features/profile/service';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Otp: {
    authFlow: 'login' | 'signup';
    callingCode: string;
    customer?: string;
    email?: string;
    expiresIn?: number;
    maxAttempts?: number;
    mobile: string;
    name?: string;
    phone: string;
  };
  PhoneEntry: {
    customer?: string;
    email: string;
    name: string;
  };
  ProfileDetails: {mobile: string; phone: string};
  MainTabs: NavigatorScreenParams<BottomTabParamList> | undefined;
  ProductDetails: {product: Product};
  Search:
    | {
        query?: string;
        submittedAt?: number;
      }
    | undefined;
  CategoryDetails: {categoryTitle: string; sectionTitle: string};
  AddressSelection: undefined;
  ConfirmLocation: {
    address?: string;
    details?: SavedAddressDetails;
    latitude?: number;
    longitude?: number;
    mode?: 'current' | 'search';
    savedAddressId?: string;
  };
  EditProfile: undefined;
  MyAddresses: undefined;
  Orders: undefined;
  Wishlist: undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  Categories: undefined;
  Cart: undefined;
  Profile: undefined;
};
