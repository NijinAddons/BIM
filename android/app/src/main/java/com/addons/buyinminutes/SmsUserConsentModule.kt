package com.addons.buyinminutes

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status

private const val REQUEST_SMS_CONSENT = 4232
private const val EVENT_MESSAGE = "SmsUserConsent:message"

/**
 * Reads the OTP SMS with Google's SMS User Consent API: when an SMS with a
 * code arrives (within 5 minutes of start()), Android shows a one-tap
 * "Allow BIM to read this message?" sheet and the full text is emitted as
 * `SmsUserConsent:message`. Unlike the SMS Retriever API, the SMS doesn't
 * need to carry the app's signature hash, and no SMS permission is needed.
 */
class SmsUserConsentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var receiver: BroadcastReceiver? = null

  private val activityEventListener =
      object : ActivityEventListener {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?,
        ) {
          if (requestCode != REQUEST_SMS_CONSENT) {
            return
          }
          if (resultCode == Activity.RESULT_OK) {
            data?.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)?.let { emit(it) }
          }
        }

        override fun onNewIntent(intent: Intent) {}
      }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "SmsUserConsent"

  @ReactMethod
  fun start(promise: Promise) {
    stopReceiver()
    val context = reactApplicationContext
    val smsReceiver =
        object : BroadcastReceiver() {
          override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) {
              return
            }
            val extras = intent.extras ?: return
            @Suppress("DEPRECATION")
            val status = extras.get(SmsRetriever.EXTRA_STATUS) as? Status ?: return
            if (status.statusCode != CommonStatusCodes.SUCCESS) {
              return
            }
            @Suppress("DEPRECATION")
            val consentIntent =
                extras.get(SmsRetriever.EXTRA_CONSENT_INTENT) as? Intent ?: return
            val activity = reactApplicationContext.currentActivity ?: return
            try {
              activity.startActivityForResult(consentIntent, REQUEST_SMS_CONSENT)
            } catch (_: Exception) {
              // The consent sheet couldn't open; the code can still be typed.
            }
          }
        }

    val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(
          smsReceiver, filter, SmsRetriever.SEND_PERMISSION, null, Context.RECEIVER_EXPORTED)
    } else {
      context.registerReceiver(smsReceiver, filter, SmsRetriever.SEND_PERMISSION, null)
    }
    receiver = smsReceiver

    SmsRetriever.getClient(context)
        .startSmsUserConsent(null)
        .addOnSuccessListener { promise.resolve(true) }
        .addOnFailureListener { error ->
          stopReceiver()
          promise.reject("sms_consent_failed", error)
        }
  }

  @ReactMethod
  fun stop() {
    stopReceiver()
  }

  // Required by NativeEventEmitter.
  @ReactMethod fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}

  @ReactMethod fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Double) {}

  override fun invalidate() {
    stopReceiver()
    super.invalidate()
  }

  private fun stopReceiver() {
    receiver?.let {
      try {
        reactApplicationContext.unregisterReceiver(it)
      } catch (_: IllegalArgumentException) {
        // Already unregistered.
      }
    }
    receiver = null
  }

  private fun emit(message: String) {
    if (!reactApplicationContext.hasActiveReactInstance()) {
      return
    }
    reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_MESSAGE, message)
  }
}
