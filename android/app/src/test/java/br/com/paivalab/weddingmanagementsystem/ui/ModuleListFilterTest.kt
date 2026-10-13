package br.com.paivalab.weddingmanagementsystem.ui

import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class ModuleListFilterTest {
    private val yesterday = LocalDate.now().minusDays(1).toString()
    private val index = RecordIndex(listOf(
        PlannerRecord("a", Kinds.GUEST, "Zeca", status = "CONFIRMED", updatedAt = 1, extraJson = """{"tagIds":["t"]}"""),
        PlannerRecord("b", Kinds.GUEST, "Ana", status = "INVITED", updatedAt = 2, phone = "+55 11 9999"),
        PlannerRecord("c", Kinds.TASK, "Pagar buffet", status = "TODO", date = yesterday),
        PlannerRecord("d", Kinds.TASK, "Feito", status = "DONE", date = yesterday),
        PlannerRecord("t", Kinds.TAG, "Família"),
    ))

    @Test fun filtersByQueryStatusAndTag() {
        assertEquals(listOf("b"), ModuleListViewModel.filter(index, Kinds.GUEST, "9999", null, null, "recent").items.map { it.id })
        assertEquals(listOf("a"), ModuleListViewModel.filter(index, Kinds.GUEST, "", "CONFIRMED", null, "recent").items.map { it.id })
        assertEquals(listOf("a"), ModuleListViewModel.filter(index, Kinds.GUEST, "", null, "t", "recent").items.map { it.id })
    }

    @Test fun sortsAndCountsOverdue() {
        assertEquals(listOf("b", "a"), ModuleListViewModel.filter(index, Kinds.GUEST, "", null, null, "name").items.map { it.id })
        val tasks = ModuleListViewModel.filter(index, Kinds.TASK, "", ModuleListViewModel.STATUS_OVERDUE, null, "recent")
        assertEquals(listOf("c"), tasks.items.map { it.id })
        assertEquals(1, tasks.overdue)
        assertEquals(2, tasks.total)
    }
}
