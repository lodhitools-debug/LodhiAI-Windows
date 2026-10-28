# ProGuard / R8 rules for Lodhi AI Android Companion

# Retain Retrofit data models for JSON deserialization
-keepclassmembers class com.lodhiai.companion.data.model.** { <fields>; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Retain Coroutines & Flow
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# AndroidX Biometric & Security Crypto
-dontwarn androidx.biometric.**
-dontwarn androidx.security.crypto.**
