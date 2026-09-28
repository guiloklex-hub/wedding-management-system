package br.com.paivalab.weddingmanagementsystem.backup

import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.CipherOutputStream
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

object PortableCrypto {
    private val magic = "WFPBAK01".toByteArray(Charsets.US_ASCII)
    private const val iterations = 600_000
    private const val headerSize = 8 + 4 + 16 + 12
    private val random = SecureRandom()

    fun encrypt(plain: InputStream, destination: OutputStream, password: CharArray) {
        require(password.size >= 12) { "Use uma senha de pelo menos 12 caracteres" }
        val salt = ByteArray(16).also(random::nextBytes)
        val nonce = ByteArray(12).also(random::nextBytes)
        val header = ByteBuffer.allocate(headerSize).put(magic).putInt(iterations).put(salt).put(nonce).array()
        destination.write(header)
        val key = derive(password, salt, iterations)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, nonce))
        cipher.updateAAD(header)
        CipherOutputStream(destination, cipher).use { encrypted -> plain.copyTo(encrypted) }
    }

    fun decrypt(source: InputStream, destination: OutputStream, password: CharArray,
                maxPlainBytes: Long = Long.MAX_VALUE) {
        require(maxPlainBytes > 0) { "Espaço insuficiente" }
        val header = ByteArray(headerSize)
        readFully(source, header)
        require(header.copyOfRange(0, 8).contentEquals(magic)) { "Formato de backup desconhecido" }
        val buffer = ByteBuffer.wrap(header)
        buffer.position(8)
        val workFactor = buffer.int
        require(workFactor in 600_000..2_000_000) { "Parâmetros do backup inválidos" }
        val salt = ByteArray(16).also(buffer::get)
        val nonce = ByteArray(12).also(buffer::get)
        val key = derive(password, salt, workFactor)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, nonce))
        cipher.updateAAD(header)
        val chunk = ByteArray(64 * 1024)
        var tail = ByteArray(0)
        var written = 0L
        while (true) {
            val count = source.read(chunk)
            if (count < 0) break
            val combined = ByteArray(tail.size + count)
            tail.copyInto(combined)
            chunk.copyInto(combined, tail.size, 0, count)
            if (combined.size <= 16) {
                tail = combined
                continue
            }
            val process = combined.size - 16
            val plain = cipher.update(combined, 0, process)
            if (plain != null) {
                written += plain.size
                require(written <= maxPlainBytes) { "Espaço insuficiente" }
                destination.write(plain)
            }
            tail = combined.copyOfRange(process, combined.size)
        }
        require(tail.size == 16) { "Backup incompleto" }
        val final = cipher.doFinal(tail)
        written += final.size
        require(written <= maxPlainBytes) { "Espaço insuficiente" }
        destination.write(final)
    }

    private fun derive(password: CharArray, salt: ByteArray, rounds: Int): SecretKeySpec {
        val specification = PBEKeySpec(password, salt, rounds, 256)
        val bytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(specification).encoded
        specification.clearPassword()
        return SecretKeySpec(bytes, "AES").also { bytes.fill(0) }
    }

    private fun readFully(source: InputStream, target: ByteArray) {
        var read = 0
        while (read < target.size) {
            val count = source.read(target, read, target.size - read)
            require(count > 0) { "Backup incompleto" }
            read += count
        }
    }

}
