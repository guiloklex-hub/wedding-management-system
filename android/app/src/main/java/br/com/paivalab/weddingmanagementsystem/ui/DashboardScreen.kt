package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.FinanceRules
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import br.com.paivalab.weddingmanagementsystem.data.RiskRadar
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.roundToInt

@Composable
internal fun DashboardScreen(
    index: RecordIndex,
    coupleNames: String,
    eventDate: String,
    currency: String,
    language: String,
    navigate: (String) -> Unit,
    openRecord: (PlannerRecord) -> Unit,
) {
    val active = index.active
    val wedding = remember(eventDate) { runCatching { LocalDate.parse(eventDate) }.getOrNull() }
    val daysUntil = wedding?.let { ChronoUnit.DAYS.between(LocalDate.now(), it) }
    val budget = FinanceRules.budgetEstimated(active)
    val paid = index.kind(Kinds.PAYMENT).filter { it.status == "PAID" }.sumOf { it.amountCents ?: 0L }
    val tasks = index.kind(Kinds.TASK)
    val pendingTasks = tasks.count { it.status != "DONE" }
    val doneTasks = tasks.size - pendingTasks
    val confirmedGuests = index.kind(Kinds.GUEST).filter { it.status == "CONFIRMED" }
    val seatsConfirmed = confirmedGuests.sumOf { 1 + it.plusOnesConfirmed }
    val upcoming = remember(index) {
        (index.kind(Kinds.TASK) + index.kind(Kinds.PAYMENT))
            .filter { it.date != null && it.status !in setOf("PAID", "DONE") }
            .sortedBy { it.date }.take(8)
    }
    val paidRatio = if (budget <= 0L) 0f else (paid.toFloat() / budget.toFloat()).coerceIn(0f, 1f)
    val paidPercent = (paidRatio * 100).roundToInt()
    val riskAlerts = remember(index, wedding, currency, language) {
        RiskRadar.compute(
            activeRecords = active,
            cashflow = wedding?.let { FinanceRules.monthlyCashflow(active, it, LocalDate.now()) }.orEmpty(),
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
                                coupleNames.ifBlank { stringResource(R.string.app_name) },
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold,
                                color = PlannerOnSurface,
                                modifier = Modifier.semantics { heading() },
                            )
                            Text(
                                if (wedding != null) stringResource(R.string.big_day, formatDisplayDate(eventDate, language))
                                else stringResource(R.string.event_date_missing),
                                color = PlannerChampagne,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                        if (daysUntil != null && daysUntil >= 0) {
                            val days = daysUntil.toInt()
                            InfoBadge(pluralStringResource(R.plurals.days_left, days, days), countdownColor(days))
                        }
                    }
                    HorizontalDivider(color = PlannerBorder)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(stringResource(R.string.financial_progress, paidPercent), style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                        Text("${localizedCurrency(paid, currency, language)} / ${localizedCurrency(budget, currency, language)}",
                            style = MaterialTheme.typography.labelSmall, color = PlannerEmerald)
                    }
                    PlannerProgressBar(paidRatio, PlannerEmerald)
                }
            }
        }
        if (riskAlerts.isNotEmpty()) item {
            val top = riskAlerts.first()
            val critical = top.severity == "HIGH"
            val accent = if (critical) PlannerRose else PlannerChampagne
            Card(
                onClick = { navigate("insights") },
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, accent.copy(alpha = 0.55f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(stringResource(R.string.risk_radar_count, riskAlerts.size), style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold, color = accent)
                        InfoBadge(stringResource(if (critical) R.string.risk_critical else R.string.risk_warning), accent)
                    }
                    Text(riskTitle(top), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                    Text(riskBody(top), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.weight(1f)) {
                    SummaryCard(
                        label = stringResource(R.string.total_budget),
                        value = localizedCurrency(budget, currency, language),
                        subtitle = pluralStringResource(R.plurals.budget_items, index.count(Kinds.BUDGET), index.count(Kinds.BUDGET)),
                        accent = PlannerChampagne,
                    ) { navigate(Kinds.BUDGET) }
                }
                Box(Modifier.weight(1f)) {
                    SummaryCard(
                        label = stringResource(R.string.total_paid),
                        value = localizedCurrency(paid, currency, language),
                        subtitle = stringResource(R.string.percent_of_budget, paidPercent),
                        accent = PlannerEmerald,
                    ) { navigate(Kinds.PAYMENT) }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.weight(1f)) {
                    SummaryCard(
                        label = stringResource(R.string.pending_tasks),
                        value = pendingTasks.toString(),
                        subtitle = pluralStringResource(R.plurals.tasks_done, doneTasks, doneTasks),
                        accent = PlannerRose,
                    ) { navigate(Kinds.TASK) }
                }
                Box(Modifier.weight(1f)) {
                    SummaryCard(
                        label = stringResource(R.string.confirmed_guests),
                        value = confirmedGuests.size.toString(),
                        subtitle = pluralStringResource(R.plurals.seats_confirmed, seatsConfirmed, seatsConfirmed),
                        accent = PlannerChampagne,
                    ) { navigate(Kinds.GUEST) }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.upcoming), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold,
                    modifier = Modifier.semantics { heading() })
                InfoBadge(pluralStringResource(R.plurals.pending_count, upcoming.size, upcoming.size), PlannerChampagne)
            }
        }
        if (upcoming.isEmpty()) item { Text(stringResource(R.string.no_upcoming), color = PlannerMuted) }
        items(upcoming, key = { it.id }) { record ->
            Card(
                onClick = { openRecord(record) },
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Box(Modifier.padding(14.dp)) {
                    RecordCard(record, index, currency, language, onClick = { openRecord(record) })
                }
            }
        }
    }
}

/** Mesmas faixas do painel web: verde acima de 90 dias, âmbar até 30, vermelho no último mês. */
@Composable
private fun countdownColor(days: Int): Color = when {
    days > 90 -> PlannerEmerald
    days > 30 -> PlannerAmber
    else -> PlannerRose
}

@Composable
internal fun SummaryCard(label: String, value: String, subtitle: String, accent: Color, onClick: () -> Unit) {
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
