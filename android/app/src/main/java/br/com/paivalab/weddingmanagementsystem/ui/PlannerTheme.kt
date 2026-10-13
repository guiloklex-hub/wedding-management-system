package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Immutable
data class PlannerPalette(
    val rose: Color,
    val champagne: Color,
    val emerald: Color,
    val amber: Color,
    val danger: Color,
    val muted: Color,
    val background: Color,
    val surface: Color,
    val raised: Color,
    val border: Color,
    val track: Color,
    val onAccent: Color,
    val onSurface: Color,
    val isDark: Boolean,
)

private val DarkPalette = PlannerPalette(
    rose = Color(0xFFF43F5E),
    champagne = Color(0xFFD4AF37),
    emerald = Color(0xFF34D399),
    amber = Color(0xFFFBBF24),
    danger = Color(0xFFF87171),
    muted = Color(0xFFA1A1AA),
    background = Color(0xFF09090B),
    surface = Color(0xFF141418),
    raised = Color(0xFF1E191D),
    border = Color(0xFF27272A),
    track = Color(0xFF27272A),
    onAccent = Color.White,
    onSurface = Color(0xFFF4F4F5),
    isDark = true,
)

/** Tons mais escuros dos acentos para manter contraste AA sobre fundo claro. */
private val LightPalette = PlannerPalette(
    rose = Color(0xFFBE123C),
    champagne = Color(0xFF8A6A12),
    emerald = Color(0xFF047857),
    amber = Color(0xFFB45309),
    danger = Color(0xFFB91C1C),
    muted = Color(0xFF5B5B66),
    background = Color(0xFFFAF7F5),
    surface = Color(0xFFFFFFFF),
    raised = Color(0xFFFFF1F2),
    border = Color(0xFFE7E1DC),
    track = Color(0xFFE7E5E4),
    onAccent = Color.White,
    onSurface = Color(0xFF1C1917),
    isDark = false,
)

val LocalPlannerPalette = staticCompositionLocalOf { DarkPalette }

val PlannerRose: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.rose
val PlannerChampagne: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.champagne
val PlannerEmerald: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.emerald
val PlannerAmber: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.amber
val PlannerDanger: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.danger
val PlannerMuted: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.muted
val PlannerBackground: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.background
val PlannerSurface: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.surface
val PlannerRaised: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.raised
val PlannerBorder: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.border
val PlannerTrack: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.track
val PlannerOnAccent: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.onAccent
val PlannerOnSurface: Color @Composable @ReadOnlyComposable get() = LocalPlannerPalette.current.onSurface

private fun schemeFor(palette: PlannerPalette) = if (palette.isDark) {
    darkColorScheme(
        primary = palette.rose,
        onPrimary = palette.onAccent,
        primaryContainer = Color(0xFF3F131E),
        onPrimaryContainer = Color(0xFFFFD9E0),
        secondary = palette.champagne,
        onSecondary = Color(0xFF1C1608),
        secondaryContainer = Color(0xFF2E2512),
        onSecondaryContainer = Color(0xFFF7E4B5),
        tertiary = palette.emerald,
        onTertiary = Color(0xFF052E1C),
        tertiaryContainer = Color(0xFF0E3A29),
        onTertiaryContainer = Color(0xFFA7F3D0),
        background = palette.background,
        onBackground = palette.onSurface,
        surface = palette.surface,
        onSurface = palette.onSurface,
        surfaceVariant = Color(0xFF1F1F25),
        onSurfaceVariant = palette.muted,
        outline = Color(0xFF3F3F46),
        outlineVariant = palette.border,
        error = palette.danger,
    )
} else {
    lightColorScheme(
        primary = palette.rose,
        onPrimary = palette.onAccent,
        primaryContainer = Color(0xFFFFE4E8),
        onPrimaryContainer = Color(0xFF4C0519),
        secondary = palette.champagne,
        onSecondary = Color.White,
        secondaryContainer = Color(0xFFF7EBC8),
        onSecondaryContainer = Color(0xFF3A2C05),
        tertiary = palette.emerald,
        onTertiary = Color.White,
        tertiaryContainer = Color(0xFFD1FAE5),
        onTertiaryContainer = Color(0xFF022C22),
        background = palette.background,
        onBackground = palette.onSurface,
        surface = palette.surface,
        onSurface = palette.onSurface,
        surfaceVariant = Color(0xFFF3EEEA),
        onSurfaceVariant = palette.muted,
        outline = Color(0xFFA8A29E),
        outlineVariant = palette.border,
        error = palette.danger,
    )
}

/** `mode`: "system", "light" ou "dark". */
@Composable
fun isPlannerDark(mode: String): Boolean = when (mode) {
    "light" -> false
    "dark" -> true
    else -> isSystemInDarkTheme()
}

@Composable
fun PlannerTheme(darkTheme: Boolean = true, content: @Composable () -> Unit) {
    val palette = if (darkTheme) DarkPalette else LightPalette
    CompositionLocalProvider(LocalPlannerPalette provides palette) {
        MaterialTheme(
            colorScheme = schemeFor(palette),
            shapes = Shapes(
                small = RoundedCornerShape(12.dp),
                medium = RoundedCornerShape(16.dp),
                large = RoundedCornerShape(24.dp),
            ),
            content = content,
        )
    }
}
