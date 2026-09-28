package br.com.paivalab.weddingmanagementsystem.backup

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.io.DataInputStream
import java.io.RandomAccessFile
import java.security.KeyStore
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream
import javax.crypto.Cipher
import javax.crypto.CipherOutputStream
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class PortableVault(private val context: Context) {
    private val directory = File(context.filesDir, "portable-vault").also { it.mkdirs() }
    private val namePattern = Regex("^[0-9a-f-]{36}\\.vault$")
    private val alias = "wfp-web-passthrough-v1"
    private val aad = "WFP-WEB-VAULT-1".toByteArray(Charsets.US_ASCII)
    private val reversalAad = "WFP-REVERSAL-1".toByteArray(Charsets.US_ASCII)

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").also { it.load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build())
        return generator.generateKey()
    }

    fun seal(source: ZipFile, entryNames: List<String>): String {
        require(entryNames.isNotEmpty() && entryNames.distinct().size == entryNames.size)
        val plain = File.createTempFile("web-vault-", ".zip", context.cacheDir)
        val name = "${UUID.randomUUID()}.vault"
        val target = File(directory, name)
        try {
            ZipOutputStream(plain.outputStream().buffered()).use { output ->
                entryNames.forEach { entryName ->
                    require(entryName == "web.sqlite" || entryName.startsWith("uploads/"))
                    val entry = source.getEntry(entryName) ?: error("Arquivo web ausente: $entryName")
                    output.putNextEntry(ZipEntry(entryName))
                    source.getInputStream(entry).use { it.copyTo(output) }
                    output.closeEntry()
                }
            }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key())
            cipher.updateAAD(aad)
            target.outputStream().buffered().use { raw ->
                raw.write(cipher.iv)
                CipherOutputStream(raw, cipher).use { encrypted ->
                    plain.inputStream().buffered().use { it.copyTo(encrypted) }
                }
            }
            return name
        } catch (error: Exception) {
            target.delete()
            throw error
        } finally {
            plain.delete()
        }
    }

    fun <T> withOpen(name: String, block: (ZipFile) -> T): T {
        require(namePattern.matches(name)) { "Cofre web inválido" }
        return openSealed(File(directory, name), aad, block)
    }

    fun sealReversal(plain: File): String {
        val reversions = File(context.filesDir, "portable-reversions").also { it.mkdirs() }
        val name = "${UUID.randomUUID()}.vault"
        val target = File(reversions, name)
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key())
            cipher.updateAAD(reversalAad)
            target.outputStream().buffered().use { raw ->
                raw.write(cipher.iv)
                CipherOutputStream(raw, cipher).use { encrypted -> plain.inputStream().buffered().use { it.copyTo(encrypted) } }
            }
            return name
        } catch (error: Exception) {
            target.delete()
            throw error
        }
    }

    fun <T> withReversal(name: String, block: (ZipFile) -> T): T {
        require(namePattern.matches(name)) { "Reversão inválida" }
        return openSealed(File(context.filesDir, "portable-reversions/$name"), reversalAad, block)
    }

    fun copyReversalPlain(name: String, target: File) {
        withReversal(name) { source -> File(source.name).copyTo(target, overwrite = true) }
    }

    private fun <T> openSealed(sealed: File, associatedData: ByteArray, block: (ZipFile) -> T): T {
        val plain = File.createTempFile("web-vault-open-", ".zip", context.cacheDir)
        try {
            require(sealed.length() >= 28) { "Cofre web incompleto" }
            val tag = ByteArray(16)
            RandomAccessFile(sealed, "r").use { file ->
                file.seek(file.length() - tag.size)
                file.readFully(tag)
            }
            DataInputStream(sealed.inputStream().buffered()).use { raw ->
                val nonce = ByteArray(12)
                raw.readFully(nonce)
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, nonce))
                cipher.updateAAD(associatedData)
                plain.outputStream().buffered().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    var remaining = sealed.length() - 28
                    while (remaining > 0) {
                        val count = raw.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
                        require(count > 0) { "Cofre web incompleto" }
                        cipher.update(buffer, 0, count)?.let(output::write)
                        remaining -= count
                    }
                    cipher.doFinal(tag)?.let(output::write)
                }
            }
            return ZipFile(plain).use(block)
        } finally {
            plain.delete()
        }
    }

    fun delete(name: String?) {
        if (name != null && namePattern.matches(name)) File(directory, name).delete()
    }

    fun cleanOrphans(active: String?) {
        directory.listFiles()?.filter { namePattern.matches(it.name) && it.name != active }?.forEach(File::delete)
    }
}
