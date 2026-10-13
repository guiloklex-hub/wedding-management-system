package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RecordFieldsTest {
    @Test fun readsWebSqliteBooleansDatesAndNulls() {
        val json = JSONObject("""{"isVIP":1,"isChild":0,"checkedInAt":null,"expiresAt":1773100800000,"rating":"4"}""")
        assertTrue(ExtraFields.bool(json, "isVIP"))
        assertFalse(ExtraFields.bool(json, "isChild"))
        assertFalse(ExtraFields.has(json, "checkedInAt"))
        assertEquals(LocalDate.parse("2026-03-10"), ExtraFields.day(json, "expiresAt"))
        assertEquals(4, ExtraFields.int(json, "rating"))
    }

    @Test fun normalizesLegacyAndroidValuesToWebEnums() {
        val guest = JSONObject(WebValues.normalizeExtra(Kinds.GUEST, """{"side":"BRIDE","isVIP":1,"checkedInAt":null}"""))
        assertEquals("NOIVA", guest.getString("side"))
        assertEquals(true, guest.get("isVIP"))
        assertFalse(guest.has("checkedInAt"))
        assertEquals("CREDIT", JSONObject(WebValues.normalizeExtra(Kinds.PAYMENT, """{"method":"CREDIT_CARD"}""")).getString("method"))
        val item = JSONObject(WebValues.normalizeExtra(Kinds.HONEYMOON_ITEM, """{"itemKind":"HOTEL"}"""))
        assertEquals("HOTEL", item.getString("kind"))
        assertFalse(item.has("itemKind"))
        val trousseau = JSONObject(WebValues.normalizeExtra(Kinds.TROUSSEAU, """{"room":"Cozinha","priority":"HIGH"}"""))
        assertEquals("KITCHEN", trousseau.getString("room"))
        assertEquals("ESSENTIAL", trousseau.getString("priority"))
        val contract = JSONObject(WebValues.normalizeExtra(Kinds.CONTRACT, """{"expiresAt":1773100800000}"""))
        assertEquals("2026-03-10", contract.getString("expiresAt"))
    }

    @Test fun normalizationIsIdempotent() {
        val once = WebValues.normalizeExtra(Kinds.GUEST, """{"side":"GROOM","isPadrinho":true}""")
        assertEquals(once, WebValues.normalizeExtra(Kinds.GUEST, once))
    }

    @Test fun repairsDefaultsWrittenByV110Editor() {
        val baseline = JSONObject("""{"isVIP":1,"side":null,"lateFeePercent":null}""")
        val guest = PlannerRecord("g", Kinds.GUEST, "Ana", extraJson = """{"isVIP":false,"side":"BOTH"}""")
        val repaired = JSONObject(LegacyRepair.repair(guest, baseline).extraJson)
        assertTrue(repaired.getBoolean("isVIP"))
        assertFalse(repaired.has("side"))
        val payment = PlannerRecord("p", Kinds.PAYMENT, "Sinal",
            extraJson = """{"lateFeePercent":2.0,"interestPercentPerMonth":1.0,"method":"PIX"}""")
        val fixed = JSONObject(LegacyRepair.repair(payment, JSONObject("{}")).extraJson)
        assertFalse(fixed.has("lateFeePercent"))
        assertFalse(fixed.has("method"))
    }

    @Test fun keepsIntentionalEditsWhenBaselineAgrees() {
        val baseline = JSONObject("""{"isVIP":0,"side":"NOIVO","method":"BOLETO"}""")
        val guest = PlannerRecord("g", Kinds.GUEST, "Ana", extraJson = """{"isVIP":true,"side":"BOTH"}""")
        assertEquals(guest, LegacyRepair.repair(guest, baseline))
        assertNull(null)
    }
}
