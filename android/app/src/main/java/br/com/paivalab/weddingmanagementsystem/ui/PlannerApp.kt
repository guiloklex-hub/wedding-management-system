package br.com.paivalab.weddingmanagementsystem.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
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
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.backup.BackupArchive
import br.com.paivalab.weddingmanagementsystem.data.CalendarExport
import br.com.paivalab.weddingmanagementsystem.data.InstallmentMath
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.Money
import br.com.paivalab.weddingmanagementsystem.data.PaymentAdjustment
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RiskRadar
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.math.roundToInt
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

private val primaryTabs = listOf(Kinds.TASK, Kinds.VENDOR, Kinds.GUEST)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlannerApp(
    model: PlannerViewModel,
    activity: Activity,
    archive: BackupArchive,
    authenticate: ((() -> Unit)?) -> Unit,
    externalSection: String? = null,
    onExternalSectionConsumed: () -> Unit = {},
    onLoadDemoSeed: () -> Unit = {},
) {
    val allRecords by model.records.collectAsState()
    val allFiles by model.files.collectAsState()
    val allAudits by model.audits.collectAsState()
    val language by model.locale.collectAsState()
    val currency by model.currency.collectAsState()
    val coupleNames by model.coupleNames.collectAsState()
    val eventDate by model.eventDate.collectAsState()
    val contingencyPercent by model.contingencyPercent.collectAsState()
    val pixKey by model.pixKey.collectAsState()
    val pixHolder by model.pixHolderName.collectAsState()
    val pixCity by model.pixCity.collectAsState()
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
    var showPixDialog by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val notify: (String) -> Unit = { msg -> scope.launch { snackbar.showSnackbar(msg) } }
    val guestResultMessage = localized(R.string.guest_import_result, language)
    val genericError = localized(R.string.error_generic, language)
    val tableFullError = localized(R.string.table_full, language)
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

    LaunchedEffect(externalSection) {
        if (!externalSection.isNullOrBlank()) {
            editor = null
            creating = false
            section = externalSection
            onExternalSectionConsumed()
        }
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
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Favorite, null, tint = PlannerRose, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
                    }
                },
                navigationIcon = {
                    if (section !in listOf("dashboard", "more") && section !in primaryTabs) {
                        IconButton(onClick = { section = "more" }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = PlannerBackground),
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color(0xFF0C0C0F)) {
                val tabs = listOf(
                    Triple("dashboard", R.string.dashboard, Icons.Default.Dashboard),
                    Triple(Kinds.TASK, R.string.tasks, modules.first { it.kind == Kinds.TASK }.icon),
                    Triple(Kinds.VENDOR, R.string.vendors, modules.first { it.kind == Kinds.VENDOR }.icon),
                    Triple(Kinds.GUEST, R.string.guests, modules.first { it.kind == Kinds.GUEST }.icon),
                    Triple("more", R.string.more, Icons.Default.MoreHoriz),
                )
                tabs.forEach { (key, label, icon) ->
                    NavigationBarItem(
                        selected = section == key || (key == "more" && section !in tabs.map { it.first }),
                        onClick = { section = key },
                        icon = { Icon(icon, localized(label, language)) },
                        label = { Text(localized(label, language), maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = PlannerRose,
                            selectedTextColor = PlannerRose,
                            indicatorColor = PlannerRose.copy(alpha = 0.18f),
                            unselectedIconColor = PlannerMuted,
                            unselectedTextColor = PlannerMuted,
                        ),
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            if (currentModule != null) {
                ExtendedFloatingActionButton(
                    onClick = { creating = true },
                    containerColor = PlannerRose,
                    contentColor = Color.White,
                    icon = { Icon(Icons.Default.Add, null) },
                    text = { Text(localized(R.string.add, language), fontWeight = FontWeight.SemiBold) },
                )
            }
        },
    ) { inner ->
        Box(Modifier.fillMaxSize().padding(inner)) {
            when (section) {
                "dashboard" -> DashboardScreen(allRecords, coupleNames, eventDate, currency, language) { section = it }
                "more" -> MoreScreen(allRecords, language) { section = it }
                "settings" -> SettingsScreen(
                    model = model,
                    language = language,
                    currency = currency,
                    authenticate = authenticate,
                    onExportCalendar = { calendarFile.launch("wedding-finance.ics") },
                    onLoadDemoSeed = onLoadDemoSeed,
                    onNotify = notify,
                ) { section = it }
                "insights" -> InsightsScreen(allRecords, language, currency, eventDate, contingencyPercent) { section = it }
                "help" -> HelpScreen(language)
                "audit" -> AuditScreen(allAudits, allRecords, language)
                "vendor-compare" -> VendorCompareScreen(allRecords, language, currency)
                "wedding-day" -> WeddingDayScreen(model, allRecords, language, notify)
                "backup" -> BackupScreen(archive, language, authenticate, model::refreshEvent)
                else -> if (currentModule != null) {
                    ModuleScreen(
                        module = currentModule,
                        records = allRecords,
                        files = allFiles,
                        language = language,
                        currency = currency,
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
                        onSeedVenueChecklist = { venueId ->
                            model.seedVenueChecklist(venueId ?: "") { added ->
                                notify("$added itens de inspeção adicionados!")
                            }
                        },
                        onInstallments = { installments = true },
                        onGroupRsvp = model::setGroupRsvp,
                        onCompare = { section = "vendor-compare" },
                        onSharePix = { showPixDialog = true },
                        pixConfigured = pixKey.isNotBlank(),
                        onDial = { record -> dialPhone(activity, record.phone) },
                        onMaps = { record -> openMap(activity, record) },
                    )
                }
            }
        }
    }

    if (showPixDialog) {
        PixQrDialog(
            activity = activity,
            pixKey = pixKey,
            pixHolderName = pixHolder.ifBlank { coupleNames.ifBlank { "CASAMENTO" } },
            pixCity = pixCity.ifBlank { "SAO PAULO" },
            onDismiss = { showPixDialog = false },
            onNotify = notify,
        )
    }

    if (creating || editor != null) {
        val module = currentModule
        if (module != null) {
            RecordEditor(
                module = module,
                initial = editor,
                records = allRecords,
                language = language,
                onDismiss = { editor = null; creating = false },
                onSave = { record ->
                    model.save(record) {
                        editor = null
                        creating = false
                        notify("Registro salvo com sucesso!")
                    }
                },
            )
        }
    }
    deleteTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text(localized(R.string.confirm_delete, language)) },
            text = { Text(target.title) },
            confirmButton = {
                TextButton(onClick = {
                    model.delete(target.id)
                    deleteTarget = null
                    notify("Registro removido")
                }) {
                    Text(localized(R.string.delete, language), color = PlannerRose)
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) {
                    Text(localized(R.string.cancel, language))
                }
            },
        )
    }
    inviteTemplate?.let { template ->
        AlertDialog(
            onDismissRequest = { inviteTemplate = null },
            title = { Text(localized(R.string.choose_guest, language)) },
            text = {
                LazyColumn(Modifier.heightIn(max = 360.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(allRecords.filter { it.kind == Kinds.GUEST && it.deletedAt == null }) { guest ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                            border = BorderStroke(1.dp, PlannerBorder),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(guest.title, fontWeight = FontWeight.SemiBold)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    if (guest.phone.isNotBlank()) {
                                        TextButton(onClick = {
                                            inviteTemplate = null
                                            if (openInviteWhatsApp(activity, template, guest)) pendingInvite = Triple(template, guest, "WHATSAPP")
                                        }) { Text(localized(R.string.share_whatsapp, language)) }
                                    }
                                    TextButton(onClick = {
                                        inviteTemplate = null
                                        if (shareInviteText(activity, template, guest)) pendingInvite = Triple(template, guest, "SHARE")
                                    }) { Text(localized(R.string.share_text, language)) }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { inviteTemplate = null }) { Text(localized(R.string.cancel, language)) } },
        )
    }
    pendingInvite?.let { (template, guest, channel) ->
        AlertDialog(
            onDismissRequest = { pendingInvite = null },
            title = { Text(localized(R.string.sent_confirm, language)) },
            text = { Text("${guest.title}\n${localized(R.string.sent_warning, language)}") },
            confirmButton = {
                TextButton(onClick = {
                    model.confirmInvitationSent(template.id, guest.id, channel)
                    pendingInvite = null
                }) { Text(localized(R.string.sent_confirm, language)) }
            },
            dismissButton = { TextButton(onClick = { pendingInvite = null }) { Text(localized(R.string.cancel, language)) } },
        )
    }
    guestImport?.let { preview ->
        AlertDialog(
            onDismissRequest = model::dismissGuestImport,
            title = { Text(localized(R.string.import_guests, language)) },
            text = {
                Text(localized(R.string.guest_import_preview, language)
                    .replace("{count}", preview.guests.size.toString()).replace("{source}", preview.source))
            },
            confirmButton = { TextButton(onClick = model::commitGuestImport) { Text(localized(R.string.import_guests, language)) } },
            dismissButton = { TextButton(onClick = model::dismissGuestImport) { Text(localized(R.string.cancel, language)) } },
        )
    }
    if (installments) {
        InstallmentsDialog(
            records = allRecords,
            language = language,
            currency = currency,
            onDismiss = { installments = false },
            onSave = { vendorId, name, total, count, due ->
                model.createInstallments(vendorId, name, total, count, due)
                installments = false
                notify("$count parcelas geradas com sucesso!")
            },
        )
    }
}

@Composable
private fun DashboardScreen(
    records: List<PlannerRecord>,
    coupleNames: String,
    eventDate: String,
    currency: String,
    language: String,
    navigate: (String) -> Unit,
) {
    val active = records.filter { it.deletedAt == null }
    val budget = active.filter { it.kind == Kinds.BUDGET }.sumOf { it.estimatedCents ?: it.amountCents ?: 0L }
    val paid = active.filter { it.kind == Kinds.PAYMENT && it.status == "PAID" }.sumOf { it.amountCents ?: 0L }
    val tasks = active.count { it.kind == Kinds.TASK && it.status != "DONE" }
    val doneTasks = active.count { it.kind == Kinds.TASK && it.status == "DONE" }
    val confirmedGuests = active.filter { it.kind == Kinds.GUEST && it.status == "CONFIRMED" }
    val totalSeatsConfirmed = confirmedGuests.sumOf { 1 + it.plusOnesConfirmed }
    val upcoming = active.filter { it.kind in setOf(Kinds.TASK, Kinds.PAYMENT) && it.date != null && it.status !in setOf("PAID", "DONE") }
        .sortedBy { it.date }.take(8)
    val paidRatio = if (budget <= 0L) 0f else (paid.toFloat() / budget.toFloat()).coerceIn(0f, 1f)
    val daysUntil = runCatching { ChronoUnit.DAYS.between(LocalDate.now(), LocalDate.parse(eventDate)) }.getOrNull()
    val riskAlerts = remember(active, daysUntil, currency, language) {
        RiskRadar.compute(
            activeRecords = active,
            cashflow = emptyList(),
            daysToEvent = daysUntil,
            formatMoney = { localizedCurrency(it, currency, language) },
        )
    }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Card(
                onClick = { navigate("wedding-day") },
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerChampagne.copy(alpha = 0.35f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                coupleNames.ifBlank { localized(R.string.app_name, language) },
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            )
                            val dateDisplay = if (eventDate.isNotBlank()) "Grande Dia: ${formatDisplayDate(eventDate, language)}"
                            else formatDisplayDate(LocalDate.now().toString(), language)
                            Text(dateDisplay, color = PlannerChampagne, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                        }
                        if (daysUntil != null && daysUntil >= 0) {
                            InfoBadge("Faltam $daysUntil dias", PlannerRose)
                        }
                    }
                    HorizontalDivider(color = PlannerBorder)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Execução financeira: ${(paidRatio * 100).roundToInt()}% quitado", style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                        Text("${localizedCurrency(paid, currency, language)} / ${localizedCurrency(budget, currency, language)}", style = MaterialTheme.typography.labelSmall, color = PlannerEmerald)
                    }
                    Canvas(Modifier.fillMaxWidth().height(8.dp)) {
                        val radius = CornerRadius(4.dp.toPx(), 4.dp.toPx())
                        drawRoundRect(Color(0xFF27272A), cornerRadius = radius)
                        drawRoundRect(PlannerEmerald, size = Size(size.width * paidRatio, size.height), cornerRadius = radius)
                    }
                }
            }
        }
        if (riskAlerts.isNotEmpty()) {
            item {
                val topAlert = riskAlerts.first()
                val isCritical = topAlert.severity == "HIGH"
                val borderColor = if (isCritical) PlannerRose else PlannerChampagne
                Card(
                    onClick = { navigate("insights") },
                    colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                    border = BorderStroke(1.dp, borderColor.copy(alpha = 0.55f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "Radar de Riscos (${riskAlerts.size})",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold,
                                color = borderColor,
                            )
                            InfoBadge(if (isCritical) "Atenção Crítica" else "Alerta", borderColor)
                        }
                        Text(topAlert.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        Text(topAlert.body, style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                    }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.weight(1f)) {
                    SummaryCard(
                        label = localized(R.string.total_budget, language),
                        value = localizedCurrency(budget, currency, language),
                        subtitle = "${active.count { it.kind == Kinds.BUDGET }} categorias",
                        accent = PlannerChampagne,
                    ) { navigate(Kinds.BUDGET) }
                }
                Box(Modifier.weight(1f)) {
                    SummaryCard(
                        label = localized(R.string.total_paid, language),
                        value = localizedCurrency(paid, currency, language),
                        subtitle = "${(paidRatio * 100).roundToInt()}% do orçamento",
                        accent = PlannerEmerald,
                    ) { navigate(Kinds.PAYMENT) }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.weight(1f)) {
                    SummaryCard(
                        label = localized(R.string.pending_tasks, language),
                        value = tasks.toString(),
                        subtitle = "$doneTasks concluída(s)",
                        accent = PlannerRose,
                    ) { navigate(Kinds.TASK) }
                }
                Box(Modifier.weight(1f)) {
                    SummaryCard(
                        label = localized(R.string.confirmed_guests, language),
                        value = "${confirmedGuests.size} ($totalSeatsConfirmed)",
                        subtitle = "$totalSeatsConfirmed lugares confirmados",
                        accent = PlannerChampagne,
                    ) { navigate(Kinds.GUEST) }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(localized(R.string.upcoming, language), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                InfoBadge("${upcoming.size} pendentes", PlannerChampagne)
            }
        }
        if (upcoming.isEmpty()) item { Text(localized(R.string.empty, language), color = PlannerMuted) }
        items(upcoming, key = { it.id }) { record ->
            Card(
                onClick = { navigate(record.kind) },
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Box(Modifier.padding(14.dp)) {
                    RecordCard(record, active, currency, language, onClick = { navigate(record.kind) })
                }
            }
        }
    }
}

@Composable
private fun SummaryCard(label: String, value: String, subtitle: String, accent: Color, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(containerColor = PlannerSurface),
        border = BorderStroke(1.dp, accent.copy(alpha = 0.28f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, color = PlannerMuted, style = MaterialTheme.typography.labelMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(value, color = accent, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(subtitle, color = PlannerMuted, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun MoreScreen(records: List<PlannerRecord>, language: String, navigate: (String) -> Unit) {
    val active = records.filter { it.deletedAt == null }
    val secondaryModules = modules.filter { it.kind !in primaryTabs }
    val systemItems = listOf(
        Triple("insights", R.string.insights, Icons.Default.Search),
        Triple("vendor-compare", R.string.vendor_compare, Icons.Default.Search),
        Triple("wedding-day", R.string.wedding_day, Icons.Default.Celebration),
        Triple("settings", R.string.settings, Icons.Default.Settings),
        Triple("backup", R.string.backup, Icons.Default.Settings),
        Triple("audit", R.string.audit, Icons.Default.Search),
        Triple("help", R.string.help, Icons.Default.Favorite),
    )

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("Gestão & Painéis do Casamento", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerChampagne)
        }
        items(systemItems.chunked(2)) { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                pair.forEach { (key, label, icon) ->
                    Card(
                        onClick = { navigate(key) },
                        colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                        border = BorderStroke(1.dp, PlannerChampagne.copy(alpha = 0.25f)),
                        modifier = Modifier.weight(1f),
                    ) {
                        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(icon, null, tint = PlannerChampagne, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(10.dp))
                            Text(localized(label, language), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
        item {
            Spacer(Modifier.height(4.dp))
            Text("Módulos Especializados", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerRose)
        }
        items(secondaryModules.chunked(2)) { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                pair.forEach { module ->
                    val count = active.count { it.kind == module.kind }
                    Card(
                        onClick = { navigate(module.kind) },
                        colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                        border = BorderStroke(1.dp, PlannerBorder),
                        modifier = Modifier.weight(1f),
                    ) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Icon(module.icon, null, tint = PlannerRose, modifier = Modifier.size(20.dp))
                                InfoBadge(count.toString(), if (count > 0) PlannerChampagne else PlannerMuted)
                            }
                            Text(localized(module.title, language), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ModuleScreen(
    module: ModuleDefinition,
    records: List<PlannerRecord>,
    files: List<PlannerFile>,
    language: String,
    currency: String,
    onEdit: (PlannerRecord) -> Unit,
    onDelete: (PlannerRecord) -> Unit,
    onStatus: (String, String) -> Unit,
    onPaid: (String) -> Unit,
    onWhatsApp: (PlannerRecord) -> Unit,
    onAttach: (PlannerRecord) -> Unit,
    onExport: (PlannerFile) -> Unit,
    onGift: (String) -> Unit,
    onInvite: (PlannerRecord) -> Unit,
    onGuestImport: () -> Unit,
    onSeedTasks: () -> Unit,
    onSeedVenueChecklist: (String?) -> Unit,
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
    var selectedStatus by remember(module.kind) { mutableStateOf<String?>(null) }
    val active = records.filter { it.deletedAt == null }
    val todayStr = LocalDate.now().toString()
    val filtered = active.filter {
        it.kind == module.kind &&
            (query.isBlank() || it.title.contains(query, ignoreCase = true) || it.subtitle.contains(query, ignoreCase = true)) &&
            (module.kind != Kinds.GUEST || selectedTagId == null || selectedTagId in recordTagIds(it)) &&
            when (selectedStatus) {
                null -> true
                "OVERDUE" -> !it.date.isNullOrBlank() && it.date < todayStr && it.status !in setOf("PAID", "DONE", "RECEIVED", "BOUGHT", "PROCESSED")
                else -> it.status == selectedStatus
            }
    }

    LazyColumn(contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            ModuleSummaryBanner(module.kind, active, currency, language)
        }
        item {
            OutlinedTextField(
                query,
                { query = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(localized(R.string.search, language)) },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                singleLine = true,
            )
        }
        if (module.statuses.isNotEmpty()) item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val allCount = active.count { it.kind == module.kind }
                FilterChip(
                    selected = selectedStatus == null,
                    onClick = { selectedStatus = null },
                    label = { Text("Todos ($allCount)") },
                )
                if (module.kind in setOf(Kinds.PAYMENT, Kinds.TASK)) {
                    val overdueCount = active.count {
                        it.kind == module.kind && !it.date.isNullOrBlank() && it.date < todayStr &&
                            it.status !in setOf("PAID", "DONE")
                    }
                    if (overdueCount > 0) {
                        FilterChip(
                            selected = selectedStatus == "OVERDUE",
                            onClick = { selectedStatus = if (selectedStatus == "OVERDUE") null else "OVERDUE" },
                            label = { Text("⚠️ Vencidos ($overdueCount)") },
                        )
                    }
                }
                module.statuses.forEach { st ->
                    val count = active.count { it.kind == module.kind && it.status == st }
                    FilterChip(
                        selected = selectedStatus == st,
                        onClick = { selectedStatus = if (selectedStatus == st) null else st },
                        label = { Text("${statusLabel(st, language)} ($count)") },
                    )
                }
            }
        }
        if (module.kind == Kinds.GUEST) item {
            OutlinedButton(onClick = onGuestImport, modifier = Modifier.fillMaxWidth()) { Text(localized(R.string.import_guests, language)) }
        }
        if (module.kind == Kinds.GUEST && active.any { it.kind == Kinds.TAG }) item {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FilterChip(
                    selected = selectedTagId == null,
                    onClick = { selectedTagId = null },
                    label = { Text(localized(R.string.all_tags, language)) },
                )
                active.filter { it.kind == Kinds.TAG }.sortedBy { it.title }.forEach { tag ->
                    FilterChip(
                        selected = selectedTagId == tag.id,
                        onClick = { selectedTagId = tag.id },
                        label = { Text(tag.title) },
                    )
                }
            }
        }
        if (module.kind == Kinds.VENDOR) item {
            OutlinedButton(onClick = onCompare, modifier = Modifier.fillMaxWidth()) { Text(localized(R.string.vendor_compare, language)) }
        }
        if (module.kind == Kinds.TASK) item {
            OutlinedButton(onClick = onSeedTasks, modifier = Modifier.fillMaxWidth()) { Text(localized(R.string.add_task_templates, language)) }
        }
        if (module.kind == Kinds.VENUE_CHECK) item {
            val defaultVenueId = active.firstOrNull { it.kind == Kinds.VENUE }?.id
            OutlinedButton(
                onClick = { onSeedVenueChecklist(defaultVenueId) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Gerar checklist padrão de inspeção (20 itens)")
            }
        }
        if (module.kind == Kinds.PAYMENT) item {
            OutlinedButton(onClick = onInstallments, modifier = Modifier.fillMaxWidth()) { Text(localized(R.string.create_installments, language)) }
        }
        if (module.kind == Kinds.GIFT && pixConfigured) item {
            OutlinedButton(onClick = onSharePix, modifier = Modifier.fillMaxWidth()) {
                Text("QR Code & Pix Copia e Cola (${localized(R.string.share_pix, language)})")
            }
        }
        if (filtered.isEmpty()) item { Text(localized(R.string.empty, language), modifier = Modifier.padding(18.dp), color = PlannerMuted) }
        items(filtered, key = { it.id }) { record ->
            val recordFiles = files.filter { it.recordId == record.id }
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    RecordCard(record, active, currency, language, onClick = { onEdit(record) })
                    HorizontalDivider(color = PlannerBorder)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(
                            modifier = Modifier.weight(1f).horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            when (module.kind) {
                                Kinds.PAYMENT -> if (record.status != "PAID") {
                                    TextButton(onClick = { onPaid(record.id) }) { Text(localized(R.string.mark_paid, language), color = PlannerEmerald) }
                                }
                                Kinds.INCOME -> if (record.status != "RECEIVED") {
                                    TextButton(onClick = { onStatus(record.id, "RECEIVED") }) { Text("Marcar recebido", color = PlannerEmerald) }
                                }
                                Kinds.TASK, Kinds.VENUE_CHECK -> if (record.status != "DONE") {
                                    TextButton(onClick = { onStatus(record.id, "DONE") }) { Text(localized(R.string.mark_done, language), color = PlannerEmerald) }
                                }
                                Kinds.GUEST -> {
                                    if (record.status != "CONFIRMED") {
                                        TextButton(onClick = { onStatus(record.id, "CONFIRMED") }) { Text(localized(R.string.confirm_guest, language), color = PlannerEmerald) }
                                    }
                                    if (record.phone.isNotBlank()) {
                                        TextButton(onClick = { onWhatsApp(record) }) { Text("WhatsApp") }
                                    }
                                }
                                Kinds.GIFT -> if (record.status != "PROCESSED" && record.amountCents != null) {
                                    TextButton(onClick = { onGift(record.id) }) { Text(localized(R.string.post_gift, language), color = PlannerEmerald) }
                                }
                                Kinds.INVITATION, Kinds.SAVE_THE_DATE -> {
                                    TextButton(onClick = { onInvite(record) }) { Text(localized(R.string.prepare_invite, language)) }
                                }
                            }
                            if (module.kind == Kinds.GROUP) {
                                listOf("CONFIRMED" to R.string.confirm_group, "DECLINED" to R.string.decline_group, "MAYBE" to R.string.status_maybe).forEach { (st, lbl) ->
                                    if (record.status != st) {
                                        TextButton(onClick = { onGroupRsvp(record.id, st) }) { Text(localized(lbl, language)) }
                                    }
                                }
                            }
                            if (module.kind in setOf(Kinds.VENDOR, Kinds.VENUE, Kinds.CONTACT, Kinds.GROUP) && record.phone.isNotBlank()) {
                                TextButton(onClick = { onDial(record) }) { Text(localized(R.string.call_phone, language)) }
                                TextButton(onClick = { onWhatsApp(record) }) { Text("WhatsApp") }
                            }
                            if (module.kind == Kinds.VENUE) {
                                TextButton(onClick = { onMaps(record) }) { Text(localized(R.string.open_maps, language)) }
                            }
                            if (module.kind in setOf(Kinds.VENDOR, Kinds.VENUE, Kinds.CONTRACT, Kinds.INVITATION, Kinds.SAVE_THE_DATE)) {
                                TextButton(onClick = { onAttach(record) }) { Text(localized(R.string.attach_file, language)) }
                            }
                        }
                        IconButton(onClick = { onDelete(record) }) {
                            Icon(Icons.Default.Delete, localized(R.string.delete, language), tint = PlannerMuted)
                        }
                    }
                    if (recordFiles.isNotEmpty()) {
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            recordFiles.forEach { file ->
                                OutlinedButton(onClick = { onExport(file) }) {
                                    Text("📎 ${file.fileName}", style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ModuleSummaryBanner(kind: String, active: List<PlannerRecord>, currency: String, language: String) {
    val items = active.filter { it.kind == kind }
    if (items.isEmpty()) return
    val summary: Triple<String, String, Color>? = when (kind) {
        Kinds.BUDGET -> {
            val est = items.sumOf { it.estimatedCents ?: 0L }
            val real = items.sumOf { it.amountCents ?: 0L }
            val diff = real - est
            val detail = if (diff <= 0L) "Economia de ${localizedCurrency(-diff, currency, language)}" else "Excedente de +${localizedCurrency(diff, currency, language)}"
            Triple("Previsto: ${localizedCurrency(est, currency, language)} · Real: ${localizedCurrency(real, currency, language)}", detail, if (diff <= 0L) PlannerEmerald else PlannerRose)
        }
        Kinds.PAYMENT -> {
            val paid = items.filter { it.status == "PAID" }.sumOf { it.amountCents ?: 0L }
            val pending = items.filter { it.status != "PAID" }.sumOf { it.amountCents ?: 0L }
            Triple("Pago: ${localizedCurrency(paid, currency, language)}", "Em aberto: ${localizedCurrency(pending, currency, language)}", PlannerEmerald)
        }
        Kinds.INCOME -> {
            val rec = items.filter { it.status == "RECEIVED" }.sumOf { it.amountCents ?: 0L }
            val exp = items.filter { it.status != "RECEIVED" }.sumOf { it.amountCents ?: 0L }
            Triple("Recebido: ${localizedCurrency(rec, currency, language)}", "Previsto: ${localizedCurrency(exp, currency, language)}", PlannerEmerald)
        }
        Kinds.ASSET -> {
            val total = items.sumOf { it.amountCents ?: 0L }
            Triple("Patrimônio acumulado: ${localizedCurrency(total, currency, language)}", "${items.size} reserva(s) ativas", PlannerChampagne)
        }
        Kinds.GOAL -> {
            val target = items.sumOf { it.amountCents ?: 0L }
            val saved = active.filter { it.kind == Kinds.ASSET }.sumOf { it.amountCents ?: 0L }
            val pct = if (target <= 0L) 0 else ((saved.toFloat() / target) * 100).roundToInt()
            Triple("Metas: ${localizedCurrency(target, currency, language)}", "Acumulado: ${localizedCurrency(saved, currency, language)} ($pct%)", PlannerChampagne)
        }
        Kinds.GUEST -> {
            val conf = items.filter { it.status == "CONFIRMED" }
            val seats = conf.sumOf { 1 + it.plusOnesConfirmed }
            Triple("${conf.size} de ${items.size} convites confirmados", "Total confirmado: $seats lugares", PlannerEmerald)
        }
        Kinds.TABLE -> {
            val cap = items.sumOf { it.amountCents ?: 0L }
            val occ = active.filter { it.kind == Kinds.GUEST && it.seatingTableId != null }.sumOf { 1 + it.plusOnesConfirmed }
            Triple("${items.size} mesas configuradas", "Ocupação total: $occ / $cap lugares", PlannerChampagne)
        }
        else -> null
    }
    if (summary != null) {
        Card(
            colors = CardDefaults.cardColors(containerColor = PlannerSurface),
            border = BorderStroke(1.dp, summary.third.copy(alpha = 0.30f)),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(Modifier.padding(14.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(summary.first, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(summary.second, style = MaterialTheme.typography.labelSmall, color = summary.third)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecordCard(
    record: PlannerRecord,
    allRecords: List<PlannerRecord>,
    currency: String,
    language: String,
    onClick: () -> Unit,
) {
    val parent = remember(record.parentId, allRecords) {
        record.parentId?.let { pid -> allRecords.find { it.id == pid && it.deletedAt == null } }
    }
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(record.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                if (record.subtitle.isNotBlank()) {
                    Text(record.subtitle, maxLines = 2, overflow = TextOverflow.Ellipsis, color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
                }
            }
            if (record.status.isNotBlank()) {
                Spacer(Modifier.width(8.dp))
                StatusBadge(record.status, language)
            }
        }

        if (parent != null) {
            InfoBadge("Vínculo: ${parent.title}", PlannerChampagne)
        }

        when (record.kind) {
            Kinds.VENDOR -> {
                val rating = runCatching { JSONObject(record.extraJson).optInt("rating", 0) }.getOrDefault(0)
                if (rating in 1..5) {
                    Text("${"★".repeat(rating)}${"☆".repeat(5 - rating)} ($rating/5)", color = PlannerChampagne, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
                }
                if (record.phone.isNotBlank() || record.email.isNotBlank()) {
                    Text(listOf(record.phone, record.email).filter { it.isNotBlank() }.joinToString(" · "), color = PlannerMuted, style = MaterialTheme.typography.labelSmall)
                }
            }
            Kinds.VENUE -> {
                val address = runCatching { JSONObject(record.extraJson).optString("address") }.getOrDefault("")
                if (address.isNotBlank()) Text("📍 $address", color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
            }
            Kinds.CONTACT -> {
                if (record.phone.isNotBlank() || record.email.isNotBlank()) {
                    Text(listOf(record.phone, record.email).filter { it.isNotBlank() }.joinToString(" · "), color = PlannerChampagne, style = MaterialTheme.typography.bodySmall)
                }
            }
            Kinds.VENDOR_NOTE -> {
                if (record.notes.isNotBlank()) {
                    Text(record.notes, maxLines = 3, overflow = TextOverflow.Ellipsis, color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
                }
            }
            Kinds.PAYMENT -> {
                val json = runCatching { JSONObject(record.extraJson) }.getOrElse { JSONObject() }
                val n = json.optInt("installmentNumber", 0)
                val total = json.optInt("totalInstallments", 0)
                val method = json.optString("method", "")
                val adj = PaymentAdjustment.compute(record)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (n > 0 && total > 0) InfoBadge("Parcela $n de $total", PlannerChampagne)
                    if (method.isNotBlank()) InfoBadge("💳 $method", PlannerEmerald)
                    if (adj.lateDays > 0) {
                        val feeText = if (adj.hasAdjustment) {
                            "⚠️ ${adj.lateDays}d atraso · Atualizado: ${localizedCurrency(adj.adjustedCents, currency, language)}"
                        } else {
                            "⚠️ Vencido há ${adj.lateDays} dia(s)"
                        }
                        InfoBadge(feeText, PlannerRose)
                    }
                }
            }
            Kinds.TASK -> {
                val priority = runCatching { JSONObject(record.extraJson).optString("priority", "") }.getOrDefault("")
                if (priority.isNotBlank()) {
                    val pLabel = when (priority) {
                        "HIGH" -> "Prioridade Alta"
                        "MEDIUM" -> "Prioridade Média"
                        else -> "Prioridade Normal"
                    }
                    InfoBadge(pLabel, if (priority == "HIGH") PlannerRose else PlannerChampagne)
                }
            }
            Kinds.GUEST -> {
                val json = runCatching { JSONObject(record.extraJson) }.getOrElse { JSONObject() }
                val side = json.optString("side", "")
                val dietary = json.optString("dietary", "")
                val city = json.optString("city", "")
                val isVip = json.optBoolean("isVIP", false)
                val isPadrinho = json.optBoolean("isPadrinho", false)
                val isChild = json.optBoolean("isChild", false)
                val group = record.guestGroupId?.let { gid -> allRecords.find { it.id == gid }?.title }
                val table = record.seatingTableId?.let { tid -> allRecords.find { it.id == tid }?.title }
                val tags = recordTagIds(record).mapNotNull { tid -> allRecords.find { it.id == tid }?.title }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    InfoBadge("${1 + record.plusOnesConfirmed} lugar(es) (+${record.plusOnesConfirmed}/${record.plusOnesAllowed} acomp.)", PlannerEmerald)
                    if (side.isNotBlank()) {
                        val sideLabel = when (side) {
                            "BRIDE" -> "👰 Lado Noiva"
                            "GROOM" -> "🤵 Lado Noivo"
                            else -> "💑 Lado Comum"
                        }
                        InfoBadge(sideLabel, PlannerChampagne)
                    }
                    if (isVip) InfoBadge("⭐ VIP", PlannerRose)
                    if (isPadrinho) InfoBadge("💍 Padrinho", PlannerChampagne)
                    if (isChild) InfoBadge("🧒 Criança", PlannerEmerald)
                    if (dietary.isNotBlank()) InfoBadge("🥗 $dietary", PlannerRose)
                    if (city.isNotBlank()) InfoBadge("🏙️ $city", PlannerMuted)
                    if (!group.isNullOrBlank()) InfoBadge("👥 $group", PlannerChampagne)
                    if (!table.isNullOrBlank()) InfoBadge("🪑 $table", PlannerChampagne)
                    tags.forEach { t -> InfoBadge("🏷️ $t", PlannerRose) }
                }
            }
            Kinds.GROUP -> {
                val members = allRecords.filter { it.kind == Kinds.GUEST && it.guestGroupId == record.id }
                val seats = members.sumOf { 1 + it.plusOnesConfirmed }
                InfoBadge("${members.size} convidado(s) · $seats lugar(es)", PlannerChampagne)
            }
            Kinds.TAG -> {
                val count = allRecords.count { it.kind == Kinds.GUEST && record.id in recordTagIds(it) }
                InfoBadge("$count convidado(s) marcado(s)", PlannerChampagne)
            }
            Kinds.GOAL -> {
                val target = record.amountCents ?: 0L
                val saved = allRecords.filter { it.kind == Kinds.ASSET && it.parentId == record.id }.sumOf { it.amountCents ?: 0L }
                val ratio = if (target <= 0L) 0f else (saved.toFloat() / target.toFloat()).coerceIn(0f, 1f)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Acumulado: ${localizedCurrency(saved, currency, language)}", style = MaterialTheme.typography.labelSmall, color = PlannerEmerald)
                    Text("${(ratio * 100).roundToInt()}%", style = MaterialTheme.typography.labelSmall, color = PlannerChampagne, fontWeight = FontWeight.Bold)
                }
                Canvas(Modifier.fillMaxWidth().height(8.dp)) {
                    val radius = CornerRadius(4.dp.toPx(), 4.dp.toPx())
                    drawRoundRect(Color(0xFF27272A), cornerRadius = radius)
                    drawRoundRect(PlannerEmerald, size = Size(size.width * ratio, size.height), cornerRadius = radius)
                }
            }
            Kinds.HONEYMOON -> {
                val itemsTotal = allRecords.filter { it.kind == Kinds.HONEYMOON_ITEM && it.parentId == record.id }.sumOf { it.amountCents ?: 0L }
                if (itemsTotal > 0L) {
                    InfoBadge("Itens vinculados: ${localizedCurrency(itemsTotal, currency, language)}", PlannerEmerald)
                }
            }
            Kinds.HONEYMOON_ITEM -> {
                val json = runCatching { JSONObject(record.extraJson) }.getOrElse { JSONObject() }
                val itemKind = json.optString("itemKind", "")
                val confirmationNumber = json.optString("confirmationNumber", "")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (itemKind.isNotBlank()) {
                        val label = when (itemKind) {
                            "FLIGHT" -> "✈️ Voo"
                            "HOTEL" -> "🏨 Hospedagem"
                            "ACTIVITY" -> "🗺️ Passeio"
                            "TRANSPORT" -> "🚗 Transporte"
                            else -> "📄 Outro"
                        }
                        InfoBadge(label, PlannerChampagne)
                    }
                    if (confirmationNumber.isNotBlank()) {
                        InfoBadge("Reserva: $confirmationNumber", PlannerEmerald)
                    }
                }
            }
            Kinds.TROUSSEAU -> {
                val json = runCatching { JSONObject(record.extraJson) }.getOrElse { JSONObject() }
                val room = json.optString("room", "")
                val store = json.optString("store", "")
                val priority = json.optString("priority", "")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (room.isNotBlank()) InfoBadge("🏠 $room", PlannerChampagne)
                    if (store.isNotBlank()) InfoBadge("🛍️ $store", PlannerEmerald)
                    if (priority.isNotBlank()) InfoBadge("Prioridade: $priority", if (priority == "HIGH") PlannerRose else PlannerMuted)
                }
            }
            Kinds.INVITATION, Kinds.SAVE_THE_DATE -> {
                val count = allRecords.count { it.parentId == record.id && it.kind in setOf("invitation_log", "save_the_date_log") }
                InfoBadge("${localized(R.string.confirmed_sends, language)}: $count", PlannerChampagne)
                if (record.notes.isNotBlank()) {
                    Text(record.notes, maxLines = 2, overflow = TextOverflow.Ellipsis, color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        if (record.kind in setOf(Kinds.BUDGET, Kinds.TROUSSEAU)) {
            val est = record.estimatedCents ?: 0L
            val act = record.amountCents ?: 0L
            val isOver = est > 0L && act > est
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                if (record.estimatedCents != null || record.kind == Kinds.BUDGET) {
                    Text(
                        "${localized(R.string.report_estimated, language)}: ${localizedCurrency(est, currency, language)}",
                        color = PlannerMuted,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                if (record.amountCents != null) {
                    Text(
                        "${localized(R.string.budget_actual, language)}: ${localizedCurrency(act, currency, language)}",
                        color = if (isOver) PlannerRose else PlannerEmerald,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (record.kind !in setOf(Kinds.BUDGET, Kinds.TROUSSEAU) && record.amountCents != null) {
                if (record.kind == Kinds.TABLE) {
                    val occupied = allRecords.filter { it.kind == Kinds.GUEST && it.seatingTableId == record.id }.sumOf { 1 + it.plusOnesConfirmed }
                    val capacity = record.amountCents
                    InfoBadge("$occupied / $capacity ${localized(R.string.seats, language)}", if (occupied <= capacity) PlannerEmerald else PlannerRose)
                } else {
                    Text(
                        localizedCurrency(record.amountCents, currency, language),
                        color = PlannerChampagne,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            if (!record.date.isNullOrBlank()) {
                Text("📅 ${formatDisplayDate(record.date, language)}", style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
            }
        }
    }
}

private data class EditorFormState(
    val title: String,
    val subtitle: String,
    val amount: String,
    val estimated: String,
    val date: String,
    val status: String,
    val phone: String,
    val email: String,
    val notes: String,
    val venueAddress: String,
    val rating: String,
    val incomeFrequency: String,
    val contractVersion: String,
    val guestSide: String,
    val guestDietary: String,
    val guestCity: String,
    val guestIsVip: Boolean,
    val guestIsPadrinho: Boolean,
    val guestIsChild: Boolean,
    val paymentMethod: String,
    val lateFeePercent: String,
    val interestPercentPerMonth: String,
    val honeymoonItemKind: String,
    val honeymoonConfirmation: String,
    val trousseauRoom: String,
    val trousseauStore: String,
    val itemPriority: String,
    val parentId: String?,
    val guestGroupId: String?,
    val seatingTableId: String?,
    val plusAllowed: String,
    val plusConfirmed: String,
    val selectedTagIds: Set<String>,
    val localError: String = "",
)

@Composable
private fun RecordEditor(
    module: ModuleDefinition,
    initial: PlannerRecord?,
    records: List<PlannerRecord>,
    language: String,
    onDismiss: () -> Unit,
    onSave: (PlannerRecord) -> Unit,
) {
    val invalidMessage = localized(R.string.invalid_fields, language)
    var form by remember(initial?.id, module.kind) {
        val json = runCatching { JSONObject(initial?.extraJson ?: "{}") }.getOrElse { JSONObject() }
        mutableStateOf(
            EditorFormState(
                title = initial?.title.orEmpty(),
                subtitle = initial?.subtitle.orEmpty(),
                amount = initial?.amountCents?.let {
                    if (module.kind == Kinds.TABLE) it.toString() else java.math.BigDecimal.valueOf(it, 2).toPlainString()
                }.orEmpty(),
                estimated = initial?.estimatedCents?.let {
                    java.math.BigDecimal.valueOf(it, 2).toPlainString()
                }.orEmpty(),
                date = initial?.date.orEmpty(),
                status = initial?.status ?: module.statuses.firstOrNull().orEmpty(),
                phone = initial?.phone.orEmpty(),
                email = initial?.email.orEmpty(),
                notes = initial?.notes.orEmpty(),
                venueAddress = json.optString("address"),
                rating = json.optInt("rating", 0).takeIf { it > 0 }?.toString().orEmpty(),
                incomeFrequency = json.optString("frequency", "ONE_TIME"),
                contractVersion = json.optInt("version", 1).toString(),
                guestSide = json.optString("side", "BOTH"),
                guestDietary = json.optString("dietary", ""),
                guestCity = json.optString("city", ""),
                guestIsVip = json.optBoolean("isVIP", false),
                guestIsPadrinho = json.optBoolean("isPadrinho", false),
                guestIsChild = json.optBoolean("isChild", false),
                paymentMethod = json.optString("method", "PIX"),
                lateFeePercent = json.optDouble("lateFeePercent", 2.0).toString(),
                interestPercentPerMonth = json.optDouble("interestPercentPerMonth", 1.0).toString(),
                honeymoonItemKind = json.optString("itemKind", "FLIGHT"),
                honeymoonConfirmation = json.optString("confirmationNumber", ""),
                trousseauRoom = json.optString("room", ""),
                trousseauStore = json.optString("store", ""),
                itemPriority = json.optString("priority", "MEDIUM"),
                parentId = initial?.parentId,
                guestGroupId = initial?.guestGroupId,
                seatingTableId = initial?.seatingTableId,
                plusAllowed = initial?.plusOnesAllowed?.toString() ?: "0",
                plusConfirmed = initial?.plusOnesConfirmed?.toString() ?: "0",
                selectedTagIds = initial?.let(::recordTagIds).orEmpty(),
            ),
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(localized(if (initial == null) R.string.add else R.string.edit, language) + " · " + localized(module.title, language)) },
        text = {
            Column(
                Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedTextField(form.title, { form = form.copy(title = it.take(160)) }, label = { Text(localized(R.string.title, language)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(form.subtitle, { form = form.copy(subtitle = it.take(500)) }, label = {
                    Text(localized(if (module.kind == Kinds.VENDOR) R.string.category else R.string.subtitle, language))
                }, singleLine = true, modifier = Modifier.fillMaxWidth())
                if (module.kind in setOf(Kinds.BUDGET, Kinds.TROUSSEAU)) {
                    OutlinedTextField(
                        form.estimated,
                        { form = form.copy(estimated = it) },
                        label = { Text(localized(R.string.report_estimated, language)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                if (module.hasAmount) {
                    OutlinedTextField(
                        form.amount,
                        { form = form.copy(amount = it) },
                        label = {
                            Text(localized(when (module.kind) {
                                Kinds.TABLE -> R.string.capacity
                                Kinds.BUDGET, Kinds.TROUSSEAU -> R.string.budget_actual
                                else -> R.string.amount
                            }, language))
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = if (module.kind == Kinds.TABLE) KeyboardType.Number else KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                if (module.hasDate) {
                    DatePickerOutlinedField(
                        value = form.date,
                        onValueChange = { form = form.copy(date = it) },
                        label = localized(R.string.date, language),
                    )
                }
                if (module.kind == Kinds.INCOME) {
                    Text(localized(R.string.frequency, language), style = MaterialTheme.typography.labelLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(selected = form.incomeFrequency == "ONE_TIME", onClick = { form = form.copy(incomeFrequency = "ONE_TIME") }, label = { Text(localized(R.string.one_time, language)) })
                        FilterChip(selected = form.incomeFrequency == "MONTHLY", onClick = { form = form.copy(incomeFrequency = "MONTHLY") }, label = { Text(localized(R.string.monthly, language)) })
                    }
                }
                if (module.statuses.isNotEmpty()) {
                    Text(localized(R.string.status, language), style = MaterialTheme.typography.labelLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        module.statuses.forEach { option ->
                            FilterChip(selected = form.status == option, onClick = { form = form.copy(status = option) }, label = { Text(statusLabel(option, language)) })
                        }
                    }
                }
                if (module.kind == Kinds.PAYMENT) {
                    Text("Forma de Pagamento", style = MaterialTheme.typography.labelLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("PIX" to "PIX", "BOLETO" to "Boleto", "CREDIT_CARD" to "Cartão", "TRANSFER" to "TED/DOC").forEach { (key, lbl) ->
                            FilterChip(selected = form.paymentMethod == key, onClick = { form = form.copy(paymentMethod = key) }, label = { Text(lbl) })
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            form.lateFeePercent,
                            { form = form.copy(lateFeePercent = it.take(5)) },
                            label = { Text("Multa (%)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            form.interestPercentPerMonth,
                            { form = form.copy(interestPercentPerMonth = it.take(5)) },
                            label = { Text("Juros a.m. (%)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                if (module.kind == Kinds.HONEYMOON_ITEM) {
                    Text("Tipo de Item", style = MaterialTheme.typography.labelLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf(
                            "FLIGHT" to "✈️ Voo",
                            "HOTEL" to "🏨 Hotel",
                            "ACTIVITY" to "🗺️ Passeio",
                            "TRANSPORT" to "🚗 Transporte",
                            "OTHER" to "📄 Outro",
                        ).forEach { (key, lbl) ->
                            FilterChip(selected = form.honeymoonItemKind == key, onClick = { form = form.copy(honeymoonItemKind = key) }, label = { Text(lbl) })
                        }
                    }
                    OutlinedTextField(
                        form.honeymoonConfirmation,
                        { form = form.copy(honeymoonConfirmation = it.take(80)) },
                        label = { Text("Código Localizador / Reserva") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                if (module.kind == Kinds.TROUSSEAU) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            form.trousseauRoom,
                            { form = form.copy(trousseauRoom = it.take(60)) },
                            label = { Text("Cômodo (Quarto, Cozinha...)") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            form.trousseauStore,
                            { form = form.copy(trousseauStore = it.take(80)) },
                            label = { Text("Loja / Marca") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                if (module.kind in setOf(Kinds.TASK, Kinds.TROUSSEAU)) {
                    Text("Prioridade", style = MaterialTheme.typography.labelLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("HIGH" to "Alta", "MEDIUM" to "Média", "LOW" to "Baixa").forEach { (key, lbl) ->
                            FilterChip(selected = form.itemPriority == key, onClick = { form = form.copy(itemPriority = key) }, label = { Text(lbl) })
                        }
                    }
                }
                if (module.hasContact) {
                    OutlinedTextField(
                        form.phone,
                        { form = form.copy(phone = it.take(30)) },
                        label = { Text(localized(R.string.phone, language)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        form.email,
                        { form = form.copy(email = it.take(120)) },
                        label = { Text(localized(R.string.email, language)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                if (module.kind == Kinds.VENUE) {
                    OutlinedTextField(form.venueAddress, { form = form.copy(venueAddress = it.take(240)) }, label = { Text(localized(R.string.address, language)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                }
                if (module.kind == Kinds.VENDOR) {
                    OutlinedTextField(
                        form.rating,
                        { form = form.copy(rating = it.take(1)) },
                        label = { Text(localized(R.string.rating, language)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                if (module.kind == Kinds.CONTRACT) {
                    OutlinedTextField(
                        form.contractVersion,
                        { form = form.copy(contractVersion = it.take(3)) },
                        label = { Text(localized(R.string.contract_version, language)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                if (module.parentKind != null) {
                    Text(localized(modules.first { it.kind == module.parentKind }.title, language), style = MaterialTheme.typography.labelLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(selected = form.parentId == null, onClick = { form = form.copy(parentId = null) }, label = { Text("—") })
                        records.filter { it.kind == module.parentKind && it.deletedAt == null }.forEach { parent ->
                            FilterChip(selected = form.parentId == parent.id, onClick = { form = form.copy(parentId = parent.id) }, label = { Text(parent.title) })
                        }
                    }
                }
                if (module.kind == Kinds.GUEST) {
                    Text("Lado do Casal & Perfil", style = MaterialTheme.typography.labelLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(selected = form.guestSide == "BRIDE", onClick = { form = form.copy(guestSide = "BRIDE") }, label = { Text("👰 Noiva") })
                        FilterChip(selected = form.guestSide == "GROOM", onClick = { form = form.copy(guestSide = "GROOM") }, label = { Text("🤵 Noivo") })
                        FilterChip(selected = form.guestSide == "BOTH", onClick = { form = form.copy(guestSide = "BOTH") }, label = { Text("💑 Comum") })
                    }
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(selected = form.guestIsVip, onClick = { form = form.copy(guestIsVip = !form.guestIsVip) }, label = { Text("⭐ VIP") })
                        FilterChip(selected = form.guestIsPadrinho, onClick = { form = form.copy(guestIsPadrinho = !form.guestIsPadrinho) }, label = { Text("💍 Padrinho/Madrinha") })
                        FilterChip(selected = form.guestIsChild, onClick = { form = form.copy(guestIsChild = !form.guestIsChild) }, label = { Text("🧒 Criança") })
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            form.guestDietary,
                            { form = form.copy(guestDietary = it.take(80)) },
                            label = { Text("Restrição alimentar") },
                            placeholder = { Text("Ex: Vegano, Sem lactose") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            form.guestCity,
                            { form = form.copy(guestCity = it.take(80)) },
                            label = { Text("Cidade") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Text(localized(R.string.groups, language), style = MaterialTheme.typography.labelLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(selected = form.guestGroupId == null, onClick = { form = form.copy(guestGroupId = null) }, label = { Text("—") })
                        records.filter { it.kind == Kinds.GROUP && it.deletedAt == null }.forEach { group ->
                            FilterChip(selected = form.guestGroupId == group.id, onClick = { form = form.copy(guestGroupId = group.id) }, label = { Text(group.title) })
                        }
                    }
                    Text(localized(R.string.tags, language), style = MaterialTheme.typography.labelLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        records.filter { it.kind == Kinds.TAG && it.deletedAt == null }.sortedBy { it.title }.forEach { tag ->
                            FilterChip(
                                selected = tag.id in form.selectedTagIds,
                                onClick = {
                                    val next = if (tag.id in form.selectedTagIds) form.selectedTagIds - tag.id else form.selectedTagIds + tag.id
                                    form = form.copy(selectedTagIds = next)
                                },
                                label = { Text(tag.title) },
                            )
                        }
                    }
                    OutlinedTextField(
                        form.plusAllowed,
                        { form = form.copy(plusAllowed = it) },
                        label = { Text(localized(R.string.plus_allowed, language)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        form.plusConfirmed,
                        { form = form.copy(plusConfirmed = it) },
                        label = { Text(localized(R.string.plus_confirmed, language)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text(localized(R.string.seating, language), style = MaterialTheme.typography.labelLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(selected = form.seatingTableId == null, onClick = { form = form.copy(seatingTableId = null) }, label = { Text("—") })
                        records.filter { it.kind == Kinds.TABLE && it.deletedAt == null }.forEach { table ->
                            FilterChip(selected = form.seatingTableId == table.id, onClick = { form = form.copy(seatingTableId = table.id) }, label = { Text(table.title) })
                        }
                    }
                }
                OutlinedTextField(form.notes, { form = form.copy(notes = it.take(8000)) }, label = { Text(localized(R.string.notes, language)) }, minLines = 2, modifier = Modifier.fillMaxWidth())
                if (form.localError.isNotEmpty()) Text(form.localError, color = MaterialTheme.colorScheme.error)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                try {
                    require(form.title.isNotBlank())
                    val normalizedDate = normalizeDateInput(form.date)
                    val parsedAmount = if (!module.hasAmount || form.amount.isBlank()) null else
                        if (module.kind == Kinds.TABLE) form.amount.toLong().also { require(it in 1..1000) } else Money.parseToCents(form.amount)
                    val parsedEstimated = when (module.kind) {
                        Kinds.BUDGET -> Money.parseToCents(form.estimated)
                        Kinds.TROUSSEAU -> form.estimated.takeIf { it.isNotBlank() }?.let(Money::parseToCents)
                        else -> initial?.estimatedCents
                    }
                    val parsedRating = form.rating.takeIf { it.isNotBlank() }?.toInt()?.also { require(it in 1..5) }
                    val parsedContractVersion = if (module.kind == Kinds.CONTRACT)
                        form.contractVersion.toInt().also { require(it in 1..999) } else 1
                    if (normalizedDate.isNotBlank()) LocalDate.parse(normalizedDate)
                    val updatedJson = JSONObject(initial?.extraJson ?: "{}").apply {
                        when (module.kind) {
                            Kinds.VENUE -> put("address", form.venueAddress.trim())
                            Kinds.VENDOR -> put("rating", parsedRating ?: JSONObject.NULL)
                            Kinds.GUEST -> {
                                put("tagIds", JSONArray(form.selectedTagIds.sorted()))
                                put("side", form.guestSide)
                                put("dietary", form.guestDietary.trim())
                                put("city", form.guestCity.trim())
                                put("isVIP", form.guestIsVip)
                                put("isPadrinho", form.guestIsPadrinho)
                                put("isChild", form.guestIsChild)
                            }
                            Kinds.PAYMENT -> {
                                put("method", form.paymentMethod)
                                put("lateFeePercent", form.lateFeePercent.toDoubleOrNull() ?: 2.0)
                                put("interestPercentPerMonth", form.interestPercentPerMonth.toDoubleOrNull() ?: 1.0)
                            }
                            Kinds.HONEYMOON_ITEM -> {
                                put("itemKind", form.honeymoonItemKind)
                                put("confirmationNumber", form.honeymoonConfirmation.trim())
                            }
                            Kinds.TROUSSEAU -> {
                                put("room", form.trousseauRoom.trim())
                                put("store", form.trousseauStore.trim())
                                put("priority", form.itemPriority)
                            }
                            Kinds.TASK -> put("priority", form.itemPriority)
                            Kinds.INCOME -> put("frequency", form.incomeFrequency)
                            Kinds.CONTRACT -> put("version", parsedContractVersion)
                        }
                    }.toString()
                    val record = (initial ?: PlannerRecord(UUID.randomUUID().toString(), module.kind, form.title)).copy(
                        title = form.title.trim(), subtitle = form.subtitle.trim(), amountCents = parsedAmount,
                        estimatedCents = parsedEstimated,
                        date = normalizedDate.ifBlank { null }, status = form.status, phone = form.phone.trim(), email = form.email.trim(),
                        notes = form.notes.trim(), parentId = form.parentId, guestGroupId = form.guestGroupId, seatingTableId = form.seatingTableId,
                        plusOnesAllowed = if (module.kind == Kinds.GUEST) form.plusAllowed.toInt() else 0,
                        plusOnesConfirmed = if (module.kind == Kinds.GUEST) form.plusConfirmed.toInt() else 0,
                        extraJson = updatedJson,
                    )
                    onSave(record)
                } catch (_: Exception) { form = form.copy(localError = invalidMessage) }
            }) { Text(localized(R.string.save, language)) }
        },
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

@Composable
private fun InstallmentsDialog(
    records: List<PlannerRecord>,
    language: String,
    currency: String,
    onDismiss: () -> Unit,
    onSave: (String?, String, Long, Int, LocalDate) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var count by remember { mutableStateOf("2") }
    var firstDate by remember { mutableStateOf(LocalDate.now().toString()) }
    var vendorId by remember { mutableStateOf<String?>(null) }
    var invalid by remember { mutableStateOf(false) }
    val errorText = localized(R.string.invalid_fields, language)

    val previewSplit = remember(amount, count) {
        runCatching {
            val cents = Money.parseToCents(amount)
            val n = count.toInt().also { require(it in 1..120) }
            InstallmentMath.split(cents, n)
        }.getOrNull()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(localized(R.string.create_installments, language)) },
        text = {
            Column(
                Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedTextField(title, { title = it.take(160) }, label = { Text(localized(R.string.title, language)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(
                    amount,
                    { amount = it },
                    label = { Text(localized(R.string.amount, language)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    count,
                    { count = it },
                    label = { Text(localized(R.string.installment_count, language)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                DatePickerOutlinedField(
                    value = firstDate,
                    onValueChange = { firstDate = it },
                    label = localized(R.string.first_due_date, language),
                )
                if (!previewSplit.isNullOrEmpty()) {
                    InfoBadge("${previewSplit.size}x de ${localizedCurrency(previewSplit.first(), currency, language)}", PlannerEmerald)
                }
                Text(localized(R.string.vendors, language), style = MaterialTheme.typography.labelLarge)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(selected = vendorId == null, onClick = { vendorId = null }, label = { Text("—") })
                    records.filter { it.kind == Kinds.VENDOR && it.deletedAt == null }.forEach { vendor ->
                        FilterChip(selected = vendorId == vendor.id, onClick = { vendorId = vendor.id }, label = { Text(vendor.title) })
                    }
                }
                if (invalid) Text(errorText, color = MaterialTheme.colorScheme.error)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                try {
                    require(title.isNotBlank())
                    val total = Money.parseToCents(amount)
                    val installmentsCount = count.toInt().also { require(it in 1..120) }
                    val normalizedDate = normalizeDateInput(firstDate)
                    onSave(vendorId, title.trim(), total, installmentsCount, LocalDate.parse(normalizedDate))
                } catch (_: Exception) { invalid = true }
            }) { Text(localized(R.string.save, language)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(localized(R.string.cancel, language)) } },
    )
}

private fun inviteMessage(template: PlannerRecord, guest: PlannerRecord): String =
    (template.notes.ifBlank { template.subtitle.ifBlank { template.title } })
        .replace("{nome}", guest.title).replace("{name}", guest.title)

private fun openInviteWhatsApp(activity: Activity, template: PlannerRecord, guest: PlannerRecord): Boolean = runCatching {
    val number = guest.phone.filter { it.isDigit() }
    require(number.isNotBlank())
    val uri = Uri.parse("https://wa.me/$number?text=${Uri.encode(inviteMessage(template, guest))}")
    activity.startActivity(Intent(Intent.ACTION_VIEW, uri))
    true
}.getOrDefault(false)

private fun shareInviteText(activity: Activity, template: PlannerRecord, guest: PlannerRecord): Boolean = runCatching {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, inviteMessage(template, guest))
    }
    activity.startActivity(Intent.createChooser(intent, guest.title))
    true
}.getOrDefault(false)
