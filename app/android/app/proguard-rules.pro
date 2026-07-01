# ProGuard / R8 configuration for Vidra Release builds

# Keep Hermes engine classes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep React Native NativeModules
-keepclassmembers class * {
  @com.facebook.react.bridge.ReactMethod *;
}

# Keep react-native-keychain
-keep class com.oblador.keychain.** { *; }

# Keep react-native-mmkv
-keep class com.mrousavy.camera.frameprocessors.FrameProcessorPlugin { *; }
-keep class com.tencent.mmkv.** { *; }

# Keep react-native-background-downloader / Fetch2
-keep class com.tonyodev.fetch2.** { *; }
-keep class com.tonyodev.fetch2core.** { *; }

# Keep vector icons
-keep class com.oblador.vectoricons.** { *; }

# General network client structures
-keepattributes Signature, *Annotation*, InnerClasses, EnclosingMethod
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase
