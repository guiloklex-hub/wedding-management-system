package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FinanceRulesTest {
    @Test fun monthlyRecurrenceAndNegativeBalance() {
        val records = listOf(
            PlannerRecord("cash", Kinds.ASSET, "Caixa", amountCents = 10_000),
            PlannerRecord("salary", Kinds.INCOME, "Salário", amountCents = 5_000,
                extraJson = "{\"frequency\":\"MONTHLY\"}"),
            PlannerRecord("pay", Kinds.PAYMENT, "Local", amountCents = 18_000, date = "2026-09-30"),
        )
        val points = FinanceRules.monthlyCashflow(records, LocalDate.parse("2026-10-01"), LocalDate.parse("2026-09-01"))
        assertEquals(2, points.size)
        assertEquals(-3_000, points[0].endingCents)
        assertTrue(points[0].negative)
        assertEquals(2_000, points[1].endingCents)
    }

    @Test fun contractedThresholdsFollowWebRule() {
        assertEquals(.3, FinanceRules.expectedContractedFraction(366), 0.0)
        assertEquals(.6, FinanceRules.expectedContractedFraction(365), 0.0)
        assertEquals(.85, FinanceRules.expectedContractedFraction(180), 0.0)
        assertEquals(1.0, FinanceRules.expectedContractedFraction(30), 0.0)
    }
}
