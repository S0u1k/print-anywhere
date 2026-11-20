package com.pocketprint.bridge.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color

val Navy950 = Color(0xFF0B0F19)
val Navy900 = Color(0xFF111827)
val Navy800 = Color(0xFF1F2937)
val Navy700 = Color(0xFF374151)
val Slate400 = Color(0xFF9CA3AF)
val Slate200 = Color(0xFFE5E7EB)
val White = Color(0xFFFFFFFF)

val BrandBlue = Color(0xFF2563EB)
val BrandBlueLight = Color(0xFF60A5FA)

val StatusGreen = Color(0xFF10B981)
val StatusAmber = Color(0xFFF59E0B)
val StatusRed = Color(0xFFEF4444)

val DarkColorScheme = darkColorScheme(
    primary = BrandBlue,
    onPrimary = White,
    secondary = BrandBlueLight,
    onSecondary = Navy950,
    background = Navy950,
    onBackground = White,
    surface = Navy900,
    onSurface = White,
    surfaceVariant = Navy800,
    onSurfaceVariant = Slate200,
    outline = Navy700,
    error = StatusRed,
    onError = White
)
