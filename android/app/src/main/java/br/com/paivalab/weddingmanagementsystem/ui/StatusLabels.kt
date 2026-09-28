package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.runtime.Composable
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
        else -> return status
    }
    return localized(resource, language)
}
