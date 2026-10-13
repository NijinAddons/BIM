package com.addons.buyinminutes

import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The window background is the splash (navy + logo, see AppTheme) so there's
 * no flash before React Native draws its first frame. Once JS has drawn its
 * own splash on top, swap it to plain white — otherwise the splash art peeks
 * through wherever the window is exposed later, e.g. the strip uncovered
 * while the keyboard animates open.
 */
class AppWindowModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AppWindow"

  @ReactMethod
  fun resetBackground() {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      activity.window.setBackgroundDrawable(ColorDrawable(Color.WHITE))
    }
  }
}
