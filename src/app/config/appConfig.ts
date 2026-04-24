const frappeBaseUrl = 'https://buyinminutes.u.frappe.cloud';

export const appConfig = {
  frappeBaseUrl,
  productAssetBaseUrl: frappeBaseUrl,
  sendOtpUrl: 'https://develop.m.frappe.cloud/api/method/otp_app.api.send_otp',
  verifyOtpUrl: 'https://develop.m.frappe.cloud/api/method/otp_app.api.verify_otp',
  googleMapsApiKey: 'AIzaSyD7PH748dyXjzDSDhat1m3CvvQAuRmD5eQ',
  frappeApiKey: '13b0f0ee794c72f',
  frappeApiSecret: '2278238d36a40ef',
  stripePublishableKey: 'pk_test_51TMmA1LSpYhV4e90qPv64E6GbbCcmLSnUDBQTXKNcRqeXA3pfWJA0nf3fEsTbQ4R2LQ2nhPWpNUOxyyXECriuraO00FwkNmpk9',
  stripeMerchantIdentifier: 'merchant.com.addons.buyinminutes',
  stripeUrlScheme: 'buyinminutes',
  stripePaymentSheetUrl: `${frappeBaseUrl}/api/method/buyinminutes.api.stripe.create_payment_sheet`,
} as const;
