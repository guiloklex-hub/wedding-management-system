package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R

@Composable
fun statusLabel(status: String, language: String): String {
    val resource = when (status) {
        "TODO" -> R.string.status_todo
        "IN_PROGRESS" -> R.string.status_in_progress
        "DONE" -> R.string.status_done
        "BLOCKED" -> R.string.status_blocked
        "NEGOTIATION" -> R.string.status_negotiation
        "CONTRACTED" -> R.string.status_contracted
        "FINALIZED" -> R.string.status_finalized
        "NOT_INVITED" -> R.string.status_not_invited
        "INVITED" -> R.string.status_invited
        "CONFIRMED" -> R.string.status_confirmed
        "DECLINED" -> R.string.status_declined
        "MAYBE" -> R.string.status_maybe
        "PENDING" -> R.string.status_pending
        "PAID" -> R.string.status_paid
        "EXPECTED" -> R.string.status_expected
        "RECEIVED" -> R.string.status_received
        "CANCELLED" -> R.string.status_cancelled
        "THANKED" -> R.string.status_thanked
        "PROCESSED" -> R.string.status_processed
        "PLANNED" -> R.string.status_planned
        "BOOKED" -> R.string.status_booked
        "TO_BUY" -> R.string.status_to_buy
        "BOUGHT" -> R.string.status_bought
        "GIFTED" -> R.string.status_gifted
        "DRAFT" -> R.string.status_draft
        "SIGNED" -> R.string.status_signed
        "EXPIRED" -> R.string.status_expired
        "SENT" -> R.string.status_sent
        "NEGOTIATING" -> R.string.status_negotiation
        "SIGNED_DIGITAL" -> R.string.status_signed_digital
        "SIGNED_PHYSICAL" -> R.string.status_signed_physical
        else -> return status
    }
    return localized(resource, language)
}

fun statusColor(status: String): Color = when (status) {
    "DONE", "PAID", "CONFIRMED", "FINALIZED", "SIGNED", "SIGNED_DIGITAL", "SIGNED_PHYSICAL", "RECEIVED", "PROCESSED", "BOUGHT", "GIFTED", "THANKED", "SENT" -> PlannerEmerald
    "IN_PROGRESS", "NEGOTIATION", "NEGOTIATING", "CONTRACTED", "INVITED", "MAYBE", "PENDING", "EXPECTED", "BOOKED", "PLANNED" -> PlannerChampagne
    "BLOCKED", "DECLINED", "CANCELLED", "EXPIRED" -> PlannerRose
    else -> PlannerMuted
}

@Composable
fun StatusBadge(status: String, language: String) {
    if (status.isBlank()) return
    val color = statusColor(status)
    Surface(
        shape = RoundedCornerShape(50),
        color = color.copy(alpha = 0.14f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.40f)),
    ) {
        Text(
            text = statusLabel(status, language),
            color = color,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}

@Composable
fun InfoBadge(text: String, color: Color = PlannerChampagne) {
    if (text.isBlank()) return
    Surface(
        shape = RoundedCornerShape(50),
        color = color.copy(alpha = 0.12f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.32f)),
    ) {
        Text(
            text = text,
            color = color,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}

@Composable
fun webValueLabel(value: String, language: String): String {
    val resource = when (value) {
        "URGENT" -> R.string.priority_urgent
        "HIGH" -> R.string.priority_high
        "MEDIUM" -> R.string.priority_medium
        "LOW" -> R.string.priority_low
        "ESSENTIAL" -> R.string.priority_essential
        "NICE_TO_HAVE" -> R.string.priority_nice_to_have
        "LUXURY" -> R.string.priority_luxury
        "PIX" -> R.string.method_pix
        "BOLETO" -> R.string.method_boleto
        "CREDIT" -> R.string.method_credit
        "TRANSFER" -> R.string.method_transfer
        "CASH" -> R.string.method_cash
        "NOIVA" -> R.string.side_bride
        "NOIVO" -> R.string.side_groom
        "AMBOS" -> R.string.side_both
        "KITCHEN" -> R.string.room_kitchen
        "BATHROOM" -> R.string.room_bathroom
        "BEDROOM" -> R.string.room_bedroom
        "LIVING" -> R.string.room_living
        "LAUNDRY" -> R.string.room_laundry
        "ELECTRONICS" -> R.string.room_electronics
        "OTHER" -> R.string.room_other
        else -> return value
    }
    return localized(resource, language)
}

fun priorityColor(priority: String): Color = when (priority) {
    "URGENT", "ESSENTIAL" -> PlannerRose
    "HIGH" -> PlannerChampagne
    else -> PlannerMuted
}
