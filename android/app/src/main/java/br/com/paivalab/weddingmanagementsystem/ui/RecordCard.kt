package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Event
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.ExtraFields
import br.com.paivalab.weddingmanagementsystem.data.GiftRules
import br.com.paivalab.weddingmanagementsystem.data.GoalRules
import br.com.paivalab.weddingmanagementsystem.data.GuestRules
import br.com.paivalab.weddingmanagementsystem.data.IncomeRules
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PaymentAdjustment
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import br.com.paivalab.weddingmanagementsystem.data.VendorCategories
import java.time.LocalDate
import kotlin.math.roundToInt

@Composable
fun honeymoonKindLabel(kind: String): String = stringResource(
    when (kind) {
        "FLIGHT" -> R.string.hm_flight
        "HOTEL" -> R.string.hm_hotel
        "TRANSFER" -> R.string.hm_transfer
        "ACTIVITY" -> R.string.hm_activity
        "DOCUMENT" -> R.string.hm_document
        "BAGGAGE" -> R.string.hm_baggage
        else -> R.string.hm_other
    },
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun RecordCard(
    record: PlannerRecord,
    index: RecordIndex,
    currency: String,
    language: String,
    onClick: () -> Unit,
) {
    val extra = index.extra(record)
    val parent = index.find(record.parentId)
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(record.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                if (record.subtitle.isNotBlank() && record.kind != Kinds.INCOME) {
                    Text(record.subtitle, maxLines = 2, overflow = TextOverflow.Ellipsis, color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
                }
            }
            if (record.status.isNotBlank()) {
                Spacer(Modifier.width(8.dp))
                StatusBadge(record.status, language)
            }
        }

        if (parent != null) InfoBadge(stringResource(R.string.linked_to, parent.title), PlannerChampagne)

        when (record.kind) {
            Kinds.VENDOR -> {
                VendorCategories.key(extra)?.let { key -> InfoBadge(stringResource(categoryLabel(key)), categoryColor(key)) }
                val rating = ExtraFields.int(extra, "rating") ?: 0
                if (rating in 1..5) {
                    val description = stringResource(R.string.rating_value, rating)
                    Text(
                        "★".repeat(rating) + "☆".repeat(5 - rating),
                        color = PlannerChampagne,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.semantics { contentDescription = description },
                    )
                }
                ContactLine(record, PlannerMuted)
            }
            Kinds.VENUE -> {
                val address = ExtraFields.text(extra, "address")
                if (address.isNotBlank()) Text(address, color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
                val seated = ExtraFields.int(extra, "capacitySeated")
                val standing = ExtraFields.int(extra, "capacityStanding")
                val checks = index.children(record.id, Kinds.VENUE_CHECK)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (ExtraFields.bool(extra, "isShortlisted")) InfoBadge(stringResource(R.string.venue_shortlisted), PlannerChampagne)
                    if (seated != null || standing != null) {
                        InfoBadge(stringResource(R.string.venue_capacity_value, seated?.toString() ?: "—", standing?.toString() ?: "—"), PlannerMuted)
                    }
                    if (checks.isNotEmpty()) {
                        val done = checks.count { it.status == "DONE" }
                        InfoBadge(stringResource(R.string.venue_checklist_progress, done, checks.size),
                            if (done == checks.size) PlannerEmerald else PlannerChampagne)
                    }
                    InfoBadge(record.date?.let { stringResource(R.string.venue_visited_value, formatDisplayDate(it, language)) }
                        ?: stringResource(R.string.venue_not_visited), if (record.date != null) PlannerEmerald else PlannerMuted)
                }
            }
            Kinds.INCOME -> {
                val givenBy = ExtraFields.text(extra, "givenByName")
                val receivedAt = ExtraFields.instant(extra, "receivedAt")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    InfoBadge(stringResource(incomeSourceLabel(IncomeRules.source(record))), PlannerChampagne)
                    if (ExtraFields.text(extra, "frequency") == "MONTHLY") InfoBadge(stringResource(R.string.monthly), PlannerMuted)
                    if (givenBy.isNotBlank()) InfoBadge(stringResource(R.string.income_given_by_value, givenBy), PlannerMuted)
                    if (record.status == "RECEIVED" && receivedAt != null) {
                        val day = java.time.Instant.ofEpochMilli(receivedAt).atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString()
                        InfoBadge(stringResource(R.string.income_received_on, formatDisplayDate(day, language)), PlannerEmerald)
                    }
                }
            }
            Kinds.CONTACT -> ContactLine(record, PlannerChampagne)
            Kinds.VENDOR_NOTE -> if (record.notes.isNotBlank()) {
                Text(record.notes, maxLines = 3, overflow = TextOverflow.Ellipsis, color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
            }
            Kinds.PAYMENT -> {
                val number = ExtraFields.int(extra, "installmentNumber") ?: 0
                val total = ExtraFields.int(extra, "totalInstallments") ?: 0
                val method = ExtraFields.text(extra, "method")
                val adjustment = PaymentAdjustment.compute(record)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (number > 0 && total > 0) InfoBadge(stringResource(R.string.installment_of, number, total), PlannerChampagne)
                    if (method.isNotBlank()) InfoBadge(webValueLabel(method, language), PlannerEmerald)
                    if (adjustment.lateDays > 0) {
                        val days = adjustment.lateDays.toInt()
                        InfoBadge(
                            if (adjustment.hasAdjustment) {
                                plural(R.plurals.late_days_adjusted, days, days,
                                    localizedCurrency(adjustment.adjustedCents, currency, language))
                            } else plural(R.plurals.overdue_days, days, days),
                            PlannerRose,
                        )
                    }
                }
            }
            Kinds.TASK -> {
                val priority = ExtraFields.text(extra, "priority")
                val responsible = ExtraFields.text(extra, "responsible")
                val venue = index.find(ExtraFields.text(extra, "venueId").ifBlank { null })
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (priority.isNotBlank()) {
                        InfoBadge("${stringResource(R.string.priority)}: ${webValueLabel(priority, language)}", priorityColor(priority))
                    }
                    if (responsible.isNotBlank()) InfoBadge(stringResource(R.string.task_responsible_value, responsible), PlannerMuted)
                    if (venue != null) InfoBadge(venue.title, PlannerChampagne)
                }
            }
            Kinds.GUEST -> {
                val side = ExtraFields.text(extra, "side")
                val dietary = ExtraFields.text(extra, "dietary")
                val city = ExtraFields.text(extra, "city")
                val seats = 1 + record.plusOnesConfirmed
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    InfoBadge(plural(R.plurals.guest_seats, seats, seats, record.plusOnesConfirmed, record.plusOnesAllowed), PlannerEmerald)
                    if (side.isNotBlank()) InfoBadge(webValueLabel(side, language), PlannerChampagne)
                    if (ExtraFields.bool(extra, "isVIP")) InfoBadge(stringResource(R.string.guest_vip), PlannerRose)
                    if (ExtraFields.bool(extra, "isPadrinho")) InfoBadge(stringResource(R.string.guest_padrinho), PlannerChampagne)
                    if (ExtraFields.bool(extra, "isChild")) InfoBadge(stringResource(R.string.guest_child), PlannerEmerald)
                    if (dietary.isNotBlank()) InfoBadge(stringResource(R.string.guest_dietary_value, dietary), PlannerRose)
                    if (city.isNotBlank()) InfoBadge(city, PlannerMuted)
                    ExtraFields.int(extra, "age")?.let { InfoBadge(plural(R.plurals.guest_age_value, it, it), PlannerMuted) }
                    if (ExtraFields.has(extra, "checkedInAt")) InfoBadge(stringResource(R.string.guest_checked_in), PlannerEmerald)
                    index.find(record.guestGroupId)?.let { InfoBadge(stringResource(R.string.group_value, it.title), PlannerChampagne) }
                    index.find(record.seatingTableId)?.let { InfoBadge(stringResource(R.string.table_value, it.title), PlannerChampagne) }
                    index.tagIdsByGuest[record.id].orEmpty().mapNotNull { index.find(it)?.title }.forEach { InfoBadge(it, PlannerRose) }
                }
            }
            Kinds.GROUP -> {
                val members = index.groupMembers(record.id)
                val summary = GuestRules.summarizeGroup(record, members)
                val contactName = ExtraFields.text(extra, "contactName")
                if (contactName.isNotBlank()) Text(stringResource(R.string.group_contact_value, contactName), color = PlannerMuted,
                    style = MaterialTheme.typography.bodySmall)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    InfoBadge(plural(R.plurals.group_members, members.size, members.size,
                        members.sumOf { 1 + it.plusOnesConfirmed }), PlannerChampagne)
                    if (members.isNotEmpty()) {
                        InfoBadge(stringResource(R.string.group_rsvp_summary, summary.confirmed, summary.declined, summary.pending), PlannerEmerald)
                    }
                    when {
                        !summary.willReceive -> InfoBadge(stringResource(R.string.group_no_contact), PlannerDanger)
                        summary.fallbackName != null -> InfoBadge(stringResource(R.string.group_contact_fallback, summary.fallbackName), PlannerMuted)
                    }
                }
            }
            Kinds.GIFT -> {
                val type = GiftRules.type(extra)
                val giverName = ExtraFields.text(extra, "giverName")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    InfoBadge(stringResource(if (type == "CASH") R.string.gift_type_cash else R.string.gift_type_item),
                        if (type == "CASH") PlannerEmerald else PlannerChampagne)
                    if (parent == null) InfoBadge(giverName.ifBlank { stringResource(R.string.gift_anonymous) }, PlannerMuted)
                    if (type == "CASH" && ExtraFields.bool(extra, "isHoneymoonShare")) InfoBadge(stringResource(R.string.gift_honeymoon_share), PlannerRose)
                    if (GiftRules.processed(record, extra)) InfoBadge(stringResource(R.string.gift_posted), PlannerEmerald)
                }
            }
            Kinds.TAG -> {
                val count = index.guestsWithTag(record.id)
                InfoBadge(plural(R.plurals.tag_guests, count, count), PlannerChampagne)
            }
            Kinds.GOAL -> {
                val progress = GoalRules.progress(record, index, LocalDate.now())
                val ratio = (progress.percent / 100).toFloat()
                if (!progress.active) InfoBadge(stringResource(R.string.goal_inactive), PlannerMuted)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(stringResource(R.string.saved_amount, localizedCurrency(progress.savedCents, currency, language)),
                        style = MaterialTheme.typography.labelSmall, color = PlannerEmerald)
                    Text("${progress.percent.roundToInt()}%", style = MaterialTheme.typography.labelSmall, color = PlannerChampagne,
                        fontWeight = FontWeight.Bold)
                }
                PlannerProgressBar(ratio, if (progress.percent >= 100.0) PlannerChampagne else PlannerEmerald)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    InfoBadge(stringResource(R.string.goal_remaining, localizedCurrency(progress.remainingCents, currency, language)), PlannerRose)
                    InfoBadge(stringResource(R.string.goal_per_month, progress.perMonthCents?.let { localizedCurrency(it, currency, language) } ?: "—"),
                        PlannerChampagne)
                    InfoBadge(stringResource(R.string.goal_contributions, progress.contributions), PlannerMuted)
                }
            }
            Kinds.HONEYMOON -> {
                val itemsTotal = index.children(record.id, Kinds.HONEYMOON_ITEM).sumOf { it.amountCents ?: 0L }
                if (itemsTotal > 0L) {
                    InfoBadge(stringResource(R.string.honeymoon_items_total, localizedCurrency(itemsTotal, currency, language)), PlannerEmerald)
                }
            }
            Kinds.HONEYMOON_ITEM -> {
                val itemKind = ExtraFields.text(extra, "kind")
                val confirmation = ExtraFields.text(extra, "confirmationNumber")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (itemKind.isNotBlank()) InfoBadge(honeymoonKindLabel(itemKind), PlannerChampagne)
                    if (confirmation.isNotBlank()) InfoBadge(stringResource(R.string.booking_code, confirmation), PlannerEmerald)
                }
            }
            Kinds.TROUSSEAU -> {
                val room = ExtraFields.text(extra, "room")
                val store = ExtraFields.text(extra, "store")
                val priority = ExtraFields.text(extra, "priority")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (room.isNotBlank()) InfoBadge(webValueLabel(room, language), PlannerChampagne)
                    if (store.isNotBlank()) InfoBadge(store, PlannerEmerald)
                    if (priority.isNotBlank()) {
                        InfoBadge("${stringResource(R.string.priority)}: ${webValueLabel(priority, language)}", priorityColor(priority))
                    }
                }
            }
            Kinds.INVITATION, Kinds.SAVE_THE_DATE -> {
                val count = index.children(record.id).count { it.kind in setOf("invitation_log", "save_the_date_log") }
                InfoBadge("${stringResource(R.string.confirmed_sends)}: $count", PlannerChampagne)
                if (record.notes.isNotBlank()) {
                    Text(record.notes, maxLines = 2, overflow = TextOverflow.Ellipsis, color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        if (record.kind in setOf(Kinds.BUDGET, Kinds.TROUSSEAU)) {
            val estimated = record.estimatedCents ?: 0L
            val actual = record.amountCents ?: 0L
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                if (record.estimatedCents != null || record.kind == Kinds.BUDGET) {
                    Text("${stringResource(R.string.report_estimated)}: ${localizedCurrency(estimated, currency, language)}",
                        color = PlannerMuted, style = MaterialTheme.typography.bodySmall)
                }
                if (record.amountCents != null) {
                    Text(
                        "${stringResource(R.string.budget_actual)}: ${localizedCurrency(actual, currency, language)}",
                        color = if (estimated > 0L && actual > estimated) PlannerRose else PlannerEmerald,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (record.kind !in setOf(Kinds.BUDGET, Kinds.TROUSSEAU) && record.amountCents != null) {
                if (record.kind == Kinds.TABLE) {
                    val occupied = index.tableOccupancy(record.id)
                    val capacity = record.amountCents
                    InfoBadge("$occupied / $capacity ${stringResource(R.string.seats)}", if (occupied <= capacity) PlannerEmerald else PlannerRose)
                } else {
                    Text(localizedCurrency(record.amountCents, currency, language), color = PlannerChampagne,
                        style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                }
            }
            if (!record.date.isNullOrBlank() && record.kind != Kinds.VENUE) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Default.Event, null, tint = PlannerMuted, modifier = Modifier.size(14.dp))
                    Text(if (record.kind == Kinds.GOAL) stringResource(R.string.goal_target_date, formatDisplayDate(record.date, language))
                        else formatDisplayDate(record.date, language), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                }
            }
        }
    }
}

@Composable
private fun ContactLine(record: PlannerRecord, color: androidx.compose.ui.graphics.Color) {
    val line = listOf(record.phone, record.email).filter { it.isNotBlank() }.joinToString(" · ")
    if (line.isNotBlank()) Text(line, color = color, style = MaterialTheme.typography.bodySmall)
}
