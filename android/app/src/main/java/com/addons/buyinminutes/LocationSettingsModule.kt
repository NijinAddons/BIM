package com.addons.buyinminutes

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.Priority

private const val REQUEST_CHECK_SETTINGS = 4231

/**
 * Shows the native Play Services "Turn on Location" dialog in-app (the
 * Settings API resolution flow) instead of sending the user to the system
 * Settings screen. Android only — iOS has no equivalent, an app cannot
 * prompt to enable system Location Services without leaving the app.
 */
class LocationSettingsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var pendingPromise: Promise? = null

  private val activityEventListener =
      object : ActivityEventListener {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?,
        ) {
          if (requestCode != REQUEST_CHECK_SETTINGS) {
            return
          }
          val promise = pendingPromise ?: return
          pendingPromise = null
          promise.resolve(resultCode == Activity.RESULT_OK)
        }

        override fun onNewIntent(intent: Intent) {}
      }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "LocationSettings"

  @ReactMethod
  fun promptEnable(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("no_activity", "No current activity to show the dialog on")
      return
    }

    val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L).build()
    val settingsRequest = LocationSettingsRequest.Builder().addLocationRequest(request).build()

    LocationServices.getSettingsClient(activity)
        .checkLocationSettings(settingsRequest)
        .addOnSuccessListener { promise.resolve(true) }
        .addOnFailureListener { exception ->
          if (exception is ResolvableApiException) {
            pendingPromise = promise
            try {
              exception.startResolutionForResult(activity, REQUEST_CHECK_SETTINGS)
            } catch (sendEx: Exception) {
              pendingPromise = null
              promise.reject("resolution_failed", sendEx)
            }
          } else {
            // Not resolvable in-app (e.g. no location provider at all on
            // this device) — caller falls back to the system Settings screen.
            promise.resolve(false)
          }
        }
  }
}
