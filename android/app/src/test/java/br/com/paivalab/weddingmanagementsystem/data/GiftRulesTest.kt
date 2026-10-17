package br.com.paivalab.weddingmanagementsystem.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GiftRulesTest {
    private val now = 1_760_000_000_000L

    @Test fun thankedStatusKeepsThankedAtInSync() {
        val received = PlannerRecord("g", Kinds.GIFT, "Pix", status = "RECEIVED")
        val thanked = GiftRules.normalize(received, received.copy(status = "THANKED"), now)
        assertEquals(now, ExtraFields.instant(ExtraFields.parse(thanked.extraJson), "thankedAt"))
        val edited = GiftRules.normalize(thanked, thanked.copy(title = "Pix da tia", extraJson = "{}"), now + 1_000)
        assertEquals(now, ExtraFields.instant(ExtraFields.parse(edited.extraJson), "thankedAt"))
        val reverted = GiftRules.normalize(edited, edited.copy(status = "RECEIVED"), now + 2_000)
        assertFalse(ExtraFields.parse(reverted.extraJson).has("thankedAt"))
    }

    @Test fun legacyAndroidStatusesBecomeWebValues() {
        val pending = GiftRules.normalize(null, PlannerRecord("g", Kinds.GIFT, "Jogo", status = "PENDING"), now)
        assertEquals("RECEIVED", pending.status)
        val processed = GiftRules.normalize(null, PlannerRecord("g", Kinds.GIFT, "Pix", amountCents = 100, status = "PROCESSED"), now)
        assertEquals("RECEIVED", processed.status)
        assertTrue(GiftRules.processed(processed, ExtraFields.parse(processed.extraJson)))
        val item = GiftRules.normalize(null, PlannerRecord("g", Kinds.GIFT, "Jogo", status = "RECEIVED",
            extraJson = """{"type":"ITEM","isHoneymoonShare":true}"""), now)
        assertFalse(ExtraFields.parse(item.extraJson).has("isHoneymoonShare"))
    }

    @Test fun onlyUnpostedCashWithAmountCanBePosted() {
        val cash = PlannerRecord("g", Kinds.GIFT, "Pix", amountCents = 10_000)
        assertTrue(GiftRules.canPost(cash, ExtraFields.parse(cash.extraJson)))
        assertFalse(GiftRules.canPost(cash.copy(amountCents = null), ExtraFields.parse("{}")))
        assertFalse(GiftRules.canPost(cash, ExtraFields.parse("""{"type":"ITEM"}""")))
        assertFalse(GiftRules.canPost(cash, ExtraFields.parse("""{"processedAt":$now}""")))
    }

    @Test fun statsLikeTheWebCards() {
        val gifts = listOf(
            PlannerRecord("a", Kinds.GIFT, "Pix", amountCents = 50_000, status = "THANKED", extraJson = """{"type":"CASH","processedAt":$now}"""),
            PlannerRecord("b", Kinds.GIFT, "Transferência", amountCents = 20_000, status = "RECEIVED"),
            PlannerRecord("c", Kinds.GIFT, "Jogo de panelas", status = "RECEIVED", extraJson = """{"type":"ITEM"}"""),
        )
        val index = RecordIndex(gifts)
        assertEquals(GiftStats(cashCents = 70_000, cashPendingCents = 20_000, items = 1, pendingThanks = 2),
            GiftRules.stats(gifts, index::extra))
    }

    @Test fun giverIsGuestOrTypedName() {
        val index = RecordIndex(listOf(
            PlannerRecord("guest", Kinds.GUEST, "Tia Rosa"),
            PlannerRecord("g1", Kinds.GIFT, "Pix", parentId = "guest"),
            PlannerRecord("g2", Kinds.GIFT, "Pix", extraJson = """{"giverName":"Colegas"}"""),
            PlannerRecord("g3", Kinds.GIFT, "Pix"),
        ))
        assertEquals(listOf("Tia Rosa", "Colegas", null), listOf("g1", "g2", "g3").map { GiftRules.giver(index.find(it)!!, index) })
    }
}
