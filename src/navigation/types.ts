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
  SocialProvider,
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
 *   │  ├─ Explore   (single screen)
 *   │  └─ Services  (single screen)
 *   │  (+ Profile — a drawer over the tabs, opened from the header avatar)
 *   ├─ Cart            (shared — opened from Home / product screens)
 *   ├─ Orders → OrdersStack (shared — opened from Profile / after payment)
 *   ├─ ProductDetail   (shared — reachable from any tab / deep link)
 *   ├─ WeeklyKits      (shared — pick a weekly kit, opened from Home)
 *   ├─ BrandDetail     (shared)
 *   ├─ BrandCategoryItems (a brand's products in one category)
 *   ├─ StoreDetail     (shared)
 *   ├─ Wishlist        (shared)
 *   ├─ SavedAddresses  (opened from the Profile drawer)
 *   ├─ WebView         (help / policy pages, opened from the Profile drawer)
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

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Categories: NavigatorScreenParams<CategoriesStackParamList> | undefined;
  Explore: undefined;
  Services: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Cart: undefined;
  Orders: NavigatorScreenParams<OrdersStackParamList> | undefined;
  ProductDetail: { item: CategoryItem };
  WeeklyKits: { kitId?: string } | undefined;
  BrandDetail: { brand: Brand };
  BrandCategoryItems: { brand: Brand; itemGroup: string };
  StoreDetail: { store: Store };
  Wishlist: undefined;
  SavedAddresses: undefined;
  WebView: WebViewParams;
  Search: undefined;
  Checkout: WebViewParams;
  Login: undefined;
  // Phone + OTP step after a Google/Apple sign-in whose account has no
  // verified mobile number yet. Sign-in completes only after it.
  PhoneEntry: { idToken: string; user: AuthUser; provider: SocialProvider };
  Otp:
    | {
        phone?: string;
        authFlowToken?: string;
        // Set when verifying a phone for a pending Google/Apple sign-in.
        socialIdToken?: string;
        socialUser?: AuthUser;
        socialProvider?: SocialProvider;
      }
    | undefined;
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
  OrdersStackParamList;

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
    RootStackScreenProps<keyof RootStackParamList>
  >;
