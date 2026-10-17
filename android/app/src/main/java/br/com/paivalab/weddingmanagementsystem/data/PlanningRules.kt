package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** Checklist do local na ordem de `sortOrder`, como `VenueChecklistItem` da web. */
object VenueChecklist {
    const val VALUE_MAX = 500

    fun sortOrder(item: PlannerRecord): Int = ExtraFields.int(ExtraFields.parse(item.extraJson), "sortOrder") ?: Int.MAX_VALUE

    fun items(index: RecordIndex, venueId: String): List<PlannerRecord> =
        index.children(venueId, Kinds.VENUE_CHECK).sortedWith(compareBy<PlannerRecord>(::sortOrder).thenBy { it.createdAt })

    fun value(item: PlannerRecord): String = ExtraFields.text(ExtraFields.parse(item.extraJson), "value")

    /** Próxima posição: uma depois do maior `sortOrder`, como `addChecklistItem`. */
    fun nextSortOrder(items: List<PlannerRecord>): Int =
        (items.mapNotNull { ExtraFields.int(ExtraFields.parse(it.extraJson), "sortOrder") }.maxOrNull() ?: -1) + 1

    /** Itens com `sortOrder` renumerado depois de mover `id` uma posição para cima (-1) ou para baixo (+1). */
    fun moved(items: List<PlannerRecord>, id: String, delta: Int): List<PlannerRecord> {
        val from = items.indexOfFirst { it.id == id }
        val to = from + delta
        if (from < 0 || to !in items.indices) return emptyList()
        val reordered = items.toMutableList().apply { add(to, removeAt(from)) }
        return reordered.mapIndexedNotNull { position, item ->
            if (sortOrder(item) == position) null
            else item.copy(extraJson = ExtraFields.parse(item.extraJson).put("sortOrder", position).toString())
        }
    }
}

/** Origens de receita aceitas pela web (`incomeActions`). */
object IncomeRules {
    val sources = listOf("SALARY", "BONUS", "GIFT", "FREELANCE", "SALE", "RESTITUTION", "OTHER")

    /** Até a v1.2 a origem era texto livre; o que não for da lista vira OTHER, como na restauração web. */
    fun source(record: PlannerRecord?): String {
        val value = record?.subtitle?.trim()?.uppercase().orEmpty()
        return when {
            value.isEmpty() -> "SALARY"
            value in sources -> value
            else -> "OTHER"
        }
    }

    /** `receivedAt` como em `updateIncome`: mantém o instante original e limpa ao deixar de estar recebida. */
    fun withReceipt(previous: PlannerRecord?, next: PlannerRecord, now: Long): PlannerRecord {
        if (next.kind != Kinds.INCOME) return next
        val extra = ExtraFields.parse(next.extraJson)
        if (next.status == "RECEIVED") {
            if (ExtraFields.has(extra, "receivedAt")) return next
            val original = previous?.takeIf { it.status == "RECEIVED" }
                ?.let { ExtraFields.instant(ExtraFields.parse(it.extraJson), "receivedAt") }
            extra.put("receivedAt", original ?: now)
        } else {
            if (!extra.has("receivedAt")) return next
            extra.remove("receivedAt")
        }
        return next.copy(extraJson = extra.toString())
    }
}

data class GoalProgress(
    val savedCents: Long,
    val remainingCents: Long,
    val percent: Double,
    val perMonthCents: Long?,
    val contributions: Int,
    val active: Boolean,
)

/** Cartão de meta da web (`goals-client.tsx`): falta, por mês e aportes vinculados. */
object GoalRules {
    fun active(goal: PlannerRecord): Boolean = ExtraFields.bool(ExtraFields.parse(goal.extraJson), "isActive", default = true)

    fun progress(goal: PlannerRecord, index: RecordIndex, today: LocalDate): GoalProgress {
        val assets = index.children(goal.id, Kinds.ASSET)
        val target = goal.amountCents ?: 0L
        val saved = assets.sumOf { it.amountCents ?: 0L }
        val remaining = (target - saved).coerceAtLeast(0L)
        val percent = if (target > 0L) (saved.toDouble() / target * 100).coerceAtMost(100.0) else 0.0
        val monthsLeft = goal.date?.let { runCatching { LocalDate.parse(it) }.getOrNull() }?.let { targetDate ->
            val days = ChronoUnit.DAYS.between(today, targetDate)
            if (days <= 0L) 0L else (days + 29L) / 30L
        }
        val perMonth = if (monthsLeft != null && monthsLeft > 0 && remaining > 0) Math.round(remaining.toDouble() / monthsLeft) else null
        return GoalProgress(saved, remaining, percent, perMonth, assets.size, active(goal))
    }

    /** Metas ativas primeiro, como a ordenação da página web. */
    fun ordered(goals: List<PlannerRecord>): List<PlannerRecord> = goals.sortedByDescending(::active)
}
