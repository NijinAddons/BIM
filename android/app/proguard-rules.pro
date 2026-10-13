# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# @react-native-community/geolocation + the Play Services fused location
# provider it delegates to on Android resolve some classes via reflection;
# without these, enabling minifyEnabled on the release build type can break
# location silently (no crash, just a failed/empty fix) in release-only.
-keep class com.google.android.gms.location.** { *; }
-keep class com.reactnativecommunity.geolocation.** { *; }
-dontwarn com.google.android.gms.location.**

# react-native-maps (Google Maps SDK for Android)
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }
-keep class com.airbnb.android.react.maps.** { *; }
-dontwarn com.google.android.gms.maps.**
