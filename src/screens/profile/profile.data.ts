import type { ListCardItem } from '../../components';
import type { OrderStatusKey } from '../../services';
import { GREEN_TINT } from '../../theme/colors';

export const PROFILE_GREEN = '#167C6C';
export const DESTRUCTIVE = '#C2410C';

// TODO: confirm the published Privacy Policy / Terms & Conditions pages.
const PRIVACY_URL = 'https://buyinminutes.u.frappe.cloud/privacy';
const TERMS_URL = 'https://buyinminutes.u.frappe.cloud/terms';
const SUPPLIER_SIGNUP_URL =
  'https://buyinminutes.u.frappe.cloud/become-a-supplier/new';
const FLEET_ENROLLMENT_URL =
  'https://buyinminutes.u.frappe.cloud/Buy%20In%20Minutes/new';
const RIDER_SIGNUP_URL =
  'https://buyinminutes.u.frappe.cloud/Buy%20In%20Minutes/new';

/** A menu row does exactly one of: open a route, open a URL, or say "coming soon". */
export type MenuItem = ListCardItem & {
  comingSoon?: string;
  route?: 'SavedAddresses' | 'Wishlist';
  signedInOnly?: boolean;
  web?: { title: string; url: string };
};

export const MENU_SECTIONS: {
  items: MenuItem[];
  signedInOnly?: boolean;
  title: string;
}[] = [
  {
    signedInOnly: true,
    title: 'Account',
    items: [
      {
        icon: 'map-marker-outline',
        key: 'addresses',
        label: 'Saved Addresses',
        route: 'SavedAddresses',
      },
      {
        icon: 'heart-outline',
        key: 'wishlist',
        label: 'Wishlist',
        route: 'Wishlist',
      },
      {
        comingSoon: 'Coupons & Offers',
        icon: 'tag-outline',
        key: 'coupons',
        label: 'Coupons & Offers',
      },
    ],
  },
  {
    title: 'Partner with BIM',
    items: [
      {
        caption: 'List your store',
        icon: 'storefront-outline',
        key: 'sell',
        label: 'Sell with us',
        web: { title: 'Sell with us', url: SUPPLIER_SIGNUP_URL },
      },
      {
        caption: 'Enroll your fleet',
        icon: 'truck-outline',
        key: 'fleet',
        label: 'Delivery partner',
        web: {
          title: 'Delivery company enrollment',
          url: FLEET_ENROLLMENT_URL,
        },
      },
      {
        caption: 'Flexible shifts',
        icon: 'bicycle',
        key: 'rider',
        label: 'Become a BIM Rider',
        web: { title: 'Become a BIM Rider', url: RIDER_SIGNUP_URL },
      },
    ],
  },
  {
    title: 'Help & Legal',
    items: [
      {
        comingSoon: 'Help Center',
        icon: 'help-circle-outline',
        key: 'help',
        label: 'Help Center',
      },
      {
        icon: 'shield-outline',
        key: 'privacy',
        label: 'Privacy Policy',
        web: { title: 'Privacy Policy', url: PRIVACY_URL },
      },
      {
        icon: 'file-document-outline',
        key: 'terms',
        label: 'Terms & Conditions',
        web: { title: 'Terms & Conditions', url: TERMS_URL },
      },
    ],
  },
];

// Shown to guests in place of the My Orders card.
export const PERKS = [
  {
    accent: PROFILE_GREEN,
    caption: 'Live delivery updates',
    icon: 'truck-outline',
    label: 'Track orders',
    tint: GREEN_TINT,
  },
  {
    accent: '#C2415B',
    caption: 'Keep favourites for later',
    icon: 'heart-outline',
    label: 'Wishlist',
    tint: '#FCEBEF',
  },
  {
    accent: '#B7791F',
    caption: 'Exclusive deals & codes',
    icon: 'tag-outline',
    label: 'Member offers',
    tint: '#FDF3E1',
  },
];

export const ORDER_SHORTCUTS: {
  icon: string;
  label: string;
  showCount: boolean;
  status: OrderStatusKey;
}[] = [
  {
    icon: 'clock-outline',
    label: 'Processing',
    showCount: true,
    status: 'Processing',
  },
  {
    icon: 'truck-outline',
    label: 'Shipped',
    showCount: true,
    status: 'Out for delivery',
  },
  {
    icon: 'package-variant-closed',
    label: 'Delivered',
    showCount: false,
    status: 'Delivered',
  },
  {
    icon: 'close-circle-outline',
    label: 'Cancelled',
    showCount: false,
    status: 'Cancelled',
  },
];
