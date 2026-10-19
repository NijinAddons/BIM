import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import type {
  AuthUser,
  Brand,
  CategoryItem,
  QuotationRequestSummary,
  SalesOrderSummary,
  Store,
} from '../services';

/**
 * One place for every route + its params.
 *
 * Hierarchy:
 *   RootStack
 *   ├─ Splash          (boot screen, replaces itself with MainTabs)
 *   ├─ MainTabs (bottom tabs)
 *   │  ├─ Home     → HomeStack
 *   │  ├─ Categories → CategoriesStack
 *   │  ├─ Cart      (single screen)
 *   │  ├─ Orders    → OrdersStack
 *   │  └─ Profile   → ProfileStack
 *   ├─ ProductDetail   (shared — reachable from any tab / deep link)
 *   ├─ WeeklyKits      (shared — pick a weekly kit, opened from Home)
 *   ├─ BrandDetail     (shared)
 *   ├─ BrandCategoryItems (a brand's products in one category)
 *   ├─ StoreDetail     (shared)
 *   ├─ Wishlist        (shared)
 *   ├─ Search          (shared — Home's search bar)
 *   ├─ Checkout        (Stripe payment page, opened from Cart; going back
 *   │                   returns to Cart)
 *   └─ Login / Otp / ProfileDetails (sign-in flow, pushed on demand —
 *      e.g. from Cart's "Login to proceed" — the app is otherwise
 *      browsable as a guest; see `useAuthStatus` in `hooks/useAuth`)
 */

export type HomeStackParamList = {
  HomeFeed: undefined;
};

export type CategoriesStackParamList = {
  CategoriesList: { parentId?: string; parentName?: string } | undefined;
  CategoryItems: { categoryName: string; itemGroup: string };
};

export type OrdersStackParamList = {
  OrdersList: undefined;
  OrderDetails: { orderId: string; summary?: SalesOrderSummary };
  QuotationDetails: { requestId: string; summary?: QuotationRequestSummary };
};

export type WebViewParams = {
  title: string;
  url: string;
  paymentCheckout?: boolean;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  SavedAddresses: undefined;
  WebView: WebViewParams;
};

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Categories: NavigatorScreenParams<CategoriesStackParamList> | undefined;
  Cart: undefined;
  Orders: NavigatorScreenParams<OrdersStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  ProductDetail: { item: CategoryItem };
  WeeklyKits: { kitId?: string } | undefined;
  BrandDetail: { brand: Brand };
  BrandCategoryItems: { brand: Brand; itemGroup: string };
  StoreDetail: { store: Store };
  Wishlist: undefined;
  Search: undefined;
  Checkout: WebViewParams;
  Login: undefined;
  Otp: { phone?: string; authFlowToken?: string } | undefined;
  ProfileDetails:
    | {
        phone?: string;
        profileToken?: string;
        sessionToken?: string;
        user?: AuthUser;
      }
    | undefined;
};

/**
 * Flattened view of every app route. Used to type screen props so a screen
 * can navigate to any route — including shared ones on the root stack —
 * without hand-writing composite types everywhere.
 */
export type AppParamList = RootStackParamList &
  MainTabParamList &
  HomeStackParamList &
  CategoriesStackParamList &
  OrdersStackParamList &
  ProfileStackParamList;

// Makes `useNavigation()` / `useRoute()` fully typed with no generics.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends AppParamList {}
  }
}

// ---- Per-screen prop helpers ------------------------------------------------

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export type HomeStackScreenProps<T extends keyof HomeStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<HomeStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type CategoriesStackScreenProps<
  T extends keyof CategoriesStackParamList,
> = CompositeScreenProps<
  NativeStackScreenProps<CategoriesStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;

export type OrdersStackScreenProps<T extends keyof OrdersStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<OrdersStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ProfileStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;
