const frappeBaseUrl = 'https://buyinminutes.u.frappe.cloud';
const allProductsPagePath = '/all-products';
const allProductsFeedMethod = 'webshop.webshop.api.get_product_filter_data';

export const appConfig = {
  frappeBaseUrl,
  allProductsPagePath,
  allProductsPageUrl: `${frappeBaseUrl}${allProductsPagePath}`,
  allProductsFeedMethod,
  allProductsFeedUrl: `${frappeBaseUrl}/api/method/${allProductsFeedMethod}`,
  productAssetBaseUrl: frappeBaseUrl,
  sendOtpUrl: `${frappeBaseUrl}/api/method/otp_app.api.send_otp`,
  verifyOtpUrl: `${frappeBaseUrl}/api/method/otp_app.api.verify_otp`,
  loginUrl: `${frappeBaseUrl}/api/method/otp_app.api.login`,
  completeSignupUrl: `${frappeBaseUrl}/api/method/otp_app.api.complete_signup`,
  googleLoginUrl: `${frappeBaseUrl}/api/method/otp_app.firebase_auth.google_login`,
  appleLoginUrl: `${frappeBaseUrl}/api/method/otp_app.apple_login.apple_login`,
  googleMapsApiKey: 'AIzaSyD7PH748dyXjzDSDhat1m3CvvQAuRmD5eQ',
  firebaseGoogleIosClientId:
    '586858899535-nc37gh2bmb63u92mk38us2dbrfblfhfk.apps.googleusercontent.com',
  firebaseGoogleWebClientId:
    '586858899535-gsvn1k48u4j0d03bjvtemf0107csn5fm.apps.googleusercontent.com',
  frappeApiKey: 'af3323ac76cd75a',
  frappeApiSecret: 'cd0feba064827c3',
  stripePublishableKey: 'pk_test_51TMmA1LSpYhV4e90qPv64E6GbbCcmLSnUDBQTXKNcRqeXA3pfWJA0nf3fEsTbQ4R2LQ2nhPWpNUOxyyXECriuraO00FwkNmpk9',
  stripeMerchantIdentifier: 'merchant.com.addons.buyinminutes',
  stripeUrlScheme: 'buyinminutes',
  stripePaymentSheetUrl:
    `${frappeBaseUrl}/api/method/otp_app.stripe_api.create_payment_intent`,
} as const;
