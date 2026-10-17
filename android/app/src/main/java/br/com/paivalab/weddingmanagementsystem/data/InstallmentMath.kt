package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate

/** Parcelamento como em `generateInstallments` da web (limites do Zod incluídos). */
data class InstallmentPlan(
    val vendorId: String,
    val title: String,
    val totalCents: Long,
    val count: Int,
    val firstDueDate: LocalDate,
    val intervalDays: Int = 30,
    val method: String = "PIX",
    val lateFeePercent: Double? = null,
    val interestPercentPerMonth: Double? = null,
) {
    init {
        require(totalCents in 1..1_000_000_000L)
        require(count in 1..InstallmentMath.MAX_COUNT)
        require(intervalDays in 1..366)
        require(method in WebValues.paymentMethods)
        require(lateFeePercent == null || lateFeePercent in 0.0..100.0)
        require(interestPercentPerMonth == null || interestPercentPerMonth in 0.0..100.0)
    }
}

object InstallmentMath {
    const val MAX_COUNT = 60

    fun split(totalCents: Long, count: Int): List<Long> {
        require(totalCents >= 0 && count in 1..120)
        val base = totalCents / count
        val remainder = totalCents - base * count
        return List(count) { index -> base + if (index == count - 1) remainder else 0 }
    }

    fun dueDates(first: LocalDate, count: Int, intervalDays: Int): List<LocalDate> =
        List(count) { index -> first.plusDays(index.toLong() * intervalDays) }
}
