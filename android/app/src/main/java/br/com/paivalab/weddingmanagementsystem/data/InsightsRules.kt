package br.com.paivalab.weddingmanagementsystem.data

import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/** Fatores e pesos de `computeHealthScore` em `src/lib/cashflow.ts`. */
enum class HealthFactor(val weight: Double) { CONTRACTED(.25), PAID(.20), LIQUIDITY(.20), TASKS(.15), ON_TRACK(.10), CASH(.10) }

enum class HealthAdvice { LOW_CONTRACTED, LOW_CASH_COVERAGE, OVERDUE_TASKS, NEGATIVE_MONTH, LOW_PAYMENT_PROGRESS }

data class HealthTip(val advice: HealthAdvice, val args: List<Long> = emptyList())

data class HealthReport(
    val score: Int,
    val factors: Map<HealthFactor, Double>,
    val alerts: List<HealthTip>,
    val recommendations: List<HealthTip>,
)

data class InsightsTotals(val budgetCents: Long, val contractedCents: Long, val paidCents: Long, val cashCents: Long)

data class SCurvePoint(val date: LocalDate, val plannedCents: Long, val paidCents: Long, val lowerCents: Long, val upperCents: Long)

data class BurndownPoint(val date: LocalDate, val ideal: Double, val remaining: Int, val overdue: Int)

/** Categoria do detector de estouro; [categoryKey] nulo usa o texto livre [label], como `resolveCategoryLabel`. */
data class CategoryCreep(val categoryKey: String?, val label: String, val estimatedCents: Long, val actualCents: Long) {
    val deltaCents: Long get() = actualCents - estimatedCents
    val pct: Double get() = if (estimatedCents > 0) deltaCents.toDouble() / estimatedCents else 0.0
}

/** Barra da cascata por categoria; [category] nulo é a barra de total. */
data class WaterfallBar(val category: CategoryCreep?, val deltaCents: Long, val runningCents: Long)

data class PaymentHeatCell(val date: LocalDate, val amountCents: Long, val count: Int)

data class WhatIfResult(val month: YearMonth?, val balanceAtCents: Long, val worstCents: Long, val finalCents: Long)

object InsightsRules {
    fun health(
        totals: InsightsTotals, daysToEvent: Long, totalTasks: Int, tasksDone: Int, tasksOverdue: Int, worstBalanceCents: Long,
    ): HealthReport {
        val budget = totals.budgetCents
        val contracted = if (budget > 0) minOf(totals.contractedCents.toDouble() / budget, 1.0) else 0.0
        val paid = if (budget > 0) minOf(totals.paidCents.toDouble() / budget, 1.0) else 0.0
        val tasks = if (totalTasks > 0) tasksDone.toDouble() / totalTasks else 0.0
        val overdue = if (totalTasks > 0) tasksOverdue.toDouble() / totalTasks else 0.0
        val cash = if (budget > 0) minOf(totals.cashCents.toDouble() / max(budget - totals.paidCents, 1L), 1.0) else 0.0
        val expected = FinanceRules.expectedContractedFraction(daysToEvent)
        val onTrack = minOf(contracted / expected, 1.0)
        val liquidity = if (worstBalanceCents >= 0) 1.0 else 0.0
        val factors = linkedMapOf(
            HealthFactor.CONTRACTED to contracted, HealthFactor.PAID to paid, HealthFactor.LIQUIDITY to liquidity,
            HealthFactor.TASKS to max(tasks - overdue, 0.0), HealthFactor.ON_TRACK to onTrack, HealthFactor.CASH to cash,
        )
        val score = (factors.entries.sumOf { (factor, value) -> value * factor.weight } * 100).roundToInt()

        val lagging = contracted < expected - .15
        val lowCash = cash < .3 && budget - totals.paidCents > 0
        val alerts = buildList {
            if (liquidity == 0.0) add(HealthTip(HealthAdvice.NEGATIVE_MONTH))
            if (overdue > .1) add(HealthTip(HealthAdvice.OVERDUE_TASKS, listOf(percent(overdue))))
            if (lagging) add(HealthTip(HealthAdvice.LOW_CONTRACTED))
            if (lowCash) add(HealthTip(HealthAdvice.LOW_CASH_COVERAGE))
        }
        val recommendations = buildList {
            if (lagging) add(HealthTip(HealthAdvice.LOW_CONTRACTED, listOf(percent(contracted), percent(expected))))
            if (lowCash) add(HealthTip(HealthAdvice.LOW_CASH_COVERAGE, listOf(percent(cash))))
            if (overdue > .1) add(HealthTip(HealthAdvice.OVERDUE_TASKS, listOf(tasksOverdue.toLong(), totalTasks.toLong())))
            if (liquidity == 0.0) add(HealthTip(HealthAdvice.NEGATIVE_MONTH))
            if (paid < .2 && daysToEvent > 90) add(HealthTip(HealthAdvice.LOW_PAYMENT_PROGRESS, listOf(percent(paid), daysToEvent)))
        }
        return HealthReport(score, factors, alerts, recommendations)
    }

    private fun percent(value: Double): Long = (value * 100).roundToLong()

    /** Como `daysUntil` da web: arredonda para cima a distância até a meia-noite UTC do evento. */
    fun daysUntil(eventDate: LocalDate, nowMillis: Long): Long {
        val diff = eventDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() - nowMillis
        return Math.floorDiv(diff + DAY_MS - 1, DAY_MS)
    }

    fun creep(index: RecordIndex): List<CategoryCreep> {
        val groups = linkedMapOf<String, CategoryCreep>()
        index.kind(Kinds.VENDOR).forEach { vendor ->
            val key = VendorCategories.key(index.extra(vendor))
            val items = index.children(vendor.id, Kinds.BUDGET)
            val estimated = items.sumOf { it.estimatedCents ?: it.amountCents ?: 0L }
            val actual = items.sumOf { it.amountCents ?: it.estimatedCents ?: 0L }
            val group = key ?: "text:${vendor.subtitle.trim()}"
            val current = groups[group] ?: CategoryCreep(key, vendor.subtitle.trim(), 0, 0)
            groups[group] = current.copy(estimatedCents = current.estimatedCents + estimated, actualCents = current.actualCents + actual)
        }
        return groups.values.sortedByDescending { it.deltaCents }
    }

    fun waterfall(creep: List<CategoryCreep>): List<WaterfallBar> {
        var running = 0L
        val bars = creep.sortedByDescending { it.deltaCents }.filter { it.deltaCents != 0L }.map {
            running += it.deltaCents
            WaterfallBar(it, it.deltaCents, running)
        }
        val total = creep.sumOf { it.deltaCents }
        return bars + WaterfallBar(null, total, total)
    }

    fun heatmap(payments: List<PlannerRecord>, from: LocalDate, to: LocalDate): List<PaymentHeatCell> =
        payments.mapNotNull { payment -> day(payment.date)?.takeIf { it in from..to }?.let { it to payment } }
            .groupBy({ it.first }, { it.second })
            .map { (date, rows) -> PaymentHeatCell(date, rows.sumOf { it.amountCents ?: 0L }, rows.size) }
            .sortedBy { it.date }

    fun sCurve(index: RecordIndex, contingencyPercent: Int): List<SCurvePoint> {
        val planned = sortedMapOf<LocalDate, Long>()
        val paid = sortedMapOf<LocalDate, Long>()
        index.kind(Kinds.PAYMENT).forEach { payment ->
            val amount = payment.amountCents ?: 0L
            day(payment.date)?.let { planned.merge(it, amount, Long::plus) }
            val paidAt = ExtraFields.instant(index.extra(payment), "paidAt")
            if (paidAt != null && payment.status == "PAID") paid.merge(utcDay(paidAt), amount, Long::plus)
        }
        val band = max(0, contingencyPercent) / 100.0
        var plannedCum = 0L
        var paidCum = 0L
        return (planned.keys + paid.keys).toSortedSet().map { date ->
            plannedCum += planned[date] ?: 0L
            paidCum += paid[date] ?: 0L
            SCurvePoint(date, plannedCum, paidCum, (plannedCum * (1 - band)).roundToLong(), (plannedCum * (1 + band)).roundToLong())
        }
    }

    fun burndown(tasks: List<PlannerRecord>, extra: (PlannerRecord) -> org.json.JSONObject, eventDate: LocalDate, todayMillis: Long): List<BurndownPoint> {
        if (tasks.isEmpty()) return emptyList()
        val start = utcDay(minOf(tasks.minOf { it.createdAt }, todayMillis))
        val days = ChronoUnit.DAYS.between(start, eventDate)
        if (days < 1) return emptyList()
        val total = tasks.size
        val rows = tasks.map { Triple(it, ExtraFields.instant(extra(it), "completedAt"), day(it.date)) }
        return (0..days).map { offset ->
            val date = start.plusDays(offset)
            val dayStart = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
            var completed = 0
            var overdue = 0
            rows.forEach { (task, completedAt, deadline) ->
                if (completedAt != null && completedAt <= dayStart) completed++
                else if (deadline != null && deadline < date && task.status != "DONE") overdue++
            }
            val ideal = max(0.0, total - total * offset.toDouble() / days)
            BurndownPoint(date, (ideal * 10).roundToInt() / 10.0, max(0, total - completed), overdue)
        }
    }

    /** Simulador "e se" da web: soma o valor nas saídas do mês escolhido e refaz o saldo. */
    fun whatIf(cashflow: List<MonthlyCashflow>, startingCashCents: Long, amountCents: Long, date: LocalDate): WhatIfResult {
        val target = YearMonth.from(date)
        var running = startingCashCents
        var balanceAt = startingCashCents
        var worst = if (cashflow.isEmpty()) startingCashCents else Long.MAX_VALUE
        var hit: YearMonth? = null
        cashflow.forEach { month ->
            running += month.incomeCents - month.outflowCents - if (month.month == target) amountCents else 0L
            if (month.month == target) {
                balanceAt = running
                hit = month.month
            }
            worst = minOf(worst, running)
        }
        return WhatIfResult(hit, balanceAt, worst, running)
    }

    private fun day(value: String?): LocalDate? = value?.takeIf { it.length >= 10 }?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }

    fun utcDay(millis: Long): LocalDate = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()

    private const val DAY_MS = 86_400_000L
}

/** Tudo o que `loadInsightsSnapshot` (`src/lib/reports/insights-snapshot.ts`) calcula para a tela de Insights. */
data class InsightsSnapshot(
    val totals: InsightsTotals,
    val daysToEvent: Long,
    val leftoverCents: Long,
    val cashflow: List<MonthlyCashflow>,
    val worstBalanceCents: Long,
    val health: HealthReport,
    val creep: List<CategoryCreep>,
    val heatmap: List<PaymentHeatCell>,
    val sCurve: List<SCurvePoint>,
    val burndown: List<BurndownPoint>,
    val waterfall: List<WaterfallBar>,
) {
    companion object {
        fun compute(index: RecordIndex, contingencyPercent: Int, eventDate: LocalDate, nowMillis: Long): InsightsSnapshot {
            val today = InsightsRules.utcDay(nowMillis)
            var budget = 0L
            var contracted = 0L
            index.kind(Kinds.VENDOR).forEach { vendor ->
                val cost = index.children(vendor.id, Kinds.BUDGET).sumOf { it.amountCents ?: it.estimatedCents ?: 0L }
                budget += cost
                if (vendor.status == "CONTRACTED" || vendor.status == "FINALIZED") contracted += cost
            }
            val payments = index.kind(Kinds.PAYMENT)
            val totals = InsightsTotals(
                budgetCents = budget,
                contractedCents = contracted,
                paidCents = payments.filter { it.status == "PAID" }.sumOf { it.amountCents ?: 0L },
                cashCents = index.kind(Kinds.ASSET).sumOf { it.amountCents ?: 0L },
            )
            val cashflow = FinanceRules.monthlyCashflow(index.active, eventDate, today)
            val worst = cashflow.minOfOrNull { it.endingCents } ?: totals.cashCents
            val tasks = index.kind(Kinds.TASK)
            val todayText = today.toString()
            val daysToEvent = InsightsRules.daysUntil(eventDate, nowMillis)
            val health = InsightsRules.health(
                totals, daysToEvent, tasks.size, tasks.count { it.status == "DONE" },
                tasks.count { it.status != "DONE" && !it.date.isNullOrBlank() && it.date.take(10) <= todayText }, worst,
            )
            val creep = InsightsRules.creep(index).filter { it.estimatedCents > 0 }
            val pending = payments.filter { it.status != "PAID" }
            return InsightsSnapshot(
                totals = totals,
                daysToEvent = daysToEvent,
                leftoverCents = totals.cashCents - (budget - totals.paidCents) - (contracted * contingencyPercent / 100.0).roundToLong(),
                cashflow = cashflow,
                worstBalanceCents = worst,
                health = health,
                creep = creep,
                heatmap = InsightsRules.heatmap(pending, today.withDayOfMonth(1), eventDate),
                sCurve = InsightsRules.sCurve(index, contingencyPercent),
                burndown = InsightsRules.burndown(tasks, index::extra, eventDate, nowMillis),
                waterfall = InsightsRules.waterfall(creep),
            )
        }
    }
}
