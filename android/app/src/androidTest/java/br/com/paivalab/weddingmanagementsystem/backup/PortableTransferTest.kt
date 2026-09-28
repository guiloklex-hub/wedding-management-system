package br.com.paivalab.weddingmanagementsystem.backup

import android.net.Uri
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import br.com.paivalab.weddingmanagementsystem.data.PlannerDatabase
import br.com.paivalab.weddingmanagementsystem.data.PlannerPreferences
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerBlob
import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PortableTransferTest {
    @Test fun exportsNativeOnlyDataForWeb() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val database = Room.inMemoryDatabaseBuilder(context, PlannerDatabase::class.java).build()
        val output = File(context.getExternalFilesDir(null), "native-origin-validation.wfpbackup")
        try {
            val bytes = "Contrato criado no Android".toByteArray()
            val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
                .joinToString("") { "%02x".format(it) }
            database.dao().save(PlannerRecord("native-vendor", "vendor", "Fornecedor Android",
                subtitle = "DECORATION", status = "NEGOTIATION"))
            database.dao().save(PlannerRecord("native-guest", "guest", "Convidada Android",
                status = "INVITED"))
            database.dao().saveFile(PlannerFile("native-file", "native-vendor", "CONTRACT",
                "contrato.txt", "text/plain", bytes.size.toLong(), digest))
            database.dao().saveBlob(PlannerBlob("native-file", bytes))
            val archive = BackupArchive(context, database, PlannerPreferences(context))
            val password = "native-validation-password".toCharArray()
            archive.export(Uri.fromFile(output), password)
            val preview = archive.inspect(Uri.fromFile(output), password)
            assertEquals(2, preview.records)
            assertEquals(1, preview.files)
            assertEquals(0, preview.webTables)
        } finally {
            database.close()
            if (InstrumentationRegistry.getArguments().getString("persistNativeOrigin") != "true") output.delete()
        }
    }

    @Test fun importsPythonV2AndExportsItAgain() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val source = File(context.cacheDir, "portable-v2-fixture.wfpbackup")
        InstrumentationRegistry.getInstrumentation().context.assets.open("portable-v2-fixture.wfpbackup").use { input ->
            source.outputStream().use { input.copyTo(it) }
        }
        val database = Room.databaseBuilder(context, PlannerDatabase::class.java, "portable-transfer-test.db")
            .addMigrations(PlannerDatabase.MIGRATION_1_2).build()
        try {
            val archive = BackupArchive(context, database, PlannerPreferences(context))
            val password = "fixture-password-v2".toCharArray()
            val preview = archive.inspect(Uri.fromFile(source), password)
            assertTrue(preview.complete)
            assertEquals(2, preview.records)
            assertEquals(1, preview.files)
            assertEquals(4, preview.webTables)
            archive.restore(Uri.fromFile(source), password)
            assertEquals(2, database.dao().allRecords().size)
            assertEquals(1, database.dao().allFiles().size)
            assertTrue(archive.hasReversal())
            val exported = File(context.cacheDir, "android-roundtrip.wfpbackup")
            archive.export(Uri.fromFile(exported), password)
            val second = archive.inspect(Uri.fromFile(exported), password)
            assertEquals(2, second.records)
            assertEquals(4, second.webTables)
        } finally {
            database.close()
            context.deleteDatabase("portable-transfer-test.db")
            source.delete()
            File(context.cacheDir, "android-roundtrip.wfpbackup").delete()
        }
    }

    @Test fun rejectsWrongPasswordAndTamperedArchive() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val source = File(context.cacheDir, "portable-v2-reject.wfpbackup")
        InstrumentationRegistry.getInstrumentation().context.assets.open("portable-v2-fixture.wfpbackup").use { input ->
            source.outputStream().use { input.copyTo(it) }
        }
        val database = Room.databaseBuilder(context, PlannerDatabase::class.java, "portable-reject-test.db")
            .build()
        try {
            val archive = BackupArchive(context, database, PlannerPreferences(context))
            assertTrue(runCatching { archive.inspect(Uri.fromFile(source), "wrong-password".toCharArray()) }.isFailure)
            val bytes = source.readBytes()
            bytes[bytes.size / 2] = (bytes[bytes.size / 2].toInt() xor 1).toByte()
            source.writeBytes(bytes)
            assertTrue(runCatching { archive.inspect(Uri.fromFile(source), "fixture-password-v2".toCharArray()) }.isFailure)
            assertTrue(database.dao().allRecords().isEmpty())
        } finally {
            database.close()
            context.deleteDatabase("portable-reject-test.db")
            source.delete()
        }
    }
}
