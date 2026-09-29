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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
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

@Composable
fun VendorCompareScreen(records: List<PlannerRecord>, language: String, currency: String) {
    val active = records.filter { it.deletedAt == null }
    val vendors = active.filter { it.kind == Kinds.VENDOR }
        .sortedWith(compareBy({ it.subtitle.lowercase() }, { it.title.lowercase() }))
    val totalPlanned = active.filter { it.kind == Kinds.BUDGET }.sumOf { it.estimatedCents ?: 0L }
    val totalActual = active.filter { it.kind == Kinds.BUDGET }.sumOf { it.amountCents ?: 0L }
    val totalDiff = totalActual - totalPlanned

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
                    val diffLabel = if (totalDiff <= 0L) "Economia acumulada: ${localizedCurrency(-totalDiff, currency, language)}"
                    else "Excedente sobre o estimado: +${localizedCurrency(totalDiff, currency, language)}"
                    InfoBadge(diffLabel, if (totalDiff <= 0L) PlannerEmerald else PlannerRose)
                }
            }
        }
        if (vendors.isEmpty()) item { Text(localized(R.string.empty, language)) }
        items(vendors.size) { index ->
            val vendor = vendors[index]
            val budgets = active.filter { it.kind == Kinds.BUDGET && it.parentId == vendor.id }
            val payments = active.filter { it.kind == Kinds.PAYMENT && it.parentId == vendor.id }
            val planned = budgets.sumOf { it.estimatedCents ?: 0L }
            val actual = budgets.sumOf { it.amountCents ?: 0L }
            val paid = payments.filter { it.status == "PAID" }.sumOf { it.amountCents ?: 0L }
            val diff = actual - planned
            val rating = runCatching { JSONObject(vendor.extraJson).optInt("rating", 0) }.getOrDefault(0)
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
                        val stars = "★".repeat(rating) + "☆".repeat(5 - rating)
                        Text("$stars  ($rating/5)", color = PlannerChampagne, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
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
                            planned == 0L && actual == 0L -> "Sem orçamento vinculado"
                            diff < 0L -> "Economia: -${localizedCurrency(-diff, currency, language)}"
                            diff > 0L -> "Acima: +${localizedCurrency(diff, currency, language)}"
                            else -> "Dentro da meta"
                        }
                        InfoBadge(deltaText, if (diff <= 0L) PlannerEmerald else PlannerRose)
                        Text("${(paidRatio * 100).roundToInt()}% quitado", style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                    }
                    Canvas(Modifier.fillMaxWidth().height(8.dp)) {
                        val radius = CornerRadius(4.dp.toPx(), 4.dp.toPx())
                        drawRoundRect(Color(0xFF27272A), cornerRadius = radius)
                        drawRoundRect(PlannerEmerald, size = Size(size.width * paidRatio, size.height), cornerRadius = radius)
                    }
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

    if (showPixDialog && activity != null) {
        PixQrDialog(
            activity = activity,
            pixKey = pixKey,
            pixHolderName = pixHolder,
            pixCity = pixCity,
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
                        label = { Text("Reserva de contingência recomendada (%)") },
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
                            onNotify("Dados do casamento e contingência ($pct%) salvos!")
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
                    Text("Pix EMV (Copia e Cola + QR Code)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerChampagne)
                    OutlinedTextField(pixKey, { pixKey = it.take(120) }, label = { Text(localized(R.string.pix_key, language)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(pixHolder, { pixHolder = it.take(120) }, label = { Text(localized(R.string.pix_holder, language)) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(pixCity, { pixCity = it.take(40) }, label = { Text("Cidade do titular (para BR Code EMV)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Text(localized(R.string.pix_manual_warning, language), color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                model.savePix(pixKey, pixHolder, pixCity)
                                onNotify("Configuração Pix EMV salva!")
                            },
                            modifier = Modifier.weight(1f),
                        ) { Text(localized(R.string.save, language)) }
                        OutlinedButton(
                            onClick = { showPixDialog = true },
                            modifier = Modifier.weight(1f),
                        ) { Text("Ver QR Code") }
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
                        listOf("pt-BR" to "Português (BR)", "en" to "English", "es" to "Español").forEach { (option, label) ->
                            FilterChip(selected = language == option, onClick = { model.setLocale(option) }, label = { Text(label) })
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(localized(R.string.currency, language), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("BRL" to "R$ (BRL)", "USD" to "US$ (USD)", "EUR" to "€ (EUR)").forEach { (option, label) ->
                            FilterChip(selected = currency == option, onClick = { model.setCurrency(option) }, label = { Text(label) })
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
                    Text("Segurança, Backup & Dados", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerChampagne)
                    Button(onClick = { navigate("backup") }, modifier = Modifier.fillMaxWidth()) {
                        Text(localized(R.string.backup, language))
                    }
                    OutlinedButton(onClick = onExportCalendar, modifier = Modifier.fillMaxWidth()) {
                        Text(localized(R.string.export_calendar, language))
                    }
                    OutlinedButton(onClick = { authenticate(null) }, modifier = Modifier.fillMaxWidth()) {
                        Text(localized(R.string.unlock_button, language))
                    }
                    OutlinedButton(
                        onClick = {
                            onLoadDemoSeed()
                            onNotify("Dados de demonstração (Seed) recarregados!")
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Recarregar dados de demonstração (Seed)")
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun InsightsScreen(
    records: List<PlannerRecord>,
    language: String,
    currency: String,
    eventDate: String,
    contingencyPercent: Int = 10,
    onNavigateSection: (String) -> Unit = {},
) {
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
    val expected = active.filter { it.kind == Kinds.BUDGET }.sumOf { it.estimatedCents ?: it.amountCents ?: 0L }
    val actualTotal = active.filter { it.kind == Kinds.BUDGET }.sumOf { it.amountCents ?: it.estimatedCents ?: 0L }
    val contingencyCents = (expected * contingencyPercent) / 100L
    val contracted = active.count { it.kind == Kinds.VENDOR && it.status in setOf("CONTRACTED", "FINALIZED") }
    val vendors = active.count { it.kind == Kinds.VENDOR }
    val negotiationCount = active.count { it.kind == Kinds.VENDOR && it.status == "NEGOTIATION" }
    val contractedOnlyCount = active.count { it.kind == Kinds.VENDOR && it.status == "CONTRACTED" }
    val finalizedCount = active.count { it.kind == Kinds.VENDOR && it.status == "FINALIZED" }
    val paymentTotal = active.count { it.kind == Kinds.PAYMENT }
    val paid = active.count { it.kind == Kinds.PAYMENT && it.status == "PAID" }
    val paidCents = active.filter { it.kind == Kinds.PAYMENT && it.status == "PAID" }.sumOf { it.amountCents ?: 0L }
    val tasks = active.count { it.kind == Kinds.TASK }
    val done = active.count { it.kind == Kinds.TASK && it.status == "DONE" }
    val bars = listOf(
        Triple(localized(R.string.vendors, language), contracted, vendors),
        Triple(localized(R.string.payments, language), paid, paymentTotal),
        Triple(localized(R.string.tasks, language), done, tasks),
    )
    val today = LocalDate.now()
    val wedding = runCatching { LocalDate.parse(eventDate) }.getOrNull()
    val daysToEvent = wedding?.let { ChronoUnit.DAYS.between(today, it) }
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
    val riskAlerts = remember(active, cashflow, daysToEvent, currency, language) {
        RiskRadar.compute(active, cashflow, daysToEvent, { cents -> localizedCurrency(cents, currency, language) }, today)
    }
    val demographics = remember(active) { GuestDemographics.analyze(active) }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerChampagne.copy(alpha = 0.28f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(localized(R.string.total_budget, language), color = PlannerMuted, style = MaterialTheme.typography.labelLarge)
                        InfoBadge("Contingência ($contingencyPercent%): ${localizedCurrency(contingencyCents, currency, language)}", PlannerChampagne)
                    }
                    Text(
                        localizedCurrency(expected, currency, language),
                        color = PlannerChampagne,
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${localized(R.string.budget_actual, language)}: ${localizedCurrency(actualTotal, currency, language)}", style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                        Text("${localized(R.string.total_paid, language)}: ${localizedCurrency(paidCents, currency, language)}", style = MaterialTheme.typography.bodySmall, color = PlannerEmerald, fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(4.dp))
                    Button(onClick = { reportFile.launch("wedding-report-${LocalDate.now()}.csv") }, modifier = Modifier.fillMaxWidth()) {
                        Text(localized(R.string.export_report, language))
                    }
                }
            }
        }
        if (reportError) item { Text(localized(R.string.error_generic, language), color = MaterialTheme.colorScheme.error) }
        if (score != null) item {
            val scoreColor = when {
                score >= 80 -> PlannerEmerald
                score >= 60 -> PlannerChampagne
                else -> PlannerRose
            }
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, scoreColor.copy(alpha = 0.35f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(Modifier.padding(18.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(localized(R.string.health_score, language), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        val statusDesc = when {
                            score >= 80 -> "Excelente equilíbrio financeiro e operacional"
                            score >= 60 -> "Planejamento saudável — atenção às próximas parcelas"
                            else -> "Atenção ao fluxo de caixa e tarefas pendentes"
                        }
                        Text(statusDesc, style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                    }
                    Text("$score / 100", color = scoreColor, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (riskAlerts.isNotEmpty()) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                    border = BorderStroke(1.dp, PlannerRose.copy(alpha = 0.40f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("⚠️ Radar de Riscos & Alertas", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerRose)
                            InfoBadge("${riskAlerts.size} alerta(s)", PlannerRose)
                        }
                        riskAlerts.forEach { alert ->
                            val accent = if (alert.severity == "HIGH") PlannerRose else PlannerChampagne
                            Card(
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E191D)),
                                border = BorderStroke(1.dp, accent.copy(alpha = 0.35f)),
                                modifier = Modifier.fillMaxWidth().clickable { onNavigateSection(alert.targetSection) },
                            ) {
                                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(alert.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = accent)
                                    Text(alert.body, style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                                }
                            }
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
                    Text("Funil de Fornecedores & Mapa do Buffet", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerChampagne)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        InfoBadge("Negociação: $negotiationCount", PlannerChampagne)
                        InfoBadge("Contratados: $contractedOnlyCount", PlannerEmerald)
                        InfoBadge("Finalizados: $finalizedCount", PlannerEmerald)
                    }
                    HorizontalDivider(color = PlannerBorder)
                    Text("Demografia de Convidados & Restrições Alimentares", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        InfoBadge("Confirmados: ${demographics.confirmedSeats} lugares", PlannerEmerald)
                        InfoBadge("Lado Noiva: ${demographics.brideSideCount}", PlannerRose)
                        InfoBadge("Lado Noivo: ${demographics.groomSideCount}", PlannerChampagne)
                        if (demographics.bothSideCount > 0) InfoBadge("Ambos: ${demographics.bothSideCount}", PlannerMuted)
                        if (demographics.vipCount > 0) InfoBadge("VIPs: ${demographics.vipCount}", PlannerChampagne)
                        if (demographics.padrinhosCount > 0) InfoBadge("Padrinhos: ${demographics.padrinhosCount}", PlannerEmerald)
                        if (demographics.childrenCount > 0) InfoBadge("Crianças: ${demographics.childrenCount}", PlannerMuted)
                    }
                    if (demographics.dietaryItems.isNotEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Restrições Alimentares para o Buffet (${demographics.dietaryItems.size}):", style = MaterialTheme.typography.labelSmall, color = PlannerChampagne)
                            demographics.dietaryItems.forEach { (guestName, restriction) ->
                                Text("🍽️ $guestName — $restriction", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        }

        items(bars.size) { index ->
            val (label, current, total) = bars[index]
            val ratio = if (total <= 0) 0f else (current.toFloat() / total).coerceIn(0f, 1f)
            val pct = (ratio * 100).roundToInt()
            val barColor = when {
                ratio >= 0.75f -> PlannerEmerald
                ratio >= 0.40f -> PlannerChampagne
                else -> PlannerRose
            }
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("$label · $current de $total", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        InfoBadge("$pct%", barColor)
                    }
                    Canvas(Modifier.fillMaxWidth().height(10.dp)) {
                        val radius = CornerRadius(5.dp.toPx(), 5.dp.toPx())
                        drawRoundRect(Color(0xFF27272A), cornerRadius = radius)
                        drawRoundRect(barColor, size = Size(size.width * ratio, size.height), cornerRadius = radius)
                    }
                }
            }
        }
        if (cashflow.isNotEmpty()) item {
            Text(localized(R.string.cashflow, language), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        items(cashflow.size) { index ->
            val point = cashflow[index]
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, if (point.negative) PlannerRose.copy(alpha = 0.4f) else PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(formatYearMonth(point.month.toString(), language), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            localizedCurrency(point.endingCents, currency, language),
                            color = if (point.negative) Color(0xFFF87171) else PlannerEmerald,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Entradas: +${localizedCurrency(point.incomeCents, currency, language)}", style = MaterialTheme.typography.bodySmall, color = PlannerEmerald)
                        Text("Saídas: -${localizedCurrency(point.outflowCents, currency, language)}", style = MaterialTheme.typography.bodySmall, color = PlannerRose)
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
                    Text("100% Privado & Offline no seu Smartphone", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerChampagne)
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
                    Text("Convites, RSVP & WhatsApp", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerRose)
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
                    Text("Backup Cifrado (.wfpbackup v2)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerEmerald)
                    Text(
                        "Seus backups são protegidos com PBKDF2-HMAC-SHA256 (600 mil iterações) e AES-256-GCM. Antes de qualquer restauração, o aplicativo salva automaticamente uma cópia de reversão no Android Keystore.",
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
            val label = when (audit.action) {
                "SAVE" -> localized(R.string.audit_save, language)
                "DELETE" -> localized(R.string.audit_delete, language)
                "STATUS" -> localized(R.string.audit_status, language)
                "MARK_PAID" -> localized(R.string.audit_paid, language)
                "ADD_FILE" -> localized(R.string.audit_file, language)
                "IMPORT_GUESTS" -> "Importação de lista de convidados"
                "SEED_TASK_TEMPLATES" -> "Modelos de tarefas adicionados"
                "CREATE_INSTALLMENTS" -> "Parcelamento financeiro gerado"
                "SETTING" -> "Configuração do evento atualizada"
                "CONVERT_TO_FINANCE" -> "Presente convertido em receita/caixa"
                "ASSIGN_TABLE" -> "Convidado alocado em mesa"
                "SEED_DEMO" -> "Dados de demonstração (Seed) carregados"
                "CHECK_IN" -> "Check-in de convidado no evento"
                "GROUP_RSVP" -> "RSVP do grupo atualizado"
                "CONFIRM_INVITE" -> "Envio de convite confirmado"
                else -> audit.action.replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() }
            }
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
