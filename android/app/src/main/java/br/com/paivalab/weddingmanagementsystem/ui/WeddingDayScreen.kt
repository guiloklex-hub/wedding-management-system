package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import org.json.JSONObject

@Composable
fun WeddingDayScreen(
    model: PlannerViewModel,
    records: List<PlannerRecord>,
    language: String,
    onNotify: (String) -> Unit = {},
) {
    val storedSchedule by model.daySchedule.collectAsState()
    val storedRain by model.rainPlan.collectAsState()
    val storedNotes by model.specialNotes.collectAsState()
    var schedule by remember(storedSchedule) { mutableStateOf(storedSchedule) }
    var rain by remember(storedRain) { mutableStateOf(storedRain) }
    var notes by remember(storedNotes) { mutableStateOf(storedNotes) }
    val confirmed = records.filter { it.kind == Kinds.GUEST && it.status == "CONFIRMED" && it.deletedAt == null }
    val checked = confirmed.count { runCatching { JSONObject(it.extraJson).has("checkedInAt") }.getOrDefault(false) }
    val tables = records.filter { it.kind == Kinds.TABLE && it.deletedAt == null }.sortedBy { it.title }
    val unseated = confirmed.filter { it.seatingTableId == null }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerChampagne.copy(alpha = 0.28f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Roteiro Operacional & Plano de Contingência", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerChampagne)
                    OutlinedTextField(
                        schedule,
                        { schedule = it.take(8000) },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        label = { Text(localized(R.string.day_schedule, language)) },
                    )
                    OutlinedTextField(
                        rain,
                        { rain = it.take(8000) },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        label = { Text(localized(R.string.rain_plan, language)) },
                    )
                    OutlinedTextField(
                        notes,
                        { notes = it.take(8000) },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        label = { Text(localized(R.string.special_notes, language)) },
                    )
                    Button(
                        onClick = {
                            model.saveWeddingDay(schedule, rain, notes)
                            onNotify("Cronograma e Plano B salvos com sucesso!")
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(localized(R.string.save, language))
                    }
                }
            }
        }
        if (tables.isNotEmpty()) item {
            Text(localized(R.string.table_overview, language), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        items(tables, key = { "table-${it.id}" }) { table ->
            val guests = records.filter { it.kind == Kinds.GUEST && it.deletedAt == null && it.seatingTableId == table.id }
            val occupied = guests.sumOf { 1 + it.plusOnesConfirmed }
            val capacity = table.amountCents ?: 0L
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(table.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        InfoBadge("$occupied / $capacity ${localized(R.string.seats, language)}", if (occupied <= capacity) PlannerChampagne else PlannerRose)
                    }
                    guests.forEach { guest ->
                        Text("• ${guest.title} (${1 + guest.plusOnesConfirmed} ${localized(R.string.seats, language)})", style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                    }
                }
            }
        }
        if (unseated.isNotEmpty()) item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerRose.copy(alpha = 0.35f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(localized(R.string.unseated_guests, language), style = MaterialTheme.typography.titleMedium, color = PlannerRose, fontWeight = FontWeight.SemiBold)
                    unseated.forEach { guest -> Text("• ${guest.title}", style = MaterialTheme.typography.bodySmall) }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(localized(R.string.checked_in, language), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                InfoBadge("$checked / ${confirmed.size} presentes", PlannerEmerald)
            }
        }
        items(confirmed, key = { it.id }) { guest ->
            val checkedAt = runCatching { JSONObject(guest.extraJson).optLong("checkedInAt", 0L) }.getOrDefault(0L)
            val isChecked = checkedAt > 0L
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, if (isChecked) PlannerEmerald.copy(alpha = 0.35f) else PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(Modifier.padding(16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(guest.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text("${1 + guest.plusOnesConfirmed} ${localized(R.string.seats, language)}", style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                        if (isChecked) {
                            Text("Check-in realizado em ${formatTimestamp(checkedAt, language)}", style = MaterialTheme.typography.labelSmall, color = PlannerEmerald)
                        }
                    }
                    if (isChecked) {
                        StatusBadge("CONFIRMED", language)
                    } else {
                        OutlinedButton(onClick = {
                            model.checkInGuest(guest.id)
                            onNotify("Check-in confirmado: ${guest.title}")
                        }) {
                            Text(localized(R.string.check_in, language))
                        }
                    }
                }
            }
        }
    }
}
