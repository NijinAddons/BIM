import type {LinkingOptions} from '@react-navigation/native';

import type {RootStackParamList} from './types';

/**
 * Deep-link map for universal links and push-notification payloads.
 *
 * TODO: `ProductDetail` currently takes a full `CategoryItem` object as a
 * param, which can't come from a URL. To make `product/:id` linkable, change
 * the route param to `{id: string}` and have the screen fetch the item.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['buyinminutes://', 'https://buyinminutes.app'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: {screens: {HomeFeed: 'home'}},
          Categories: {
            screens: {
              CategoriesList: 'categories',
              CategoryItems: 'categories/:itemGroup',
            },
          },
          Explore: 'explore',
          Services: 'services',
        },
      },
      Cart: 'cart',
      Orders: {
        screens: {
          OrdersList: 'orders',
          OrderDetails: 'orders/:orderId',
        },
      },
      Wishlist: 'wishlist',
    },
  },
};
