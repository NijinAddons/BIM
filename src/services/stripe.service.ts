import {STRIPE_PUBLISHABLE_KEY} from '../config';
import {postFrappeMethod} from './frappe.client';
import type {PlaceOrderItem} from './orders.service';

export {STRIPE_PUBLISHABLE_KEY};

// Shared by both create_checkout_session (hosted redirect) and
// create_payment_intent (in-app PaymentSheet) — both build the same Sales
// Order upsert from this exact payload, only the Stripe call at the end
// differs (Checkout Session vs. PaymentIntent).
export type CheckoutParams = {
  items: PlaceOrderItem[];
  /** ISO date, `YYYY-MM-DD`. */
  deliveryDate: string;
  /** e.g. `"10 AM - 12 PM"` (see `CartScreen.tsx`'s `DELIVERY_SLOTS`). */
  deliverySlot: string | null;
  deliveryFee: number;
  customerPickup: boolean;
  addressDisplay: string | null;
  couponCode?: string | null;
};

export type CreateCheckoutSessionParams = CheckoutParams;

export type CreateCheckoutSessionResponse = {
  success: boolean;
  checkout_url: string;
  session_id: string;
  /** Always null: the Sales Order is only created once payment succeeds. */
  sales_order: string | null;
  checkout_resume_token?: string;
};

/**
 * Ask the backend to create a Stripe Checkout Session for the cart, and
 * return the hosted checkout page's URL to open in the system browser.
 *
 * Payload confirmed against the real backend source,
 * `buy_in_minutes/payment.py` on the Frappe Cloud bench (available locally
 * at `~/frappe-dev/frappe-bench/apps/buy_in_minutes/buy_in_minutes/payment.py`).
 * `create_checkout_session` has no `amount`/`currency`/`items`/`session_token`
 * params — it takes `cart_items` (same `{item_code, quantity, rate,
 * supplier?, size?}` shape as `create_cash_on_delivery_order`, see
 * `orders.service.ts`) and builds the Sales Order + Checkout Session
 * directly from it, no server-side cart lookup. The prior "Cart is empty"
 * (417) here was the same bug already fixed for the COD path: sending
 * `items`/`qty` instead of `cart_items`/`quantity`.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams,
): Promise<CreateCheckoutSessionResponse> {
  const response = await postFrappeMethod<CreateCheckoutSessionResponse>(
    'buy_in_minutes.payment.create_checkout_session',
    {
      cart_items: params.items,
      delivery_date: params.deliveryDate,
      delivery_slot: params.deliverySlot,
      delivery_fee: params.deliveryFee,
      customer_pickup: params.customerPickup,
      address_display: params.addressDisplay,
      coupon_code: params.couponCode ?? undefined,
    },
    'checkout session',
  );
  console.log('createCheckoutSession response', response);
  return response;
}

export type CreatePaymentIntentParams = CheckoutParams;

export type CreatePaymentIntentResponse = {
  success: boolean;
  client_secret: string;
  payment_intent_id: string;
  sales_order: string;
  publishable_key: string | null;
};

/**
 * In-app PaymentSheet counterpart of `createCheckoutSession` — same Sales
 * Order upsert on the backend (`buy_in_minutes.payment.create_payment_intent`),
 * but returns a PaymentIntent `client_secret` for Stripe's native
 * PaymentSheet instead of a browser-redirect URL.
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<CreatePaymentIntentResponse> {
  return postFrappeMethod<CreatePaymentIntentResponse>(
    'buy_in_minutes.payment.create_payment_intent',
    {
      cart_items: params.items,
      delivery_date: params.deliveryDate,
      delivery_slot: params.deliverySlot,
      delivery_fee: params.deliveryFee,
      customer_pickup: params.customerPickup,
      address_display: params.addressDisplay,
      coupon_code: params.couponCode ?? undefined,
    },
    'payment intent',
  );
}

export type FinalizePaymentIntentResponse = {
  success: boolean;
  sales_order: string;
  purchase_orders: string[];
  sales_order_status: string;
  docstatus: number;
  payment_status: string;
  items: Array<{
    item_code: string;
    item_name: string;
    description: string | null;
    qty: number;
    rate: number;
    amount: number;
    size: string | null;
  }>;
};

export type FinalizeStripeCheckoutResponse = FinalizePaymentIntentResponse;

/**
 * Call right after `presentPaymentSheet()` succeeds, so the order is
 * submitted immediately instead of waiting on the backend webhook. The
 * webhook (`payment_intent.succeeded`) still runs too as a safety net —
 * `_submit_sales_order` is idempotent on the backend either way.
 */
export async function finalizePaymentIntent(
  paymentIntentId: string,
): Promise<FinalizePaymentIntentResponse> {
  return postFrappeMethod<FinalizePaymentIntentResponse>(
    'buy_in_minutes.payment.finalize_payment_intent',
    {payment_intent_id: paymentIntentId},
    'payment confirmation',
  );
}

export async function finalizeStripeCheckout(
  sessionId: string,
): Promise<FinalizeStripeCheckoutResponse> {
  return postFrappeMethod<FinalizeStripeCheckoutResponse>(
    'buy_in_minutes.payment.finalize_stripe_checkout',
    {session_id: sessionId},
    'checkout payment confirmation',
  );
}
