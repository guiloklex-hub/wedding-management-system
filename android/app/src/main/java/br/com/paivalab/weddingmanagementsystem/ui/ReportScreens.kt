package br.com.paivalab.weddingmanagementsystem.ui

import androidx.annotation.StringRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.FinanceRules
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerAudit
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RiskRadar
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import org.json.JSONObject

data class MobileReport(val route: String, @StringRes val title: Int)

val mobileReports = listOf(
    MobileReport("report-cashflow", R.string.report_cashflow),
    MobileReport("report-vendors", R.string.report_vendor_funnel),
    MobileReport("report-risk", R.string.report_risk),
    MobileReport("report-guests", R.string.report_guests),
    MobileReport("report-gifts", R.string.report_gifts),
    MobileReport("report-tasks", R.string.report_tasks),
    MobileReport("report-honeymoon", R.string.report_honeymoon),
    MobileReport("report-trousseau", R.string.report_trousseau),
    MobileReport("report-activity", R.string.report_activity),
)

@Composable
fun ReportsHubScreen(language: String, onNavigate: (String) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text(localized(R.string.reports, language), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        items(mobileReports, key = { it.route }) { report ->
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth().clickable { onNavigate(report.route) },
            ) {
                Text(localized(report.title, language), modifier = Modifier.padding(18.dp), style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}

@Composable
private fun ReportMetric(label: String, value: String, onClick: (() -> Unit)? = null) {
    Card(
        colors = CardDefaults.cardColors(containerColor = PlannerSurface),
        border = BorderStroke(1.dp, PlannerBorder),
        modifier = Modifier.fillMaxWidth().then(if (onClick == null) Modifier else Modifier.clickable(onClick = onClick)),
    ) {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
            Text(value, color = PlannerChampagne, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun ReportDetailScreen(
    route: String,
    records: List<PlannerRecord>,
    audits: List<PlannerAudit>,
    language: String,
    currency: String,
    eventDate: String,
    onNavigate: (String) -> Unit,
) {
    val title = mobileReports.firstOrNull { it.route == route }?.title ?: R.string.reports
    val active = records.filter { it.deletedAt == null }
    val today = LocalDate.now()
    LazyColumn(contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 80.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text(localized(title, language), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        when (route) {
            "report-vendors" -> {
                val vendors = active.filter { it.kind == Kinds.VENDOR }
                val statuses = listOf("NEGOTIATION", "CONTRACTED", "FINALIZED")
                items(statuses) { status ->
                    ReportMetric(statusLabel(status, language), vendors.count { it.status == status }.toString())
                }
                val byCategory = vendors.groupingBy { it.subtitle.ifBlank { "—" } }.eachCount().toList().sortedByDescending { it.second }
                item { Text(localized(R.string.report_by_category, language), style = MaterialTheme.typography.titleMedium) }
                items(byCategory) { (category, count) -> ReportMetric(category, count.toString(), { onNavigate(Kinds.VENDOR) }) }
            }
            "report-risk" -> {
                val wedding = runCatching { LocalDate.parse(eventDate) }.getOrNull()
                val cashflow = wedding?.let { FinanceRules.monthlyCashflow(active, it, today) }.orEmpty()
                val days = wedding?.let { ChronoUnit.DAYS.between(today, it) }
                val alerts = RiskRadar.compute(active, cashflow, days, { localizedCurrency(it, currency, language) }, today)
                if (alerts.isEmpty()) item { Text(localized(R.string.report_no_alerts, language), color = PlannerEmerald) }
                items(alerts, key = { it.id }) { alert ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                        border = BorderStroke(1.dp, if (alert.severity == "HIGH") PlannerRose else PlannerChampagne),
                        modifier = Modifier.fillMaxWidth().clickable { onNavigate(alert.targetSection) },
                    ) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(alert.title, fontWeight = FontWeight.Bold)
                            Text(alert.body, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
            "report-guests" -> {
                val guests = active.filter { it.kind == Kinds.GUEST }
                val confirmed = guests.filter { it.status == "CONFIRMED" }
                item { ReportMetric(localized(R.string.guests, language), guests.size.toString(), { onNavigate(Kinds.GUEST) }) }
                item { ReportMetric(localized(R.string.status_confirmed, language), confirmed.size.toString()) }
                item { ReportMetric(localized(R.string.seats, language), confirmed.sumOf { 1 + it.plusOnesConfirmed }.toString()) }
                items(listOf("INVITED", "MAYBE", "DECLINED")) { status ->
                    ReportMetric(statusLabel(status, language), guests.count { it.status == status }.toString())
                }
                val groups = active.filter { it.kind == Kinds.GROUP }.associateBy { it.id }
                val byGroup = confirmed.groupingBy { guest -> groups[guest.guestGroupId]?.title ?: "—" }.eachCount().toList().sortedByDescending { it.second }
                item { Text(localized(R.string.groups, language), style = MaterialTheme.typography.titleMedium) }
                items(byGroup) { (group, count) -> ReportMetric(group, count.toString()) }
            }
            "report-gifts" -> {
                val gifts = active.filter { it.kind == Kinds.GIFT }
                val received = gifts.filter { it.status in setOf("RECEIVED", "THANKED", "PROCESSED") }
                item { ReportMetric(localized(R.string.gifts, language), gifts.size.toString(), { onNavigate(Kinds.GIFT) }) }
                item { ReportMetric(localized(R.string.status_received, language), received.size.toString()) }
                item { ReportMetric(localized(R.string.status_thanked, language), gifts.count { it.status == "THANKED" }.toString()) }
                item { ReportMetric(localized(R.string.report_total_value, language), localizedCurrency(received.sumOf { it.amountCents ?: 0L }, currency, language)) }
                val byGuest = gifts.groupingBy { gift -> active.firstOrNull { it.id == gift.parentId }?.title ?: "—" }.eachCount().toList().sortedByDescending { it.second }.take(10)
                item { Text(localized(R.string.guests, language), style = MaterialTheme.typography.titleMedium) }
                items(byGuest) { (guest, count) -> ReportMetric(guest, count.toString()) }
            }
            "report-honeymoon" -> {
                val honeymoon = active.firstOrNull { it.kind == Kinds.HONEYMOON }
                val items = active.filter { it.kind == Kinds.HONEYMOON_ITEM }
                val paid = items.filter { it.status == "PAID" }.sumOf { it.amountCents ?: 0L }
                item { ReportMetric(localized(R.string.honeymoon_items, language), items.size.toString(), { onNavigate(Kinds.HONEYMOON_ITEM) }) }
                honeymoon?.amountCents?.let { amount -> item { ReportMetric(localized(R.string.total_budget, language), localizedCurrency(amount, currency, language)) } }
                item { ReportMetric(localized(R.string.total_paid, language), localizedCurrency(paid, currency, language)) }
                val byStatus = items.groupingBy { it.status }.eachCount()
                items(byStatus.toList()) { (status, count) -> ReportMetric(statusLabel(status, language), count.toString()) }
            }
            "report-trousseau" -> {
                val trousseau = active.filter { it.kind == Kinds.TROUSSEAU }
                val complete = trousseau.count { it.status in setOf("BOUGHT", "GIFTED") }
                item { ReportMetric(localized(R.string.trousseau, language), trousseau.size.toString(), { onNavigate(Kinds.TROUSSEAU) }) }
                item { ReportMetric(localized(R.string.status_bought, language), complete.toString()) }
                item { ReportMetric(localized(R.string.report_completion, language), if (trousseau.isEmpty()) "0%" else "${complete * 100 / trousseau.size}%") }
                item { ReportMetric(localized(R.string.report_total_value, language), localizedCurrency(trousseau.sumOf { it.amountCents ?: 0L }, currency, language)) }
                val byRoom = trousseau.groupingBy { runCatching { JSONObject(it.extraJson).optString("room", "") }.getOrDefault("").ifBlank { "—" } }.eachCount().toList().sortedByDescending { it.second }
                item { Text(localized(R.string.report_by_room, language), style = MaterialTheme.typography.titleMedium) }
                items(byRoom) { (room, count) -> ReportMetric(room, count.toString()) }
            }
            "report-cashflow" -> {
                val wedding = runCatching { LocalDate.parse(eventDate) }.getOrNull()
                val cashflow = wedding?.let { FinanceRules.monthlyCashflow(active, it, today) }.orEmpty()
                if (cashflow.isEmpty()) item { Text(localized(R.string.report_event_date_needed, language), color = PlannerMuted) }
                items(cashflow) { month ->
                    ReportMetric(formatYearMonth(month.month.toString(), language), localizedCurrency(month.endingCents, currency, language), { onNavigate("insights") })
                }
            }
            "report-tasks" -> {
                val tasks = active.filter { it.kind == Kinds.TASK }
                val done = tasks.count { it.status == "DONE" }
                item { ReportMetric(localized(R.string.tasks, language), tasks.size.toString(), { onNavigate(Kinds.TASK) }) }
                item { ReportMetric(localized(R.string.status_done, language), done.toString()) }
                item { ReportMetric(localized(R.string.report_completion, language), if (tasks.isEmpty()) "0%" else "${done * 100 / tasks.size}%") }
                items(tasks.groupingBy { it.status }.eachCount().toList()) { (status, count) ->
                    ReportMetric(statusLabel(status, language), count.toString())
                }
            }
            "report-activity" -> {
                val byId = active.associateBy { it.id }
                if (audits.isEmpty()) item { Text(localized(R.string.empty, language), color = PlannerMuted) }
                items(audits.take(100), key = { it.id }) { audit ->
                    ReportMetric("${formatTimestamp(audit.at, language)} · ${byId[audit.recordId]?.title ?: audit.action}", audit.action)
                }
            }
        }
    }
}
