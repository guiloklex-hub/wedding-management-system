package br.com.paivalab.weddingmanagementsystem.data

import android.content.Context
import java.io.File
import java.io.IOException

/**
 * Bytes dos anexos em arquivos privados do app (`noBackupFilesDir/blobs`).
 * Guardá-los no SQLite estourava a CursorWindow (~2 MB) ao ler PDFs maiores.
 */
class BlobStore(context: Context) {
    private val root = File(context.noBackupFilesDir, "blobs")

    private fun safeName(id: String): String {
        require(id.matches(Regex("[A-Za-z0-9_-]{1,100}"))) { "ID de anexo inválido" }
        return id
    }

    fun file(id: String): File = File(root, safeName(id))

    fun exists(id: String): Boolean = file(id).isFile

    fun read(id: String): ByteArray? = file(id).takeIf { it.isFile }?.readBytes()

    /** Lê do arquivo ou, se a migração ainda não rodou, do SQLite em blocos. */
    suspend fun read(id: String, dao: PlannerDao): ByteArray? = read(id) ?: legacy(id, dao)

    private suspend fun legacy(id: String, dao: PlannerDao): ByteArray? {
        val size = dao.legacyBlobSize(id) ?: return null
        val output = java.io.ByteArrayOutputStream(size.toInt())
        var offset = 1L
        while (offset <= size) {
            output.write(dao.legacyBlobChunk(id, offset, CHUNK) ?: break)
            offset += CHUNK
        }
        return output.toByteArray().takeIf { it.size.toLong() == size }
    }

    fun write(id: String, bytes: ByteArray) = writeInto(root, id, bytes)

    fun delete(id: String) { file(id).delete() }

    private fun writeInto(directory: File, id: String, bytes: ByteArray) {
        if (!directory.isDirectory && !directory.mkdirs()) throw IOException("Não foi possível criar ${directory.name}")
        val target = File(directory, safeName(id))
        val temporary = File(directory, "${target.name}.tmp")
        temporary.outputStream().use { output ->
            output.write(bytes)
            output.fd.sync()
        }
        if (!temporary.renameTo(target)) {
            temporary.delete()
            throw IOException("Não foi possível gravar o anexo")
        }
    }

    /** Área de preparo para trocar todos os anexos de uma vez na restauração. */
    inner class Staging internal constructor(private val directory: File) {
        fun write(id: String, bytes: ByteArray) = writeInto(directory, id, bytes)

        /** Substitui os anexos atuais; chamar só depois de o banco ter sido gravado. */
        fun commit() {
            val previous = File(root.parentFile, "blobs-previous")
            previous.deleteRecursively()
            if (root.exists() && !root.renameTo(previous)) throw IOException("Não foi possível trocar os anexos")
            if (!directory.renameTo(root)) {
                previous.renameTo(root)
                throw IOException("Não foi possível trocar os anexos")
            }
            previous.deleteRecursively()
        }

        fun discard() { directory.deleteRecursively() }
    }

    fun stage(): Staging {
        val directory = File(root.parentFile, "blobs-staging")
        directory.deleteRecursively()
        if (!directory.mkdirs()) throw IOException("Não foi possível preparar os anexos")
        return Staging(directory)
    }

    /**
     * Move os anexos guardados no SQLite (versões até 1.1.x) para arquivos, lendo em
     * blocos para não estourar a CursorWindow. Idempotente: pode rodar a cada abertura.
     */
    suspend fun migrateFromDatabase(dao: PlannerDao) {
        dao.legacyBlobIds().forEach { id ->
            if (!exists(id)) write(id, legacy(id, dao) ?: return@forEach)
            dao.deleteLegacyBlob(id)
        }
    }

    private companion object {
        const val CHUNK = 512L * 1024L
    }
}
