# Proguard rules for PocketPrint Bridge
-keepattributes *Annotation*
-keepclassmembers class * {
    @androidx.room.* *;
}
