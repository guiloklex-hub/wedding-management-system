package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import org.json.JSONObject

@Composable
fun WeddingDayScreen(model: PlannerViewModel, records: List<PlannerRecord>, language: String) {
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
    LazyColumn(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Text(localized(R.string.wedding_day, language), style = MaterialTheme.typography.headlineSmall) }
        item { OutlinedTextField(schedule, { schedule = it.take(8000) }, modifier = Modifier.fillMaxWidth(),
            minLines = 3, label = { Text(localized(R.string.day_schedule, language)) }) }
        item { OutlinedTextField(rain, { rain = it.take(8000) }, modifier = Modifier.fillMaxWidth(),
            minLines = 2, label = { Text(localized(R.string.rain_plan, language)) }) }
        item { OutlinedTextField(notes, { notes = it.take(8000) }, modifier = Modifier.fillMaxWidth(),
            minLines = 2, label = { Text(localized(R.string.special_notes, language)) }) }
        item { Button(onClick = { model.saveWeddingDay(schedule, rain, notes) }) { Text(localized(R.string.save, language)) } }
        if (tables.isNotEmpty()) item { Text(localized(R.string.table_overview, language), style = MaterialTheme.typography.titleLarge) }
        items(tables, key = { "table-${it.id}" }) { table ->
            val guests = records.filter { it.kind == Kinds.GUEST && it.deletedAt == null && it.seatingTableId == table.id }
            val occupied = guests.sumOf { 1 + it.plusOnesConfirmed }
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(table.title, style = MaterialTheme.typography.titleMedium)
                    Text("$occupied / ${table.amountCents ?: 0} ${localized(R.string.seats, language)}",
                        color = PlannerChampagne)
                    guests.forEach { guest -> Text("${guest.title} · ${1 + guest.plusOnesConfirmed}") }
                }
            }
        }
        if (unseated.isNotEmpty()) item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(localized(R.string.unseated_guests, language), style = MaterialTheme.typography.titleMedium)
                    unseated.forEach { guest -> Text(guest.title) }
                }
            }
        }
        item { Text("${localized(R.string.checked_in, language)}: $checked / ${confirmed.size}",
            style = MaterialTheme.typography.titleLarge) }
        items(confirmed, key = { it.id }) { guest ->
            val isChecked = runCatching { JSONObject(guest.extraJson).has("checkedInAt") }.getOrDefault(false)
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(guest.title, style = MaterialTheme.typography.titleMedium)
                    Text("${1 + guest.plusOnesConfirmed} ${localized(R.string.seats, language)}")
                    if (isChecked) Text(localized(R.string.checked_in, language), color = PlannerChampagne)
                    else OutlinedButton(onClick = { model.checkInGuest(guest.id) }) {
                        Text(localized(R.string.check_in, language))
                    }
                }
            }
        }
    }
}
