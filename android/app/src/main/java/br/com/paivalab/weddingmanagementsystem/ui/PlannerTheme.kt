package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

val PlannerRose = Color(0xFFF43F5E)
val PlannerChampagne = Color(0xFFBA9A50)
val PlannerBackground = Color(0xFF0A0A0A)
val PlannerSurface = Color(0xFF18181B)

private val scheme = darkColorScheme(
    primary = PlannerRose,
    secondary = PlannerChampagne,
    background = PlannerBackground,
    surface = PlannerSurface,
    surfaceVariant = Color(0xFF27272A),
    onPrimary = Color.White,
    onBackground = Color(0xFFEDEDED),
    onSurface = Color(0xFFEDEDED),
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
