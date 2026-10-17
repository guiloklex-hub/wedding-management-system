package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.roundToLong

data class VendorFunnel(val negotiation: Int, val contracted: Int, val finalized: Int) {
    val total: Int get() = negotiation + contracted + finalized
}

data class RsvpCounts(val invited: Int, val confirmed: Int, val declined: Int, val maybe: Int, val plusOnesConfirmed: Int, val total: Int)

data class GiftProgress(val total: Int, val cashCount: Int, val cashTotalCents: Long, val thanked: Int) {
    val thankedRatio: Float get() = if (total == 0) 0f else thanked.toFloat() / total
}

data class TaskStats(val total: Int, val done: Int, val overdue: Int)

/** Números do painel calculados como em `src/lib/reports/dashboard-data.ts`. */
data class DashboardMetrics(
    val totalBudgetCents: Long,
    val contingencyCents: Long,
    val contractedCents: Long,
    val paidCents: Long,
    val remainingCents: Long,
    val assetsCents: Long,
    val funnel: VendorFunnel,
    val rsvp: RsvpCounts,
    val gifts: GiftProgress,
    val tasks: TaskStats,
    val upcomingPayments: List<PlannerRecord>,
    val daysToEvent: Long?,
) {
    val paidRatio: Float get() = if (totalBudgetCents <= 0L) 0f else (paidCents.toFloat() / totalBudgetCents).coerceIn(0f, 1f)

    /** Percentual do saldo devedor coberto pelo caixa; nulo quando já está tudo pago. */
    val coveragePercent: Int? get() =
        if (remainingCents <= 0L) null else minOf(100, ((assetsCents.toDouble() / remainingCents) * 100).roundToLong().toInt())

    /** Alerta de quitação da web: faltam 20 dias ou menos e ainda há saldo. */
    val showSettleAlert: Boolean get() = daysToEvent != null && daysToEvent <= 20 && remainingCents > 0L

    companion object {
        fun compute(index: RecordIndex, contingencyPercent: Int, eventDate: LocalDate?, today: LocalDate): DashboardMetrics {
            val vendors = index.kind(Kinds.VENDOR)
            var budget = 0L
            var contracted = 0L
            // Como na web, o total vem dos itens ligados a um fornecedor ativo.
            vendors.forEach { vendor ->
                val cost = index.children(vendor.id, Kinds.BUDGET).sumOf { it.amountCents ?: it.estimatedCents ?: 0L }
                budget += cost
                if (vendor.status == "CONTRACTED" || vendor.status == "FINALIZED") contracted += cost
            }
            val contingency = (contracted * contingencyPercent / 100.0).roundToLong()
            val totalBudget = budget + contingency
            val paid = index.kind(Kinds.PAYMENT).filter { it.status == "PAID" }.sumOf { it.amountCents ?: 0L }
            val assets = index.kind(Kinds.ASSET).sumOf { it.amountCents ?: 0L }

            val guests = index.kind(Kinds.GUEST)
            val rsvp = RsvpCounts(
                invited = guests.count { it.status == "INVITED" },
                confirmed = guests.count { it.status == "CONFIRMED" },
                declined = guests.count { it.status == "DECLINED" },
                maybe = guests.count { it.status == "MAYBE" },
                plusOnesConfirmed = guests.sumOf { it.plusOnesConfirmed },
                total = guests.size,
            )

            val gifts = index.kind(Kinds.GIFT)
            val cash = gifts.filter { ExtraFields.text(index.extra(it), "type") == "CASH" }
            val giftProgress = GiftProgress(gifts.size, cash.size, cash.sumOf { it.amountCents ?: 0L },
                gifts.count { GiftRules.thanked(it, index.extra(it)) })

            val todayText = today.toString()
            val tasks = index.kind(Kinds.TASK)
            val taskStats = TaskStats(
                total = tasks.size,
                done = tasks.count { it.status == "DONE" },
                overdue = tasks.count { it.status != "DONE" && !it.date.isNullOrBlank() && it.date < todayText },
            )

            val limit = today.plusDays(30).toString()
            val upcoming = index.kind(Kinds.PAYMENT)
                .filter { it.status == "PENDING" && it.date != null && it.date >= todayText && it.date <= limit }
                .sortedBy { it.date }
                .take(6)

            return DashboardMetrics(
                totalBudgetCents = totalBudget,
                contingencyCents = contingency,
                contractedCents = contracted,
                paidCents = paid,
                remainingCents = totalBudget - paid,
                assetsCents = assets,
                funnel = VendorFunnel(
                    vendors.count { it.status == "NEGOTIATION" },
                    vendors.count { it.status == "CONTRACTED" },
                    vendors.count { it.status == "FINALIZED" },
                ),
                rsvp = rsvp,
                gifts = giftProgress,
                tasks = taskStats,
                upcomingPayments = upcoming,
                daysToEvent = eventDate?.let { ChronoUnit.DAYS.between(today, it) },
            )
        }
    }
}

enum class EventPhase { TWELVE_MONTHS, SIX_MONTHS, THREE_MONTHS, ONE_MONTH, ONE_WEEK, PAST }

/** Porta de `src/lib/event-phases.ts`. */
object EventPhases {
    val shown = listOf(EventPhase.TWELVE_MONTHS, EventPhase.SIX_MONTHS, EventPhase.THREE_MONTHS, EventPhase.ONE_MONTH, EventPhase.ONE_WEEK)

    fun phase(daysToEvent: Long): EventPhase = when {
        daysToEvent < 0 -> EventPhase.PAST
        daysToEvent <= 7 -> EventPhase.ONE_WEEK
        daysToEvent <= 30 -> EventPhase.ONE_MONTH
        daysToEvent <= 90 -> EventPhase.THREE_MONTHS
        daysToEvent <= 180 -> EventPhase.SIX_MONTHS
        else -> EventPhase.TWELVE_MONTHS
    }

    /** Progresso 0..1 ao longo dos ~12 meses até o evento. */
    fun progress(daysToEvent: Long): Float = when {
        daysToEvent <= 0 -> 1f
        daysToEvent >= 365 -> 0f
        else -> (365 - daysToEvent) / 365f
    }
}

object TaskRules {
    /**
     * `completedAt` como na Server Action web: grava ao concluir, mantém o
     * instante original se já estava concluída e limpa ao reabrir.
     */
    fun withCompletion(previous: PlannerRecord?, next: PlannerRecord, now: Long): PlannerRecord {
        if (next.kind != Kinds.TASK) return next
        val extra = ExtraFields.parse(next.extraJson)
        if (next.status == "DONE") {
            if (ExtraFields.has(extra, "completedAt")) return next
            val original = previous?.takeIf { it.status == "DONE" }
                ?.let { ExtraFields.instant(ExtraFields.parse(it.extraJson), "completedAt") }
            extra.put("completedAt", original ?: now)
        } else {
            if (!extra.has("completedAt")) return next
            extra.remove("completedAt")
        }
        return next.copy(extraJson = extra.toString())
    }
}
