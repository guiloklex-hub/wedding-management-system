package br.com.paivalab.weddingmanagementsystem.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.backup.BackupArchive
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.CalendarExport
import br.com.paivalab.weddingmanagementsystem.data.Money
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID
import org.json.JSONObject
import org.json.JSONArray

private val primaryTabs = listOf(Kinds.TASK, Kinds.VENDOR, Kinds.GUEST)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlannerApp(model: PlannerViewModel, activity: Activity, archive: BackupArchive,
               authenticate: ((() -> Unit)?) -> Unit) {
    val allRecords by model.records.collectAsState()
    val allFiles by model.files.collectAsState()
    val allAudits by model.audits.collectAsState()
    val language by model.locale.collectAsState()
    val currency by model.currency.collectAsState()
    val eventDate by model.eventDate.collectAsState()
    val pixKey by model.pixKey.collectAsState()
    val pixHolder by model.pixHolderName.collectAsState()
    val error by model.error.collectAsState()
    val guestImport by model.guestImport.collectAsState()
    val guestImportResult by model.guestImportResult.collectAsState()
    var section by remember { mutableStateOf("dashboard") }
    var editor by remember { mutableStateOf<PlannerRecord?>(null) }
    var creating by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<PlannerRecord?>(null) }
    var attachmentTarget by remember { mutableStateOf<PlannerRecord?>(null) }
    var exportTarget by remember { mutableStateOf<PlannerFile?>(null) }
    var inviteTemplate by remember { mutableStateOf<PlannerRecord?>(null) }
    var pendingInvite by remember { mutableStateOf<Triple<PlannerRecord, PlannerRecord, String>?>(null) }
    var installments by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val guestResultMessage = localized(R.string.guest_import_result, language)
    val genericError = localized(R.string.error_generic, language)
    val tableFullError = localized(R.string.table_full, language)
    val pixShareMessage = localized(R.string.pix_share_message, language)
        .replace("{key}", pixKey).replace("{holder}", pixHolder)
    val pixShareTitle = localized(R.string.share_pix, language)
    val importFile = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        val target = attachmentTarget
        if (uri != null && target != null) model.addAttachment(activity, target.id, uri)
        attachmentTarget = null
    }
    val exportFile = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        val target = exportTarget
        if (uri != null && target != null) model.exportAttachment(activity, target, uri)
        exportTarget = null
    }
    val calendarFile = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/calendar")) { uri ->
        if (uri != null) runCatching {
            activity.contentResolver.openOutputStream(uri, "w")?.use { stream ->
                stream.write(CalendarExport.generate(allRecords).toByteArray(Charsets.UTF_8))
            } ?: error("calendar")
        }
    }
    val guestFile = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) model.previewGuestImport(activity, uri)
    }

    LaunchedEffect(error) {
        if (error != null) {
            snackbar.showSnackbar(if (error == "Mesa sem lugares") tableFullError else genericError)
            model.clearError()
        }
    }
    LaunchedEffect(guestImportResult) {
        guestImportResult?.let { (added, skipped) ->
            snackbar.showSnackbar(guestResultMessage
                .replace("{added}", added.toString()).replace("{skipped}", skipped.toString()))
        }
    }
    BackHandler(section != "dashboard" || editor != null || creating) {
        when {
            editor != null || creating -> { editor = null; creating = false }
            else -> section = "dashboard"
        }
    }

    val currentModule = modules.find { it.kind == section }
    val title = when (section) {
        "dashboard" -> localized(R.string.dashboard, language)
        "more" -> localized(R.string.more, language)
        "settings" -> localized(R.string.settings, language)
        "insights" -> localized(R.string.insights, language)
        "help" -> localized(R.string.help, language)
        "audit" -> localized(R.string.audit, language)
        "vendor-compare" -> localized(R.string.vendor_compare, language)
        "wedding-day" -> localized(R.string.wedding_day, language)
        "backup" -> localized(R.string.backup, language)
        else -> currentModule?.let { localized(it.title, language) } ?: section
    }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Favorite, null, tint = PlannerRose, modifier = Modifier.size(22.dp))
                    Spacer(Modifier.width(10.dp))
                    Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                } },
                navigationIcon = { if (section !in listOf("dashboard", "more") && section !in primaryTabs)
                    IconButton(onClick = { section = "more" }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = PlannerBackground),
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color(0xFF09090B)) {
                val tabs = listOf(
                    Triple("dashboard", R.string.dashboard, Icons.Default.Dashboard),
                    Triple(Kinds.TASK, R.string.tasks, modules.first { it.kind == Kinds.TASK }.icon),
                    Triple(Kinds.VENDOR, R.string.vendors_nav, modules.first { it.kind == Kinds.VENDOR }.icon),
                    Triple(Kinds.GUEST, R.string.guests, modules.first { it.kind == Kinds.GUEST }.icon),
                    Triple("more", R.string.more, Icons.Default.MoreHoriz),
                )
                tabs.forEach { (key, label, icon) ->
                    NavigationBarItem(
                        selected = section == key || (key == "more" && section !in tabs.map { it.first }),
                        onClick = { section = key },
                        icon = { Icon(icon, if (key == Kinds.VENDOR) localized(R.string.vendors, language) else null) },
                        label = { Text(localized(label, language), maxLines = 1) },
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            if (currentModule != null) {
                ExtendedFloatingActionButton(
                    onClick = { creating = true },
                    icon = { Icon(Icons.Default.Add, null) },
                    text = { Text(localized(R.string.add, language)) },
                )
            }
        },
    ) { inner ->
        Box(Modifier.fillMaxSize().padding(inner)) {
            when (section) {
                "dashboard" -> DashboardScreen(allRecords, currency, language) { section = it }
                "more" -> MoreScreen(language) { section = it }
                "settings" -> SettingsScreen(model, language, currency, authenticate,
                    onExportCalendar = { calendarFile.launch("wedding-finance.ics") }) { section = it }
                "insights" -> InsightsScreen(allRecords, language, currency, eventDate)
                "help" -> HelpScreen(language)
                "audit" -> AuditScreen(allAudits, allRecords, language)
                "vendor-compare" -> VendorCompareScreen(allRecords, language, currency)
                "wedding-day" -> WeddingDayScreen(model, allRecords, language)
                "backup" -> BackupScreen(archive, language, authenticate, model::refreshEvent)
                else -> if (currentModule != null) {
                    ModuleScreen(currentModule, allRecords, allFiles, language, currency,
                        onEdit = { editor = it },
                        onDelete = { deleteTarget = it },
                        onStatus = { id, status -> model.setStatus(id, status) },
                        onPaid = model::markPaid,
                        onWhatsApp = { record -> openWhatsApp(activity, record) },
                        onAttach = { record -> attachmentTarget = record; importFile.launch(arrayOf("*/*")) },
                        onExport = { file -> exportTarget = file; exportFile.launch(file.fileName) },
                        onGift = { id -> model.convertGift(id, Kinds.INCOME) },
                        onInvite = { inviteTemplate = it },
                        onGuestImport = { guestFile.launch(arrayOf("*/*")) },
                        onSeedTasks = model::seedTaskTemplates,
                        onInstallments = { installments = true },
                        onGroupRsvp = model::setGroupRsvp,
                        onCompare = { section = "vendor-compare" },
                        onSharePix = { sharePix(activity, pixShareMessage, pixShareTitle) },
                        pixConfigured = pixKey.isNotBlank(),
                        onDial = { record -> dialPhone(activity, record.phone) },
                        onMaps = { record -> openMap(activity, record) },
                    )
                }
            }
        }
    }

    if (creating || editor != null) {
        val module = currentModule
        if (module != null) {
            RecordEditor(module, editor, allRecords, language,
                onDismiss = { editor = null; creating = false },
                onSave = { record -> model.save(record) { editor = null; creating = false } },
            )
        }
    }
    deleteTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text(localized(R.string.confirm_delete, language)) },
            text = { Text(target.title) },
            confirmButton = { TextButton(onClick = { model.delete(target.id); deleteTarget = null }) {
                Text(localized(R.string.delete, language))
            } },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) {
                Text(localized(R.string.cancel, language))
            } },
        )
    }
    inviteTemplate?.let { template ->
        AlertDialog(
            onDismissRequest = { inviteTemplate = null },
            title = { Text(localized(R.string.choose_guest, language)) },
            text = { LazyColumn(Modifier.height(320.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                items(allRecords.filter { it.kind == Kinds.GUEST && it.deletedAt == null }) { guest ->
                    Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) {
                        Text(guest.title)
                        Row {
                            if (guest.phone.isNotBlank()) TextButton(onClick = {
                                inviteTemplate = null
                                if (openInviteWhatsApp(activity, template, guest)) pendingInvite = Triple(template, guest, "WHATSAPP")
                            }) { Text(localized(R.string.share_whatsapp, language)) }
                            TextButton(onClick = {
                                inviteTemplate = null
                                if (shareInviteText(activity, template, guest)) pendingInvite = Triple(template, guest, "SHARE")
                            }) { Text(localized(R.string.share_text, language)) }
                        }
                    } }
                }
            } },
            confirmButton = { TextButton(onClick = { inviteTemplate = null }) { Text(localized(R.string.cancel, language)) } },
        )
    }
    pendingInvite?.let { (template, guest, channel) ->
        AlertDialog(
            onDismissRequest = { pendingInvite = null },
            title = { Text(localized(R.string.sent_confirm, language)) },
            text = { Text("${guest.title}\n${localized(R.string.sent_warning, language)}") },
            confirmButton = { TextButton(onClick = {
                model.confirmInvitationSent(template.id, guest.id, channel)
                pendingInvite = null
            }) { Text(localized(R.string.sent_confirm, language)) } },
            dismissButton = { TextButton(onClick = { pendingInvite = null }) { Text(localized(R.string.cancel, language)) } },
        )
    }
    guestImport?.let { preview ->
        AlertDialog(
            onDismissRequest = model::dismissGuestImport,
            title = { Text(localized(R.string.import_guests, language)) },
            text = { Text(localized(R.string.guest_import_preview, language)
                .replace("{count}", preview.guests.size.toString()).replace("{source}", preview.source)) },
            confirmButton = { TextButton(onClick = model::commitGuestImport) { Text(localized(R.string.import_guests, language)) } },
            dismissButton = { TextButton(onClick = model::dismissGuestImport) { Text(localized(R.string.cancel, language)) } },
        )
    }
    if (installments) InstallmentsDialog(allRecords, language,
        onDismiss = { installments = false },
        onSave = { vendorId, name, total, count, due ->
            model.createInstallments(vendorId, name, total, count, due)
            installments = false
        })
}

@Composable
private fun DashboardScreen(records: List<PlannerRecord>, currency: String, language: String, navigate: (String) -> Unit) {
    val active = records.filter { it.deletedAt == null }
    val budget = active.filter { it.kind == Kinds.BUDGET }.sumOf { it.estimatedCents ?: it.amountCents ?: 0 }
    val paid = active.filter { it.kind == Kinds.PAYMENT && it.status == "PAID" }.sumOf { it.amountCents ?: 0 }
    val tasks = active.count { it.kind == Kinds.TASK && it.status != "DONE" }
    val guests = active.count { it.kind == Kinds.GUEST && it.status == "CONFIRMED" }
    val upcoming = active.filter { it.kind in setOf(Kinds.TASK, Kinds.PAYMENT) && it.date != null && it.status !in setOf("PAID", "DONE") }
        .sortedBy { it.date }.take(8)
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Text(localized(R.string.app_name, language), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(LocalDate.now().toString(), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        item { SummaryCard(localized(R.string.total_budget, language), localizedCurrency(budget, currency, language), PlannerChampagne) { navigate(Kinds.BUDGET) } }
        item { SummaryCard(localized(R.string.total_paid, language), localizedCurrency(paid, currency, language), Color(0xFF34D399)) { navigate(Kinds.PAYMENT) } }
        item { Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.weight(1f)) { SummaryCard(localized(R.string.pending_tasks, language), tasks.toString(), PlannerRose) { navigate(Kinds.TASK) } }
            Box(Modifier.weight(1f)) { SummaryCard(localized(R.string.confirmed_guests, language), guests.toString(), PlannerChampagne) { navigate(Kinds.GUEST) } }
        } }
        item { Text(localized(R.string.upcoming, language), style = MaterialTheme.typography.titleLarge) }
        if (upcoming.isEmpty()) item { Text(localized(R.string.empty, language)) }
        items(upcoming, key = { it.id }) { record ->
            RecordCard(record, currency, language, onClick = { navigate(record.kind) })
        }
    }
}

@Composable
private fun SummaryCard(label: String, value: String, accent: Color, onClick: () -> Unit) {
    Card(onClick = onClick, colors = CardDefaults.cardColors(containerColor = PlannerSurface),
        border = BorderStroke(1.dp, accent.copy(alpha = .25f)), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
            Text(value, color = accent, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun MoreScreen(language: String, navigate: (String) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(modules.filter { it.kind !in primaryTabs }, key = { it.kind }) { module ->
            Card(onClick = { navigate(module.kind) }, modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(module.icon, null, tint = PlannerRose)
                    Spacer(Modifier.width(16.dp))
                    Text(localized(module.title, language), style = MaterialTheme.typography.titleMedium)
                }
            }
        }
        items(listOf(Triple("insights", R.string.insights, Icons.Default.Search),
            Triple("wedding-day", R.string.wedding_day, Icons.Default.Celebration),
            Triple("settings", R.string.settings, Icons.Default.Settings),
            Triple("audit", R.string.audit, Icons.Default.Search),
            Triple("help", R.string.help, Icons.Default.Favorite))) { (key, label, icon) ->
            Card(onClick = { navigate(key) }, modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, null, tint = PlannerChampagne)
                    Spacer(Modifier.width(16.dp))
                    Text(localized(label, language), style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}

@Composable
private fun ModuleScreen(
    module: ModuleDefinition, records: List<PlannerRecord>, files: List<PlannerFile>, language: String, currency: String,
    onEdit: (PlannerRecord) -> Unit, onDelete: (PlannerRecord) -> Unit,
    onStatus: (String, String) -> Unit, onPaid: (String) -> Unit,
    onWhatsApp: (PlannerRecord) -> Unit,
    onAttach: (PlannerRecord) -> Unit, onExport: (PlannerFile) -> Unit, onGift: (String) -> Unit,
    onInvite: (PlannerRecord) -> Unit,
    onGuestImport: () -> Unit,
    onSeedTasks: () -> Unit,
    onInstallments: () -> Unit,
    onGroupRsvp: (String, String) -> Unit,
    onCompare: () -> Unit,
    onSharePix: () -> Unit,
    pixConfigured: Boolean,
    onDial: (PlannerRecord) -> Unit,
    onMaps: (PlannerRecord) -> Unit,
) {
    var query by remember(module.kind) { mutableStateOf("") }
    var selectedTagId by remember(module.kind) { mutableStateOf<String?>(null) }
    val filtered = records.filter { it.kind == module.kind && it.deletedAt == null &&
        (query.isBlank() || it.title.contains(query, ignoreCase = true) || it.subtitle.contains(query, ignoreCase = true)) &&
        (module.kind != Kinds.GUEST || selectedTagId == null || selectedTagId in recordTagIds(it)) }
    LazyColumn(contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            OutlinedTextField(query, { query = it }, modifier = Modifier.fillMaxWidth(),
                label = { Text(localized(R.string.search, language)) },
                leadingIcon = { Icon(Icons.Default.Search, null) }, singleLine = true)
        }
        if (module.kind == Kinds.GUEST) item {
            OutlinedButton(onClick = onGuestImport) { Text(localized(R.string.import_guests, language)) }
        }
        if (module.kind == Kinds.GUEST && records.any { it.kind == Kinds.TAG && it.deletedAt == null }) item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FilterChip(selected = selectedTagId == null, onClick = { selectedTagId = null },
                    label = { Text(localized(R.string.all_tags, language)) })
                records.filter { it.kind == Kinds.TAG && it.deletedAt == null }.sortedBy { it.title }.forEach { tag ->
                    FilterChip(selected = selectedTagId == tag.id, onClick = { selectedTagId = tag.id },
                        label = { Text(tag.title) })
                }
            }
        }
        if (module.kind == Kinds.VENDOR) item {
            OutlinedButton(onClick = onCompare) { Text(localized(R.string.vendor_compare, language)) }
        }
        if (module.kind == Kinds.TASK) item {
            OutlinedButton(onClick = onSeedTasks) { Text(localized(R.string.add_task_templates, language)) }
        }
        if (module.kind == Kinds.PAYMENT) item {
            OutlinedButton(onClick = onInstallments) { Text(localized(R.string.create_installments, language)) }
        }
        if (module.kind == Kinds.GIFT && pixConfigured) item {
            OutlinedButton(onClick = onSharePix) { Text(localized(R.string.share_pix, language)) }
        }
        if (filtered.isEmpty()) item { Text(localized(R.string.empty, language), modifier = Modifier.padding(18.dp)) }
        items(filtered, key = { it.id }) { record ->
            Card(colors = CardDefaults.cardColors(containerColor = PlannerSurface), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    RecordCard(record, currency, language, onClick = { onEdit(record) })
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        when (module.kind) {
                            Kinds.PAYMENT -> if (record.status != "PAID") TextButton(onClick = { onPaid(record.id) }) { Text(localized(R.string.mark_paid, language)) }
                            Kinds.TASK -> if (record.status != "DONE") TextButton(onClick = { onStatus(record.id, "DONE") }) { Text(localized(R.string.mark_done, language)) }
                            Kinds.GUEST -> {
                                TextButton(onClick = { onStatus(record.id, "CONFIRMED") }) { Text(localized(R.string.confirm_guest, language)) }
                                if (record.phone.isNotBlank()) TextButton(onClick = { onWhatsApp(record) }) { Text("WhatsApp") }
                            }
                            Kinds.GIFT -> if (record.status != "PROCESSED" && record.amountCents != null)
                                TextButton(onClick = { onGift(record.id) }) { Text(localized(R.string.post_gift, language)) }
                            Kinds.INVITATION, Kinds.SAVE_THE_DATE ->
                                TextButton(onClick = { onInvite(record) }) { Text(localized(R.string.prepare_invite, language)) }
                        }
                        Spacer(Modifier.weight(1f))
                        IconButton(onClick = { onDelete(record) }) { Icon(Icons.Default.Delete, localized(R.string.delete, language)) }
                    }
                    if (module.kind == Kinds.GROUP) {
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("CONFIRMED" to R.string.confirm_group, "DECLINED" to R.string.decline_group,
                                "MAYBE" to R.string.status_maybe).forEach { (status, label) ->
                                TextButton(onClick = { onGroupRsvp(record.id, status) }) { Text(localized(label, language)) }
                            }
                        }
                    }
                    if (module.kind in setOf(Kinds.VENDOR, Kinds.VENUE, Kinds.CONTACT, Kinds.GROUP)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (record.phone.isNotBlank()) {
                                TextButton(onClick = { onDial(record) }) { Text(localized(R.string.call_phone, language)) }
                                TextButton(onClick = { onWhatsApp(record) }) { Text("WhatsApp") }
                            }
                            if (module.kind == Kinds.VENUE) TextButton(onClick = { onMaps(record) }) {
                                Text(localized(R.string.open_maps, language))
                            }
                        }
                    }
                    if (module.kind in setOf(Kinds.INVITATION, Kinds.SAVE_THE_DATE)) {
                        val count = records.count { it.parentId == record.id && it.kind in setOf("invitation_log", "save_the_date_log") }
                        Text("${localized(R.string.confirmed_sends, language)}: $count")
                    }
                    if (module.kind in setOf(Kinds.VENDOR, Kinds.VENUE, Kinds.CONTRACT, Kinds.INVITATION, Kinds.SAVE_THE_DATE)) {
                        TextButton(onClick = { onAttach(record) }) { Text(localized(R.string.attach_file, language)) }
                        files.filter { it.recordId == record.id }.forEach { file ->
                            TextButton(onClick = { onExport(file) }) { Text(file.fileName) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RecordCard(record: PlannerRecord, currency: String, language: String, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(record.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        if (record.subtitle.isNotBlank()) Text(record.subtitle, maxLines = 2, overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (record.kind == Kinds.INCOME && runCatching {
                JSONObject(record.extraJson).optString("frequency") == "MONTHLY"
            }.getOrDefault(false))
            Text(localized(R.string.monthly, language), color = PlannerChampagne)
        if (record.kind == Kinds.CONTRACT) {
            val version = runCatching { JSONObject(record.extraJson).optInt("version", 1) }.getOrDefault(1)
            Text("${localized(R.string.contract_version, language)}: $version", color = PlannerChampagne)
        }
        if (record.kind in setOf(Kinds.BUDGET, Kinds.TROUSSEAU)) {
            if (record.estimatedCents != null || record.kind == Kinds.BUDGET)
                Text("${localized(R.string.report_estimated, language)}: ${localizedCurrency(record.estimatedCents ?: 0, currency, language)}",
                    color = PlannerChampagne)
            if (record.amountCents != null) Text("${localized(R.string.budget_actual, language)}: ${localizedCurrency(record.amountCents, currency, language)}",
                color = PlannerRose)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (record.kind !in setOf(Kinds.BUDGET, Kinds.TROUSSEAU) && record.amountCents != null) Text(if (record.kind == Kinds.TABLE) record.amountCents.toString()
                else localizedCurrency(record.amountCents, currency, language), color = PlannerChampagne)
            if (record.date != null) Text(record.date)
            if (record.status.isNotBlank()) Text(statusLabel(record.status, language), color = PlannerRose)
        }
    }
}

@Composable
private fun RecordEditor(
    module: ModuleDefinition, initial: PlannerRecord?, records: List<PlannerRecord>, language: String,
    onDismiss: () -> Unit, onSave: (PlannerRecord) -> Unit,
) {
    val invalidMessage = localized(R.string.invalid_fields, language)
    var title by remember(initial?.id, module.kind) { mutableStateOf(initial?.title.orEmpty()) }
    var subtitle by remember(initial?.id, module.kind) { mutableStateOf(initial?.subtitle.orEmpty()) }
    var amount by remember(initial?.id, module.kind) { mutableStateOf(initial?.amountCents?.let {
        if (module.kind == Kinds.TABLE) it.toString() else java.math.BigDecimal.valueOf(it, 2).toPlainString()
    }.orEmpty()) }
    var estimated by remember(initial?.id, module.kind) { mutableStateOf(initial?.estimatedCents?.let {
        java.math.BigDecimal.valueOf(it, 2).toPlainString()
    }.orEmpty()) }
    var date by remember(initial?.id, module.kind) { mutableStateOf(initial?.date.orEmpty()) }
    var status by remember(initial?.id, module.kind) { mutableStateOf(initial?.status ?: module.statuses.firstOrNull().orEmpty()) }
    var phone by remember(initial?.id, module.kind) { mutableStateOf(initial?.phone.orEmpty()) }
    var email by remember(initial?.id, module.kind) { mutableStateOf(initial?.email.orEmpty()) }
    var notes by remember(initial?.id, module.kind) { mutableStateOf(initial?.notes.orEmpty()) }
    var venueAddress by remember(initial?.id, module.kind) { mutableStateOf(
        runCatching { JSONObject(initial?.extraJson ?: "{}").optString("address") }.getOrDefault("")
    ) }
    var rating by remember(initial?.id, module.kind) { mutableStateOf(
        runCatching { JSONObject(initial?.extraJson ?: "{}").optInt("rating", 0) }.getOrDefault(0)
            .takeIf { it > 0 }?.toString().orEmpty()
    ) }
    var incomeFrequency by remember(initial?.id, module.kind) { mutableStateOf(
        runCatching { JSONObject(initial?.extraJson ?: "{}").optString("frequency", "ONE_TIME") }.getOrDefault("ONE_TIME")
    ) }
    var contractVersion by remember(initial?.id, module.kind) { mutableStateOf(
        runCatching { JSONObject(initial?.extraJson ?: "{}").optInt("version", 1) }.getOrDefault(1).toString()
    ) }
    var parentId by remember(initial?.id, module.kind) { mutableStateOf(initial?.parentId) }
    var guestGroupId by remember(initial?.id, module.kind) { mutableStateOf(initial?.guestGroupId) }
    var seatingTableId by remember(initial?.id, module.kind) { mutableStateOf(initial?.seatingTableId) }
    var plusAllowed by remember(initial?.id, module.kind) { mutableStateOf(initial?.plusOnesAllowed?.toString() ?: "0") }
    var plusConfirmed by remember(initial?.id, module.kind) { mutableStateOf(initial?.plusOnesConfirmed?.toString() ?: "0") }
    var selectedTagIds by remember(initial?.id, module.kind) { mutableStateOf(initial?.let(::recordTagIds).orEmpty()) }
    var localError by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(localized(if (initial == null) R.string.add else R.string.edit, language) + " · " + localized(module.title, language)) },
        text = {
            Column(Modifier.height(430.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(title, { title = it.take(160) }, label = { Text(localized(R.string.title, language)) }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(subtitle, { subtitle = it.take(500) }, label = {
                    Text(localized(if (module.kind == Kinds.VENDOR) R.string.category else R.string.subtitle, language))
                }, modifier = Modifier.fillMaxWidth())
                if (module.kind in setOf(Kinds.BUDGET, Kinds.TROUSSEAU)) OutlinedTextField(estimated, { estimated = it }, label = {
                    Text(localized(R.string.report_estimated, language))
                }, modifier = Modifier.fillMaxWidth())
                if (module.hasAmount) OutlinedTextField(amount, { amount = it }, label = {
                    Text(localized(when (module.kind) {
                        Kinds.TABLE -> R.string.capacity
                        Kinds.BUDGET, Kinds.TROUSSEAU -> R.string.budget_actual
                        else -> R.string.amount
                    }, language))
                }, modifier = Modifier.fillMaxWidth())
                if (module.hasDate) OutlinedTextField(date, { date = it.take(10) }, label = { Text(localized(R.string.date, language)) }, modifier = Modifier.fillMaxWidth())
                if (module.kind == Kinds.INCOME) {
                    Text(localized(R.string.frequency, language), style = MaterialTheme.typography.labelLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(selected = incomeFrequency == "ONE_TIME", onClick = { incomeFrequency = "ONE_TIME" },
                            label = { Text(localized(R.string.one_time, language)) })
                        FilterChip(selected = incomeFrequency == "MONTHLY", onClick = { incomeFrequency = "MONTHLY" },
                            label = { Text(localized(R.string.monthly, language)) })
                    }
                }
                if (module.statuses.isNotEmpty()) {
                    Text(localized(R.string.status, language), style = MaterialTheme.typography.labelLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        module.statuses.forEach { option -> FilterChip(selected = status == option, onClick = { status = option }, label = { Text(statusLabel(option, language)) }) }
                    }
                }
                if (module.hasContact) {
                    OutlinedTextField(phone, { phone = it.take(30) }, label = { Text(localized(R.string.phone, language)) }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(email, { email = it.take(120) }, label = { Text(localized(R.string.email, language)) }, modifier = Modifier.fillMaxWidth())
                }
                if (module.kind == Kinds.VENUE) OutlinedTextField(venueAddress,
                    { venueAddress = it.take(240) }, label = { Text(localized(R.string.address, language)) },
                    modifier = Modifier.fillMaxWidth())
                if (module.kind == Kinds.VENDOR) OutlinedTextField(rating,
                    { rating = it.take(1) }, label = { Text(localized(R.string.rating, language)) },
                    modifier = Modifier.fillMaxWidth())
                if (module.kind == Kinds.CONTRACT) OutlinedTextField(contractVersion,
                    { contractVersion = it.take(3) }, label = { Text(localized(R.string.contract_version, language)) },
                    modifier = Modifier.fillMaxWidth())
                if (module.parentKind != null) {
                    Text(localized(modules.first { it.kind == module.parentKind }.title, language))
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(selected = parentId == null, onClick = { parentId = null }, label = { Text("—") })
                        records.filter { it.kind == module.parentKind && it.deletedAt == null }.forEach { parent ->
                            FilterChip(selected = parentId == parent.id, onClick = { parentId = parent.id }, label = { Text(parent.title) })
                        }
                    }
                }
                if (module.kind == Kinds.GUEST) {
                    Text(localized(R.string.groups, language))
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(selected = guestGroupId == null, onClick = { guestGroupId = null }, label = { Text("—") })
                        records.filter { it.kind == Kinds.GROUP && it.deletedAt == null }.forEach { group ->
                            FilterChip(selected = guestGroupId == group.id, onClick = { guestGroupId = group.id }, label = { Text(group.title) })
                        }
                    }
                    Text(localized(R.string.tags, language))
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        records.filter { it.kind == Kinds.TAG && it.deletedAt == null }.sortedBy { it.title }.forEach { tag ->
                            FilterChip(selected = tag.id in selectedTagIds,
                                onClick = { selectedTagIds = if (tag.id in selectedTagIds) selectedTagIds - tag.id else selectedTagIds + tag.id },
                                label = { Text(tag.title) })
                        }
                    }
                    OutlinedTextField(plusAllowed, { plusAllowed = it }, label = { Text(localized(R.string.plus_allowed, language)) }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(plusConfirmed, { plusConfirmed = it }, label = { Text(localized(R.string.plus_confirmed, language)) }, modifier = Modifier.fillMaxWidth())
                    Text(localized(R.string.seating, language))
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(selected = seatingTableId == null, onClick = { seatingTableId = null }, label = { Text("—") })
                        records.filter { it.kind == Kinds.TABLE && it.deletedAt == null }.forEach { table ->
                            FilterChip(selected = seatingTableId == table.id, onClick = { seatingTableId = table.id }, label = { Text(table.title) })
                        }
                    }
                }
                OutlinedTextField(notes, { notes = it.take(8000) }, label = { Text(localized(R.string.notes, language)) }, minLines = 2, modifier = Modifier.fillMaxWidth())
                if (localError.isNotEmpty()) Text(localError, color = MaterialTheme.colorScheme.error)
            }
        },
        confirmButton = { TextButton(onClick = {
            try {
                require(title.isNotBlank())
                val parsedAmount = if (!module.hasAmount || amount.isBlank()) null else
                    if (module.kind == Kinds.TABLE) amount.toLong().also { require(it in 1..1000) } else Money.parseToCents(amount)
                val parsedEstimated = when (module.kind) {
                    Kinds.BUDGET -> Money.parseToCents(estimated)
                    Kinds.TROUSSEAU -> estimated.takeIf { it.isNotBlank() }?.let(Money::parseToCents)
                    else -> initial?.estimatedCents
                }
                val parsedRating = rating.takeIf { it.isNotBlank() }?.toInt()?.also { require(it in 1..5) }
                val parsedContractVersion = if (module.kind == Kinds.CONTRACT)
                    contractVersion.toInt().also { require(it in 1..999) } else 1
                if (date.isNotBlank()) LocalDate.parse(date)
                val record = (initial ?: PlannerRecord(UUID.randomUUID().toString(), module.kind, title)).copy(
                    title = title.trim(), subtitle = subtitle.trim(), amountCents = parsedAmount,
                    estimatedCents = parsedEstimated,
                    date = date.ifBlank { null }, status = status, phone = phone.trim(), email = email.trim(),
                    notes = notes.trim(), parentId = parentId, guestGroupId = guestGroupId, seatingTableId = seatingTableId,
                    plusOnesAllowed = if (module.kind == Kinds.GUEST) plusAllowed.toInt() else 0,
                    plusOnesConfirmed = if (module.kind == Kinds.GUEST) plusConfirmed.toInt() else 0,
                    extraJson = if (module.kind == Kinds.VENUE)
                        JSONObject(initial?.extraJson ?: "{}").put("address", venueAddress.trim()).toString()
                    else if (module.kind == Kinds.VENDOR)
                        JSONObject(initial?.extraJson ?: "{}").put("rating", parsedRating ?: JSONObject.NULL).toString()
                    else if (module.kind == Kinds.GUEST)
                        JSONObject(initial?.extraJson ?: "{}").put("tagIds", JSONArray(selectedTagIds.sorted())).toString()
                    else if (module.kind == Kinds.INCOME)
                        JSONObject(initial?.extraJson ?: "{}").put("frequency", incomeFrequency).toString()
                    else if (module.kind == Kinds.CONTRACT)
                        JSONObject(initial?.extraJson ?: "{}").put("version", parsedContractVersion).toString()
                    else initial?.extraJson ?: "{}",
                )
                onSave(record)
            } catch (_: Exception) { localError = invalidMessage }
        }) { Text(localized(R.string.save, language)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(localized(R.string.cancel, language)) } },
    )
}

private fun recordTagIds(record: PlannerRecord): Set<String> = runCatching {
    val array = JSONObject(record.extraJson).optJSONArray("tagIds") ?: return@runCatching emptySet()
    (0 until array.length()).map { array.getString(it) }.toSet()
}.getOrDefault(emptySet())

private fun openWhatsApp(activity: Activity, record: PlannerRecord) {
    val number = record.phone.filter { it.isDigit() }
    if (number.isBlank()) return
    val uri = Uri.parse("https://wa.me/$number")
    runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, uri)) }
}

private fun dialPhone(activity: Activity, phone: String) {
    val number = phone.filter { it.isDigit() || it == '+' }
    if (number.isNotBlank()) runCatching { activity.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))) }
}

private fun openMap(activity: Activity, record: PlannerRecord) {
    val address = runCatching { JSONObject(record.extraJson).optString("address") }.getOrDefault("")
    val query = address.ifBlank { record.title }
    val geo = Uri.parse("geo:0,0?q=${Uri.encode(query)}")
    if (runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, geo)) }.isFailure) {
        val web = Uri.parse("https://www.google.com/maps/search/?api=1&query=${Uri.encode(query)}")
        runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, web)) }
    }
}

private fun sharePix(activity: Activity, body: String, title: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, body)
    }
    activity.startActivity(Intent.createChooser(intent, title))
}

@Composable
private fun InstallmentsDialog(records: List<PlannerRecord>, language: String, onDismiss: () -> Unit,
                               onSave: (String?, String, Long, Int, LocalDate) -> Unit) {
    var title by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var count by remember { mutableStateOf("2") }
    var firstDate by remember { mutableStateOf(LocalDate.now().toString()) }
    var vendorId by remember { mutableStateOf<String?>(null) }
    var invalid by remember { mutableStateOf(false) }
    val errorText = localized(R.string.invalid_fields, language)
    AlertDialog(onDismissRequest = onDismiss,
        title = { Text(localized(R.string.create_installments, language)) },
        text = { Column(Modifier.height(390.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(title, { title = it.take(160) }, label = { Text(localized(R.string.title, language)) })
            OutlinedTextField(amount, { amount = it }, label = { Text(localized(R.string.amount, language)) })
            OutlinedTextField(count, { count = it }, label = { Text(localized(R.string.installment_count, language)) })
            OutlinedTextField(firstDate, { firstDate = it.take(10) }, label = { Text(localized(R.string.first_due_date, language)) })
            Text(localized(R.string.vendors, language))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FilterChip(selected = vendorId == null, onClick = { vendorId = null }, label = { Text("—") })
                records.filter { it.kind == Kinds.VENDOR && it.deletedAt == null }.forEach { vendor ->
                    FilterChip(selected = vendorId == vendor.id, onClick = { vendorId = vendor.id }, label = { Text(vendor.title) })
                }
            }
            if (invalid) Text(errorText, color = MaterialTheme.colorScheme.error)
        } },
        confirmButton = { TextButton(onClick = {
            try {
                require(title.isNotBlank())
                val total = Money.parseToCents(amount)
                val installmentsCount = count.toInt().also { require(it in 1..120) }
                onSave(vendorId, title.trim(), total, installmentsCount, LocalDate.parse(firstDate))
            } catch (_: Exception) { invalid = true }
        }) { Text(localized(R.string.save, language)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(localized(R.string.cancel, language)) } })
}

private fun inviteMessage(template: PlannerRecord, guest: PlannerRecord): String =
    (template.notes.ifBlank { template.subtitle.ifBlank { template.title } })
        .replace("{nome}", guest.title).replace("{name}", guest.title)

private fun openInviteWhatsApp(activity: Activity, template: PlannerRecord, guest: PlannerRecord): Boolean = runCatching {
    val number = guest.phone.filter { it.isDigit() }
    require(number.isNotBlank())
    val uri = Uri.parse("https://wa.me/$number?text=${Uri.encode(inviteMessage(template, guest))}")
    activity.startActivity(Intent(Intent.ACTION_VIEW, uri))
}.isSuccess

private fun shareInviteText(activity: Activity, template: PlannerRecord, guest: PlannerRecord): Boolean = runCatching {
    val intent = Intent(Intent.ACTION_SEND).setType("text/plain")
        .putExtra(Intent.EXTRA_TEXT, inviteMessage(template, guest))
    activity.startActivity(Intent.createChooser(intent, null))
}.isSuccess
