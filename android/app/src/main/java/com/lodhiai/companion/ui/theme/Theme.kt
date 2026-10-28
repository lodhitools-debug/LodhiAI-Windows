package com.lodhiai.companion.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Lodhi AI Dark Glassmorphic Theme Palette
val BrandCyan = Color(0xFF00E5FF)
val BrandIndigo = Color(0xFF6366F1)
val DarkBackground = Color(0xFF0F172A)
val DarkSurface = Color(0xFF1E293B)
val DarkCard = Color(0xFF334155)
val TextPrimaryDark = Color(0xFFF8FAFC)
val TextSecondaryDark = Color(0xFF94A3B8)
val AccentSuccess = Color(0xFF10B981)
val AccentWarning = Color(0xFFF59E0B)
val AccentDanger = Color(0xFFEF4444)

private val DarkColorScheme = darkColorScheme(
    primary = BrandCyan,
    secondary = BrandIndigo,
    background = DarkBackground,
    surface = DarkSurface,
    onPrimary = Color.Black,
    onSecondary = Color.White,
    onBackground = TextPrimaryDark,
    onSurface = TextPrimaryDark,
    error = AccentDanger
)

private val LightColorScheme = lightColorScheme(
    primary = BrandIndigo,
    secondary = BrandCyan,
    background = Color(0xFFF8FAFC),
    surface = Color.White,
    onPrimary = Color.White,
    onSecondary = Color.Black,
    onBackground = Color(0xFF0F172A),
    onSurface = Color(0xFF0F172A),
    error = AccentDanger
)

@Composable
fun LodhiAITheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
