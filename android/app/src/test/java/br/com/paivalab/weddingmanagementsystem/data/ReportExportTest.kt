package br.com.paivalab.weddingmanagementsystem.data

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReportExportTest {
    @Test fun quotesUserTextAndKeepsCentPrecision() {
        val active = PlannerRecord("1", Kinds.PAYMENT, "Bolo; \"especial\"", amountCents = 12_345,
            notes = "linha 1\nlinha 2")
        val deleted = PlannerRecord("2", Kinds.PAYMENT, "apagado", deletedAt = 1)
        val csv = String(ReportExport.generate(listOf(active, deleted),
            listOf("Tipo", "Título", "Valor", "Previsto", "Data", "Estado", "Notas"),
            mapOf(Kinds.PAYMENT to "Pagamentos")), Charsets.UTF_8)
        assertTrue(csv.startsWith("\uFEFF"))
        assertTrue(csv.contains("\"Bolo; \"\"especial\"\"\""))
        assertTrue(csv.contains("\"123.45\""))
        assertTrue(csv.contains("\"linha 1\nlinha 2\""))
        assertFalse(csv.contains("apagado"))
    }

    @Test fun preventsSpreadsheetFormulaExecution() {
        val csv = String(ReportExport.generate(listOf(PlannerRecord("1", Kinds.VENDOR, "=HYPERLINK(\"x\")")),
            listOf("Tipo", "Título", "Valor", "Previsto", "Data", "Estado", "Notas"), emptyMap()), Charsets.UTF_8)
        assertTrue(csv.contains("\"'=HYPERLINK(\"\"x\"\")\""))
    }
}
