import {appConfig} from '../../app/config/appConfig';
import {CartItem} from '../../features/cart/types';
import {apiClient} from '../api/apiClient';
import {ApiError} from '../api/apiError';
import {logger} from '../../utils/logger';

type CreatePaymentSheetRequest = {
  amount: number;
  currency: string;
  address: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    unitAmount: number;
  }[];
};

type PaymentSheetResponse = {
  paymentIntent?: string;
  paymentIntentClientSecret?: string;
  clientSecret?: string;
  ephemeralKey?: string;
  customer?: string;
  publishableKey?: string;
};

const toMinorUnits = (amount: number) => Math.round(amount * 100);

const getPaymentIntentClientSecret = (response: PaymentSheetResponse) =>
  response.paymentIntentClientSecret ?? response.paymentIntent ?? response.clientSecret;

const getFrappeExceptionMessage = (body?: string) => {
  if (!body) {
    return null;
  }

  try {
    const parsedBody = JSON.parse(body) as {
      exception?: string;
      exc_type?: string;
    };

    return parsedBody.exception ?? parsedBody.exc_type ?? null;
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
      'Install/deploy the Frappe app that provides buyinminutes.api.stripe.create_payment_sheet, or update stripePaymentSheetUrl to the installed app method.',
    ].join(' ');
  }

  if (frappeException?.includes('Failed to get method for command')) {
    return 'Stripe checkout is not available because the ERPNext payment method could not be found.';
  }

  return null;
};

const getAuthHeaders = (): Record<string, string> => {
  if (!appConfig.frappeApiKey || !appConfig.frappeApiSecret) {
    return {};
  }

  return {
    Authorization: `token ${appConfig.frappeApiKey}:${appConfig.frappeApiSecret}`,
  };
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
    amount,
    currency,
    address,
    items,
  }: {
    amount: number;
    currency: string;
    address: string;
    items: CartItem[];
  }) => {
    const payload: CreatePaymentSheetRequest = {
      amount: toMinorUnits(amount),
      currency,
      address,
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitAmount: toMinorUnits(item.price),
      })),
    };

    let result;

    try {
      result = await apiClient.post<PaymentSheetResponse>(
        appConfig.stripePaymentSheetUrl,
        {
          body: payload as unknown as Record<string, unknown>,
          headers: getAuthHeaders(),
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

    logger.log('[Stripe] createPaymentSheet response', result.data);

    const paymentIntentClientSecret = getPaymentIntentClientSecret(result.data);

    if (!paymentIntentClientSecret) {
      throw new Error('Stripe payment sheet response is missing a client secret.');
    }

    return {
      customer: result.data.customer,
      ephemeralKey: result.data.ephemeralKey,
      paymentIntentClientSecret,
    };
  },
};
