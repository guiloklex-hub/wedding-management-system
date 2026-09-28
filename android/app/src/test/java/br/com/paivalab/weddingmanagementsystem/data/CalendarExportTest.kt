package br.com.paivalab.weddingmanagementsystem.data

import java.time.Instant
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CalendarExportTest {
    @Test fun onlyActiveTasksAndPaymentsAreExported() {
        val text = CalendarExport.generate(listOf(
            PlannerRecord("a", Kinds.TASK, "Pagar, buffet", date = "2026-10-01"),
            PlannerRecord("b", Kinds.PAYMENT, "Parcela", date = "2026-10-03"),
            PlannerRecord("c", Kinds.GUEST, "Pessoa", date = "2026-10-04"),
            PlannerRecord("d", Kinds.TASK, "Excluída", date = "2026-10-05", deletedAt = 1),
        ), Instant.parse("2026-09-01T00:00:00Z"))
        assertTrue(text.contains("SUMMARY:Pagar\\, buffet"))
        assertTrue(text.contains("DTSTART;VALUE=DATE:20261001"))
        assertTrue(text.contains("DTEND;VALUE=DATE:20261002"))
        assertTrue(text.contains("SUMMARY:Parcela"))
        assertFalse(text.contains("Pessoa"))
        assertFalse(text.contains("Excluída"))
    }
}
