package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.paivalab.weddingmanagementsystem.R

private val UnlockNight = Color(0xFF0B090D)
private val UnlockIvory = Color(0xFFF9F5F1)
private val UnlockMuted = Color(0xFFD5CBD0)
private val UnlockGold = Color(0xFFF1D091)
private val UnlockButton = Color(0xFFB91C45)

@Composable
fun UnlockScreen(
    language: String,
    canAuthenticate: Boolean,
    onUnlock: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize().background(UnlockNight)) {
        val heroHeight = (maxHeight * 0.46f).coerceAtLeast(180.dp)
        Image(
            painter = painterResource(R.drawable.unlock_background),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    0f to UnlockNight.copy(alpha = 0.35f),
                    0.35f to Color.Transparent,
                    0.62f to UnlockNight.copy(alpha = 0.60f),
                    1f to UnlockNight,
                ),
            ),
        )
        Column(
            modifier = Modifier.fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 24.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(42.dp)
                        .clip(CircleShape)
                        .background(UnlockNight.copy(alpha = 0.80f))
                        .border(BorderStroke(1.dp, UnlockGold.copy(alpha = 0.65f)), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.Favorite, contentDescription = null, tint = PlannerRose, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(12.dp))
                Text(
                    localized(R.string.unlock_brand, language),
                    color = UnlockIvory,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                )
            }

            Spacer(Modifier.height(heroHeight))

            Column(
                modifier = Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(28.dp))
                    .background(UnlockNight.copy(alpha = 0.97f))
                    .border(BorderStroke(1.dp, UnlockGold.copy(alpha = 0.38f)), RoundedCornerShape(28.dp))
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.Lock, contentDescription = null, tint = UnlockGold, modifier = Modifier.size(16.dp))
                    Text(
                        localized(R.string.unlock_private, language),
                        color = UnlockGold,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.8.sp,
                    )
                }
                Text(
                    localized(R.string.unlock_intro, language),
                    color = UnlockIvory,
                    fontSize = 30.sp,
                    lineHeight = 34.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    localized(R.string.unlock_description, language),
                    color = UnlockMuted,
                    fontSize = 15.sp,
                    lineHeight = 22.sp,
                )
                if (!canAuthenticate) {
                    Text(
                        localized(R.string.device_lock_required, language),
                        color = UnlockIvory,
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                    )
                }
                Button(
                    onClick = if (canAuthenticate) onUnlock else onOpenSettings,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = UnlockButton, contentColor = Color.White),
                ) {
                    if (canAuthenticate) {
                        Icon(Icons.Outlined.Fingerprint, contentDescription = null, modifier = Modifier.size(22.dp))
                        Spacer(Modifier.width(10.dp))
                    }
                    Text(
                        localized(if (canAuthenticate) R.string.unlock_button else R.string.settings, language),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
            Text(
                localized(R.string.unlock_local_data, language),
                modifier = Modifier.fillMaxWidth(),
                color = UnlockMuted,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
            )
        }
    }
}
