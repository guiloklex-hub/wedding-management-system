package br.com.paivalab.weddingmanagementsystem.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GuestRulesTest {
    private val guests = listOf(
        PlannerRecord("a", Kinds.GUEST, "Ana", status = "CONFIRMED", plusOnesAllowed = 1, plusOnesConfirmed = 1,
            extraJson = """{"isChild":true,"dietary":"Vegana","checkedInAt":1760000000000}"""),
        PlannerRecord("b", Kinds.GUEST, "Bia", status = "MAYBE", extraJson = """{"isPadrinho":1}"""),
        PlannerRecord("c", Kinds.GUEST, "Caio", status = "INVITED"),
        PlannerRecord("d", Kinds.GUEST, "Duda", status = "DECLINED", extraJson = """{"isChild":true}"""),
        PlannerRecord("e", Kinds.GUEST, "Edu", status = "NOT_INVITED"),
    )
    private val index = RecordIndex(guests)

    @Test fun statsFollowTheWebList() {
        // Crianças e restrições contam só entre confirmados, como na web.
        assertEquals(GuestStats(total = 5, confirmed = 1, declined = 1, pending = 2, seats = 2, children = 1, dietary = 1),
            GuestRules.stats(guests, index::extra))
    }

    @Test fun quickFiltersReadBooleansFromTheWebAsWell() {
        fun ids(filter: String) = guests.filter { GuestRules.matches(it, filter, index.extra(it)) == true }.map { it.id }
        assertEquals(listOf("a"), ids(GuestRules.FILTER_CONFIRMED))
        assertEquals(listOf("b", "c"), ids(GuestRules.FILTER_PENDING))
        assertEquals(listOf("b"), ids(GuestRules.FILTER_PADRINHOS))
        assertEquals(listOf("a", "d"), ids(GuestRules.FILTER_CHILDREN))
        assertEquals(listOf("a"), ids(GuestRules.FILTER_CHECKED_IN))
        assertNull(GuestRules.matches(guests[0], "DECLINED", index.extra(guests[0])))
    }

    @Test fun msisdnLikeTheWeb() {
        assertEquals("+5511999998888", GuestRules.validMsisdn("(11) 99999-8888"))
        assertEquals("+5511999998888", GuestRules.validMsisdn("55 11 99999 8888"))
        assertEquals("+351912345678", GuestRules.validMsisdn("+351 912 345 678"))
        assertNull(GuestRules.validMsisdn("9999-8888"))
        assertNull(GuestRules.validMsisdn(""))
    }

    @Test fun groupSummaryFallsBackToFirstReachableMember() {
        val members = listOf(
            PlannerRecord("m1", Kinds.GUEST, "Sem contato", status = "CONFIRMED"),
            PlannerRecord("m2", Kinds.GUEST, "Com telefone", status = "DECLINED", phone = "11 98888-7777"),
            PlannerRecord("m3", Kinds.GUEST, "Pendente", status = "INVITED"),
        )
        val withoutContact = GuestRules.summarizeGroup(PlannerRecord("g", Kinds.GROUP, "Família"), members)
        assertEquals(GroupSummary(3, 1, 1, 1, willReceive = true, fallbackName = "Com telefone"), withoutContact)
        val own = GuestRules.summarizeGroup(PlannerRecord("g", Kinds.GROUP, "Família", email = "familia@exemplo.com"), members)
        assertNull(own.fallbackName)
        assertFalse(GuestRules.summarizeGroup(PlannerRecord("g", Kinds.GROUP, "Vazio"), members.take(1)).willReceive)
    }

    @Test fun csvHasTheWebColumns() {
        val header = List(13) { "h$it" }
        val rows = GuestRules.csvRows(guests.take(2), index, header, "Sim") { it.lowercase() }
        assertEquals(header, rows[0])
        assertEquals(listOf("Ana", "", "", "", "", "confirmed", "1", "", "Vegana", "", "", "", "Sim"), rows[1])
        assertEquals("Sim", rows[2][10])
    }
}
