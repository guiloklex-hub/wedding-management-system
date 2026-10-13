package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.ExtraFields
import br.com.paivalab.weddingmanagementsystem.data.FinanceRules
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import kotlin.math.roundToInt

/** Ações disponíveis nos cartões e no topo de uma lista de módulo. */
class ModuleActions(
    val open: (PlannerRecord) -> Unit,
    val add: () -> Unit,
    val delete: (PlannerRecord) -> Unit,
    val setStatus: (PlannerRecord, String) -> Unit,
    val markPaid: (PlannerRecord) -> Unit,
    val whatsApp: (PlannerRecord) -> Unit,
    val dial: (PlannerRecord) -> Unit,
    val maps: (PlannerRecord) -> Unit,
    val attach: (PlannerRecord) -> Unit,
    val openFile: (PlannerFile) -> Unit,
    val postGift: (PlannerRecord) -> Unit,
    val invite: (PlannerRecord) -> Unit,
    val importGuests: () -> Unit,
    val seedTasks: () -> Unit,
    val seedVenueChecklist: (String) -> Unit,
    val installments: () -> Unit,
    val groupRsvp: (PlannerRecord, String) -> Unit,
    val compare: () -> Unit,
    val sharePix: () -> Unit,
    val giftPix: (PlannerRecord) -> Unit,
    val pixConfigured: Boolean,
)

@Composable
fun ModuleScreen(
    module: ModuleDefinition,
    index: RecordIndex,
    viewModel: ModuleListViewModel,
    currency: String,
    language: String,
    actions: ModuleActions,
) {
    val state by viewModel.list.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val selectedStatus by viewModel.status.collectAsStateWithLifecycle()
    val selectedTag by viewModel.tag.collectAsStateWithLifecycle()
    val sort by viewModel.sort.collectAsStateWithLifecycle()
    var pickVenueForChecklist by rememberSaveable { mutableStateOf(false) }

    LazyColumn(contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ModuleSummaryBanner(module.kind, index, currency, language) }
        item {
            OutlinedTextField(
                query,
                viewModel::setQuery,
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.search)) },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                trailingIcon = {
                    if (query.isNotEmpty()) IconButton(onClick = { viewModel.setQuery("") }) {
                        Icon(Icons.Default.Close, stringResource(R.string.clear_search))
                    }
                },
                singleLine = true,
            )
        }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.sort_by), style = MaterialTheme.typography.labelMedium, color = PlannerMuted)
                listOf(
                    ModuleListViewModel.SORT_RECENT to R.string.sort_recent,
                    ModuleListViewModel.SORT_NAME to R.string.sort_name,
                    ModuleListViewModel.SORT_DATE to R.string.sort_date,
                ).filter { it.first != ModuleListViewModel.SORT_DATE || module.hasDate }.forEach { (key, label) ->
                    FilterChip(selected = sort == key, onClick = { viewModel.setSort(key) }, label = { Text(stringResource(label)) })
                }
            }
        }
        if (module.statuses.isNotEmpty()) item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FilterChip(selected = selectedStatus == null, onClick = { viewModel.setStatus(null) },
                    label = { Text(stringResource(R.string.filter_all, state.total)) })
                if (state.overdue > 0) {
                    val overdue = ModuleListViewModel.STATUS_OVERDUE
                    FilterChip(
                        selected = selectedStatus == overdue,
                        onClick = { viewModel.setStatus(if (selectedStatus == overdue) null else overdue) },
                        label = { Text(stringResource(R.string.filter_overdue, state.overdue)) },
                    )
                }
                module.statuses.forEach { status ->
                    FilterChip(
                        selected = selectedStatus == status,
                        onClick = { viewModel.setStatus(if (selectedStatus == status) null else status) },
                        label = { Text("${statusLabel(status, language)} (${state.statusCounts[status] ?: 0})") },
                    )
                }
            }
        }
        if (module.kind == Kinds.GUEST) {
            item {
                OutlinedButton(onClick = actions.importGuests, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.import_guests)) }
            }
            val tags = index.kind(Kinds.TAG).sortedBy { it.title.lowercase() }
            if (tags.isNotEmpty()) item {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = selectedTag == null, onClick = { viewModel.setTag(null) }, label = { Text(stringResource(R.string.all_tags)) })
                    tags.forEach { tag ->
                        FilterChip(selected = selectedTag == tag.id, onClick = { viewModel.setTag(if (selectedTag == tag.id) null else tag.id) },
                            label = { Text(tag.title) })
                    }
                }
            }
        }
        when (module.kind) {
            Kinds.VENDOR -> item {
                OutlinedButton(onClick = actions.compare, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.vendor_compare)) }
            }
            Kinds.TASK -> item {
                OutlinedButton(onClick = actions.seedTasks, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.add_task_templates)) }
            }
            Kinds.VENUE_CHECK -> if (index.count(Kinds.VENUE) > 0) item {
                OutlinedButton(onClick = { pickVenueForChecklist = true }, modifier = Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.seed_venue_checklist))
                }
            }
            Kinds.PAYMENT -> item {
                OutlinedButton(onClick = actions.installments, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.create_installments)) }
            }
            Kinds.GIFT -> if (actions.pixConfigured) item {
                OutlinedButton(onClick = actions.sharePix, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.share_pix)) }
            }
        }
        if (state.items.isEmpty()) item {
            EmptyModuleState(
                title = if (state.total == 0) stringResource(R.string.empty_module, stringResource(module.title)) else stringResource(R.string.empty_filtered),
                showAdd = state.total == 0,
                onAdd = actions.add,
            )
        }
        items(state.items, key = { it.id }) { record ->
            ModuleRecordCard(module, record, index, currency, language, actions)
        }
    }

    if (pickVenueForChecklist) {
        AlertDialog(
            onDismissRequest = { pickVenueForChecklist = false },
            title = { Text(stringResource(R.string.seed_venue_checklist)) },
            text = {
                Column {
                    index.kind(Kinds.VENUE).sortedBy { it.title.lowercase() }.forEach { venue ->
                        ListItem(
                            headlineContent = { Text(venue.title) },
                            modifier = Modifier.fillMaxWidth().clickable {
                                pickVenueForChecklist = false
                                actions.seedVenueChecklist(venue.id)
                            },
                        )
                    }
                }
            },
            confirmButton = { TextButton(onClick = { pickVenueForChecklist = false }) { Text(stringResource(R.string.cancel)) } },
        )
    }
}

@Composable
private fun EmptyModuleState(title: String, showAdd: Boolean, onAdd: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(title, color = PlannerMuted, textAlign = TextAlign.Center)
        if (showAdd) {
            Button(onClick = onAdd) {
                Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
                Text(stringResource(R.string.add_first), modifier = Modifier.padding(start = 6.dp))
            }
        }
    }
}

@Composable
private fun ModuleRecordCard(
    module: ModuleDefinition,
    record: PlannerRecord,
    index: RecordIndex,
    currency: String,
    language: String,
    actions: ModuleActions,
) {
    val files = index.files(record.id)
    Card(
        colors = CardDefaults.cardColors(containerColor = PlannerSurface),
        border = BorderStroke(1.dp, PlannerBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            RecordCard(record, index, currency, language, onClick = { actions.open(record) })
            HorizontalDivider(color = PlannerBorder)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(
                    Modifier.weight(1f).horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    QuickActions(module, record, index, actions)
                }
                IconButton(onClick = { actions.delete(record) }) {
                    Icon(Icons.Default.Delete, stringResource(R.string.delete_named, record.title), tint = PlannerMuted)
                }
            }
            if (files.isNotEmpty()) {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    files.forEach { file ->
                        AssistChip(
                            onClick = { actions.openFile(file) },
                            label = { Text(file.fileName, style = MaterialTheme.typography.labelSmall, maxLines = 1) },
                            leadingIcon = { Icon(Icons.Default.AttachFile, null, modifier = Modifier.size(16.dp)) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickActions(module: ModuleDefinition, record: PlannerRecord, index: RecordIndex, actions: ModuleActions) {
    @Composable fun Action(label: Int, color: Color = PlannerChampagne, onClick: () -> Unit) {
        TextButton(onClick = onClick) { Text(stringResource(label), color = color) }
    }
    when (module.kind) {
        Kinds.PAYMENT -> if (record.status != "PAID") Action(R.string.mark_paid, PlannerEmerald) { actions.markPaid(record) }
        Kinds.INCOME -> if (record.status != "RECEIVED") Action(R.string.mark_received, PlannerEmerald) { actions.setStatus(record, "RECEIVED") }
        Kinds.TASK, Kinds.VENUE_CHECK -> if (record.status != "DONE") Action(R.string.mark_done, PlannerEmerald) { actions.setStatus(record, "DONE") }
        Kinds.GUEST -> {
            if (record.status != "CONFIRMED") Action(R.string.confirm_guest, PlannerEmerald) { actions.setStatus(record, "CONFIRMED") }
            if (record.phone.isNotBlank()) Action(R.string.whatsapp) { actions.whatsApp(record) }
        }
        Kinds.GIFT -> {
            val processed = record.status == "PROCESSED" || ExtraFields.has(index.extra(record), "processedAt")
            if (!processed && record.amountCents != null) Action(R.string.post_gift, PlannerEmerald) { actions.postGift(record) }
            if (actions.pixConfigured) Action(R.string.share_pix) { actions.giftPix(record) }
        }
        Kinds.INVITATION, Kinds.SAVE_THE_DATE -> Action(R.string.prepare_invite) { actions.invite(record) }
        Kinds.GROUP -> listOf("CONFIRMED" to R.string.confirm_group, "DECLINED" to R.string.decline_group, "MAYBE" to R.string.status_maybe)
            .forEach { (status, label) -> if (record.status != status) Action(label) { actions.groupRsvp(record, status) } }
    }
    if (module.kind in setOf(Kinds.VENDOR, Kinds.VENUE, Kinds.CONTACT, Kinds.GROUP) && record.phone.isNotBlank()) {
        Action(R.string.call_phone) { actions.dial(record) }
        Action(R.string.whatsapp) { actions.whatsApp(record) }
    }
    if (module.kind == Kinds.VENUE) Action(R.string.open_maps) { actions.maps(record) }
    if (module.kind in setOf(Kinds.VENDOR, Kinds.VENUE, Kinds.CONTRACT, Kinds.INVITATION, Kinds.SAVE_THE_DATE)) {
        Action(R.string.attach_file) { actions.attach(record) }
    }
}

@Composable
private fun ModuleSummaryBanner(kind: String, index: RecordIndex, currency: String, language: String) {
    val items = index.kind(kind)
    if (items.isEmpty()) return
    fun money(value: Long) = localizedCurrency(value, currency, language)
    val summary: Triple<String, String, Color>? = when (kind) {
        Kinds.BUDGET -> {
            val estimated = FinanceRules.budgetEstimated(items)
            val actual = FinanceRules.budgetActual(items)
            val diff = actual - estimated
            Triple(
                stringResource(R.string.summary_budget, money(estimated), money(actual)),
                if (diff <= 0L) stringResource(R.string.summary_saving, money(-diff)) else stringResource(R.string.summary_overrun, money(diff)),
                if (diff <= 0L) PlannerEmerald else PlannerRose,
            )
        }
        Kinds.PAYMENT -> Triple(
            stringResource(R.string.summary_paid, money(items.filter { it.status == "PAID" }.sumOf { it.amountCents ?: 0L })),
            stringResource(R.string.summary_open, money(items.filter { it.status != "PAID" }.sumOf { it.amountCents ?: 0L })),
            PlannerEmerald,
        )
        Kinds.INCOME -> Triple(
            stringResource(R.string.summary_received, money(items.filter { it.status == "RECEIVED" }.sumOf { it.amountCents ?: 0L })),
            stringResource(R.string.summary_expected, money(items.filter { it.status == "EXPECTED" }.sumOf { it.amountCents ?: 0L })),
            PlannerEmerald,
        )
        Kinds.ASSET -> Triple(
            stringResource(R.string.summary_cash, money(items.sumOf { it.amountCents ?: 0L })),
            pluralStringResource(R.plurals.summary_reserves, items.size, items.size),
            PlannerChampagne,
        )
        Kinds.GOAL -> {
            val target = items.sumOf { it.amountCents ?: 0L }
            val saved = items.sumOf { goal -> index.children(goal.id, Kinds.ASSET).sumOf { it.amountCents ?: 0L } }
            val percent = if (target <= 0L) 0 else ((saved.toFloat() / target) * 100).roundToInt()
            Triple(stringResource(R.string.summary_goals, money(target)), stringResource(R.string.summary_goals_saved, money(saved), percent),
                PlannerChampagne)
        }
        Kinds.GUEST -> {
            val confirmed = items.filter { it.status == "CONFIRMED" }
            val seats = confirmed.sumOf { 1 + it.plusOnesConfirmed }
            Triple(stringResource(R.string.summary_guests, confirmed.size, items.size),
                pluralStringResource(R.plurals.summary_seats, seats, seats), PlannerEmerald)
        }
        Kinds.TABLE -> {
            val capacity = items.sumOf { it.amountCents ?: 0L }.toInt()
            val occupied = items.sumOf { index.tableOccupancy(it.id) }
            Triple(pluralStringResource(R.plurals.summary_tables, items.size, items.size),
                stringResource(R.string.summary_occupancy, occupied, capacity), PlannerChampagne)
        }
        else -> null
    }
    if (summary != null) {
        Card(
            colors = CardDefaults.cardColors(containerColor = PlannerSurface),
            border = BorderStroke(1.dp, summary.third.copy(alpha = 0.30f)),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(14.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(summary.first, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(summary.second, style = MaterialTheme.typography.labelSmall, color = summary.third)
            }
        }
    }
}
