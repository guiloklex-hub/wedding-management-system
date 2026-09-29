package br.com.paivalab.weddingmanagementsystem.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class LocaleTextTest {
    @Test fun formatsWebSqliteEpochSecondsAndMillisecondsAsDates() {
        assertEquals("15/11/2026", formatDisplayDate("1794700800", "pt-BR"))
        assertEquals("15/11/2026", formatDisplayDate("1794700800000", "pt-BR"))
    }

    @Test fun keepsIsoCalendarDateFormatting() {
        assertEquals("04/04/2026", formatDisplayDate("2026-04-04", "pt-BR"))
        assertEquals("04/04/2026", formatDisplayDate("2026-04-04T00:00:00.000Z", "pt-BR"))
    }
}
