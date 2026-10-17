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
        PlannerRecord("e", Kinds.TASK, "Provar bolo", status = "IN_PROGRESS", date = LocalDate.now().plusDays(5).toString()),
        PlannerRecord("f", Kinds.TASK, "Lua de mel", status = "TODO", date = LocalDate.now().plusDays(30).toString()),
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
        assertEquals(4, tasks.total)
    }

    @Test fun guestAndGiftQuickFilters() {
        val guests = RecordIndex(listOf(
            PlannerRecord("p", Kinds.GUEST, "Padrinho", status = "MAYBE", extraJson = """{"isPadrinho":true}"""),
            PlannerRecord("q", Kinds.GUEST, "Outro", status = "DECLINED"),
            PlannerRecord("g1", Kinds.GIFT, "Pix", status = "THANKED"),
            PlannerRecord("g2", Kinds.GIFT, "Jogo", status = "RECEIVED"),
        ))
        val padrinhos = ModuleListViewModel.filter(guests, Kinds.GUEST, "", "PADRINHOS", null, "name")
        assertEquals(listOf("p"), padrinhos.items.map { it.id })
        assertEquals(1, padrinhos.quick["GUEST_PENDING"])
        assertEquals(listOf("q"), ModuleListViewModel.filter(guests, Kinds.GUEST, "", "DECLINED", null, "name").items.map { it.id })
        val gifts = ModuleListViewModel.filter(guests, Kinds.GIFT, "", "PENDING_THANK", null, "name")
        assertEquals(listOf("g2"), gifts.items.map { it.id })
        assertEquals(1, gifts.quick["PENDING_THANK"])
    }

    @Test fun taskQuickFiltersMatchTheWeb() {
        fun ids(status: String) = ModuleListViewModel.filter(index, Kinds.TASK, "", status, null, "name").items.map { it.id }
        assertEquals(listOf("f", "c", "e"), ids(ModuleListViewModel.STATUS_OPEN))
        // "Próximos 7 dias" inclui as atrasadas, como na web.
        assertEquals(listOf("c", "e"), ids(ModuleListViewModel.STATUS_WEEK))
        val state = ModuleListViewModel.filter(index, Kinds.TASK, "", null, null, "recent")
        assertEquals(3, state.open)
        assertEquals(2, state.week)
    }
}
