package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DomainEnhancementsTest {

    @Test
    fun `PixBrCode generates valid EMVCo payload with CRC16`() {
        val brCode = PixBrCode.generate(
            key = "casamento@guilhermeeclara.com.br",
            merchantName = "Clara & Guilherme",
            merchantCity = "São Paulo",
            amountCents = 25000L,
            txid = "PRESENTE01",
        )
        assertTrue(brCode.startsWith("000201"))
        assertTrue(brCode.contains("br.gov.bcb.pix"))
        assertTrue(brCode.contains("casamento@guilhermeeclara.com.br"))
        assertTrue(brCode.contains("5406250.00"))
        assertTrue(brCode.contains("5915Clara Guilherme"))
        assertTrue(brCode.contains("6009SAO PAULO"))
        assertTrue(brCode.matches(Regex(".*6304[0-9A-F]{4}$")))
        val withoutCrc = brCode.dropLast(4)
        assertEquals(brCode.takeLast(4), PixBrCode.crc16(withoutCrc))
    }

    @Test
    fun `QrCodeMatrix generates square matrix with finder patterns`() {
        val payload = PixBrCode.generate(
            key = "casamento@guilhermeeclara.com.br",
            merchantName = "Clara Guilherme",
            merchantCity = "ITU",
            amountCents = 15000L,
        )
        val matrix = QrCodeMatrix.encode(payload)
        assertTrue(matrix.isNotEmpty())
        assertEquals(matrix.size, matrix.first().size)
        // Finder pattern top-left 7x7 corners must be dark
        assertTrue(matrix[0][0])
        assertTrue(matrix[0][6])
        assertTrue(matrix[6][0])
        assertTrue(matrix[6][6])
        assertTrue(matrix[3][3])
    }

    @Test
    fun `PaymentAdjustment computes late fee and pro rata interest for overdue payment`() {
        val record = PlannerRecord(
            id = "pay-test",
            kind = Kinds.PAYMENT,
            title = "Parcela Atrasada",
            amountCents = 100_000L, // R$ 1.000,00
            date = "2026-09-01",
            status = "PENDING",
            extraJson = """{"lateFeePercent":2.0,"interestPercentPerMonth":1.0}""",
        )
        val result = PaymentAdjustment.compute(record, LocalDate.parse("2026-10-01"))
        assertEquals(30L, result.lateDays)
        assertEquals(2_000L, result.feeCents) // 2% of 1.000,00 = 20,00
        assertEquals(1_000L, result.interestCents) // 1% for 30 days = 10,00
        assertEquals(103_000L, result.adjustedCents)
    }

    @Test
    fun `RiskRadar flags overdue payments and budget creep`() {
        val records = listOf(
            PlannerRecord(
                id = "b1",
                kind = Kinds.BUDGET,
                title = "Buffet",
                estimatedCents = 50_000_00L,
                amountCents = 60_000_00L, // +20% creep
            ),
            PlannerRecord(
                id = "p1",
                kind = Kinds.PAYMENT,
                title = "Sinal Decoração",
                amountCents = 5_000_00L,
                date = "2026-08-01",
                status = "PENDING",
            ),
        )
        val alerts = RiskRadar.compute(
            activeRecords = records,
            cashflow = emptyList(),
            daysToEvent = 45L,
            formatMoney = { "R$ ${it / 100}" },
            today = LocalDate.parse("2026-09-28"),
        )
        assertTrue(alerts.any { it.id == "overdue-payments" && it.severity == "HIGH" })
        assertTrue(alerts.any { it.id == "budget-creep-b1" && it.severity == "HIGH" })
    }

    @Test
    fun `VenueChecklistTemplates provides 20 standard inspection items`() {
        assertEquals(20, VenueChecklistTemplates.all.size)
    }

    @Test
    fun `GuestDemographics summarizes sides VIPs children and dietary restrictions`() {
        val guests = listOf(
            PlannerRecord(
                id = "g1",
                kind = Kinds.GUEST,
                title = "Mariana",
                status = "CONFIRMED",
                plusOnesConfirmed = 1,
                extraJson = """{"side":"BRIDE","isVIP":true,"isPadrinho":true,"dietary":"Vegetariana"}""",
            ),
            PlannerRecord(
                id = "g2",
                kind = Kinds.GUEST,
                title = "Lucas",
                status = "CONFIRMED",
                plusOnesConfirmed = 0,
                extraJson = """{"side":"GROOM","isChild":true,"dietary":"Sem lactose"}""",
            ),
        )
        val summary = GuestDemographics.analyze(guests)
        assertEquals(3, summary.confirmedSeats)
        assertEquals(1, summary.vipCount)
        assertEquals(1, summary.padrinhosCount)
        assertEquals(1, summary.childrenCount)
        assertEquals(2, summary.brideSideCount)
        assertEquals(1, summary.groomSideCount)
        assertEquals(2, summary.dietaryItems.size)
    }
}
