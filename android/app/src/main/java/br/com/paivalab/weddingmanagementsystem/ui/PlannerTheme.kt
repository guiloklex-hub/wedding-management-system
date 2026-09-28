package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

val PlannerRose = Color(0xFFF43F5E)
val PlannerChampagne = Color(0xFFD4AF37)
val PlannerEmerald = Color(0xFF34D399)
val PlannerAmber = Color(0xFFFBBF24)
val PlannerMuted = Color(0xFFA1A1AA)
val PlannerBackground = Color(0xFF09090B)
val PlannerSurface = Color(0xFF141418)
val PlannerBorder = Color(0xFF27272A)

private val scheme = darkColorScheme(
    primary = PlannerRose,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF3F131E),
    onPrimaryContainer = Color(0xFFFFD9E0),
    secondary = PlannerChampagne,
    onSecondary = Color(0xFF1C1608),
    secondaryContainer = Color(0xFF2E2512),
    onSecondaryContainer = Color(0xFFF7E4B5),
    tertiary = PlannerEmerald,
    onTertiary = Color(0xFF052E1C),
    tertiaryContainer = Color(0xFF0E3A29),
    onTertiaryContainer = Color(0xFFA7F3D0),
    background = PlannerBackground,
    onBackground = Color(0xFFF4F4F5),
    surface = PlannerSurface,
    onSurface = Color(0xFFF4F4F5),
    surfaceVariant = Color(0xFF1F1F25),
    onSurfaceVariant = Color(0xFFA1A1AA),
    outline = Color(0xFF3F3F46),
    outlineVariant = PlannerBorder,
)

@Composable
fun PlannerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = scheme,
        shapes = Shapes(
            small = RoundedCornerShape(12.dp),
            medium = RoundedCornerShape(16.dp),
            large = RoundedCornerShape(24.dp),
        ),
        content = content,
    )
}
