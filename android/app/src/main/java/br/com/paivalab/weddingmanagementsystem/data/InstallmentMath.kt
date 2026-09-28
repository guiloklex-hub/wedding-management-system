package br.com.paivalab.weddingmanagementsystem.data

object InstallmentMath {
    fun split(totalCents: Long, count: Int): List<Long> {
        require(totalCents >= 0 && count in 1..120)
        val base = totalCents / count
        val remainder = totalCents - base * count
        return List(count) { index -> base + if (index == count - 1) remainder else 0 }
    }
}
