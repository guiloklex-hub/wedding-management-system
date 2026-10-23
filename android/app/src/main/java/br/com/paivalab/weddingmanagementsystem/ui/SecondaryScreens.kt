package br.com.paivalab.weddingmanagementsystem.ui

import android.app.Activity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.TextButton
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import br.com.paivalab.weddingmanagementsystem.data.ExtraFields
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.FinanceRules
import br.com.paivalab.weddingmanagementsystem.data.GuestDemographics
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerAudit
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.ReportExport
import br.com.paivalab.weddingmanagementsystem.data.RiskRadar
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.roundToInt
import org.json.JSONObject

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun VendorCompareScreen(records: List<PlannerRecord>, language: String, currency: String) {
    val active = records.filter { it.deletedAt == null }
    val vendors = active.filter { it.kind == Kinds.VENDOR }
        .sortedWith(compareBy({ it.subtitle.lowercase() }, { it.title.lowercase() }))
    val totalPlanned = FinanceRules.budgetEstimated(active)
    val totalActual = FinanceRules.budgetActual(active)
    val totalDiff = totalActual - totalPlanned
    // Como na web: escolha de 2 a 4 fornecedores; sem escolha, todos aparecem.
    var selected by rememberSaveable { mutableStateOf(emptyList<String>()) }
    val shown = if (selected.size >= 2) vendors.filter { it.id in selected } else vendors

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerChampagne.copy(alpha = 0.28f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(localized(R.string.vendor_compare, language), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column {
                            Text(localized(R.string.report_estimated, language), style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                            Text(localizedCurrency(totalPlanned, currency, language), color = PlannerChampagne, fontWeight = FontWeight.SemiBold)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(localized(R.string.budget_actual, language), style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                            Text(
                                localizedCurrency(totalActual, currency, language),
                                color = if (totalDiff <= 0L) PlannerEmerald else PlannerRose,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                    val diffLabel = if (totalDiff <= 0L) stringResource(R.string.compare_saving_total, localizedCurrency(-totalDiff, currency, language))
                    else stringResource(R.string.compare_overrun_total, localizedCurrency(totalDiff, currency, language))
                    InfoBadge(diffLabel, if (totalDiff <= 0L) PlannerEmerald else PlannerRose)
                }
            }
        }
        if (vendors.size > 2) item {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(stringResource(R.string.compare_pick, selected.size), style = MaterialTheme.typography.labelLarge)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    vendors.forEach { vendor ->
                        val checked = vendor.id in selected
                        FilterChip(
                            selected = checked,
                            enabled = checked || selected.size < 4,
                            onClick = { selected = if (checked) selected - vendor.id else selected + vendor.id },
                            label = { Text(vendor.title) },
                        )
                    }
                }
            }
        }
        if (vendors.isEmpty()) item { Text(localized(R.string.empty, language)) }
        items(shown.size) { index ->
            val vendor = shown[index]
            val budgets = active.filter { it.kind == Kinds.BUDGET && it.parentId == vendor.id }
            val payments = active.filter { it.kind == Kinds.PAYMENT && it.parentId == vendor.id }
            val planned = FinanceRules.budgetEstimated(budgets)
            val actual = FinanceRules.budgetActual(budgets)
            val paid = payments.filter { it.status == "PAID" }.sumOf { it.amountCents ?: 0L }
            val diff = actual - planned
            val rating = ExtraFields.int(ExtraFields.parse(vendor.extraJson), "rating") ?: 0
            val paidRatio = if (actual <= 0L) 0f else (paid.toFloat() / actual.toFloat()).coerceIn(0f, 1f)

            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(vendor.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            if (vendor.subtitle.isNotBlank()) Text(vendor.subtitle, color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
                        }
                        if (vendor.status.isNotBlank()) StatusBadge(vendor.status, language)
                    }
                    if (rating in 1..5) {
                        val ratingDescription = stringResource(R.string.rating_value, rating)
                        Text("★".repeat(rating) + "☆".repeat(5 - rating), color = PlannerChampagne, style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium, modifier = Modifier.semantics { contentDescription = ratingDescription })
                    }
                    HorizontalDivider(color = PlannerBorder)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column {
                            Text(localized(R.string.report_estimated, language), style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                            Text(localizedCurrency(planned, currency, language), style = MaterialTheme.typography.bodyMedium)
                        }
                        Column {
                            Text(localized(R.string.budget_actual, language), style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                            Text(
                                localizedCurrency(actual, currency, language),
                                color = if (diff <= 0L) PlannerEmerald else PlannerRose,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(localized(R.string.total_paid, language), style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                            Text(localizedCurrency(paid, currency, language), color = PlannerEmerald, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        val deltaText = when {
                            planned == 0L && actual == 0L -> stringResource(R.string.compare_no_budget)
                            diff < 0L -> stringResource(R.string.summary_saving, localizedCurrency(-diff, currency, language))
                            diff > 0L -> stringResource(R.string.summary_overrun, localizedCurrency(diff, currency, language))
                            else -> stringResource(R.string.compare_on_target)
                        }
                        InfoBadge(deltaText, if (diff <= 0L) PlannerEmerald else PlannerRose)
                        Text(stringResource(R.string.percent_paid, (paidRatio * 100).roundToInt()), style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                    }
                    PlannerProgressBar(paidRatio, PlannerEmerald, 8.dp)
                    val extra = ExtraFields.parse(vendor.extraJson)
                    Text(stringResource(R.string.compare_balance, localizedCurrency(actual - paid, currency, language)),
                        style = MaterialTheme.typography.bodySmall)
                    ExtraFields.text(extra, "indicatedBy").takeIf { it.isNotBlank() }?.let {
                        Text("${stringResource(R.string.indicated_by)}: $it", style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                    }
                    ExtraFields.text(extra, "tags").takeIf { it.isNotBlank() }?.let {
                        Text("${stringResource(R.string.tags)}: $it", style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                    }
                    val children = active.filter { it.parentId == vendor.id }
                    Text(stringResource(R.string.compare_counts, children.count { it.kind == Kinds.CONTACT },
                        children.count { it.kind == Kinds.VENDOR_NOTE }, children.count { it.kind == Kinds.CONTRACT }),
                        style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(
    model: PlannerViewModel,
    language: String,
    currency: String,
    authenticate: ((() -> Unit)?) -> Unit,
    onExportCalendar: () -> Unit,
    onLoadDemoSeed: () -> Unit = {},
    onNotify: (String) -> Unit = {},
    navigate: (String) -> Unit,
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val storedCouple by model.coupleNames.collectAsState()
    val storedDate by model.eventDate.collectAsState()
    val storedContingency by model.contingencyPercent.collectAsState()
    val storedPixKey by model.pixKey.collectAsState()
    val storedPixHolder by model.pixHolderName.collectAsState()
    val storedPixCity by model.pixCity.collectAsState()
    var names by remember(storedCouple) { mutableStateOf(storedCouple) }
    var date by remember(storedDate) { mutableStateOf(storedDate) }
    var contingencyText by remember(storedContingency) { mutableStateOf(storedContingency.toString()) }
    var pixKey by remember(storedPixKey) { mutableStateOf(storedPixKey) }
    var pixHolder by remember(storedPixHolder) { mutableStateOf(storedPixHolder) }
    var pixCity by remember(storedPixCity) { mutableStateOf(storedPixCity) }
    var showPixDialog by remember { mutableStateOf(false) }
    val savedEventMessage = stringResource(R.string.msg_event_saved)
    val savedPixMessage = stringResource(R.string.msg_pix_saved)
    var confirmDemo by remember { mutableStateOf(false) }
    val records by model.records.collectAsState()

    if (confirmDemo) {
        AlertDialog(
            onDismissRequest = { confirmDemo = false },
            text = { Text(localized(R.string.demo_seed_confirm, language)) },
            confirmButton = {
                TextButton(onClick = {
                    confirmDemo = false
                    onLoadDemoSeed()
                    onNotify(localizedText(context, R.string.demo_seed_loaded, language))
                }) { Text(localized(R.string.demo_seed_button, language)) }
            },
            dismissButton = { TextButton(onClick = { confirmDemo = false }) { Text(localized(R.string.cancel, language)) } },
        )
    }

    if (showPixDialog && activity != null) {
        PixQrDialog(
            activity = activity,
            pixKey = pixKey,
            pixHolderName = pixHolder,
            pixCity = pixCity,
            language = language,
            onDismiss = { showPixDialog = false },
            onNotify = onNotify,
        )
    }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(localized(R.string.wedding_day, language), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerChampagne)
                    OutlinedTextField(names, { names = it }, label = { Text(localized(R.string.couple_names, language)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    DatePickerOutlinedField(
                        value = date,
                        onValueChange = { date = it },
                        label = localized(R.string.event_date, language),
                    )
                    OutlinedTextField(
                        value = contingencyText,
                        onValueChange = { contingencyText = it.filter { ch -> ch.isDigit() }.take(2) },
                        label = { Text(stringResource(R.string.contingency_percent)) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Button(
                        onClick = {
                            val normalized = normalizeDateInput(date)
                            val pct = contingencyText.toIntOrNull()?.coerceIn(0, 50) ?: 10
                            date = normalized
                            model.saveEvent(names, normalized, pct)
                            onNotify(savedEventMessage)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(localized(R.string.save, language)) }
                }
            }
        }
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(stringResource(R.string.pix_settings_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerChampagne)
                    OutlinedTextField(pixKey, { pixKey = it.take(120) }, label = { Text(localized(R.string.pix_key, language)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(pixHolder, { pixHolder = it.take(120) }, label = { Text(localized(R.string.pix_holder, language)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(pixCity, { pixCity = it.take(40) }, label = { Text(stringResource(R.string.pix_city)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Text(localized(R.string.pix_manual_warning, language), color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                model.savePix(pixKey, pixHolder, pixCity)
                                onNotify(savedPixMessage)
                            },
                            modifier = Modifier.weight(1f),
                        ) { Text(localized(R.string.save, language)) }
                        OutlinedButton(
                            onClick = { showPixDialog = true },
                            modifier = Modifier.weight(1f),
                        ) { Text(stringResource(R.string.view_qr_code)) }
                    }
                }
            }
        }
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(localized(R.string.language, language), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        languageOptions.forEach { (option, label) ->
                            FilterChip(selected = language == option, onClick = { model.setLocale(option) }, label = { Text(label) })
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(localized(R.string.currency, language), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        currencyOptions.forEach { (option, label) ->
                            FilterChip(selected = currency == option, onClick = { model.setCurrency(option) }, label = { Text(label) })
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    val themeMode by model.themeMode.collectAsState()
                    Text(localized(R.string.theme, language), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("system" to R.string.theme_system, "light" to R.string.theme_light, "dark" to R.string.theme_dark).forEach { (option, label) ->
                            FilterChip(selected = themeMode == option, onClick = { model.setThemeMode(option) }, label = { Text(localized(label, language)) })
                        }
                    }
                }
            }
        }
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(stringResource(R.string.settings_security_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerChampagne)
                    Button(onClick = { navigate("backup") }, modifier = Modifier.fillMaxWidth()) {
                        Text(localized(R.string.backup, language))
                    }
                    OutlinedButton(onClick = onExportCalendar, modifier = Modifier.fillMaxWidth()) {
                        Text(localized(R.string.export_calendar, language))
                    }
                    OutlinedButton(onClick = { authenticate(null) }, modifier = Modifier.fillMaxWidth()) {
                        Text(localized(R.string.unlock_button, language))
                    }
                    if (records.isEmpty()) {
                        OutlinedButton(onClick = { confirmDemo = true }, modifier = Modifier.fillMaxWidth()) {
                            Text(localized(R.string.demo_seed_button, language))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun HelpScreen(language: String) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(localized(R.string.help_mobile_details_title, language), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerChampagne)
                    Text(localized(R.string.help_mobile_details_body, language), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(localized(R.string.help_mobile_share_title, language), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerRose)
                    Text(localized(R.string.help_mobile_share_body, language), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerChampagne.copy(alpha = 0.28f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.help_private_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerChampagne)
                    Text(localized(R.string.help_body, language), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.help_invites_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerRose)
                    Text(localized(R.string.web_rsvp_warning, language), style = MaterialTheme.typography.bodyMedium, color = PlannerMuted)
                }
            }
        }
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.help_backup_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerEmerald)
                    Text(
                        stringResource(R.string.help_backup_body),
                        style = MaterialTheme.typography.bodyMedium,
                        color = PlannerMuted,
                    )
                }
            }
        }
    }
}

@Composable
fun AuditScreen(audits: List<PlannerAudit>, records: List<PlannerRecord>, language: String) {
    val names = remember(records) { records.associate { it.id to it.title } }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (audits.isEmpty()) item { Text(localized(R.string.empty, language)) }
        items(audits.size) { index ->
            val audit = audits[index]
            val label = auditLabel(audit.action, language)
            val recordTitle = names[audit.recordId].orEmpty()
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(label, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleSmall, color = PlannerChampagne)
                        Text(formatTimestamp(audit.at, language), style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                    }
                    if (recordTitle.isNotBlank()) Text(recordTitle, style = MaterialTheme.typography.bodyMedium)
                    if (audit.details.isNotBlank() && audit.details != recordTitle) {
                        Text(audit.details, style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                    }
                }
            }
        }
    }
}

@Composable
fun auditLabel(action: String, language: String): String {
    return when (action) {
        "SAVE" -> localized(R.string.audit_save, language)
        "DELETE" -> localized(R.string.audit_delete, language)
        "STATUS" -> localized(R.string.audit_status, language)
        "MARK_PAID" -> localized(R.string.audit_paid, language)
        "UNDO_PAID" -> stringResource(R.string.audit_undo_paid)
        "GIFT_THANKED" -> stringResource(R.string.audit_gift_thanked)
        "SIGN_CONTRACT" -> stringResource(R.string.audit_contract_signed)
        "GIFT_UNTHANKED" -> stringResource(R.string.audit_gift_unthanked)
        "GROUP_MEMBERS" -> stringResource(R.string.audit_group_members)
        "CHECK_IN_UNDONE" -> stringResource(R.string.audit_check_in_undone)
        "CREATE_SPLIT_PAYMENT" -> stringResource(R.string.audit_split_payment)
        "ADD_FILE" -> localized(R.string.audit_file, language)
        "IMPORT_GUESTS" -> localized(R.string.audit_import, language)
        "SEED_TASK_TEMPLATES" -> stringResource(R.string.audit_task_templates)
        "CREATE_INSTALLMENTS" -> stringResource(R.string.audit_installments)
        "SETTING" -> stringResource(R.string.audit_setting)
        "CONVERT_TO_FINANCE" -> stringResource(R.string.audit_gift_posted)
        "ASSIGN_TABLE" -> stringResource(R.string.audit_assign_table)
        "SEED_DEMO" -> stringResource(R.string.audit_demo)
        "CHECK_IN" -> stringResource(R.string.audit_check_in)
        "GROUP_RSVP" -> stringResource(R.string.audit_group_rsvp)
        "UNDO" -> stringResource(R.string.audit_undo)
        "RESTORE" -> stringResource(R.string.audit_restore)
        "CONFIRM_SENT", "CONFIRM_INVITE" -> localized(R.string.audit_invite_sent, language)
        "SEED_VENUE_CHECKLIST" -> localized(R.string.audit_venue_checklist, language)
        else -> action.replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() }
    }
}
