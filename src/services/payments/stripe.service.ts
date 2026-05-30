import {appConfig} from '../../app/config/appConfig';
import {CartItem} from '../../features/cart/types';
import {apiClient} from '../api/apiClient';
import {ApiError} from '../api/apiError';
import {getFrappeAuthHeaders} from '../frappe/frappeAuth';
import {logger} from '../../utils/logger';

type CreatePaymentSheetRequest = {
  address?: string;
  amount?: number;
  amount_minor?: number;
  customer?: string;
  customer_id?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  currency?: string;
  email?: string;
  items?: Array<{
    item_code: string;
    item_name: string;
    qty: number;
    rate: number;
  }>;
  name?: string;
  phone?: string;
  reference_doctype?: string;
  reference_name?: string;
};

type PaymentSheetResponse = {
  message?: Record<string, unknown>;
  paymentIntent?: string;
  paymentIntentClientSecret?: string;
  clientSecret?: string;
  client_secret?: string;
  ephemeral_key?: string;
  ephemeralKey?: string;
  customerId?: string;
  customer?: string;
  publishableKey?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

const getString = (record: Record<string, unknown> | null, keys: string[]) => {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const getPaymentIntentClientSecret = (response: PaymentSheetResponse) => {
  const message = asRecord(response.message);

  return (
    getString(message, [
      'paymentIntentClientSecret',
      'paymentIntent',
      'clientSecret',
      'client_secret',
    ]) ??
    response.paymentIntentClientSecret ??
    response.paymentIntent ??
    response.clientSecret ??
    response.client_secret
  );
};

const getCustomerId = (response: PaymentSheetResponse) => {
  const message = asRecord(response.message);

  return (
    getString(message, ['customer', 'customerId', 'customer_id']) ??
    response.customer ??
    response.customerId
  );
};

const getEphemeralKey = (response: PaymentSheetResponse) => {
  const message = asRecord(response.message);

  return (
    getString(message, ['ephemeralKey', 'ephemeral_key']) ??
    response.ephemeralKey ??
    response.ephemeral_key
  );
};

const getFrappeExceptionMessage = (body?: string) => {
  if (!body) {
    return null;
  }

  try {
    const parsedBody = JSON.parse(body) as {
      _server_messages?: string;
      exc?: string;
      exception?: string;
      exc_type?: string;
      message?: string | Record<string, unknown>;
    };

    if (typeof parsedBody._server_messages === 'string' && parsedBody._server_messages) {
      try {
        const serverMessages = JSON.parse(parsedBody._server_messages) as string[];
        const firstMessage = serverMessages[0];

        if (typeof firstMessage === 'string' && firstMessage) {
          try {
            const parsedMessage = JSON.parse(firstMessage) as {
              message?: string;
            };

            if (typeof parsedMessage.message === 'string' && parsedMessage.message.trim()) {
              return parsedMessage.message.trim();
            }
          } catch {
            return firstMessage;
          }
        }
      } catch {
        return parsedBody._server_messages;
      }
    }

    if (typeof parsedBody.message === 'string' && parsedBody.message.trim()) {
      return parsedBody.message.trim();
    }

    return parsedBody.exception ?? parsedBody.exc ?? parsedBody.exc_type ?? null;
  } catch {
    return body;
  }
};

const getPaymentSheetErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const frappeException = getFrappeExceptionMessage(error.body);

  if (frappeException?.includes('App buyinminutes is not installed')) {
    return [
      'Stripe checkout is not available because the ERPNext site is missing the buyinminutes backend app.',
      'Install/deploy the Frappe app that provides the configured Stripe payment method, or update stripePaymentSheetUrl to the installed app method.',
    ].join(' ');
  }

  if (frappeException?.includes('Failed to get method for command')) {
    return frappeException;
  }

  return frappeException ?? error.body ?? error.message;
};

export const stripePaymentService = {
  isConfigured: () =>
    Boolean(appConfig.stripePublishableKey && appConfig.stripePaymentSheetUrl),

  getMissingConfig: () =>
    [
      !appConfig.stripePublishableKey ? 'stripePublishableKey' : null,
      !appConfig.stripePaymentSheetUrl ? 'stripePaymentSheetUrl' : null,
    ].filter(Boolean) as string[],

  createPaymentSheet: async ({
    amount: _amount,
    currency: _currency,
    address: _address,
    customer: _customer,
    customerEmail: _customerEmail,
    customerName: _customerName,
    customerPhone: _customerPhone,
    items: _items,
    referenceDoctype: _referenceDoctype,
    referenceName: _referenceName,
  }: {
    amount: number;
    currency: string;
    address: string;
    customer?: string;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    items: CartItem[];
    referenceDoctype?: string;
    referenceName?: string;
  }) => {
    const payload: CreatePaymentSheetRequest = {
      address: _address,
      amount: Number(_amount.toFixed(2)),
      amount_minor: Math.round(_amount * 100),
      customer: _customer,
      customer_id: _customer,
      customer_email: _customerEmail,
      customer_name: _customerName,
      customer_phone: _customerPhone,
      currency: _currency.toUpperCase(),
      email: _customerEmail,
      items: _items.map(item => ({
        item_code: item.id,
        item_name: item.name,
        qty: item.quantity,
        rate: item.price,
      })),
      name: _customerName,
      phone: _customerPhone,
      reference_doctype: _referenceDoctype,
      reference_name: _referenceName,
    };

    logger.log('[Stripe] createPaymentSheet request payload', payload);
    let result;

    try {
      result = await apiClient.post<PaymentSheetResponse>(
        appConfig.stripePaymentSheetUrl,
        {
          body: payload as unknown as Record<string, unknown>,
          headers: getFrappeAuthHeaders(),
          logLabel: 'Stripe PaymentSheet ERPNext response',
        },
      );
    } catch (error) {
      const paymentSheetErrorMessage = getPaymentSheetErrorMessage(error);

      if (paymentSheetErrorMessage) {
        throw new Error(paymentSheetErrorMessage);
      }

      throw error;
    }

    logger.log('[Stripe] createPaymentSheet response', {
      data: result.data,
      rawBody: result.rawBody,
      status: result.response.status,
    });

    const paymentIntentClientSecret = getPaymentIntentClientSecret(result.data);

    if (!paymentIntentClientSecret) {
      throw new Error('Stripe payment sheet response is missing a client secret.');
    }

    return {
      customer: getCustomerId(result.data),
      ephemeralKey: getEphemeralKey(result.data),
      paymentIntentClientSecret,
    };
  },
};
