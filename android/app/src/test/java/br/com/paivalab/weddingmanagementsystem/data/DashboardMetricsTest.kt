package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DashboardMetricsTest {
    private val today = LocalDate.parse("2027-04-25")
    private val records = listOf(
        PlannerRecord("v1", Kinds.VENDOR, "Buffet", subtitle = "Buffet", status = "CONTRACTED"),
        PlannerRecord("v2", Kinds.VENDOR, "DJ", subtitle = "Música", status = "NEGOTIATION"),
        PlannerRecord("b1", Kinds.BUDGET, "Jantar", amountCents = 3_000_000, estimatedCents = 2_500_000, parentId = "v1"),
        PlannerRecord("b2", Kinds.BUDGET, "Som", estimatedCents = 500_000, parentId = "v2"),
        PlannerRecord("b3", Kinds.BUDGET, "Sem fornecedor", estimatedCents = 999_999),
        PlannerRecord("p1", Kinds.PAYMENT, "Sinal", amountCents = 1_000_000, date = "2027-01-10", status = "PAID", parentId = "v1"),
        PlannerRecord("p2", Kinds.PAYMENT, "Saldo", amountCents = 2_000_000, date = "2027-05-01", status = "PENDING", parentId = "v1"),
        PlannerRecord("a1", Kinds.ASSET, "Poupança", amountCents = 1_200_000),
        PlannerRecord("g1", Kinds.GUEST, "Ana", status = "CONFIRMED", plusOnesAllowed = 1, plusOnesConfirmed = 1),
        PlannerRecord("g2", Kinds.GUEST, "Bia", status = "INVITED"),
        PlannerRecord("gift", Kinds.GIFT, "Pix", amountCents = 50_000, extraJson = """{"type":"CASH","thankedAt":1}"""),
        PlannerRecord("t1", Kinds.TASK, "Atrasada", date = "2027-04-01", status = "TODO"),
        PlannerRecord("t2", Kinds.TASK, "Feita", date = "2027-04-01", status = "DONE"),
    )

    @Test fun totalsFollowTheWebDashboard() {
        val metrics = DashboardMetrics.compute(RecordIndex(records), 10, LocalDate.parse("2027-05-15"), today)
        // Itens com fornecedor ativo (actual ?? estimated) + 10% sobre o contratado.
        assertEquals(3_000_000L, metrics.contractedCents)
        assertEquals(300_000L, metrics.contingencyCents)
        assertEquals(3_800_000L, metrics.totalBudgetCents)
        assertEquals(1_000_000L, metrics.paidCents)
        assertEquals(2_800_000L, metrics.remainingCents)
        assertEquals(43, metrics.coveragePercent)
        assertEquals(20L, metrics.daysToEvent)
        assertTrue(metrics.showSettleAlert)
        assertEquals(listOf("p2"), metrics.upcomingPayments.map { it.id })
        assertEquals(VendorFunnel(1, 1, 0), metrics.funnel)
        assertEquals(RsvpCounts(1, 1, 0, 0, 1, 2), metrics.rsvp)
        assertEquals(GiftProgress(1, 1, 50_000, 1), metrics.gifts)
        assertEquals(TaskStats(2, 1, 1), metrics.tasks)
    }

    @Test fun noAlertOrCoverageWhenSettled() {
        val paid = records.map { if (it.kind == Kinds.PAYMENT) it.copy(status = "PAID", amountCents = 2_000_000) else it }
        val metrics = DashboardMetrics.compute(RecordIndex(paid), 0, null, today)
        assertEquals(3_500_000L, metrics.totalBudgetCents)
        assertEquals(-500_000L, metrics.remainingCents)
        assertNull(metrics.coveragePercent)
        assertNull(metrics.daysToEvent)
        assertFalse(metrics.showSettleAlert)
    }

    @Test fun eventPhasesMatchTheWeb() {
        assertEquals(EventPhase.PAST, EventPhases.phase(-1))
        assertEquals(EventPhase.ONE_WEEK, EventPhases.phase(7))
        assertEquals(EventPhase.ONE_MONTH, EventPhases.phase(30))
        assertEquals(EventPhase.THREE_MONTHS, EventPhases.phase(90))
        assertEquals(EventPhase.SIX_MONTHS, EventPhases.phase(180))
        assertEquals(EventPhase.TWELVE_MONTHS, EventPhases.phase(181))
        assertEquals(0f, EventPhases.progress(400))
        assertEquals(1f, EventPhases.progress(0))
        assertEquals(0.5f, EventPhases.progress(182), 0.01f)
    }

    @Test fun taskCompletionLikeTheServerAction() {
        val open = PlannerRecord("t", Kinds.TASK, "Tarefa", status = "TODO")
        val completed = 1_760_000_000_000L
        val done = TaskRules.withCompletion(open, open.copy(status = "DONE"), now = completed)
        assertEquals(completed, ExtraFields.instant(ExtraFields.parse(done.extraJson), "completedAt"))
        val edited = TaskRules.withCompletion(done, done.copy(title = "Outra", extraJson = "{}"), now = completed + 1_000)
        assertEquals(completed, ExtraFields.instant(ExtraFields.parse(edited.extraJson), "completedAt"))
        val reopened = TaskRules.withCompletion(edited, edited.copy(status = "TODO"), now = completed + 2_000)
        assertFalse(ExtraFields.parse(reopened.extraJson).has("completedAt"))
        val payment = PlannerRecord("p", Kinds.PAYMENT, "Pagamento", status = "DONE")
        assertEquals(payment, TaskRules.withCompletion(null, payment, now = 1))
    }
}
