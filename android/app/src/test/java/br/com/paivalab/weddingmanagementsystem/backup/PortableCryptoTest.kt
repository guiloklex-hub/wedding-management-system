package br.com.paivalab.weddingmanagementsystem.backup

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class PortableCryptoTest {
    @Test fun roundTripAndTampering() {
        val original = ByteArray(125_000) { (it % 251).toByte() }
        val password = "backup-password-2026".toCharArray()
        val encrypted = ByteArrayOutputStream()
        PortableCrypto.encrypt(ByteArrayInputStream(original), encrypted, password)
        val decrypted = ByteArrayOutputStream()
        PortableCrypto.decrypt(ByteArrayInputStream(encrypted.toByteArray()), decrypted, password)
        assertArrayEquals(original, decrypted.toByteArray())
        val corrupted = encrypted.toByteArray().also { it[it.lastIndex - 12] = (it[it.lastIndex - 12].toInt() xor 1).toByte() }
        assertThrows(Exception::class.java) {
            PortableCrypto.decrypt(ByteArrayInputStream(corrupted), ByteArrayOutputStream(), password)
        }
        assertThrows(Exception::class.java) {
            PortableCrypto.decrypt(ByteArrayInputStream(encrypted.toByteArray()), ByteArrayOutputStream(), "wrong-password".toCharArray())
        }
    }
}
