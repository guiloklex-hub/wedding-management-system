package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import java.time.YearMonth
import kotlin.math.min

data class MonthlyCashflow(
    val month: YearMonth,
    val startingCents: Long,
    val incomeCents: Long,
    val outflowCents: Long,
    val endingCents: Long,
) {
    val negative: Boolean get() = endingCents < 0
}

object FinanceRules {
    fun monthlyCashflow(records: List<PlannerRecord>, eventDate: LocalDate, today: LocalDate): List<MonthlyCashflow> {
        val active = records.filter { it.deletedAt == null }
        val first = YearMonth.from(today)
        val last = YearMonth.from(eventDate)
        if (last < first) return emptyList()
        val assets = active.filter { it.kind == Kinds.ASSET }.sumOf { it.amountCents ?: 0 }
        val incomes = active.filter { it.kind == Kinds.INCOME && it.status != "CANCELLED" }
        val isMonthly = { record: PlannerRecord -> ExtraFields.text(ExtraFields.parse(record.extraJson), "frequency") == "MONTHLY" }
        val monthly = incomes.filter(isMonthly)
            .sumOf { it.amountCents ?: 0 }
        // Como a web: a receita entra no mês em que foi recebida e, antes disso, no mês previsto.
        val once = incomes.filterNot(isMonthly)
            .groupBy { income ->
                ExtraFields.instant(ExtraFields.parse(income.extraJson), "receivedAt")
                    ?.let { YearMonth.from(InsightsRules.utcDay(it)).toString() } ?: income.date?.take(7)
            }.mapValues { (_, rows) -> rows.sumOf { it.amountCents ?: 0 } }
        val outflow = active.filter { it.kind == Kinds.PAYMENT && it.status != "PAID" }
            .groupBy { it.date?.take(7) }.mapValues { (_, rows) -> rows.sumOf { it.amountCents ?: 0 } }
        var running = assets
        return (0..min(120L, java.time.temporal.ChronoUnit.MONTHS.between(first, last)).toInt()).map { offset ->
            val month = first.plusMonths(offset.toLong())
            val income = monthly + (once[month.toString()] ?: 0)
            val spending = outflow[month.toString()] ?: 0
            MonthlyCashflow(month, running, income, spending, running + income - spending).also { running = it.endingCents }
        }
    }

    /** Orçamento previsto como na web: soma de `estimatedValue` dos itens. */
    fun budgetEstimated(records: List<PlannerRecord>): Long =
        records.filter { it.kind == Kinds.BUDGET && it.deletedAt == null }.sumOf { it.estimatedCents ?: it.amountCents ?: 0L }

    /** Valor real como na web: `actualValue ?? estimatedValue`. */
    fun budgetActual(records: List<PlannerRecord>): Long =
        records.filter { it.kind == Kinds.BUDGET && it.deletedAt == null }.sumOf { it.amountCents ?: it.estimatedCents ?: 0L }

    fun expectedContractedFraction(daysToEvent: Long): Double = when {
        daysToEvent > 365 -> .3
        daysToEvent > 180 -> .6
        daysToEvent > 90 -> .85
        daysToEvent > 30 -> .95
        else -> 1.0
    }
}
