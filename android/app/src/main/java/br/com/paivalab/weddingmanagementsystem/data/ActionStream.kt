package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import java.time.temporal.ChronoUnit

enum class ActionKind { PAYMENT_OVERDUE, PAYMENT_DUE, TASK_OVERDUE, TASK_DUE, CONTRACT_EXPIRING, RSVP_PENDING, GIFT_THANK }

/**
 * Uma ação concreta do painel. `recordId` aponta para o registro a abrir;
 * quando nulo, a ação leva à lista do módulo em `section`.
 */
data class ActionItem(
    val id: String,
    val kind: ActionKind,
    val section: String,
    val recordId: String?,
    val dueDate: LocalDate?,
    val priority: Int,
    val finance: Boolean,
    val label: String = "",
    val amountCents: Long? = null,
    val days: Int = 0,
    val count: Int = 0,
)

/** Porta de `src/lib/action-stream.ts`: mesmas janelas, pesos e ordenação. */
object ActionStream {
    private val unsignedContract = setOf("DRAFT", "SENT", "NEGOTIATING")

    fun compute(
        index: RecordIndex,
        today: LocalDate,
        dueSoonDays: Int = 14,
        contractExpiryDays: Int = 30,
    ): List<ActionItem> {
        val items = mutableListOf<ActionItem>()
        fun vendorName(record: PlannerRecord) = index.find(record.parentId)?.title ?: "—"
        fun daysTo(date: LocalDate) = ChronoUnit.DAYS.between(today, date).toInt()

        index.kind(Kinds.PAYMENT).forEach { payment ->
            if (payment.status != "PENDING") return@forEach
            val due = payment.date?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return@forEach
            val days = daysTo(due)
            if (days < 0) {
                items += ActionItem("payment-overdue-${payment.id}", ActionKind.PAYMENT_OVERDUE, Kinds.PAYMENT, payment.id, due,
                    1000 + minOf(-days, 365), true, vendorName(payment), payment.amountCents ?: 0L, -days)
            } else if (days <= dueSoonDays) {
                items += ActionItem("payment-due-${payment.id}", ActionKind.PAYMENT_DUE, Kinds.PAYMENT, payment.id, due,
                    700 + (dueSoonDays - days), true, vendorName(payment), payment.amountCents ?: 0L, days)
            }
        }

        index.kind(Kinds.TASK).forEach { task ->
            if (task.status == "DONE") return@forEach
            val deadline = task.date?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return@forEach
            val days = daysTo(deadline)
            val bump = if (ExtraFields.text(index.extra(task), "priority") in setOf("HIGH", "URGENT")) 50 else 0
            if (days < 0) {
                items += ActionItem("task-overdue-${task.id}", ActionKind.TASK_OVERDUE, Kinds.TASK, task.id, deadline,
                    900 + minOf(-days, 365) + bump, false, task.title, days = -days)
            } else if (days <= dueSoonDays) {
                items += ActionItem("task-due-${task.id}", ActionKind.TASK_DUE, Kinds.TASK, task.id, deadline,
                    500 + (dueSoonDays - days) + bump, false, task.title, days = days)
            }
        }

        index.kind(Kinds.CONTRACT).forEach { contract ->
            if (contract.status !in unsignedContract) return@forEach
            val expires = ExtraFields.day(index.extra(contract), "expiresAt") ?: return@forEach
            val days = daysTo(expires)
            if (days < 0 || days > contractExpiryDays) return@forEach
            items += ActionItem("contract-${contract.id}", ActionKind.CONTRACT_EXPIRING, Kinds.CONTRACT, contract.id, expires,
                600 + (contractExpiryDays - days), true, vendorName(contract), days = days)
        }

        val rsvpPending = index.kind(Kinds.GUEST).count { it.status == "INVITED" }
        if (rsvpPending > 0) {
            items += ActionItem("rsvp-pending", ActionKind.RSVP_PENDING, Kinds.GUEST, null, null, 400, false, count = rsvpPending)
        }
        val giftsToThank = index.kind(Kinds.GIFT).count { !GiftRules.thanked(it, index.extra(it)) }
        if (giftsToThank > 0) {
            items += ActionItem("gift-thank", ActionKind.GIFT_THANK, Kinds.GIFT, null, null, 200, false, count = giftsToThank)
        }

        return items.sortedWith(
            compareByDescending<ActionItem> { it.priority }
                .thenBy(nullsLast()) { it.dueDate }
                .thenBy { it.id },
        )
    }
}

object GiftRules {
    /** A web só olha `thankedAt`; o status THANKED vem de backups antigos do Android. */
    fun thanked(gift: PlannerRecord, extra: org.json.JSONObject): Boolean =
        ExtraFields.has(extra, "thankedAt") || gift.status == "THANKED"
}
