package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

/** Situação de um pagamento para a cor do calendário. */
internal enum class PaymentTone { OVERDUE, PENDING, PAID }

internal fun paymentTone(payment: PlannerRecord, today: String): PaymentTone = when {
    payment.status == "PAID" -> PaymentTone.PAID
    !payment.date.isNullOrBlank() && payment.date < today -> PaymentTone.OVERDUE
    else -> PaymentTone.PENDING
}

@Composable
private fun toneColor(tone: PaymentTone): Color = when (tone) {
    PaymentTone.OVERDUE -> PlannerDanger
    PaymentTone.PENDING -> PlannerAmber
    PaymentTone.PAID -> PlannerEmerald
}

/**
 * Calendário mensal dos pagamentos, como a visão de calendário da web: cada dia
 * mostra a situação mais urgente, e tocar no dia lista os pagamentos dele.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun PaymentCalendar(
    payments: List<PlannerRecord>,
    month: YearMonth,
    selectedDay: String?,
    currency: String,
    language: String,
    onMonth: (YearMonth) -> Unit,
    onDay: (String?) -> Unit,
) {
    val locale = Locale.forLanguageTag(language)
    val today = LocalDate.now().toString()
    val byDay = payments.filter { !it.date.isNullOrBlank() }.groupBy { it.date!!.take(10) }
    val inMonth = payments.filter { it.date?.startsWith(month.toString()) == true }
    fun money(cents: Long) = localizedCurrency(cents, currency, language)
    val firstDay = WeekFields.of(locale).firstDayOfWeek
    val weekdays = (0 until 7).map { firstDay.plus(it.toLong()) }
    val leading = (month.atDay(1).dayOfWeek.value - firstDay.value + 7) % 7
    val cells = List(leading) { null } + (1..month.lengthOfMonth()).map { month.atDay(it) }
    val monthTitle = month.atDay(1).format(DateTimeFormatter.ofPattern("LLLL yyyy", locale)).replaceFirstChar { it.titlecase(locale) }

    Card(
        colors = CardDefaults.cardColors(containerColor = PlannerSurface),
        border = BorderStroke(1.dp, PlannerBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { onMonth(month.minusMonths(1)) }) {
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, stringResource(R.string.calendar_previous_month))
                }
                Text(monthTitle, Modifier.weight(1f), textAlign = TextAlign.Center, style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold)
                IconButton(onClick = { onMonth(month.plusMonths(1)) }) {
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, stringResource(R.string.calendar_next_month))
                }
            }
            Row(Modifier.fillMaxWidth()) {
                weekdays.forEach { day ->
                    Text(day.getDisplayName(TextStyle.NARROW, locale), Modifier.weight(1f), textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                }
            }
            cells.chunked(7).forEach { week ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    week.forEach { date -> DayCell(date, byDay, today, selectedDay, locale, onDay, Modifier.weight(1f)) }
                    repeat(7 - week.size) { Box(Modifier.weight(1f)) }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                InfoBadge(stringResource(R.string.summary_open, money(inMonth.filter { it.status != "PAID" }.sumOf { it.amountCents ?: 0L })),
                    PlannerAmber)
                InfoBadge(stringResource(R.string.summary_paid, money(inMonth.filter { it.status == "PAID" }.sumOf { it.amountCents ?: 0L })),
                    PlannerEmerald)
            }
            Text(stringResource(R.string.calendar_year_summary, month.year), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                (1..12).map { YearMonth.of(month.year, it) }.forEach { candidate ->
                    val total = payments.filter { it.date?.startsWith(candidate.toString()) == true }.sumOf { it.amountCents ?: 0L }
                    val name = candidate.month.getDisplayName(TextStyle.SHORT, locale).replaceFirstChar { it.titlecase(locale) }
                    FilterChip(
                        selected = candidate == month,
                        onClick = { onMonth(candidate) },
                        label = { Text(if (total > 0L) "$name · ${money(total)}" else name, style = MaterialTheme.typography.labelSmall) },
                    )
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    date: LocalDate?,
    byDay: Map<String, List<PlannerRecord>>,
    today: String,
    selectedDay: String?,
    locale: Locale,
    onDay: (String?) -> Unit,
    modifier: Modifier,
) {
    if (date == null) {
        Box(modifier.heightIn(min = 48.dp))
        return
    }
    val key = date.toString()
    val items = byDay[key].orEmpty()
    val tone = items.map { paymentTone(it, today) }.minByOrNull { it.ordinal }
    val selected = key == selectedDay
    val description = if (items.isEmpty()) date.format(DateTimeFormatter.ofPattern("d MMMM", locale))
        else plural(R.plurals.calendar_day_payments, items.size, date.format(DateTimeFormatter.ofPattern("d MMMM", locale)), items.size)
    val accent = tone?.let { toneColor(it) }
    Column(
        modifier
            .heightIn(min = 48.dp)
            .background(if (selected) PlannerRose.copy(alpha = 0.16f) else Color.Transparent, RoundedCornerShape(10.dp))
            .border(1.dp, if (key == today) PlannerChampagne.copy(alpha = 0.6f) else Color.Transparent, RoundedCornerShape(10.dp))
            .clickable(role = Role.Button) { onDay(if (selected) null else key) }
            .semantics { contentDescription = description; this.selected = selected },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(date.dayOfMonth.toString(), style = MaterialTheme.typography.bodySmall,
            fontWeight = if (items.isNotEmpty()) FontWeight.Bold else FontWeight.Normal)
        if (accent != null) Box(Modifier.padding(top = 2.dp).size(6.dp).background(accent, CircleShape))
    }
}
