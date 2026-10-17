package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.EventPhase
import br.com.paivalab.weddingmanagementsystem.data.EventPhases
import br.com.paivalab.weddingmanagementsystem.data.ExtraFields
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import java.time.LocalDate

/** Colunas do Kanban na mesma ordem da web. */
internal val taskColumns = listOf("TODO", "IN_PROGRESS", "DONE", "BLOCKED")

private fun phaseLabel(phase: EventPhase): Int = when (phase) {
    EventPhase.TWELVE_MONTHS -> R.string.phase_12m
    EventPhase.SIX_MONTHS -> R.string.phase_6m
    EventPhase.THREE_MONTHS -> R.string.phase_3m
    EventPhase.ONE_MONTH -> R.string.phase_1m
    EventPhase.ONE_WEEK -> R.string.phase_1w
    EventPhase.PAST -> R.string.countdown_past
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun TaskPhaseBar(daysToEvent: Long) {
    val current = EventPhases.phase(daysToEvent)
    Card(
        colors = CardDefaults.cardColors(containerColor = PlannerSurface),
        border = BorderStroke(1.dp, PlannerBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.phase_title), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(
                    if (current == EventPhase.PAST) stringResource(R.string.countdown_past)
                    else plural(R.plurals.days_left, daysToEvent.toInt(), daysToEvent.toInt()),
                    style = MaterialTheme.typography.labelSmall, color = PlannerMuted,
                )
            }
            PlannerProgressBar(EventPhases.progress(daysToEvent), PlannerRose, height = 6.dp)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                EventPhases.shown.forEach { phase ->
                    InfoBadge(stringResource(phaseLabel(phase)), if (phase == current) PlannerRose else PlannerMuted)
                }
            }
        }
    }
}

@Composable
internal fun TaskKanban(
    tasks: List<PlannerRecord>,
    index: RecordIndex,
    language: String,
    onOpen: (PlannerRecord) -> Unit,
    onStatus: (PlannerRecord, String) -> Unit,
) {
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        taskColumns.forEach { status ->
            val items = tasks.filter { it.status == status }
            Column(Modifier.width(260.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(statusLabel(status, language), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold,
                        color = statusColor(status), modifier = Modifier.semantics { heading() })
                    InfoBadge(items.size.toString(), PlannerMuted)
                }
                if (items.isEmpty()) {
                    Text(stringResource(R.string.kanban_empty), style = MaterialTheme.typography.bodySmall, color = PlannerMuted,
                        modifier = Modifier.padding(vertical = 12.dp))
                }
                items.forEach { task -> KanbanCard(task, index, language, onOpen, onStatus) }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun KanbanCard(
    task: PlannerRecord,
    index: RecordIndex,
    language: String,
    onOpen: (PlannerRecord) -> Unit,
    onStatus: (PlannerRecord, String) -> Unit,
) {
    val extra = index.extra(task)
    val priority = ExtraFields.text(extra, "priority", "MEDIUM")
    val responsible = ExtraFields.text(extra, "responsible")
    val overdue = task.status != "DONE" && !task.date.isNullOrBlank() && task.date < LocalDate.now().toString()
    var menu by remember { mutableStateOf(false) }
    Card(
        onClick = { onOpen(task) },
        colors = CardDefaults.cardColors(containerColor = PlannerSurface),
        border = BorderStroke(1.dp, if (overdue) PlannerDanger.copy(alpha = 0.5f) else PlannerBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(start = 12.dp, top = 8.dp, bottom = 10.dp), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f).padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(task.title, fontWeight = FontWeight.SemiBold, maxLines = 3, overflow = TextOverflow.Ellipsis)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    InfoBadge(webValueLabel(priority, language), priorityColor(priority))
                    if (!task.date.isNullOrBlank()) {
                        InfoBadge(
                            if (overdue) stringResource(R.string.task_overdue_on, formatDisplayDate(task.date, language))
                            else formatDisplayDate(task.date, language),
                            if (overdue) PlannerDanger else PlannerMuted,
                        )
                    }
                    if (responsible.isNotBlank()) InfoBadge(stringResource(R.string.task_responsible_value, responsible), PlannerMuted)
                    index.find(task.parentId)?.let { InfoBadge(it.title, PlannerChampagne) }
                }
            }
            Box {
                IconButton(onClick = { menu = true }) {
                    Icon(Icons.Default.SwapHoriz, stringResource(R.string.task_move, task.title), tint = PlannerMuted)
                }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    taskColumns.filter { it != task.status }.forEach { status ->
                        DropdownMenuItem(
                            text = { Text(statusLabel(status, language)) },
                            onClick = { menu = false; onStatus(task, status) },
                        )
                    }
                }
            }
        }
    }
}
