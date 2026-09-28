package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import java.time.YearMonth
import kotlin.math.min
import kotlin.math.roundToInt

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
    private val monthlyFrequency = Regex("\\\"frequency\\\"\\s*:\\s*\\\"MONTHLY\\\"")
    fun monthlyCashflow(records: List<PlannerRecord>, eventDate: LocalDate, today: LocalDate): List<MonthlyCashflow> {
        val active = records.filter { it.deletedAt == null }
        val first = YearMonth.from(today)
        val last = YearMonth.from(eventDate)
        if (last < first) return emptyList()
        val assets = active.filter { it.kind == Kinds.ASSET }.sumOf { it.amountCents ?: 0 }
        val incomes = active.filter { it.kind == Kinds.INCOME && it.status != "CANCELLED" }
        val monthly = incomes.filter { monthlyFrequency.containsMatchIn(it.extraJson) }
            .sumOf { it.amountCents ?: 0 }
        val once = incomes.filterNot { monthlyFrequency.containsMatchIn(it.extraJson) }
            .groupBy { it.date?.take(7) }.mapValues { (_, rows) -> rows.sumOf { it.amountCents ?: 0 } }
        val outflow = active.filter { it.kind == Kinds.PAYMENT }
            .groupBy { it.date?.take(7) }.mapValues { (_, rows) -> rows.sumOf { it.amountCents ?: 0 } }
        var running = assets
        return (0..min(120L, java.time.temporal.ChronoUnit.MONTHS.between(first, last)).toInt()).map { offset ->
            val month = first.plusMonths(offset.toLong())
            val income = monthly + (once[month.toString()] ?: 0)
            val spending = outflow[month.toString()] ?: 0
            MonthlyCashflow(month, running, income, spending, running + income - spending).also { running = it.endingCents }
        }
    }

    fun expectedContractedFraction(daysToEvent: Long): Double = when {
        daysToEvent > 365 -> .3
        daysToEvent > 180 -> .6
        daysToEvent > 90 -> .85
        daysToEvent > 30 -> .95
        else -> 1.0
    }

    fun healthScore(
        budgetCents: Long, contractedCents: Long, paidCents: Long, cashCents: Long,
        daysToEvent: Long, totalTasks: Int, tasksDone: Int, tasksOverdue: Int, worstBalanceCents: Long,
    ): Int {
        val contracted = if (budgetCents > 0) (contractedCents.toDouble() / budgetCents).coerceIn(0.0, 1.0) else 0.0
        val paid = if (budgetCents > 0) (paidCents.toDouble() / budgetCents).coerceIn(0.0, 1.0) else 0.0
        val taskRatio = if (totalTasks > 0) tasksDone.toDouble() / totalTasks else 0.0
        val overdue = if (totalTasks > 0) tasksOverdue.toDouble() / totalTasks else 0.0
        val cash = if (budgetCents > 0) (cashCents.toDouble() / maxOf(budgetCents - paidCents, 1)).coerceIn(0.0, 1.0) else 0.0
        val onTrack = (contracted / expectedContractedFraction(daysToEvent)).coerceIn(0.0, 1.0)
        val liquidity = if (worstBalanceCents >= 0) 1.0 else 0.0
        return (100 * (contracted * .25 + paid * .20 + liquidity * .20 +
            (taskRatio - overdue).coerceAtLeast(0.0) * .15 + onTrack * .10 + cash * .10)).roundToInt()
    }
}
