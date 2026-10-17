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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.ActionItem
import br.com.paivalab.weddingmanagementsystem.data.ActionKind
import br.com.paivalab.weddingmanagementsystem.data.ActionStream
import br.com.paivalab.weddingmanagementsystem.data.DashboardMetrics
import br.com.paivalab.weddingmanagementsystem.data.ExtraFields
import br.com.paivalab.weddingmanagementsystem.data.FinanceRules
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import br.com.paivalab.weddingmanagementsystem.data.RiskRadar
import java.time.LocalDate
import kotlin.math.roundToInt

private const val ACTIONS_SHOWN = 6

@Composable
internal fun DashboardScreen(
    index: RecordIndex,
    coupleNames: String,
    eventDate: String,
    contingencyPercent: Int,
    currency: String,
    language: String,
    navigate: (String) -> Unit,
    openRecord: (PlannerRecord) -> Unit,
) {
    val today = LocalDate.now()
    val wedding = remember(eventDate) { runCatching { LocalDate.parse(eventDate) }.getOrNull() }
    val metrics = remember(index, wedding, contingencyPercent) { DashboardMetrics.compute(index, contingencyPercent, wedding, today) }
    val actions = remember(index) { ActionStream.compute(index, today) }
    val riskAlerts = remember(index, wedding, currency, language) {
        val active = index.active
        RiskRadar.compute(
            activeRecords = active,
            cashflow = wedding?.let { FinanceRules.monthlyCashflow(active, it, today) }.orEmpty(),
            daysToEvent = metrics.daysToEvent,
            formatMoney = { localizedCurrency(it, currency, language) },
        )
    }
    val upcomingTasks = remember(index) {
        index.kind(Kinds.TASK).filter { it.status != "DONE" }.sortedWith(compareBy(nullsLast()) { it.date }).take(6)
    }
    var showAllActions by rememberSaveable { mutableStateOf(false) }
    fun money(cents: Long) = localizedCurrency(cents, currency, language)
    val paidPercent = (metrics.paidRatio * 100).roundToInt()

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
                        metrics.daysToEvent?.let { CountdownBadge(it) }
                    }
                    HorizontalDivider(color = PlannerBorder)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(stringResource(R.string.financial_progress, paidPercent), style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                        Text("${money(metrics.paidCents)} / ${money(metrics.totalBudgetCents)}",
                            style = MaterialTheme.typography.labelSmall, color = PlannerEmerald)
                    }
                    PlannerProgressBar(metrics.paidRatio, PlannerEmerald)
                }
            }
        }
        if (wedding == null) item {
            Card(
                onClick = { navigate("settings") },
                colors = CardDefaults.cardColors(containerColor = PlannerRose.copy(alpha = 0.10f)),
                border = BorderStroke(1.dp, PlannerRose.copy(alpha = 0.35f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(stringResource(R.string.dashboard_setup_title), fontWeight = FontWeight.SemiBold, color = PlannerRose)
                    Text(stringResource(R.string.dashboard_setup_body), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        if (metrics.showSettleAlert) item {
            val days = (metrics.daysToEvent ?: 0L).toInt()
            Card(
                onClick = { navigate(Kinds.PAYMENT) },
                colors = CardDefaults.cardColors(containerColor = PlannerDanger.copy(alpha = 0.10f)),
                border = BorderStroke(1.dp, PlannerDanger.copy(alpha = 0.35f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.ErrorOutline, null, tint = PlannerDanger)
                    Column {
                        Text(stringResource(R.string.dashboard_settle_title), fontWeight = FontWeight.SemiBold, color = PlannerDanger)
                        Text(plural(R.plurals.dashboard_settle_body, days, days, money(metrics.remainingCents)),
                            style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
        item {
            KpiRow(
                {
                    SummaryCard(stringResource(R.string.kpi_total_budget), money(metrics.totalBudgetCents),
                        stringResource(R.string.kpi_contingency, money(metrics.contingencyCents)), PlannerChampagne) { navigate(Kinds.BUDGET) }
                },
                {
                    SummaryCard(stringResource(R.string.total_paid), money(metrics.paidCents),
                        stringResource(R.string.percent_of_budget, paidPercent), PlannerEmerald) { navigate(Kinds.PAYMENT) }
                },
            )
        }
        item {
            KpiRow(
                {
                    SummaryCard(stringResource(R.string.kpi_remaining), money(metrics.remainingCents),
                        stringResource(R.string.kpi_contracted, money(metrics.contractedCents)), PlannerRose) { navigate(Kinds.PAYMENT) }
                },
                {
                    SummaryCard(stringResource(R.string.kpi_cash_coverage), money(metrics.assetsCents),
                        metrics.coveragePercent?.let { stringResource(R.string.kpi_coverage_percent, it) }
                            ?: stringResource(R.string.kpi_balance_settled), PlannerEmerald) { navigate(Kinds.ASSET) }
                },
            )
        }
        item { ActionStreamCard(actions, showAllActions, { showAllActions = !showAllActions }, index, currency, language, navigate, openRecord) }
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
        item { FunnelCard(metrics) { navigate(Kinds.VENDOR) } }
        item { RsvpCard(metrics) { navigate(Kinds.GUEST) } }
        item { GiftsCard(metrics, money(metrics.gifts.cashTotalCents)) { navigate(Kinds.GIFT) } }
        item {
            MiniCard(stringResource(R.string.dashboard_upcoming_payments), onClick = { navigate(Kinds.PAYMENT) }) {
                if (metrics.upcomingPayments.isEmpty()) Text(stringResource(R.string.dashboard_no_upcoming_payments), color = PlannerMuted,
                    style = MaterialTheme.typography.bodySmall)
                metrics.upcomingPayments.forEach { payment ->
                    UpcomingRow(index.find(payment.parentId)?.title ?: payment.title,
                        stringResource(R.string.dashboard_due_on, formatDisplayDate(payment.date, language)),
                        money(payment.amountCents ?: 0L), PlannerRose) { openRecord(payment) }
                }
            }
        }
        item {
            MiniCard(stringResource(R.string.dashboard_upcoming_tasks), onClick = { navigate(Kinds.TASK) }) {
                if (upcomingTasks.isEmpty()) Text(stringResource(R.string.no_upcoming), color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
                upcomingTasks.forEach { task ->
                    val priority = ExtraFields.text(index.extra(task), "priority", "MEDIUM")
                    UpcomingRow(task.title, task.date?.let { formatDisplayDate(it, language) } ?: stringResource(R.string.no_deadline),
                        webValueLabel(priority, language), priorityColor(priority)) { openRecord(task) }
                }
            }
        }
    }
}

@Composable
private fun KpiRow(first: @Composable () -> Unit, second: @Composable () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.weight(1f)) { first() }
        Box(Modifier.weight(1f)) { second() }
    }
}

/** Faixas de cor da contagem regressiva da web: verde acima de 90 dias, âmbar até 30, rosa no último mês. */
@Composable
private fun CountdownBadge(days: Long) {
    when {
        days < 0 -> InfoBadge(stringResource(R.string.countdown_past), PlannerMuted)
        days == 0L -> InfoBadge(stringResource(R.string.countdown_today), PlannerRose)
        else -> InfoBadge(plural(R.plurals.days_left, days.toInt(), days.toInt()), countdownColor(days))
    }
}

@Composable
private fun countdownColor(days: Long): Color = when {
    days > 90 -> PlannerEmerald
    days > 30 -> PlannerAmber
    else -> PlannerRose
}

@Composable
private fun ActionStreamCard(
    items: List<ActionItem>,
    expanded: Boolean,
    toggle: () -> Unit,
    index: RecordIndex,
    currency: String,
    language: String,
    navigate: (String) -> Unit,
    openRecord: (PlannerRecord) -> Unit,
) {
    MiniCard(stringResource(R.string.upcoming)) {
        if (items.isEmpty()) {
            Text(stringResource(R.string.action_stream_empty), color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
            return@MiniCard
        }
        val shown = if (expanded) items else items.take(ACTIONS_SHOWN)
        shown.forEach { item ->
            val accent = when (item.kind) {
                ActionKind.PAYMENT_OVERDUE, ActionKind.TASK_OVERDUE -> PlannerDanger
                ActionKind.PAYMENT_DUE, ActionKind.TASK_DUE, ActionKind.CONTRACT_EXPIRING -> PlannerAmber
                else -> PlannerChampagne
            }
            UpcomingRow(actionTitle(item, currency, language), actionWhen(item), null, accent) {
                val record = index.find(item.recordId)
                if (record != null) openRecord(record) else navigate(item.section)
            }
        }
        if (items.size > ACTIONS_SHOWN) {
            TextButton(onClick = toggle) {
                Text(if (expanded) stringResource(R.string.show_less)
                    else plural(R.plurals.action_stream_more, items.size - ACTIONS_SHOWN, items.size - ACTIONS_SHOWN))
            }
        }
    }
}

@Composable
private fun actionTitle(item: ActionItem, currency: String, language: String): String = when (item.kind) {
    ActionKind.PAYMENT_OVERDUE, ActionKind.PAYMENT_DUE ->
        stringResource(R.string.action_pay, item.label, localizedCurrency(item.amountCents ?: 0L, currency, language))
    ActionKind.TASK_OVERDUE, ActionKind.TASK_DUE -> stringResource(R.string.action_task, item.label)
    ActionKind.CONTRACT_EXPIRING -> stringResource(R.string.action_sign_contract, item.label)
    ActionKind.RSVP_PENDING -> plural(R.plurals.action_rsvp_pending, item.count, item.count)
    ActionKind.GIFT_THANK -> plural(R.plurals.action_gift_thank, item.count, item.count)
}

@Composable
private fun actionWhen(item: ActionItem): String? = when {
    item.dueDate == null -> null
    item.kind == ActionKind.PAYMENT_OVERDUE || item.kind == ActionKind.TASK_OVERDUE -> plural(R.plurals.action_overdue_by, item.days, item.days)
    item.days == 0 -> stringResource(R.string.action_due_today)
    else -> plural(R.plurals.action_due_in, item.days, item.days)
}

@Composable
private fun FunnelCard(metrics: DashboardMetrics, onClick: () -> Unit) {
    val funnel = metrics.funnel
    MiniCard(stringResource(R.string.funnel_title), onClick = onClick) {
        if (funnel.total == 0) {
            Text(stringResource(R.string.funnel_empty), color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
            return@MiniCard
        }
        listOf(
            Triple(R.string.funnel_negotiating, funnel.negotiation, PlannerAmber),
            Triple(R.string.funnel_contracted, funnel.contracted, PlannerChampagne),
            Triple(R.string.funnel_finalized, funnel.finalized, PlannerEmerald),
        ).forEach { (label, value, color) ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(stringResource(label), style = MaterialTheme.typography.bodySmall)
                Text(value.toString(), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, color = color)
            }
            PlannerProgressBar(value.toFloat() / funnel.total, color, height = 6.dp)
        }
    }
}

@Composable
private fun RsvpCard(metrics: DashboardMetrics, onClick: () -> Unit) {
    val rsvp = metrics.rsvp
    MiniCard(stringResource(R.string.rsvp_title), onClick = onClick) {
        if (rsvp.total == 0) {
            Text(stringResource(R.string.rsvp_empty), color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
            return@MiniCard
        }
        Text(stringResource(R.string.rsvp_responded, rsvp.confirmed, rsvp.total), fontWeight = FontWeight.SemiBold)
        PlannerProgressBar(rsvp.confirmed.toFloat() / rsvp.total, PlannerEmerald, height = 6.dp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InfoBadge(plural(R.plurals.rsvp_confirmed, rsvp.confirmed, rsvp.confirmed), PlannerEmerald)
            InfoBadge(plural(R.plurals.rsvp_maybe, rsvp.maybe, rsvp.maybe), PlannerAmber)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InfoBadge(plural(R.plurals.rsvp_declined, rsvp.declined, rsvp.declined), PlannerRose)
            InfoBadge(plural(R.plurals.pending_count, rsvp.invited, rsvp.invited), PlannerMuted)
        }
        Text(plural(R.plurals.rsvp_plus_ones, rsvp.plusOnesConfirmed, rsvp.plusOnesConfirmed), style = MaterialTheme.typography.labelSmall,
            color = PlannerMuted)
    }
}

@Composable
private fun GiftsCard(metrics: DashboardMetrics, cashTotal: String, onClick: () -> Unit) {
    val gifts = metrics.gifts
    MiniCard(stringResource(R.string.gifts_received_title), onClick = onClick) {
        if (gifts.total == 0) {
            Text(stringResource(R.string.gifts_empty), color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
            return@MiniCard
        }
        Text(cashTotal, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerEmerald)
        Text(stringResource(R.string.gifts_breakdown, gifts.cashCount, gifts.total - gifts.cashCount), style = MaterialTheme.typography.bodySmall,
            color = PlannerMuted)
        Text(stringResource(R.string.gifts_thanked, (gifts.thankedRatio * 100).roundToInt(), gifts.thanked, gifts.total),
            style = MaterialTheme.typography.bodySmall)
        PlannerProgressBar(gifts.thankedRatio, PlannerChampagne, height = 6.dp)
    }
}

@Composable
private fun MiniCard(title: String, onClick: (() -> Unit)? = null, content: @Composable () -> Unit) {
    val body: @Composable () -> Unit = {
        Column(Modifier.padding(14.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
            content()
        }
    }
    val colors = CardDefaults.cardColors(containerColor = PlannerSurface)
    val border = BorderStroke(1.dp, PlannerBorder)
    if (onClick != null) Card(onClick = onClick, colors = colors, border = border, modifier = Modifier.fillMaxWidth()) { body() }
    else Card(colors = colors, border = border, modifier = Modifier.fillMaxWidth()) { body() }
}

@Composable
private fun UpcomingRow(title: String, subtitle: String?, trailing: String?, accent: Color, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(containerColor = PlannerRaised),
        border = BorderStroke(1.dp, accent.copy(alpha = 0.30f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.labelSmall, color = accent)
            }
            if (trailing != null) Text(trailing, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = accent,
                modifier = Modifier.padding(start = 8.dp))
        }
    }
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
