package br.com.paivalab.weddingmanagementsystem.ui

import android.app.Activity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.backup.BackupArchive
import br.com.paivalab.weddingmanagementsystem.data.CalendarExport
import br.com.paivalab.weddingmanagementsystem.data.GuestRules
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.ReportExport
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import kotlinx.coroutines.launch

private data class Tab(val section: String, val route: Any, val label: Int, val icon: ImageVector)

private val tabs = listOf(
    Tab("dashboard", DashboardRoute, R.string.dashboard, Icons.Default.Dashboard),
    Tab(Kinds.TASK, TasksTabRoute, R.string.tasks, modules.first { it.kind == Kinds.TASK }.icon),
    Tab(Kinds.VENDOR, VendorsTabRoute, R.string.vendors, modules.first { it.kind == Kinds.VENDOR }.icon),
    Tab(Kinds.GUEST, GuestsTabRoute, R.string.guests, modules.first { it.kind == Kinds.GUEST }.icon),
    Tab("more", MoreRoute, R.string.more, Icons.Default.MoreHoriz),
)

private fun NavDestination?.isTab(tab: Tab): Boolean = this?.hierarchy?.any { it.hasRoute(tab.route::class) } == true

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlannerApp(
    model: PlannerViewModel,
    activity: Activity,
    archive: BackupArchive,
    authenticate: ((() -> Unit)?) -> Unit,
    externalSection: String? = null,
    externalRecordId: String? = null,
    onExternalConsumed: () -> Unit = {},
    onLoadDemoSeed: () -> Unit = {},
    onStartWithDemo: () -> Unit = {},
) {
    val onboarding by model.onboardingNeeded.collectAsStateWithLifecycle()
    when (onboarding) {
        null -> {
            Box(Modifier.fillMaxSize().background(PlannerBackground))
            return
        }
        true -> {
            val language by model.locale.collectAsStateWithLifecycle()
            val currency by model.currency.collectAsStateWithLifecycle()
            OnboardingScreen(language, currency, model::setLocale, model::completeOnboarding, onStartWithDemo)
            return
        }
        false -> Unit
    }
    val nav = rememberNavController()
    val index by model.index.collectAsStateWithLifecycle()
    val storedFiles by model.allFiles.collectAsStateWithLifecycle()
    val audits by model.audits.collectAsStateWithLifecycle()
    val language by model.locale.collectAsStateWithLifecycle()
    val currency by model.currency.collectAsStateWithLifecycle()
    val coupleNames by model.coupleNames.collectAsStateWithLifecycle()
    val eventDate by model.eventDate.collectAsStateWithLifecycle()
    val contingencyPercent by model.contingencyPercent.collectAsStateWithLifecycle()
    val pixKey by model.pixKey.collectAsStateWithLifecycle()
    val pixHolder by model.pixHolderName.collectAsStateWithLifecycle()
    val pixCity by model.pixCity.collectAsStateWithLifecycle()
    val guestImport by model.guestImport.collectAsStateWithLifecycle()
    val records = index.active

    var deleteTargetId by rememberSaveable { mutableStateOf<String?>(null) }
    var attachmentTargetId by rememberSaveable { mutableStateOf<String?>(null) }
    var exportTargetId by rememberSaveable { mutableStateOf<String?>(null) }
    var inviteTemplateId by rememberSaveable { mutableStateOf<String?>(null) }
    var inviteAttachmentId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingInvite by rememberSaveable { mutableStateOf<List<String>?>(null) }
    var installments by rememberSaveable { mutableStateOf(false) }
    var splitPayment by rememberSaveable { mutableStateOf(false) }
    var postGiftId by rememberSaveable { mutableStateOf<String?>(null) }
    var statusVendorId by rememberSaveable { mutableStateOf<String?>(null) }
    var signContractId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingFile by rememberSaveable { mutableStateOf<android.net.Uri?>(null) }
    var pendingFileOwner by rememberSaveable { mutableStateOf<String?>(null) }
    var membersGroupId by rememberSaveable { mutableStateOf<String?>(null) }
    var showPixDialog by rememberSaveable { mutableStateOf(false) }
    var pixGiftId by rememberSaveable { mutableStateOf<String?>(null) }

    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val notify: (String) -> Unit = { message -> scope.launch { snackbar.showSnackbar(message) } }
    val genericError = stringResource(R.string.error_generic)
    val undoLabel = stringResource(R.string.undo)
    val recipientPrompt = stringResource(R.string.select_whatsapp_recipient)
    val resources = activity.resources

    val importFile = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        val target = attachmentTargetId
        if (uri != null && target != null) {
            // PDF de contrato não tem escolha de tipo; os demais anexos pedem o tipo, como na web.
            if (index.find(target)?.kind == Kinds.CONTRACT) model.addAttachment(activity, target, uri)
            else { pendingFile = uri; pendingFileOwner = target }
        }
        attachmentTargetId = null
    }
    val exportFile = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        val target = storedFiles.firstOrNull { it.id == exportTargetId }
        if (uri != null && target != null) model.exportAttachment(activity, target, uri)
        exportTargetId = null
    }
    val calendarFile = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/calendar")) { uri ->
        if (uri != null) {
            val written = runCatching {
                activity.contentResolver.openOutputStream(uri, "w")?.use { stream ->
                    stream.write(CalendarExport.generate(records).toByteArray(Charsets.UTF_8))
                } ?: error("calendar")
            }
            if (written.isFailure) notify(genericError)
        }
    }
    val csvHeader = listOf(R.string.csv_name, R.string.phone, R.string.email, R.string.guest_side, R.string.label_group, R.string.status,
        R.string.plus_confirmed, R.string.label_table, R.string.guest_dietary, R.string.guest_city, R.string.guest_padrinho,
        R.string.guest_vip, R.string.guest_child).map { stringResource(it) }
    val csvYes = stringResource(R.string.csv_yes)
    val guestCsv = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) {
            val rows = GuestRules.csvRows(index.kind(Kinds.GUEST), index, csvHeader, csvYes) { status -> statusResource(status)?.let(activity::getString) ?: status }
            val written = runCatching {
                activity.contentResolver.openOutputStream(uri, "w")?.use { it.write(ReportExport.csv(rows)) } ?: error("csv")
            }
            if (written.isFailure) notify(genericError)
        }
    }
    val guestFile = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) model.previewGuestImport(activity, uri)
    }
    val openFile: (PlannerFile) -> Unit = { file ->
        model.prepareSharedFile(activity, file) { uri -> if (!viewFile(activity, file, uri)) notify(genericError) }
    }
    val attach: (PlannerRecord) -> Unit = { record -> attachmentTargetId = record.id; importFile.launch(arrayOf("*/*")) }
    val export: (PlannerFile) -> Unit = { file -> exportTargetId = file.id; exportFile.launch(file.fileName) }
    val openRecord: (PlannerRecord) -> Unit = { record -> nav.openRecord(record.kind, record.id) }

    LaunchedEffect(model) {
        model.messages.collect { message ->
            val text = message.quantity?.let { resources.getQuantityString(message.text, pluralQuantity(it), *message.args.toTypedArray()) }
                ?: resources.getString(message.text, *message.args.toTypedArray())
            val undo = message.undo
            val result = snackbar.showSnackbar(
                message = text,
                actionLabel = if (undo != null) undoLabel else null,
                duration = if (undo != null) SnackbarDuration.Long else SnackbarDuration.Short,
            )
            if (result == SnackbarResult.ActionPerformed && undo != null) model.undo(undo)
        }
    }
    LaunchedEffect(externalSection, externalRecordId, index) {
        if (externalSection == null && externalRecordId == null) return@LaunchedEffect
        externalSection?.takeIf { it.isNotBlank() }?.let(nav::openSection)
        if (externalRecordId != null) {
            val record = index.find(externalRecordId) ?: return@LaunchedEffect
            openRecord(record)
        }
        onExternalConsumed()
    }

    val backStack by nav.currentBackStackEntryAsState()
    val destination = backStack?.destination
    val moduleKind = when {
        destination?.hasRoute(ModuleRoute::class) == true -> backStack?.toRoute<ModuleRoute>()?.kind
        destination?.hasRoute(TasksTabRoute::class) == true -> Kinds.TASK
        destination?.hasRoute(VendorsTabRoute::class) == true -> Kinds.VENDOR
        destination?.hasRoute(GuestsTabRoute::class) == true -> Kinds.GUEST
        else -> null
    }
    val isEditor = destination?.hasRoute(EditorRoute::class) == true
    val isTabRoot = destination == null || tabs.any { destination.isTab(it) }
    // Telas empilhadas (detalhe, editor) mantêm destacada a aba de onde vieram.
    var lastTab by rememberSaveable { mutableStateOf(tabs.first().section) }
    tabs.firstOrNull { destination.isTab(it) }?.let { lastTab = it.section }
    val dynamicTitle = backStack?.let { entry ->
        when {
            destination?.hasRoute(DetailRoute::class) == true -> index.find(entry.toRoute<DetailRoute>().id)?.title
            destination?.hasRoute(ReportRoute::class) == true ->
                mobileReports.firstOrNull { it.route == entry.toRoute<ReportRoute>().route }?.title?.let { stringResource(it) }
            else -> null
        }
    }
    val title = screenTitle(destination, dynamicTitle, moduleKind)
    val wide = LocalConfiguration.current.screenWidthDp >= 840

    val moduleContent: @Composable (String) -> Unit = { kind ->
        val module = modules.first { it.kind == kind }
        val listModel: ModuleListViewModel = viewModel(
            factory = viewModelFactory { initializer { ModuleListViewModel(createSavedStateHandle(), kind, model.index) } },
        )
        ModuleScreen(
            module, index, listModel, currency, language, eventDate,
            ModuleActions(
                open = openRecord,
                add = { nav.navigate(EditorRoute(kind)) },
                delete = { deleteTargetId = it.id },
                setStatus = { record, status -> model.setStatus(record.id, status) },
                markPaid = { model.markPaid(it.id) },
                undoPaid = { model.undoPaid(it.id) },
                whatsApp = { if (!openWhatsApp(activity, it)) notify(genericError) },
                dial = { if (!dialPhone(activity, it.phone)) notify(genericError) },
                maps = { if (!openMap(activity, it)) notify(genericError) },
                attach = attach,
                openFile = openFile,
                postGift = { postGiftId = it.id },
                invite = { template ->
                    inviteTemplateId = template.id
                    inviteAttachmentId = index.files(template.id).maxByOrNull { it.createdAt }?.id
                },
                importGuests = { guestFile.launch(arrayOf("*/*")) },
                exportGuests = { guestCsv.launch("convidados-${java.time.LocalDate.now()}.csv") },
                setCheckedIn = { guest, present -> model.setCheckedIn(guest.id, present) },
                setThanked = { gift, thanked -> model.setGiftThanked(gift.id, thanked) },
                editMembers = { membersGroupId = it.id },
                changeVendorStatus = { statusVendorId = it.id },
                signContract = { signContractId = it.id },
                seedTasks = model::seedTaskTemplates,
                seedVenueChecklist = model::seedVenueChecklist,
                installments = { installments = true },
                splitPayment = { splitPayment = true },
                groupRsvp = { record, status -> model.setGroupRsvp(record.id, status) },
                compare = { nav.navigate(VendorCompareRoute) },
                sharePix = { pixGiftId = null; showPixDialog = true },
                giftPix = { gift -> pixGiftId = gift.id; showPixDialog = true },
                pixConfigured = pixKey.isNotBlank(),
            ),
        )
    }

    Row(Modifier.fillMaxSize()) {
        if (wide && !isEditor) {
            NavigationRail(containerColor = PlannerSurface) {
                tabs.forEach { tab ->
                    NavigationRailItem(
                        selected = tab.section == lastTab,
                        onClick = { nav.openTab(tab.route) },
                        icon = { Icon(tab.icon, null) },
                        label = { Text(stringResource(tab.label)) },
                    )
                }
            }
        }
        Scaffold(
            modifier = Modifier.weight(1f),
            topBar = {
                if (!isEditor) TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Favorite, null, tint = PlannerRose, modifier = Modifier.size(20.dp))
                            Box(Modifier.width(10.dp))
                            Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
                        }
                    },
                    navigationIcon = {
                        if (!isTabRoot) IconButton(onClick = { nav.popBackStack() }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back))
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = PlannerBackground),
                )
            },
            bottomBar = {
                if (!wide && !isEditor) NavigationBar(containerColor = PlannerSurface) {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = tab.section == lastTab,
                            onClick = { nav.openTab(tab.route) },
                            icon = { Icon(tab.icon, null) },
                            label = {
                                Text(stringResource(if (tab.section == Kinds.VENDOR) R.string.vendors_nav else tab.label), maxLines = 1,
                                    overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall)
                            },
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
                if (moduleKind != null) {
                    ExtendedFloatingActionButton(
                        onClick = { nav.navigate(EditorRoute(moduleKind)) },
                        containerColor = PlannerRose,
                        contentColor = PlannerOnAccent,
                        icon = { Icon(Icons.Default.Add, null) },
                        text = { Text(stringResource(R.string.add), fontWeight = FontWeight.SemiBold) },
                    )
                }
            },
            containerColor = PlannerBackground,
        ) { inner ->
            NavHost(
                nav,
                startDestination = DashboardRoute,
                modifier = Modifier.fillMaxSize().padding(inner).wrapContentWidth(Alignment.CenterHorizontally).widthIn(max = 960.dp),
            ) {
                composable<DashboardRoute> {
                    DashboardScreen(index, coupleNames, eventDate, contingencyPercent, currency, language, nav::openSection, openRecord)
                }
                composable<MoreRoute> { MoreScreen(index, nav::openSection) }
                composable<TasksTabRoute> { moduleContent(Kinds.TASK) }
                composable<VendorsTabRoute> { moduleContent(Kinds.VENDOR) }
                composable<GuestsTabRoute> { moduleContent(Kinds.GUEST) }
                composable<ModuleRoute> { entry -> moduleContent(entry.toRoute<ModuleRoute>().kind) }
                composable<DetailRoute> { entry ->
                    val record = index.find(entry.toRoute<DetailRoute>().id)
                    if (record == null) {
                        LaunchedEffect(Unit) { nav.popBackStack() }
                        return@composable
                    }
                    val related: (String, String) -> Unit = { kind, parentId -> nav.navigate(EditorRoute(kind, parentId = parentId)) }
                    val edit: (PlannerRecord) -> Unit = { nav.navigate(EditorRoute(it.kind, it.id)) }
                    if (record.kind == Kinds.VENDOR) {
                        VendorDetailScreen(
                            vendor = record, records = records, files = storedFiles, language = language, currency = currency,
                            onEdit = edit, onAddRelated = related, onDelete = { deleteTargetId = it.id }, onAttach = attach,
                            onOpenFile = openFile, onExportFile = export, onPaid = model::markPaid,
                            onDial = { phone -> if (!dialPhone(activity, phone)) notify(genericError) },
                            onWhatsApp = { if (!openWhatsApp(activity, it)) notify(genericError) },
                            onOpenLink = { url -> if (!openLink(activity, url)) notify(genericError) },
                            onChangeStatus = { statusVendorId = it.id },
                            onSignContract = { signContractId = it.id },
                        )
                    } else {
                        VenueDetailScreen(
                            venue = record, records = records, files = storedFiles.filter { it.deletedAt == null },
                            language = language, currency = currency, onEdit = edit, onAddRelated = related, onAttach = attach,
                            onOpenFile = openFile, onExportFile = export, onChecklistStatus = model::setStatus,
                            onSeedChecklist = model::seedVenueChecklist,
                            onMaps = { if (!openMap(activity, it)) notify(genericError) },
                        )
                    }
                }
                composable<EditorRoute> { entry ->
                    val route = entry.toRoute<EditorRoute>()
                    val module = modules.firstOrNull { it.kind == route.kind } ?: return@composable
                    val initial = route.id?.let(index::find)
                    if (route.id != null && initial == null) {
                        LaunchedEffect(Unit) { nav.popBackStack() }
                        return@composable
                    }
                    RecordEditorScreen(
                        module = module, initial = initial, initialParentId = route.parentId, index = index, language = language,
                        onClose = { nav.popBackStack() },
                        onSave = { record ->
                            if (record.kind == Kinds.VENDOR && initial == null) {
                                model.createVendor(record.copy(estimatedCents = null), record.estimatedCents,
                                    resources.getString(R.string.vendor_budget_title, record.title)) { nav.popBackStack() }
                            } else model.save(record) { nav.popBackStack() }
                        },
                        onDelete = { deleteTargetId = it.id },
                    )
                }
                composable<SettingsRoute> {
                    SettingsScreen(
                        model = model, language = language, currency = currency, authenticate = authenticate,
                        onExportCalendar = { calendarFile.launch("wedding-finance.ics") },
                        onLoadDemoSeed = onLoadDemoSeed, onNotify = notify, navigate = nav::openSection,
                    )
                }
                composable<InsightsRoute> { InsightsScreen(records, language, currency, eventDate, contingencyPercent, nav::openSection) }
                composable<ReportsRoute> { ReportsHubScreen(language, nav::openSection) }
                composable<ReportRoute> { entry ->
                    ReportDetailScreen(entry.toRoute<ReportRoute>().route, records, audits, language, currency, eventDate, nav::openSection)
                }
                composable<HelpRoute> { HelpScreen(language) }
                composable<AuditRoute> { AuditScreen(audits, records, language) }
                composable<TrashRoute> {
                    val deleted by model.deleted.collectAsStateWithLifecycle()
                    TrashScreen(deleted, language, onRestore = { model.restore(it.id) })
                }
                composable<VendorCompareRoute> { VendorCompareScreen(records, language, currency) }
                composable<WeddingDayRoute> { WeddingDayScreen(model, records, language, notify) }
                composable<BackupRoute> { BackupScreen(archive, language, authenticate, model::refreshEvent) }
            }
        }
    }

    if (showPixDialog) {
        PixQrDialog(
            activity = activity,
            pixKey = pixKey,
            pixHolderName = pixHolder.ifBlank { coupleNames.ifBlank { "CASAMENTO" } },
            pixCity = pixCity.ifBlank { "SAO PAULO" },
            initialAmountCents = index.find(pixGiftId)?.amountCents,
            transactionId = pixGiftId,
            language = language,
            onDismiss = { showPixDialog = false; pixGiftId = null },
            onNotify = notify,
        )
    }
    index.find(deleteTargetId)?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteTargetId = null },
            title = { Text(stringResource(R.string.confirm_delete)) },
            text = { Text(target.title) },
            confirmButton = {
                TextButton(onClick = {
                    deleteTargetId = null
                    val leaveScreen = destination?.hasRoute(EditorRoute::class) == true || destination?.hasRoute(DetailRoute::class) == true
                    model.delete(target.id) { if (leaveScreen) nav.popBackStack() }
                }) { Text(stringResource(R.string.delete), color = PlannerRose) }
            },
            dismissButton = { TextButton(onClick = { deleteTargetId = null }) { Text(stringResource(R.string.cancel)) } },
        )
    }
    index.find(inviteTemplateId)?.let { template ->
        InviteGuestDialog(
            template = template,
            index = index,
            attachmentId = inviteAttachmentId,
            onAttachment = { inviteAttachmentId = it },
            onDismiss = { inviteTemplateId = null },
            onWhatsApp = { guest, file ->
                inviteTemplateId = null
                if (file == null) {
                    if (openInviteWhatsApp(activity, template, guest)) pendingInvite = listOf(template.id, guest.id, "WHATSAPP")
                    else notify(genericError)
                } else model.prepareSharedFile(activity, file) { uri ->
                    val channel = shareInviteAttachment(activity, template, guest, file, uri, true)
                    if (channel != null) {
                        notify(recipientPrompt)
                        pendingInvite = listOf(template.id, guest.id, channel)
                    } else notify(genericError)
                }
            },
            onShare = { guest, file ->
                inviteTemplateId = null
                if (file == null) {
                    if (shareInviteText(activity, template, guest)) pendingInvite = listOf(template.id, guest.id, "SHARE")
                    else notify(genericError)
                } else model.prepareSharedFile(activity, file) { uri ->
                    val channel = shareInviteAttachment(activity, template, guest, file, uri, false)
                    if (channel != null) pendingInvite = listOf(template.id, guest.id, channel) else notify(genericError)
                }
            },
        )
    }
    pendingInvite?.let { (templateId, guestId, channel) ->
        AlertDialog(
            onDismissRequest = { pendingInvite = null },
            title = { Text(stringResource(R.string.sent_confirm)) },
            text = { Text("${index.find(guestId)?.title.orEmpty()}\n${stringResource(R.string.sent_warning)}") },
            confirmButton = {
                TextButton(onClick = {
                    model.confirmInvitationSent(templateId, guestId, channel)
                    pendingInvite = null
                }) { Text(stringResource(R.string.sent_confirm)) }
            },
            dismissButton = { TextButton(onClick = { pendingInvite = null }) { Text(stringResource(R.string.cancel)) } },
        )
    }
    guestImport?.let { preview ->
        AlertDialog(
            onDismissRequest = model::dismissGuestImport,
            title = { Text(stringResource(R.string.import_guests)) },
            text = { Text(plural(R.plurals.guest_import_preview_count, preview.guests.size, preview.guests.size, preview.source)) },
            confirmButton = { TextButton(onClick = model::commitGuestImport) { Text(stringResource(R.string.import_guests)) } },
            dismissButton = { TextButton(onClick = model::dismissGuestImport) { Text(stringResource(R.string.cancel)) } },
        )
    }
    if (installments) {
        InstallmentsDialog(
            index = index,
            currency = currency,
            language = language,
            onDismiss = { installments = false },
            onSave = { plan ->
                model.createInstallments(plan)
                installments = false
            },
        )
    }
    index.find(statusVendorId)?.let { vendor ->
        val budgets = index.children(vendor.id, Kinds.BUDGET)
        VendorStatusDialog(vendor, language, budgets.sumOf { it.estimatedCents ?: 0L }.takeIf { budgets.isNotEmpty() },
            needsActual = budgets.none { it.amountCents != null }, onDismiss = { statusVendorId = null }) { status, actual ->
            model.setVendorStatus(vendor.id, status, actual)
            statusVendorId = null
        }
    }
    index.find(signContractId)?.let { contract ->
        ContractSignDialog(contract, onDismiss = { signContractId = null }) { method, date ->
            model.signContract(contract.id, method, date)
            signContractId = null
        }
    }
    pendingFile?.let { uri ->
        val owner = pendingFileOwner
        val name = remember(uri) {
            runCatching {
                activity.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)
                    ?.use { if (it.moveToFirst()) it.getString(0) else null }
            }.getOrNull()
        }
        AttachmentKindDialog(name, onDismiss = { pendingFile = null; pendingFileOwner = null }) { kind ->
            if (owner != null) model.addAttachment(activity, owner, uri, kind)
            pendingFile = null
            pendingFileOwner = null
        }
    }
    index.find(postGiftId)?.let { gift ->
        GiftPostDialog(gift, index, currency, language, onDismiss = { postGiftId = null }) { target, name, date, notes ->
            model.convertGift(gift.id, target, name, date, notes)
            postGiftId = null
        }
    }
    index.find(membersGroupId)?.let { group ->
        GroupMembersDialog(group, index, onDismiss = { membersGroupId = null }) { ids ->
            model.setGroupMembers(group.id, ids)
            membersGroupId = null
        }
    }
    if (splitPayment) {
        SplitPaymentDialog(
            index = index,
            language = language,
            onDismiss = { splitPayment = false },
            onSave = { vendorId, name, deposit, depositMethod, balance, due, balanceMethod ->
                model.createSplitPayment(vendorId, name, deposit, depositMethod, balance, due, balanceMethod)
                splitPayment = false
            },
        )
    }
}

@Composable
private fun screenTitle(destination: NavDestination?, dynamic: String?, moduleKind: String?): String {
    val module = modules.firstOrNull { it.kind == moduleKind }
    val resource = when {
        destination == null || destination.hasRoute(DashboardRoute::class) -> R.string.dashboard
        destination.hasRoute(MoreRoute::class) -> R.string.more
        destination.hasRoute(SettingsRoute::class) -> R.string.settings
        destination.hasRoute(InsightsRoute::class) -> R.string.insights
        destination.hasRoute(ReportsRoute::class) -> R.string.reports
        destination.hasRoute(HelpRoute::class) -> R.string.help
        destination.hasRoute(AuditRoute::class) -> R.string.audit
        destination.hasRoute(TrashRoute::class) -> R.string.trash
        destination.hasRoute(VendorCompareRoute::class) -> R.string.vendor_compare
        destination.hasRoute(WeddingDayRoute::class) -> R.string.wedding_day
        destination.hasRoute(BackupRoute::class) -> R.string.backup
        module != null -> module.title
        else -> null
    }
    return dynamic ?: resource?.let { stringResource(it) } ?: stringResource(R.string.app_name)
}

@Composable
private fun InviteGuestDialog(
    template: PlannerRecord,
    index: RecordIndex,
    attachmentId: String?,
    onAttachment: (String?) -> Unit,
    onDismiss: () -> Unit,
    onWhatsApp: (PlannerRecord, PlannerFile?) -> Unit,
    onShare: (PlannerRecord, PlannerFile?) -> Unit,
) {
    val templateFiles = index.files(template.id).filter { it.deletedAt == null }.sortedByDescending { it.createdAt }
    val selectedFile = templateFiles.firstOrNull { it.id == attachmentId }
    var query by rememberSaveable { mutableStateOf("") }
    var onlyPending by rememberSaveable { mutableStateOf(true) }
    val logKind = if (template.kind == Kinds.INVITATION) "invitation_log" else "save_the_date_log"
    val sentGuestIds = remember(index, template.id) {
        index.children(template.id).filter { it.kind == logKind }
            .mapNotNull { index.extra(it).optString("guestId").takeIf(String::isNotBlank) }.toSet()
    }
    val guests = index.kind(Kinds.GUEST)
        .filter { (!onlyPending || it.id !in sentGuestIds) && (query.isBlank() || it.title.contains(query, ignoreCase = true)) }
        .sortedBy { it.title.lowercase() }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.choose_guest)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (templateFiles.isNotEmpty()) {
                    Text(stringResource(R.string.invite_attachment), style = MaterialTheme.typography.labelLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(selected = selectedFile == null, onClick = { onAttachment(null) },
                            label = { Text(stringResource(R.string.no_attachment)) })
                        templateFiles.forEach { file ->
                            FilterChip(selected = selectedFile?.id == file.id, onClick = { onAttachment(file.id) },
                                label = { Text(file.fileName, maxLines = 1) })
                        }
                    }
                }
                EditorTextField(query, { query = it }, stringResource(R.string.search), null)
                ToggleChip(stringResource(R.string.only_not_sent), onlyPending) { onlyPending = it }
                LazyColumn(Modifier.heightIn(max = 320.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (guests.isEmpty()) item { Text(stringResource(R.string.empty_filtered), color = PlannerMuted) }
                    items(guests, key = { it.id }) { guest ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                            border = BorderStroke(1.dp, PlannerBorder),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(guest.title, fontWeight = FontWeight.SemiBold)
                                if (guest.id in sentGuestIds) InfoBadge(stringResource(R.string.status_sent), PlannerEmerald)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    if (guest.phone.isNotBlank()) {
                                        TextButton(onClick = { onWhatsApp(guest, selectedFile) }) { Text(stringResource(R.string.share_whatsapp)) }
                                    }
                                    TextButton(onClick = { onShare(guest, selectedFile) }) {
                                        Text(stringResource(if (selectedFile != null) R.string.share_with_attachment else R.string.share_text))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}
