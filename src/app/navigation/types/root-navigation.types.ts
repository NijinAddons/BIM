import { NavigatorScreenParams } from '@react-navigation/native';

import { Product } from '../../../features/product/types';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Otp: { callingCode: string; mobile: string; phone: string };
  ProfileDetails: { mobile: string };
  MainTabs: NavigatorScreenParams<BottomTabParamList> | undefined;
  ProductDetails: { product: Product };
  CategoryDetails: { categoryTitle: string; sectionTitle: string };
  AddressSelection: undefined;
  ConfirmLocation: { address?: string; latitude?: number; longitude?: number };
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
