import {NavigatorScreenParams} from '@react-navigation/native';

import {Product} from '../../../features/product/types';
import {SavedAddressDetails} from '../../../features/profile/service';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Otp: {
    authFlow: 'login' | 'signup';
    callingCode: string;
    mobile: string;
    phone: string;
  };
  ProfileDetails: {mobile: string; phone: string};
  MainTabs: NavigatorScreenParams<BottomTabParamList> | undefined;
  ProductDetails: {product: Product};
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
  Wishlist: undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  Search: undefined;
  Cart: undefined;
  Profile: undefined;
};
