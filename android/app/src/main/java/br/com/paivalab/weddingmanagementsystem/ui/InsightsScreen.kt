package br.com.paivalab.weddingmanagementsystem.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.BurndownPoint
import br.com.paivalab.weddingmanagementsystem.data.CategoryCreep
import br.com.paivalab.weddingmanagementsystem.data.GuestDemographics
import br.com.paivalab.weddingmanagementsystem.data.HealthAdvice
import br.com.paivalab.weddingmanagementsystem.data.HealthFactor
import br.com.paivalab.weddingmanagementsystem.data.HealthReport
import br.com.paivalab.weddingmanagementsystem.data.HealthTip
import br.com.paivalab.weddingmanagementsystem.data.InsightsRules
import br.com.paivalab.weddingmanagementsystem.data.InsightsSnapshot
import br.com.paivalab.weddingmanagementsystem.data.Money
import br.com.paivalab.weddingmanagementsystem.data.MonthlyCashflow
import br.com.paivalab.weddingmanagementsystem.data.PaymentHeatCell
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import br.com.paivalab.weddingmanagementsystem.data.ReportExport
import br.com.paivalab.weddingmanagementsystem.data.SCurvePoint
import br.com.paivalab.weddingmanagementsystem.data.WaterfallBar
import java.time.LocalDate
import java.util.Locale
import kotlin.math.max
import kotlin.math.min

/** Tela `/dashboard/insights` da web: health score, sobra, caixa, Curva S, burndown, simulador e categorias. */
@Composable
fun InsightsScreen(
    index: RecordIndex,
    language: String,
    currency: String,
    eventDate: String,
    contingencyPercent: Int,
) {
    val wedding = remember(eventDate) { runCatching { LocalDate.parse(eventDate) }.getOrNull() }
    val snapshot = remember(index, wedding, contingencyPercent) {
        wedding?.let { InsightsSnapshot.compute(index, contingencyPercent, it, System.currentTimeMillis()) }
    }
    val demographics = remember(index) { GuestDemographics.analyze(index.active) }
    fun money(cents: Long) = localizedCurrency(cents, currency, language)

    LazyColumn(contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Text(stringResource(R.string.insights_subtitle), style = MaterialTheme.typography.bodyMedium, color = PlannerMuted) }
        if (snapshot == null || wedding == null) {
            item { Text(stringResource(R.string.report_event_date_needed), color = PlannerMuted) }
        } else {
            item { HealthCard(snapshot.health) }
            item { LiquidityCard(snapshot.leftoverCents, snapshot.totals.budgetCents, ::money) }
            item { CashflowCard(snapshot.cashflow, snapshot.worstBalanceCents, language, ::money) }
            item { MonthlyFlowCard(snapshot.cashflow, language, ::money) }
            item { SCurveCard(snapshot.sCurve, language, ::money) }
            item { BurndownCard(snapshot.burndown, language) }
            item { WhatIfCard(snapshot, wedding, language, ::money) }
            item { WaterfallCard(snapshot.waterfall, ::money) }
            if (snapshot.creep.isNotEmpty()) item { CreepCard(snapshot.creep, language, ::money) }
            if (snapshot.heatmap.isNotEmpty()) item { HeatmapCard(snapshot.heatmap, wedding, snapshot.daysToEvent, language, ::money) }
        }
        item { DemographicsCard(demographics) }
        item { ExportReportButton(index, language) }
    }
}

@Composable
private fun InsightCard(title: String, hint: String? = null, accent: Color = PlannerBorder, content: @Composable () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = PlannerSurface),
        border = BorderStroke(1.dp, accent),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
            if (hint != null) Text(hint, style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
            content()
        }
    }
}

@Composable
private fun NoData() = Text(stringResource(R.string.insights_no_data), color = PlannerMuted, modifier = Modifier.padding(vertical = 24.dp))

@Composable
private fun healthTone(score: Int): Color = when {
    score >= 75 -> PlannerEmerald
    score >= 50 -> PlannerAmber
    else -> PlannerRose
}

private fun factorLabel(factor: HealthFactor): Int = when (factor) {
    HealthFactor.CONTRACTED -> R.string.health_factor_contracted
    HealthFactor.PAID -> R.string.health_factor_paid
    HealthFactor.LIQUIDITY -> R.string.health_factor_liquidity
    HealthFactor.TASKS -> R.string.health_factor_tasks
    HealthFactor.ON_TRACK -> R.string.health_factor_on_track
    HealthFactor.CASH -> R.string.health_factor_cash
}

@Composable
private fun alertText(tip: HealthTip): String = when (tip.advice) {
    HealthAdvice.NEGATIVE_MONTH -> stringResource(R.string.health_alert_negative_month)
    HealthAdvice.OVERDUE_TASKS -> stringResource(R.string.health_alert_overdue, tip.args[0].toInt())
    HealthAdvice.LOW_CONTRACTED -> stringResource(R.string.health_alert_late_contracting)
    HealthAdvice.LOW_CASH_COVERAGE -> stringResource(R.string.health_alert_low_cash, 30)
    HealthAdvice.LOW_PAYMENT_PROGRESS -> ""
}

@Composable
private fun recommendationText(tip: HealthTip): String {
    val args = tip.args.map { it.toInt() }
    return when (tip.advice) {
        HealthAdvice.LOW_CONTRACTED -> stringResource(R.string.health_rec_low_contracted, args[0], args[1])
        HealthAdvice.LOW_CASH_COVERAGE -> stringResource(R.string.health_rec_low_cash, args[0])
        HealthAdvice.OVERDUE_TASKS -> plural(R.plurals.health_rec_overdue, args[0], args[0], args[1])
        HealthAdvice.NEGATIVE_MONTH -> stringResource(R.string.health_rec_negative_month)
        HealthAdvice.LOW_PAYMENT_PROGRESS -> plural(R.plurals.health_rec_low_payment, args[1], args[0], args[1])
    }
}

@Composable
private fun HealthCard(health: HealthReport) {
    val tone = healthTone(health.score)
    InsightCard(stringResource(R.string.health_score), accent = tone.copy(alpha = .4f)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            ScoreGauge(health.score, tone)
            Column {
                Text(stringResource(R.string.health_score_value, health.score), style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold, color = tone)
                Text(stringResource(when {
                    health.score >= 75 -> R.string.health_status_good
                    health.score >= 50 -> R.string.health_status_warn
                    else -> R.string.health_status_bad
                }), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
            }
        }
        health.factors.forEach { (factor, value) ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(stringResource(factorLabel(factor)), style = MaterialTheme.typography.bodySmall, color = PlannerMuted, modifier = Modifier.weight(1f))
                Text(stringResource(R.string.health_factor_value, Math.round(value * 100).toInt()), style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold)
            }
        }
        if (health.alerts.isNotEmpty()) HorizontalDivider(color = PlannerBorder)
        health.alerts.forEach { TipRow(Icons.Default.Warning, alertText(it), tone) }
        if (health.recommendations.isNotEmpty()) HorizontalDivider(color = PlannerBorder)
        health.recommendations.forEach { TipRow(Icons.Default.Lightbulb, recommendationText(it), PlannerAmber) }
    }
}

@Composable
private fun TipRow(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String, color: Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
        Text(text, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun LiquidityCard(leftover: Long, budget: Long, money: (Long) -> String) {
    val (tone, status) = when {
        leftover < 0 -> PlannerRose to R.string.liquidity_critical
        leftover < budget * .1 -> PlannerAmber to R.string.liquidity_warning
        else -> PlannerEmerald to R.string.liquidity_positive
    }
    InsightCard(stringResource(R.string.liquidity_label), accent = tone.copy(alpha = .4f)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(money(leftover), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = tone)
                Text(stringResource(status), style = MaterialTheme.typography.bodySmall, color = tone)
            }
            Icon(if (leftover >= 0) Icons.AutoMirrored.Filled.TrendingUp else Icons.AutoMirrored.Filled.TrendingDown, contentDescription = null, tint = tone,
                modifier = Modifier.size(32.dp))
        }
        Text(stringResource(R.string.liquidity_description), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
    }
}

private fun monthLabels(cashflow: List<MonthlyCashflow>, language: String) = cashflow.map { formatYearMonth(it.month.toString(), language) }

private fun dayLabels(dates: List<LocalDate>, language: String) = dates.map { formatDisplayDate(it.toString(), language) }

@Composable
private fun CashflowCard(cashflow: List<MonthlyCashflow>, worst: Long, language: String, money: (Long) -> String) {
    InsightCard(stringResource(R.string.insights_cashflow_title), stringResource(R.string.insights_cashflow_description)) {
        InfoBadge(stringResource(R.string.insights_worst_balance, money(worst)), if (worst >= 0) PlannerEmerald else PlannerRose)
        if (cashflow.isEmpty()) NoData() else {
            val ending = ChartSeries(stringResource(R.string.insights_legend_ending), PlannerEmerald,
                cashflow.map { it.endingCents.toFloat() }, fill = true)
            PlannerLineChart(monthLabels(cashflow, language), listOf(ending),
                stringResource(R.string.insights_worst_balance, money(worst)), { _, v -> money(v.toLong()) })
        }
    }
}

@Composable
private fun MonthlyFlowCard(cashflow: List<MonthlyCashflow>, language: String, money: (Long) -> String) {
    InsightCard(stringResource(R.string.insights_monthly_flow_title), stringResource(R.string.insights_monthly_flow_description)) {
        if (cashflow.isEmpty()) NoData() else {
            val income = ChartSeries(stringResource(R.string.insights_legend_income), PlannerEmerald, cashflow.map { it.incomeCents.toFloat() })
            val outflow = ChartSeries(stringResource(R.string.insights_legend_outflow), PlannerRose, cashflow.map { it.outflowCents.toFloat() })
            PlannerFlowBars(monthLabels(cashflow, language), income, outflow, cashflow.map { it.negative },
                stringResource(R.string.insights_monthly_flow_title), { _, v -> money(v.toLong()) })
        }
    }
}

@Composable
private fun SCurveCard(points: List<SCurvePoint>, language: String, money: (Long) -> String) {
    InsightCard(stringResource(R.string.insights_scurve_title), stringResource(R.string.insights_scurve_hint)) {
        if (points.isEmpty()) NoData() else {
            val planned = ChartSeries(stringResource(R.string.insights_scurve_planned), PlannerChampagne, points.map { it.plannedCents.toFloat() })
            val paid = ChartSeries(stringResource(R.string.insights_scurve_paid), PlannerEmerald, points.map { it.paidCents.toFloat() })
            val last = points.last()
            PlannerLineChart(dayLabels(points.map { it.date }, language), listOf(planned, paid),
                "${planned.label}: ${money(last.plannedCents)} · ${paid.label}: ${money(last.paidCents)}",
                { _, v -> money(v.toLong()) },
                band = points.map { it.lowerCents.toFloat() } to points.map { it.upperCents.toFloat() })
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.size(10.dp).background(PlannerChampagne.copy(alpha = .25f), CircleShape))
                Text(stringResource(R.string.insights_scurve_band), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
            }
        }
    }
}

@Composable
private fun BurndownCard(points: List<BurndownPoint>, language: String) {
    InsightCard(stringResource(R.string.insights_burndown_title), stringResource(R.string.insights_burndown_hint)) {
        if (points.isEmpty()) NoData() else {
            val ideal = ChartSeries(stringResource(R.string.insights_burndown_ideal), PlannerMuted, points.map { it.ideal.toFloat() }, dashed = true)
            val actual = ChartSeries(stringResource(R.string.insights_burndown_actual), PlannerRose, points.map { it.remaining.toFloat() })
            val overdue = ChartSeries(stringResource(R.string.insights_burndown_overdue), PlannerAmber, points.map { it.overdue.toFloat() })
            val today = LocalDate.now().toString()
            val current = points.lastOrNull { it.date.toString() <= today } ?: points.first()
            PlannerLineChart(dayLabels(points.map { it.date }, language), listOf(ideal, actual, overdue),
                "${actual.label}: ${current.remaining} · ${overdue.label}: ${current.overdue}",
                { line, v -> if (line === ideal) String.format(Locale.forLanguageTag(language), "%.1f", v) else v.toInt().toString() },
                yAxis = { it.toInt().toString() })
        }
    }
}

@Composable
private fun WhatIfCard(snapshot: InsightsSnapshot, wedding: LocalDate, language: String, money: (Long) -> String) {
    var amount by rememberSaveable { mutableStateOf("") }
    var date by rememberSaveable { mutableStateOf("") }
    val cents = runCatching { Money.parseToCents(amount) }.getOrNull()?.takeIf { it > 0 }
    val day = runCatching { LocalDate.parse(normalizeDateInput(date)) }.getOrNull()
    val result = if (cents != null && day != null) InsightsRules.whatIf(snapshot.cashflow, snapshot.totals.cashCents, cents, day) else null
    InsightCard(stringResource(R.string.insights_whatif_title),
        stringResource(R.string.insights_whatif_description, formatDisplayDate(wedding.toString(), language))) {
        OutlinedTextField(amount, { amount = it }, label = { Text(stringResource(R.string.insights_whatif_amount)) }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
        DatePickerOutlinedField(date, { date = it }, stringResource(R.string.insights_whatif_date))
        if (result == null) Text(stringResource(R.string.insights_whatif_prompt), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
        else {
            val fits = result.worstCents >= 0
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(if (fits) Icons.AutoMirrored.Filled.TrendingUp else Icons.AutoMirrored.Filled.TrendingDown, contentDescription = null,
                    tint = if (fits) PlannerEmerald else PlannerRose, modifier = Modifier.size(18.dp))
                InfoBadge(stringResource(if (fits) R.string.insights_whatif_ok else R.string.insights_whatif_exceeds), if (fits) PlannerEmerald else PlannerRose)
            }
            val month = result.month?.let { formatYearMonth(it.toString(), language) } ?: "—"
            WhatIfStat(stringResource(R.string.insights_whatif_balance_at, month), money(result.balanceAtCents), null)
            WhatIfStat(stringResource(R.string.insights_whatif_worst), money(result.worstCents), result.worstCents >= 0)
            WhatIfStat(stringResource(R.string.insights_whatif_final), money(result.finalCents), result.finalCents >= 0)
        }
    }
}

@Composable
private fun WhatIfStat(label: String, value: String, positive: Boolean?) {
    Row(Modifier.fillMaxWidth().background(PlannerRaised, RoundedCornerShape(12.dp)).padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = PlannerMuted, modifier = Modifier.weight(1f))
        Text(value, fontWeight = FontWeight.SemiBold, color = when (positive) {
            true -> PlannerEmerald
            false -> PlannerRose
            null -> MaterialTheme.colorScheme.onSurface
        })
    }
}

@Composable
private fun categoryName(creep: CategoryCreep): String =
    creep.categoryKey?.let { stringResource(categoryLabel(it)) } ?: creep.label.ifBlank { "—" }

/** Cascata horizontal: cada barra vai do acumulado anterior ao novo, como o `Waterfall` da web. */
@Composable
private fun WaterfallCard(bars: List<WaterfallBar>, money: (Long) -> String) {
    InsightCard(stringResource(R.string.insights_waterfall_title), stringResource(R.string.insights_waterfall_hint)) {
        if (bars.size <= 1 && bars.firstOrNull()?.deltaCents == 0L) NoData() else {
            val starts = bars.map { if (it.category == null) 0L else it.runningCents - it.deltaCents }
            val low = min(0L, (starts + bars.map { it.runningCents }).min())
            val high = max(1L + low, (starts + bars.map { it.runningCents }).max())
            val span = (high - low).toFloat()
            bars.forEachIndexed { i, bar ->
                val name = bar.category?.let { categoryName(it) } ?: stringResource(R.string.insights_waterfall_total)
                val from = min(starts[i], bar.runningCents)
                val to = max(starts[i], bar.runningCents)
                val color = when {
                    bar.category == null -> PlannerChampagne
                    bar.deltaCents > 0 -> PlannerRose
                    else -> PlannerEmerald
                }
                val value = (if (bar.deltaCents > 0) "+" else "") + money(bar.deltaCents)
                Column(Modifier.semantics(mergeDescendants = true) { contentDescription = "$name: $value" },
                    verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(name, style = MaterialTheme.typography.bodySmall, fontWeight = if (bar.category == null) FontWeight.Bold else null,
                            modifier = Modifier.weight(1f))
                        Text(value, style = MaterialTheme.typography.bodySmall, color = color, fontWeight = FontWeight.SemiBold)
                    }
                    androidx.compose.foundation.Canvas(Modifier.fillMaxWidth().height(10.dp)) {
                        val left = (from - low) / span * size.width
                        val width = max(2f, (to - from) / span * size.width)
                        drawRoundRect(color, androidx.compose.ui.geometry.Offset(left, 0f),
                            androidx.compose.ui.geometry.Size(width, size.height), androidx.compose.ui.geometry.CornerRadius(4f, 4f))
                    }
                }
            }
        }
    }
}

@Composable
private fun CreepCard(items: List<CategoryCreep>, language: String, money: (Long) -> String) {
    InsightCard(stringResource(R.string.insights_creep_title), stringResource(R.string.insights_creep_description)) {
        if (items.none { it.deltaCents > 0 }) Text(stringResource(R.string.insights_creep_ok), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
        items.forEach { item ->
            val tone = when {
                item.pct > .1 -> PlannerRose
                item.pct > 0 -> PlannerAmber
                else -> PlannerEmerald
            }
            Column(Modifier.fillMaxWidth().border(1.dp, tone.copy(alpha = .35f), RoundedCornerShape(12.dp)).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.size(10.dp).background(item.categoryKey?.let { categoryColor(it) } ?: PlannerMuted, CircleShape))
                    Text(categoryName(item), fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Text(stringResource(R.string.insights_creep_pct, String.format(Locale.forLanguageTag(language), "%.1f", item.pct * 100)),
                        color = tone, fontWeight = FontWeight.SemiBold)
                }
                CreepDetails(item, money)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CreepDetails(item: CategoryCreep, money: (Long) -> String) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.insights_creep_estimated, money(item.estimatedCents)), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
        Text(stringResource(R.string.insights_creep_contracted, money(item.actualCents)), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
        Text((if (item.deltaCents > 0) "+" else "") + money(item.deltaCents), style = MaterialTheme.typography.bodySmall,
            color = if (item.deltaCents > 0) PlannerRose else PlannerEmerald)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun HeatmapCard(cells: List<PaymentHeatCell>, wedding: LocalDate, days: Long, language: String, money: (Long) -> String) {
    var selected by rememberSaveable { mutableStateOf<String?>(null) }
    val maxAmount = max(cells.maxOf { it.amountCents }, 1L)
    val heat = PlannerRose
    InsightCard(stringResource(R.string.insights_heatmap_title),
        plural(R.plurals.insights_heatmap_description, days.toInt(), formatDisplayDate(wedding.toString(), language), days.toInt())) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            cells.forEach { cell ->
                val label = plural(R.plurals.insights_heatmap_cell, cell.count, formatDisplayDate(cell.date.toString(), language), money(cell.amountCents), cell.count)
                val alpha = .15f + cell.amountCents.toFloat() / maxAmount * .7f
                Box(Modifier.size(32.dp).background(heat.copy(alpha = alpha), RoundedCornerShape(6.dp))
                    .border(if (selected == cell.date.toString()) 2.dp else 1.dp,
                        if (selected == cell.date.toString()) MaterialTheme.colorScheme.onSurface else PlannerBorder, RoundedCornerShape(6.dp))
                    .clickable(onClickLabel = label) { selected = cell.date.toString() }
                    .semantics { contentDescription = label })
            }
        }
        val current = cells.firstOrNull { it.date.toString() == selected }
        Text(current?.let { plural(R.plurals.insights_heatmap_cell, it.count, formatDisplayDate(it.date.toString(), language), money(it.amountCents), it.count) }
            ?: stringResource(R.string.insights_chart_hint), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DemographicsCard(demographics: br.com.paivalab.weddingmanagementsystem.data.GuestDemographicsSummary) {
    InsightCard(stringResource(R.string.insights_demographics_title)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            InfoBadge(plural(R.plurals.seats_confirmed, demographics.confirmedSeats, demographics.confirmedSeats), PlannerEmerald)
            InfoBadge("${stringResource(R.string.side_bride)}: ${demographics.brideSideCount}", PlannerRose)
            InfoBadge("${stringResource(R.string.side_groom)}: ${demographics.groomSideCount}", PlannerChampagne)
            if (demographics.bothSideCount > 0) InfoBadge("${stringResource(R.string.side_both)}: ${demographics.bothSideCount}", PlannerMuted)
            if (demographics.vipCount > 0) InfoBadge("${stringResource(R.string.guest_vip)}: ${demographics.vipCount}", PlannerChampagne)
            if (demographics.padrinhosCount > 0) InfoBadge("${stringResource(R.string.guest_padrinho)}: ${demographics.padrinhosCount}", PlannerEmerald)
            if (demographics.childrenCount > 0) InfoBadge("${stringResource(R.string.guest_child)}: ${demographics.childrenCount}", PlannerMuted)
        }
        if (demographics.dietaryItems.isNotEmpty()) {
            Text(stringResource(R.string.insights_dietary_title, demographics.dietaryItems.size), style = MaterialTheme.typography.labelSmall, color = PlannerChampagne)
            demographics.dietaryItems.forEach { (guestName, restriction) -> Text("$guestName — $restriction", style = MaterialTheme.typography.bodySmall) }
        }
    }
}

@Composable
private fun ExportReportButton(index: RecordIndex, language: String) {
    val context = LocalContext.current
    var failed by remember { mutableStateOf(false) }
    val headers = listOf(R.string.report_type, R.string.title, R.string.amount, R.string.report_estimated,
        R.string.date, R.string.status, R.string.notes).map { localized(it, language) }
    val kindNames = modules.associate { it.kind to localized(it.title, language) }
    val reportFile = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) failed = runCatching {
            context.contentResolver.openOutputStream(uri, "w")?.use { it.write(ReportExport.generate(index.active, headers, kindNames)) }
                ?: error("Destino indisponível")
        }.isFailure
    }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        OutlinedButton(onClick = { reportFile.launch("wedding-report-${LocalDate.now()}.csv") }, modifier = Modifier.fillMaxWidth()) {
            Text(localized(R.string.export_report, language))
        }
        if (failed) Text(localized(R.string.error_generic, language), color = MaterialTheme.colorScheme.error)
    }
}
