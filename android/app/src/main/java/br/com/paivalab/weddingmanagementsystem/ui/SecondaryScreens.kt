package br.com.paivalab.weddingmanagementsystem.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerAudit
import br.com.paivalab.weddingmanagementsystem.data.FinanceRules
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.ReportExport
import java.time.LocalDate
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import org.json.JSONObject

@Composable
fun VendorCompareScreen(records: List<PlannerRecord>, language: String, currency: String) {
    val active = records.filter { it.deletedAt == null }
    val vendors = active.filter { it.kind == Kinds.VENDOR }
        .sortedWith(compareBy({ it.subtitle.lowercase() }, { it.title.lowercase() }))
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (vendors.isEmpty()) item { Text(localized(R.string.empty, language)) }
        items(vendors.size) { index ->
            val vendor = vendors[index]
            val budgets = active.filter { it.kind == Kinds.BUDGET && it.parentId == vendor.id }
            val payments = active.filter { it.kind == Kinds.PAYMENT && it.parentId == vendor.id }
            val planned = budgets.sumOf { it.estimatedCents ?: 0L }
            val actual = budgets.sumOf { it.amountCents ?: 0L }
            val paid = payments.filter { it.status == "PAID" }.sumOf { it.amountCents ?: 0L }
            val rating = runCatching { JSONObject(vendor.extraJson).optInt("rating", 0) }.getOrDefault(0)
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(vendor.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    if (vendor.subtitle.isNotBlank()) Text("${localized(R.string.category, language)}: ${vendor.subtitle}")
                    if (vendor.status.isNotBlank()) Text(statusLabel(vendor.status, language), color = PlannerRose)
                    if (rating in 1..5) Text("${localized(R.string.rating, language)}: $rating / 5")
                    Text("${localized(R.string.report_estimated, language)}: ${localizedCurrency(planned, currency, language)}")
                    Text("${localized(R.string.budget_actual, language)}: ${localizedCurrency(actual, currency, language)}")
                    Text("${localized(R.string.total_paid, language)}: ${localizedCurrency(paid, currency, language)}")
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(model: PlannerViewModel, language: String, currency: String,
                   authenticate: ((() -> Unit)?) -> Unit, onExportCalendar: () -> Unit,
                   navigate: (String) -> Unit) {
    val storedCouple by model.coupleNames.collectAsState()
    val storedDate by model.eventDate.collectAsState()
    val storedPixKey by model.pixKey.collectAsState()
    val storedPixHolder by model.pixHolderName.collectAsState()
    var names by remember(storedCouple) { mutableStateOf(storedCouple) }
    var date by remember(storedDate) { mutableStateOf(storedDate) }
    var pixKey by remember(storedPixKey) { mutableStateOf(storedPixKey) }
    var pixHolder by remember(storedPixHolder) { mutableStateOf(storedPixHolder) }
    LazyColumn(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { Text(localized(R.string.wedding_day, language), style = MaterialTheme.typography.titleLarge) }
        item { OutlinedTextField(names, { names = it }, label = { Text(localized(R.string.couple_names, language)) }, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(date, { date = it }, label = { Text(localized(R.string.event_date, language)) }, modifier = Modifier.fillMaxWidth()) }
        item { Button(onClick = { model.saveEvent(names, date) }) { Text(localized(R.string.save, language)) } }
        item { Text(localized(R.string.pix_static, language), style = MaterialTheme.typography.titleLarge) }
        item { OutlinedTextField(pixKey, { pixKey = it.take(120) }, label = { Text(localized(R.string.pix_key, language)) }, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(pixHolder, { pixHolder = it.take(120) }, label = { Text(localized(R.string.pix_holder, language)) }, modifier = Modifier.fillMaxWidth()) }
        item { Button(onClick = { model.savePix(pixKey, pixHolder) }) { Text(localized(R.string.save, language)) } }
        item { Text(localized(R.string.pix_manual_warning, language), color = PlannerChampagne) }
        item { Text(localized(R.string.language, language), style = MaterialTheme.typography.titleLarge) }
        item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("pt-BR", "en", "es").forEach { option ->
                FilterChip(selected = language == option, onClick = { model.setLocale(option) }, label = { Text(option) })
            }
        } }
        item { Text(localized(R.string.currency, language), style = MaterialTheme.typography.titleLarge) }
        item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("BRL", "USD", "EUR").forEach { option ->
                FilterChip(selected = currency == option, onClick = { model.setCurrency(option) }, label = { Text(option) })
            }
        } }
        item { Button(onClick = { authenticate(null) }) { Text(localized(R.string.unlock_button, language)) } }
        item { Button(onClick = { navigate("backup") }) { Text(localized(R.string.backup, language)) } }
        item { Button(onClick = onExportCalendar) { Text(localized(R.string.export_calendar, language)) } }
    }
}

@Composable
fun InsightsScreen(records: List<PlannerRecord>, language: String, currency: String, eventDate: String) {
    val context = LocalContext.current
    var reportError by remember { mutableStateOf(false) }
    val headers = listOf(R.string.report_type, R.string.title, R.string.amount, R.string.report_estimated,
        R.string.date, R.string.status, R.string.notes).map { localized(it, language) }
    val kindNames = modules.associate { it.kind to localized(it.title, language) }
    val reportFile = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) reportError = runCatching {
            context.contentResolver.openOutputStream(uri, "w")?.use { output ->
                output.write(ReportExport.generate(records, headers, kindNames))
            } ?: error("Destino indisponível")
        }.isFailure
    }
    val active = records.filter { it.deletedAt == null }
    val expected = active.filter { it.kind == Kinds.BUDGET }.sumOf { it.estimatedCents ?: it.amountCents ?: 0 }
    val contracted = active.count { it.kind == Kinds.VENDOR && it.status in setOf("CONTRACTED", "FINALIZED") }
    val vendors = active.count { it.kind == Kinds.VENDOR }
    val paymentTotal = active.count { it.kind == Kinds.PAYMENT }
    val paid = active.count { it.kind == Kinds.PAYMENT && it.status == "PAID" }
    val paidCents = active.filter { it.kind == Kinds.PAYMENT && it.status == "PAID" }.sumOf { it.amountCents ?: 0 }
    val tasks = active.count { it.kind == Kinds.TASK }
    val done = active.count { it.kind == Kinds.TASK && it.status == "DONE" }
    val bars = listOf(
        Triple(localized(R.string.vendors, language), contracted, vendors),
        Triple(localized(R.string.payments, language), paid, paymentTotal),
        Triple(localized(R.string.tasks, language), done, tasks),
    )
    val today = LocalDate.now()
    val wedding = runCatching { LocalDate.parse(eventDate) }.getOrNull()
    val cashflow = wedding?.let { FinanceRules.monthlyCashflow(active, it, today) }.orEmpty()
    val budgetItems = active.filter { it.kind == Kinds.BUDGET }
    val contractedIds = active.filter { it.kind == Kinds.VENDOR && it.status in setOf("CONTRACTED", "FINALIZED") }.map { it.id }.toSet()
    val score = wedding?.let {
        FinanceRules.healthScore(expected, budgetItems.filter { item -> item.parentId in contractedIds }.sumOf { item -> item.amountCents ?: item.estimatedCents ?: 0 },
            paidCents, active.filter { item -> item.kind == Kinds.ASSET }.sumOf { item -> item.amountCents ?: 0 },
            ChronoUnit.DAYS.between(today, it), tasks, done,
            active.count { item -> item.kind == Kinds.TASK && item.status != "DONE" && item.date?.let { date -> date < today.toString() } == true },
            cashflow.minOfOrNull { point -> point.endingCents } ?: 0)
    }
    LazyColumn(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Button(onClick = { reportFile.launch("wedding-report-${LocalDate.now()}.csv") }) {
            Text(localized(R.string.export_report, language))
        } }
        if (reportError) item { Text(localized(R.string.error_generic, language), color = MaterialTheme.colorScheme.error) }
        item { Text(localizedCurrency(expected, currency, language), color = PlannerChampagne,
            style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold) }
        if (score != null) item {
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp)) {
                Text(localized(R.string.health_score, language), style = MaterialTheme.typography.titleMedium)
                Text("$score / 100", color = PlannerRose, style = MaterialTheme.typography.headlineLarge)
            } }
        }
        items(bars.size) { index ->
            val (label, current, total) = bars[index]
            val ratio = if (total <= 0) 0f else (current.toFloat() / total).coerceIn(0f, 1f)
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("$label · $current / $total")
                    Canvas(Modifier.fillMaxWidth().height(12.dp)) {
                        drawRoundRect(Color.DarkGray)
                        drawRoundRect(PlannerRose, size = androidx.compose.ui.geometry.Size(size.width * ratio, size.height))
                    }
                }
            }
        }
        if (cashflow.isNotEmpty()) item { Text(localized(R.string.cashflow, language), style = MaterialTheme.typography.titleLarge) }
        items(cashflow.size) { index ->
            val point = cashflow[index]
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) {
                Text(point.month.toString(), fontWeight = FontWeight.Bold)
                Text(localizedCurrency(point.endingCents, currency, language),
                    color = if (point.negative) Color(0xFFF87171) else PlannerChampagne)
            } }
        }
    }
}

@Composable
fun HelpScreen(language: String) {
    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(localized(R.string.help_body, language), style = MaterialTheme.typography.bodyLarge)
        Text(localized(R.string.web_rsvp_warning, language), color = PlannerChampagne)
    }
}

@Composable
fun AuditScreen(audits: List<PlannerAudit>, records: List<PlannerRecord>, language: String) {
    val names = records.associate { it.id to it.title }
    val formatter = remember { DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm") }
    LazyColumn(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (audits.isEmpty()) item { Text(localized(R.string.empty, language)) }
        items(audits.size) { index ->
            val audit = audits[index]
            val action = when (audit.action) {
                "SAVE" -> localized(R.string.audit_save, language)
                "DELETE" -> localized(R.string.audit_delete, language)
                "STATUS" -> localized(R.string.audit_status, language)
                "MARK_PAID" -> localized(R.string.audit_paid, language)
                "ADD_FILE" -> localized(R.string.audit_file, language)
                "IMPORT_GUESTS" -> localized(R.string.audit_import, language)
                else -> audit.action.replace('_', ' ')
            }
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp)) {
                Text(action, color = PlannerRose, style = MaterialTheme.typography.titleMedium)
                Text(names[audit.recordId] ?: audit.details.ifBlank { localized(R.string.app_name, language) })
                Text(Instant.ofEpochMilli(audit.at).atZone(ZoneId.systemDefault()).format(formatter),
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            } }
        }
    }
}
