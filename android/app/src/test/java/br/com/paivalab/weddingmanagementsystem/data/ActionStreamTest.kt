package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Mesmos cenários de `src/lib/action-stream.test.ts`. */
class ActionStreamTest {
    private val today = LocalDate.parse("2026-06-08")
    private fun day(offset: Long) = today.plusDays(offset).toString()
    private fun vendor(id: String, name: String) = PlannerRecord(id, Kinds.VENDOR, name, subtitle = "Buffet")

    @Test fun emptyWhenNothingPending() {
        assertEquals(emptyList<ActionItem>(), ActionStream.compute(RecordIndex(emptyList()), today))
    }

    @Test fun overduePaymentOutranksDueSoonAndIgnoresPaidOrFar() {
        val index = RecordIndex(listOf(
            vendor("v1", "Buffet"), vendor("v2", "DJ"),
            PlannerRecord("p1", Kinds.PAYMENT, "Sinal", amountCents = 200_000, date = day(-3), status = "PENDING", parentId = "v1"),
            PlannerRecord("p2", Kinds.PAYMENT, "Parcela", amountCents = 80_000, date = day(5), status = "PENDING", parentId = "v2"),
            PlannerRecord("p3", Kinds.PAYMENT, "Pago", amountCents = 100, date = day(-1), status = "PAID", parentId = "v1"),
            PlannerRecord("p4", Kinds.PAYMENT, "Longe", amountCents = 100, date = day(40), status = "PENDING", parentId = "v1"),
        ))
        val items = ActionStream.compute(index, today)
        assertEquals(listOf(ActionKind.PAYMENT_OVERDUE, ActionKind.PAYMENT_DUE), items.map { it.kind })
        assertEquals("Buffet", items[0].label)
        assertEquals(3, items[0].days)
        assertEquals(1003, items[0].priority)
        assertEquals("p1", items[0].recordId)
        assertTrue(items[0].finance)
    }

    @Test fun overdueTaskFirstAndHighPriorityBump() {
        val index = RecordIndex(listOf(
            PlannerRecord("t1", Kinds.TASK, "Provar bolo", date = day(2), status = "TODO", extraJson = """{"priority":"MEDIUM"}"""),
            PlannerRecord("t2", Kinds.TASK, "Pagar cartório", date = day(-1), status = "TODO", extraJson = """{"priority":"HIGH"}"""),
            PlannerRecord("t3", Kinds.TASK, "Sem prazo", status = "TODO", extraJson = """{"priority":"HIGH"}"""),
            PlannerRecord("t4", Kinds.TASK, "Feita", date = day(-5), status = "DONE"),
        ))
        val items = ActionStream.compute(index, today)
        assertEquals(listOf("t2", "t1"), items.map { it.recordId })
        assertEquals(951, items[0].priority)
    }

    @Test fun onlyUnsignedContractsInsideTheWindow() {
        val records = listOf(vendor("v", "Foto")) + listOf(
            "c1" to ("DRAFT" to 10L), "c2" to ("SIGNED_DIGITAL" to 5L), "c3" to ("DRAFT" to -2L),
            "c4" to ("DRAFT" to 60L), "c5" to ("CANCELLED" to 5L), "c6" to ("NEGOTIATING" to 12L),
        ).map { (id, value) ->
            PlannerRecord(id, Kinds.CONTRACT, "Contrato", status = value.first, parentId = "v",
                extraJson = """{"expiresAt":"${day(value.second)}"}""")
        }
        val items = ActionStream.compute(RecordIndex(records), today)
        assertEquals(listOf("c1", "c6"), items.map { it.recordId })
        assertEquals("Foto", items[0].label)
    }

    @Test fun rsvpAndThanksAreSingleLowPriorityItems() {
        val index = RecordIndex(listOf(
            PlannerRecord("g1", Kinds.GUEST, "Ana", status = "INVITED"),
            PlannerRecord("g2", Kinds.GUEST, "Bia", status = "CONFIRMED"),
            PlannerRecord("gift1", Kinds.GIFT, "Jogo de panelas", status = "RECEIVED"),
            PlannerRecord("gift2", Kinds.GIFT, "Pix", extraJson = """{"thankedAt":1760000000000}"""),
            PlannerRecord("gift3", Kinds.GIFT, "Antigo", status = "THANKED"),
        ))
        val items = ActionStream.compute(index, today)
        assertEquals(listOf(ActionKind.RSVP_PENDING, ActionKind.GIFT_THANK), items.map { it.kind })
        assertEquals(listOf(1, 1), items.map { it.count })
        assertEquals(Kinds.GUEST, items[0].section)
    }
}
