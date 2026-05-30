import {loadStoredCart} from '../../features/cart/service';
import {loadStoredOrders} from '../../features/orders';

export async function initializeApp() {
  await loadStoredCart();
  await loadStoredOrders();
}
