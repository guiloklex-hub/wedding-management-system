package br.com.paivalab.weddingmanagementsystem.data

import org.junit.Assert.assertEquals
import org.junit.Test

class InstallmentMathTest {
    @Test fun lastInstallmentAbsorbsRemainder() {
        assertEquals(listOf(333L, 333L, 334L), InstallmentMath.split(1000, 3))
        assertEquals(1000L, InstallmentMath.split(1000, 3).sum())
    }
}
