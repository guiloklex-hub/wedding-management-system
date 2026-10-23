package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Flight
import androidx.compose.material.icons.filled.Hotel
import androidx.compose.material.icons.filled.Luggage
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.ExtraFields
import br.com.paivalab.weddingmanagementsystem.data.HoneymoonRules
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex

private fun kindIcon(kind: String): ImageVector = when (kind) {
    "FLIGHT" -> Icons.Default.Flight
    "HOTEL" -> Icons.Default.Hotel
    "TRANSFER" -> Icons.Default.DirectionsCar
    "ACTIVITY" -> Icons.Default.Explore
    "DOCUMENT" -> Icons.Default.Description
    "BAGGAGE" -> Icons.Default.Luggage
    else -> Icons.Default.Work
}

/** Página única da lua de mel, como `/dashboard/honeymoon`: viagem no topo e itens agrupados por tipo. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HoneymoonScreen(
    index: RecordIndex,
    currency: String,
    language: String,
    onEditTrip: (PlannerRecord?) -> Unit,
    onAddItem: (PlannerRecord?) -> Unit,
    onOpenItem: (PlannerRecord) -> Unit,
) {
    val trip = HoneymoonRules.trip(index)
    val items = HoneymoonRules.items(index)
    val tripCurrency = HoneymoonRules.currency(trip, currency)
    val pending = HoneymoonRules.documentsPending(items)
    fun day(value: String?) = value?.takeIf { it.isNotBlank() }?.let { formatDisplayDate(it, language) } ?: "—"
    LazyColumn(contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.honeymoon_destination), style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                    Text(HoneymoonRules.destination(trip).ifBlank { stringResource(R.string.honeymoon_not_decided) },
                        style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold,
                        modifier = Modifier.semantics { heading() })
                    val endDate = trip?.let { ExtraFields.day(ExtraFields.parse(it.extraJson), "endDate")?.toString() }
                    Text(stringResource(R.string.honeymoon_period, day(trip?.date), day(endDate)), color = PlannerMuted)
                    if (!trip?.notes.isNullOrBlank()) Text(trip!!.notes, style = MaterialTheme.typography.bodyMedium)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        InfoBadge(stringResource(R.string.honeymoon_budget_value,
                            trip?.amountCents?.let { localizedCurrency(it, tripCurrency, language) } ?: "—"), PlannerChampagne)
                        InfoBadge(stringResource(R.string.honeymoon_committed,
                            localizedCurrency(HoneymoonRules.committedCents(items), currency, language)), PlannerRose)
                        InfoBadge(stringResource(R.string.honeymoon_documents_pending, pending), if (pending > 0) PlannerRose else PlannerEmerald)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { onEditTrip(trip) }) { Text(stringResource(R.string.honeymoon_edit_trip)) }
                        OutlinedButton(onClick = { onAddItem(trip) }) {
                            Icon(Icons.Default.Add, null, Modifier.size(18.dp))
                            Text(stringResource(R.string.honeymoon_new_item), Modifier.padding(start = 4.dp))
                        }
                    }
                }
            }
        }
        if (items.isEmpty()) item {
            Text(stringResource(R.string.honeymoon_items_empty), color = PlannerMuted, modifier = Modifier.padding(8.dp))
        }
        HoneymoonRules.grouped(items).forEach { (kind, group) ->
            item(key = "group-$kind") {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 4.dp)) {
                    Icon(kindIcon(kind), null, tint = PlannerChampagne)
                    Text("${honeymoonKindLabel(kind)} (${group.size})", style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold, modifier = Modifier.semantics { heading() })
                }
            }
            items(group, key = { it.id }) { item -> HoneymoonItemRow(item, language, ::day) { onOpenItem(item) } }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun HoneymoonItemRow(item: PlannerRecord, language: String, day: (String?) -> String, onOpen: () -> Unit) {
    val extra = ExtraFields.parse(item.extraJson)
    val vendor = ExtraFields.text(extra, "vendor")
    val confirmation = ExtraFields.text(extra, "confirmationNumber")
    Card(
        colors = CardDefaults.cardColors(containerColor = PlannerSurface),
        border = BorderStroke(1.dp, PlannerBorder),
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(onClick = onOpen),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(item.title, fontWeight = FontWeight.SemiBold)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (vendor.isNotBlank()) InfoBadge(vendor, PlannerMuted)
                    if (!item.date.isNullOrBlank()) InfoBadge(stringResource(R.string.honeymoon_item_starts, day(item.date)), PlannerChampagne)
                    if (confirmation.isNotBlank()) InfoBadge(stringResource(R.string.booking_code, confirmation), PlannerEmerald)
                    InfoBadge(statusLabel(item.status, language), if (item.status == "CANCELLED") PlannerRose else PlannerMuted)
                }
            }
            item.amountCents?.takeIf { it > 0L }?.let {
                Text(localizedCurrency(it, HoneymoonRules.currency(item), language), color = PlannerChampagne, fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(start = 8.dp))
            }
        }
    }
}
