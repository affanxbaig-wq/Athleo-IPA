# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Athleo App, Step Counter & Background Services (CRITICAL - prevents silent crash on release)
-keep class com.athleo.** { *; }
-keepclassmembers class com.athleo.** { *; }
-keep class com.enginegrowth.athleo.** { *; }
-keepclassmembers class com.enginegrowth.athleo.** { *; }

# Keep all React Native NativeModules and ReactMethods
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    @com.facebook.react.bridge.ReactMethod *;
    @com.facebook.react.bridge.ReactMethodSync *;
}

# Android Services & Broadcast Receivers
-keep class * extends android.app.Service { *; }
-keep class * extends android.content.BroadcastReceiver { *; }

# MMKV Storage
-keep class com.tencent.mmkv.** { *; }

# RevenueCat (Purchases)
-keep class com.revenuecat.purchases.** { *; }

# React Native Biometrics
-keep class com.rnbiometrics.** { *; }

# Reanimated / Gesture Handler
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }

# React Native Screens
-keep class com.swmansion.rnscreens.** { *; }

# React Native Video & ExoPlayer / AndroidX Media3
-keep class com.brentvatne.react.** { *; }
-keep class com.brentvatne.exoplayer.** { *; }
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**
-keep class com.google.android.exoplayer2.** { *; }
-dontwarn com.google.android.exoplayer2.**

# Nitro Modules (MMKV v4 backing)
-keep class com.margelo.nitro.** { *; }
-keep class com.margelo.nitro.core.** { *; }

# React Native SVG & Vector Icons
-keep class com.horcrux.svg.** { *; }
-keep class com.oblador.vectoricons.** { *; }

# BlurView
-keep class com.reactnativecommunity.blur.** { *; }
-keep class eightbitlab.com.blurview.** { *; }
-dontwarn eightbitlab.com.blurview.**

# Geolocation
-keep class com.reactnativecommunity.geolocation.** { *; }

# Fresco & Animated GIF / WebP
-keep class com.facebook.fresco.** { *; }
-keep class com.facebook.drawee.** { *; }
-keep class com.facebook.imagepipeline.** { *; }
-keep class com.facebook.animated.gif.** { *; }
-keep class com.facebook.animated.webp.** { *; }
-keep class com.facebook.imageformat.** { *; }
-keep class com.facebook.imagepipeline.animated.factory.** { *; }


