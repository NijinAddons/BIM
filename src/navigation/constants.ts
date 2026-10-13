import { CARD } from '../theme/colors';

// App-wide surface colour. Used as every navigator's `contentStyle`
// background so a screen transition never flashes a mismatched colour
// underneath it. Kept equal to CARD because most screens (Home, Brand,
// Store, ProductDetail, Cart, Categories, Profile) paint a solid white
// container themselves — a gray contentStyle here would flicker gray-then-
// white on every push/pop into one of them.
export const APP_BACKGROUND = CARD;
