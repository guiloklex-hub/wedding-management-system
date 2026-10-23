package br.com.paivalab.weddingmanagementsystem.data

import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import org.junit.Assert.assertEquals
import org.junit.Test

/** Valores de referência gerados com as funções da web (`cashflow.ts`, `payment-curve.ts`, `task-burndown.ts`). */
class InsightsRulesTest {
    private fun ms(iso: String) = Instant.parse(iso).toEpochMilli()

    private val now = ms("2026-10-23T12:00:00Z")
    private val event = LocalDate.parse("2027-03-15")

    private val index = RecordIndex(listOf(
        PlannerRecord("v1", Kinds.VENDOR, "Fazenda", subtitle = "Local", status = "CONTRACTED", extraJson = """{"categoryKey":"VENUE"}"""),
        PlannerRecord("b1", Kinds.BUDGET, "Locação", parentId = "v1", estimatedCents = 10_000_00, amountCents = 12_000_00),
        PlannerRecord("v2", Kinds.VENDOR, "Buffet", subtitle = "Buffet", status = "NEGOTIATION", extraJson = """{"categoryKey":"BUFFET"}"""),
        PlannerRecord("b2", Kinds.BUDGET, "Jantar", parentId = "v2", estimatedCents = 5_000_00),
        PlannerRecord("v3", Kinds.VENDOR, "Doceria", subtitle = "Doces", status = "FINALIZED"),
        PlannerRecord("b3", Kinds.BUDGET, "Bem-casados", parentId = "v3", estimatedCents = 2_000_00, amountCents = 1_500_00),
        PlannerRecord("p1", Kinds.PAYMENT, "Sinal", amountCents = 3_000_00, date = "2026-09-10", status = "PAID",
            extraJson = """{"paidAt":${ms("2026-09-12T15:00:00Z")}}"""),
        PlannerRecord("p2", Kinds.PAYMENT, "Parcela", amountCents = 4_000_00, date = "2026-11-05", status = "PENDING"),
        PlannerRecord("p3", Kinds.PAYMENT, "Final", amountCents = 2_500_00, date = "2027-01-20", status = "PENDING"),
        PlannerRecord("a1", Kinds.ASSET, "Poupança", amountCents = 5_000_00),
        PlannerRecord("i1", Kinds.INCOME, "Salário", amountCents = 1_000_00, status = "EXPECTED", extraJson = """{"frequency":"MONTHLY"}"""),
        PlannerRecord("i2", Kinds.INCOME, "Bônus", amountCents = 2_000_00, date = "2026-12-01", status = "EXPECTED"),
        PlannerRecord("i3", Kinds.INCOME, "Presente", amountCents = 1_500_00, date = "2027-02-01", status = "RECEIVED",
            extraJson = """{"receivedAt":${ms("2026-11-10T10:00:00Z")}}"""),
        PlannerRecord("t1", Kinds.TASK, "Visitar", status = "DONE", date = "2026-10-15", createdAt = ms("2026-10-01T09:00:00Z"),
            extraJson = """{"completedAt":${ms("2026-10-10T08:00:00Z")}}"""),
        PlannerRecord("t2", Kinds.TASK, "Convites", status = "TODO", date = "2026-10-20", createdAt = ms("2026-10-01T09:00:00Z")),
        PlannerRecord("t3", Kinds.TASK, "Prova", status = "TODO", date = "2026-12-01", createdAt = ms("2026-10-05T09:00:00Z")),
    ))

    private val snapshot = InsightsSnapshot.compute(index, contingencyPercent = 10, eventDate = event, nowMillis = now)

    @Test fun totalsCashflowAndHealthMatchTheWeb() {
        assertEquals(InsightsTotals(18_500_00, 13_500_00, 3_000_00, 5_000_00), snapshot.totals)
        assertEquals(143L, snapshot.daysToEvent)
        assertEquals(listOf(6_000_00L, 4_500_00L, 7_500_00L, 6_000_00L, 7_000_00L, 8_000_00L), snapshot.cashflow.map { it.endingCents })
        assertEquals(2_500_00L, snapshot.cashflow[1].incomeCents)
        assertEquals(4_500_00L, snapshot.worstBalanceCents)
        assertEquals(-11_850_00L, snapshot.leftoverCents)

        val health = snapshot.health
        assertEquals(53, health.score)
        assertEquals(listOf(0.7297, 0.1622, 1.0, 0.0, 0.8585, 0.3226), health.factors.values.map { Math.round(it * 10_000) / 10_000.0 })
        assertEquals(listOf(HealthTip(HealthAdvice.OVERDUE_TASKS, listOf(33L))), health.alerts)
        assertEquals(listOf(HealthTip(HealthAdvice.OVERDUE_TASKS, listOf(1L, 3L)),
            HealthTip(HealthAdvice.LOW_PAYMENT_PROGRESS, listOf(16L, 143L))), health.recommendations)
    }

    @Test fun categoryCreepAndWaterfallMatchTheWeb() {
        assertEquals(listOf("VENUE" to 2_000_00L, "BUFFET" to 0L, "Doces" to -500_00L),
            snapshot.creep.map { (it.categoryKey ?: it.label) to it.deltaCents })
        assertEquals(listOf(Triple("VENUE", 2_000_00L, 2_000_00L), Triple("Doces", -500_00L, 1_500_00L), Triple(null, 1_500_00L, 1_500_00L)),
            snapshot.waterfall.map { Triple(it.category?.let { c -> c.categoryKey ?: c.label }, it.deltaCents, it.runningCents) })
    }

    @Test fun heatmapSCurveAndBurndownMatchTheWeb() {
        assertEquals(listOf(PaymentHeatCell(LocalDate.parse("2026-11-05"), 4_000_00, 1), PaymentHeatCell(LocalDate.parse("2027-01-20"), 2_500_00, 1)),
            snapshot.heatmap)
        assertEquals(listOf(
            SCurvePoint(LocalDate.parse("2026-09-10"), 3_000_00, 0, 2_700_00, 3_300_00),
            SCurvePoint(LocalDate.parse("2026-09-12"), 3_000_00, 3_000_00, 2_700_00, 3_300_00),
            SCurvePoint(LocalDate.parse("2026-11-05"), 7_000_00, 3_000_00, 6_300_00, 7_700_00),
            SCurvePoint(LocalDate.parse("2027-01-20"), 9_500_00, 3_000_00, 8_550_00, 10_450_00),
        ), snapshot.sCurve)
        val burndown = snapshot.burndown
        assertEquals(166, burndown.size)
        assertEquals(BurndownPoint(LocalDate.parse("2026-10-01"), 3.0, 3, 0), burndown[0])
        assertEquals(BurndownPoint(LocalDate.parse("2026-10-11"), 2.8, 2, 0), burndown[10])
        assertEquals(BurndownPoint(LocalDate.parse("2026-10-23"), 2.6, 2, 1), burndown[22])
        assertEquals(BurndownPoint(event, 0.0, 2, 2), burndown.last())
    }

    @Test fun whatIfAddsThePaymentToItsMonth() {
        val result = InsightsRules.whatIf(snapshot.cashflow, snapshot.totals.cashCents, 3_000_00, LocalDate.parse("2026-12-10"))
        assertEquals(WhatIfResult(YearMonth.of(2026, 12), 4_500_00, 3_000_00, 5_000_00), result)
        val outside = InsightsRules.whatIf(snapshot.cashflow, snapshot.totals.cashCents, 1_00, LocalDate.parse("2030-01-01"))
        assertEquals(null, outside.month)
        assertEquals(snapshot.totals.cashCents, outside.balanceAtCents)
    }
}
