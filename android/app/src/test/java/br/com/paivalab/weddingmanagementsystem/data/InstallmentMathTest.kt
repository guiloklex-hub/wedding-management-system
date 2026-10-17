package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class InstallmentMathTest {
    @Test fun lastInstallmentAbsorbsRemainder() {
        assertEquals(listOf(333L, 333L, 334L), InstallmentMath.split(1000, 3))
        assertEquals(1000L, InstallmentMath.split(1000, 3).sum())
    }

    @Test fun dueDatesFollowIntervalInDaysLikeTheWeb() {
        val first = LocalDate.parse("2027-01-31")
        assertEquals(listOf("2027-01-31", "2027-03-02", "2027-04-01"),
            InstallmentMath.dueDates(first, 3, 30).map { it.toString() })
        assertEquals(listOf("2027-01-31", "2027-02-07"), InstallmentMath.dueDates(first, 2, 7).map { it.toString() })
    }

    @Test fun planEnforcesWebLimits() {
        val first = LocalDate.parse("2027-01-10")
        assertThrows(IllegalArgumentException::class.java) { InstallmentPlan("v", "Buffet", 1000, 61, first) }
        assertThrows(IllegalArgumentException::class.java) { InstallmentPlan("v", "Buffet", 1000, 2, first, intervalDays = 0) }
        assertThrows(IllegalArgumentException::class.java) { InstallmentPlan("v", "Buffet", 1000, 2, first, method = "CREDIT_CARD") }
        assertThrows(IllegalArgumentException::class.java) { InstallmentPlan("v", "Buffet", 1000, 2, first, lateFeePercent = 101.0) }
        assertEquals(60, InstallmentPlan("v", "Buffet", 1000, 60, first).count)
    }
}
