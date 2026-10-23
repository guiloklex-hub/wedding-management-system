package br.com.paivalab.weddingmanagementsystem.ui

import androidx.annotation.StringRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.CompareArrows
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex

private data class SystemEntry(val section: String, @StringRes val title: Int, val icon: ImageVector)

private val systemEntries = listOf(
    SystemEntry("insights", R.string.insights, Icons.Default.Insights),
    SystemEntry("reports", R.string.reports, Icons.Default.BarChart),
    SystemEntry("vendor-compare", R.string.vendor_compare, Icons.Default.CompareArrows),
    SystemEntry("wedding-day", R.string.wedding_day, Icons.Default.Celebration),
    SystemEntry("settings", R.string.settings, Icons.Default.Settings),
    SystemEntry("backup", R.string.backup, Icons.Default.Backup),
    SystemEntry("audit", R.string.audit, Icons.Default.History),
    SystemEntry("trash", R.string.trash, Icons.Default.DeleteOutline),
    SystemEntry("help", R.string.help, Icons.AutoMirrored.Filled.HelpOutline),
)

@Composable
internal fun MoreScreen(index: RecordIndex, navigate: (String) -> Unit) {
    // Os itens da lua de mel ficam dentro da tela da viagem, como na web.
    val secondaryModules = modules.filter { it.kind !in primaryTabs && it.kind != Kinds.HONEYMOON_ITEM }
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 160.dp),
        contentPadding = PaddingValues(16.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Text(stringResource(R.string.more_management), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold,
                color = PlannerChampagne, modifier = Modifier.semantics { heading() })
        }
        items(systemEntries, key = { it.section }) { entry ->
            Card(
                onClick = { navigate(entry.section) },
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerChampagne.copy(alpha = 0.25f)),
            ) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(entry.icon, null, tint = PlannerChampagne, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(10.dp))
                    Text(stringResource(entry.title), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                        maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) {
            Text(stringResource(R.string.more_modules), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold,
                color = PlannerRose, modifier = Modifier.padding(top = 4.dp).semantics { heading() })
        }
        items(secondaryModules, key = { it.kind }) { module ->
            val count = index.count(module.kind)
            Card(
                onClick = { navigate(module.kind) },
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
            ) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(module.icon, null, tint = PlannerRose, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.weight(1f))
                        InfoBadge(count.toString(), if (count > 0) PlannerChampagne else PlannerMuted)
                    }
                    Text(stringResource(module.title), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                        maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}
