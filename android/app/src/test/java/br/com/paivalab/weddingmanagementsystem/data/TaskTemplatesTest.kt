package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TaskTemplatesTest {
    @Test fun templatesPreserveKeysAndRelativeDates() {
        assertEquals(33, TaskTemplates.all.size)
        assertEquals(33, TaskTemplates.all.map { it.key }.toSet().size)
        val rehearsal = TaskTemplates.all.first { it.key == "1w-emergency-kit" }
        assertEquals(LocalDate.parse("2027-06-23"), TaskTemplates.deadline(LocalDate.parse("2027-06-30"), rehearsal))
        assertTrue(TaskTemplates.all.any { it.monthsBefore < 0 })
    }
}
