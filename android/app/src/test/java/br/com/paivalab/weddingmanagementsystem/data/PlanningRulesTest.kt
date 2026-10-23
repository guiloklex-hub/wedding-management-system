package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlanningRulesTest {
    private fun check(id: String, order: Int?, createdAt: Long = 0L) = PlannerRecord(id, Kinds.VENUE_CHECK, id, parentId = "v",
        createdAt = createdAt, extraJson = order?.let { """{"sortOrder":$it}""" } ?: "{}")

    @Test fun checklistFollowsSortOrderAndRenumbersOnMove() {
        val index = RecordIndex(listOf(PlannerRecord("v", Kinds.VENUE, "Fazenda"), check("c", 2), check("a", 0), check("b", 1),
            check("legacy", null, createdAt = 5L)))
        val items = VenueChecklist.items(index, "v")
        assertEquals(listOf("a", "b", "c", "legacy"), items.map { it.id })
        assertEquals(3, VenueChecklist.nextSortOrder(items))

        val moved = VenueChecklist.moved(items, "c", -1).associate { it.id to VenueChecklist.sortOrder(it) }
        assertEquals(mapOf("c" to 1, "b" to 2, "legacy" to 3), moved)
        assertTrue(VenueChecklist.moved(items, "a", -1).isEmpty())
    }

    @Test fun incomeSourceAndReceiptLikeTheWeb() {
        assertEquals("SALARY", IncomeRules.source(PlannerRecord("i", Kinds.INCOME, "x")))
        assertEquals("BONUS", IncomeRules.source(PlannerRecord("i", Kinds.INCOME, "x", subtitle = "bonus")))
        assertEquals("OTHER", IncomeRules.source(PlannerRecord("i", Kinds.INCOME, "x", subtitle = "Poupança")))

        val expected = PlannerRecord("i", Kinds.INCOME, "Bônus", status = "EXPECTED")
        val received = IncomeRules.withReceipt(expected, expected.copy(status = "RECEIVED"), 1_700_000_000_000L)
        assertEquals(1_700_000_000_000L, ExtraFields.instant(ExtraFields.parse(received.extraJson), "receivedAt"))
        val edited = IncomeRules.withReceipt(received, received.copy(title = "Bônus anual", extraJson = "{}"), 1_800_000_000_000L)
        assertEquals(1_700_000_000_000L, ExtraFields.instant(ExtraFields.parse(edited.extraJson), "receivedAt"))
        val reopened = IncomeRules.withReceipt(received, received.copy(status = "EXPECTED"), 1_800_000_000_000L)
        assertFalse(ExtraFields.parse(reopened.extraJson).has("receivedAt"))
    }

    @Test fun goalCardMatchesTheWeb() {
        val goal = PlannerRecord("g", Kinds.GOAL, "Viagem", amountCents = 10_000_00L, date = "2027-01-15")
        val index = RecordIndex(listOf(goal,
            PlannerRecord("a1", Kinds.ASSET, "Aporte", amountCents = 2_500_00L, parentId = "g"),
            PlannerRecord("a2", Kinds.ASSET, "Aporte", amountCents = 1_500_00L, parentId = "g"),
            PlannerRecord("a3", Kinds.ASSET, "Solto", amountCents = 9_000_00L)))
        val progress = GoalRules.progress(goal, index, LocalDate.of(2026, 10, 17))
        assertEquals(4_000_00L, progress.savedCents)
        assertEquals(6_000_00L, progress.remainingCents)
        assertEquals(40.0, progress.percent, 0.001)
        // 90 dias → 3 meses, arredondando para cima como a web.
        assertEquals(2_000_00L, progress.perMonthCents)
        assertEquals(2, progress.contributions)
        assertTrue(progress.active)

        val late = GoalRules.progress(goal, index, LocalDate.of(2027, 2, 1))
        assertNull(late.perMonthCents)

        val inactive = goal.copy(id = "z", extraJson = """{"isActive":false}""")
        assertEquals(listOf("g", "z"), GoalRules.ordered(listOf(inactive, goal)).map { it.id })
    }

    @Test fun honeymoonGroupsLikeTheWebPage() {
        fun item(id: String, kind: String, date: String?, status: String = "PLANNED", amount: Long? = null, createdAt: Long = 0L) =
            PlannerRecord(id, Kinds.HONEYMOON_ITEM, id, date = date, status = status, amountCents = amount, createdAt = createdAt,
                extraJson = """{"kind":"$kind"}""")
        val trip = PlannerRecord("singleton", Kinds.HONEYMOON, "honeymoon", createdAt = 5L)
        val index = RecordIndex(listOf(
            PlannerRecord("late", Kinds.HONEYMOON, "Roma", createdAt = 9L), trip,
            item("hotel", "HOTEL", "2027-05-18", amount = 2_000_00L),
            item("flight", "FLIGHT", "2027-05-17", status = "PAID", amount = 5_000_00L),
            item("passport", "DOCUMENT", null, createdAt = 2L),
            item("visa", "DOCUMENT", null, status = "CONFIRMED", createdAt = 1L),
        ))
        assertEquals("singleton", HoneymoonRules.trip(index)?.id)
        assertEquals("", HoneymoonRules.destination(trip))
        val items = HoneymoonRules.items(index)
        assertEquals(listOf("visa", "passport", "flight", "hotel"), items.map { it.id })
        assertEquals(listOf("DOCUMENT", "FLIGHT", "HOTEL"), HoneymoonRules.grouped(items).keys.toList())
        assertEquals(7_000_00L, HoneymoonRules.committedCents(items))
        assertEquals(1, HoneymoonRules.documentsPending(items))
        assertEquals("BRL", HoneymoonRules.currency(trip))
    }

    @Test fun trousseauOrdersByPriorityAndTogglesLikeTheWeb() {
        fun item(id: String, priority: String, room: String, status: String = "TO_BUY", estimated: Long? = null, paid: Long? = null) =
            PlannerRecord(id, Kinds.TROUSSEAU, id, status = status, estimatedCents = estimated, amountCents = paid,
                extraJson = """{"priority":"$priority","room":"$room"}""")
        val items = listOf(item("sofa", "LUXURY", "LIVING"), item("pan", "ESSENTIAL", "KITCHEN", "BOUGHT", 100_00L, 90_00L),
            item("bed", "ESSENTIAL", "BEDROOM", "GIFTED", 300_00L), item("lamp", "NICE_TO_HAVE", "BEDROOM", estimated = 50_00L))
        assertEquals(listOf("bed", "pan", "lamp", "sofa"), TrousseauRules.ordered(items).map { it.id })
        assertEquals(TrousseauStats(450_00L, 90_00L, toBuy = 2, gifted = 1), TrousseauRules.stats(items))
        assertEquals("TO_BUY", TrousseauRules.toggled(items[1], "BOUGHT"))
        assertEquals("GIFTED", TrousseauRules.toggled(items[1], "GIFTED"))
    }
}
