package br.com.paivalab.weddingmanagementsystem.ui

import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EditorFormTest {
    private fun module(kind: String) = modules.first { it.kind == kind }
    private val vendor = PlannerRecord("v1", Kinds.VENDOR, "Buffet", subtitle = "Buffet")
    private val table = PlannerRecord("t1", Kinds.TABLE, "Mesa 1", amountCents = 2)
    private val seated = PlannerRecord("g0", Kinds.GUEST, "Ana", status = "CONFIRMED", seatingTableId = "t1")
    private val index = RecordIndex(listOf(vendor, table, seated))

    @Test fun reportsEachInvalidFieldSeparately() {
        val outcome = buildEditorRecord(module(Kinds.PAYMENT),
            EditorFormState(title = "", amount = "abc", date = "31/02/2027", lateFeePercent = "150"), null, index)
        val errors = (outcome as EditorOutcome.Invalid).errors
        assertEquals(R.string.err_required, errors[EditorField.TITLE])
        assertEquals(R.string.err_money, errors[EditorField.AMOUNT])
        assertEquals(R.string.err_date, errors[EditorField.DATE])
        assertEquals(R.string.err_vendor_required, errors[EditorField.PARENT])
        assertEquals(R.string.err_percent, errors[EditorField.LATE_FEE])
    }

    @Test fun validatesContactsLikeTheWeb() {
        val outcome = buildEditorRecord(module(Kinds.GUEST),
            EditorFormState(title = "Bia", phone = "abc", email = "sem-arroba", plusAllowed = "1", plusConfirmed = "2"), null, index)
        val errors = (outcome as EditorOutcome.Invalid).errors
        assertEquals(R.string.err_phone, errors[EditorField.PHONE])
        assertEquals(R.string.err_email, errors[EditorField.EMAIL])
        assertEquals(R.string.err_plus_confirmed, errors[EditorField.PLUS_CONFIRMED])
    }

    @Test fun blocksFullTable() {
        val outcome = buildEditorRecord(module(Kinds.GUEST),
            EditorFormState(title = "Bia", status = "CONFIRMED", seatingTableId = "t1", plusAllowed = "1", plusConfirmed = "1"), null, index)
        assertEquals(R.string.table_full, (outcome as EditorOutcome.Invalid).errors[EditorField.TABLE])
    }

    @Test fun buildsPaymentWithWebValuesAndWithoutImplicitDefaults() {
        val outcome = buildEditorRecord(module(Kinds.PAYMENT),
            EditorFormState(title = "Sinal", amount = "1.500,00".replace(".", ""), date = "10/03/2027", parentId = "v1", status = "PENDING"),
            null, index) { "new" }
        val record = (outcome as EditorOutcome.Valid).record
        assertEquals(150_000L, record.amountCents)
        assertEquals("2027-03-10", record.date)
        val extra = JSONObject(record.extraJson)
        assertFalse(extra.has("method"))
        assertFalse(extra.has("lateFeePercent"))
    }

    @Test fun roundTripsExistingGuestWithoutLosingFields() {
        val guest = PlannerRecord("g1", Kinds.GUEST, "Caio", status = "INVITED",
            extraJson = """{"side":"BRIDE","isVIP":1,"dietary":"Vegano","tagIds":["x"],"language":"en"}""")
        val form = editorFormFrom(module(Kinds.GUEST), guest, null)
        assertEquals("NOIVA", form.guestSide)
        assertTrue(form.guestIsVip)
        val record = (buildEditorRecord(module(Kinds.GUEST), form, guest, index) as EditorOutcome.Valid).record
        val extra = JSONObject(record.extraJson)
        assertEquals("NOIVA", extra.getString("side"))
        assertEquals(true, extra.getBoolean("isVIP"))
        assertEquals("en", extra.getString("language"))
    }

    @Test fun newVendorNeedsEstimateAndKeepsCategoryKey() {
        val missing = buildEditorRecord(module(Kinds.VENDOR), EditorFormState(title = "Foto Luz", subtitle = "Fotografia"), null, index)
        assertEquals(R.string.err_required, (missing as EditorOutcome.Invalid).errors[EditorField.ESTIMATED])
        val valid = buildEditorRecord(module(Kinds.VENDOR),
            EditorFormState(title = "Foto Luz", subtitle = "Fotografia", estimated = "8000", vendorCategoryKey = "PHOTO_VIDEO"), null, index)
        val record = (valid as EditorOutcome.Valid).record
        assertEquals(800_000L, record.estimatedCents)
        assertEquals("PHOTO_VIDEO", JSONObject(record.extraJson).getString("categoryKey"))
        // Ao editar, o estimado fica nos itens de orçamento e não é pedido de novo.
        val edited = buildEditorRecord(module(Kinds.VENDOR), editorFormFrom(module(Kinds.VENDOR), vendor, null), vendor, index)
        assertTrue(edited is EditorOutcome.Valid)
    }

    @Test fun newContractStartsAtNextVendorVersion() {
        val withContract = RecordIndex(listOf(vendor, PlannerRecord("c1", Kinds.CONTRACT, "Contrato", parentId = "v1")))
        val form = editorFormFrom(module(Kinds.CONTRACT), null, "v1",
            br.com.paivalab.weddingmanagementsystem.data.ContractRules.nextVersion(withContract, "v1"))
        assertEquals("2", form.contractVersion)
    }
}
