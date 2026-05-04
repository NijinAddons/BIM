import {loadStoredCart} from '../../features/cart/service';

export async function initializeApp() {
  await loadStoredCart();
}
