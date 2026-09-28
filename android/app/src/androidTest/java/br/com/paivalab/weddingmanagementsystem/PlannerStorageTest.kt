package br.com.paivalab.weddingmanagementsystem

import android.content.Context
import android.net.Uri
import androidx.room.Room
import androidx.room.withTransaction
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import br.com.paivalab.weddingmanagementsystem.backup.BackupArchive
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.GuestImport
import br.com.paivalab.weddingmanagementsystem.data.PlannerBlob
import br.com.paivalab.weddingmanagementsystem.data.PlannerDatabase
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerPreferences
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.PlannerRepository
import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PlannerStorageTest {
    private lateinit var context: Context
    private lateinit var database: PlannerDatabase
    private lateinit var repository: PlannerRepository

    @Before fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        database = Room.inMemoryDatabaseBuilder(context, PlannerDatabase::class.java).build()
        repository = PlannerRepository(database)
    }

    @After fun tearDown() { database.close() }

    @Test fun seatingCapacityAndSingleGiftPosting() = runBlocking {
        repository.save(PlannerRecord("table", Kinds.TABLE, "Mesa", amountCents = 2))
        repository.save(PlannerRecord("guest1", Kinds.GUEST, "Ana", status = "CONFIRMED", plusOnesAllowed = 1,
            plusOnesConfirmed = 1, seatingTableId = "table"))
        repository.save(PlannerRecord("guest2", Kinds.GUEST, "Bia", status = "CONFIRMED"))
        val failure = runCatching { repository.assignGuestToTable("guest2", "table") }.exceptionOrNull()
        assertNotNull(failure)
        assertNull(database.dao().find("guest2")?.seatingTableId)

        repository.save(PlannerRecord("gift", Kinds.GIFT, "Presente", amountCents = 5_000))
        repository.convertGift("gift", Kinds.INCOME)
        assertEquals("PROCESSED", database.dao().find("gift")?.status)
        assertNotNull(runCatching { repository.convertGift("gift", Kinds.INCOME) }.exceptionOrNull())
        assertEquals(1, database.dao().allRecords().count { it.kind == Kinds.INCOME })
    }

    @Test fun groupRsvpUpdatesMembersOnly() = runBlocking {
        repository.save(PlannerRecord("group", Kinds.GROUP, "Família"))
        repository.save(PlannerRecord("member", Kinds.GUEST, "Ana", guestGroupId = "group", status = "INVITED"))
        repository.save(PlannerRecord("other", Kinds.GUEST, "Bia", status = "INVITED"))
        repository.setGroupRsvp("group", "CONFIRMED")
        assertEquals("CONFIRMED", database.dao().find("member")?.status)
        assertEquals("INVITED", database.dao().find("other")?.status)
        assertEquals("CONFIRMED", database.dao().find("group")?.status)
    }

    @Test fun replacementTransactionRollsBackAfterFailure() = runBlocking {
        repository.save(PlannerRecord("original", Kinds.VENDOR, "Fornecedor original"))
        assertNotNull(runCatching {
            database.withTransaction {
                database.dao().clearRecords()
                error("interrupção simulada")
            }
        }.exceptionOrNull())
        assertEquals("Fornecedor original", database.dao().find("original")?.title)
    }

    @Test fun databasePersistsAfterReopen() = runBlocking {
        val name = "reopen-${System.nanoTime()}.db"
        try {
            val first = Room.databaseBuilder(context, PlannerDatabase::class.java, name).build()
            try {
                first.dao().save(PlannerRecord("persisted", Kinds.GUEST, "Convidado salvo"))
            } finally { first.close() }
            val reopened = Room.databaseBuilder(context, PlannerDatabase::class.java, name).build()
            try {
                assertEquals("Convidado salvo", reopened.dao().find("persisted")?.title)
            } finally { reopened.close() }
        } finally { context.deleteDatabase(name) }
    }

    @Test fun backupRestoresRecordsAndRealBytesAndRejectsWrongPassword() = runBlocking {
        val bytes = "PDF test".toByteArray()
        val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        repository.save(PlannerRecord("vendor", Kinds.VENDOR, "Buffet"))
        repository.save(PlannerRecord("tag", Kinds.TAG, "Padrinhos"))
        repository.save(PlannerRecord("guest", Kinds.GUEST, "Ana",
            extraJson = """{"tagIds":["tag"]}"""))
        database.dao().saveFile(PlannerFile("file", "vendor", "OTHER", "contract.pdf", "application/pdf", bytes.size.toLong(), hash))
        database.dao().saveBlob(PlannerBlob("file", bytes))
        val archive = BackupArchive(context, database, PlannerPreferences(context))
        val target = File.createTempFile("backup-test-", ".wfpbackup", context.cacheDir)
        try {
            val uri = Uri.fromFile(target)
            archive.export(uri, "correct horse battery".toCharArray())
            assertNotNull(runCatching { archive.inspect(uri, "wrong password".toCharArray()) }.exceptionOrNull())
            repository.delete("vendor")
            val corrupt = File.createTempFile("corrupt-test-", ".wfpbackup", context.cacheDir)
            try {
                target.copyTo(corrupt, overwrite = true)
                java.io.RandomAccessFile(corrupt, "rw").use { file ->
                    file.seek(file.length() - 1)
                    val lastByte = file.read()
                    file.seek(file.length() - 1)
                    file.write(lastByte xor 1)
                }
                assertNotNull(runCatching { archive.restore(Uri.fromFile(corrupt),
                    "correct horse battery".toCharArray()) }.exceptionOrNull())
                assertNull(database.dao().find("vendor"))
            } finally { corrupt.delete() }
            val preview = archive.inspect(uri, "correct horse battery".toCharArray())
            assertEquals(1, preview.files)
            assertEquals(3, preview.records)
            archive.restore(uri, "correct horse battery".toCharArray())
            assertEquals("Buffet", database.dao().find("vendor")?.title)
            assertEquals("""{"tagIds":["tag"]}""", database.dao().find("guest")?.extraJson)
            assertEquals(bytes.toList(), database.dao().blob("file")?.bytes?.toList())
        } finally {
            target.delete()
        }
    }

    @Test fun desktopConverterBackupRestoresOnAndroid() = runBlocking {
        val source = File.createTempFile("interop-", ".wfpbackup", context.cacheDir)
        try {
            InstrumentationRegistry.getInstrumentation().context.assets.open("interop.wfpbackup").use { input ->
                source.outputStream().use { output -> input.copyTo(output) }
            }
            val archive = BackupArchive(context, database, PlannerPreferences(context))
            archive.restore(Uri.fromFile(source), "correct horse battery".toCharArray())
            assertEquals("Fornecedor migrado", database.dao().find("interop-vendor")?.title)
            assertEquals("attachment from desktop converter", String(database.dao().blob("interop-file")!!.bytes))
        } finally {
            source.delete()
        }
    }

    @Test fun externalConverterBackupRestoresOnAndroid() = runBlocking {
        val directory = context.getExternalFilesDir(null)
        val source = File(directory, "migration-validation.wfpbackup")
        val passwordFile = File(directory, "migration-validation-password.txt")
        val expectedRecords = InstrumentationRegistry.getArguments().getString("expectedRecords")?.toIntOrNull()
        val expectedFiles = InstrumentationRegistry.getArguments().getString("expectedFiles")?.toIntOrNull()
        assumeTrue(source.isFile && passwordFile.isFile && expectedRecords != null && expectedFiles != null)
        try {
            val password = passwordFile.readText().trimEnd().toCharArray()
            try {
                val archive = BackupArchive(context, database, PlannerPreferences(context))
                val preview = archive.inspect(Uri.fromFile(source), password)
                assertEquals(expectedRecords, preview.records)
                assertEquals(expectedFiles, preview.files)
                archive.restore(Uri.fromFile(source), password)
                assertEquals(expectedRecords, database.dao().allRecords().size)
                InstrumentationRegistry.getArguments().getString("expectedGuestId")?.let { id ->
                    val title = database.dao().find(id)?.title
                    val expectedTitle = InstrumentationRegistry.getArguments().getString("expectedGuestTitle")
                    if (expectedTitle != null) assertEquals(expectedTitle, title)
                    else assertTrue(title?.endsWith("(editado no Android)") == true)
                }
                val files = database.dao().allFiles()
                assertEquals(expectedFiles, files.size)
                files.forEach { file ->
                    val bytes = database.dao().blob(file.id)?.bytes
                    assertNotNull(bytes)
                    val digest = MessageDigest.getInstance("SHA-256").digest(bytes!!)
                        .joinToString("") { "%02x".format(it) }
                    assertEquals(file.sha256, digest)
                }
                if (InstrumentationRegistry.getArguments().getString("roundtripEditGuest") == "true") {
                    val guest = database.dao().allRecords().first { it.kind == "guest" && it.deletedAt == null }
                    database.dao().save(guest.copy(title = "${guest.title} (editado no Android)", updatedAt = guest.updatedAt + 1000))
                }
                if (InstrumentationRegistry.getArguments().getString("roundtripExport") == "true") {
                    archive.export(Uri.fromFile(File(directory, "migration-validation-return.wfpbackup")), password)
                }
            } finally {
                password.fill('\u0000')
            }
        } finally {
            source.delete()
            passwordFile.delete()
        }
    }

    @Test fun importsWedyXlsxWithoutServer() {
        val source = File.createTempFile("wedy-", ".xlsx", context.cacheDir)
        try {
            val headers = listOf("Nome do convite", "Nome completo do convidado", "Status", "Telefone", "E-mail", "Tags")
            val values = listOf("Família Silva", "Ana Silva", "Confirmado", "5511999999999", "ana@example.test", "Padrinhos")
            fun row(number: Int, cells: List<String>) = "<row r=\"$number\">" + cells.mapIndexed { index, value ->
                "<c r=\"${'A' + index}$number\" t=\"inlineStr\"><is><t>$value</t></is></c>"
            }.joinToString("") + "</row>"
            val xml = "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>" +
                row(1, headers) + row(2, values) + "</sheetData></worksheet>"
            ZipOutputStream(source.outputStream()).use { zip ->
                zip.putNextEntry(ZipEntry("xl/worksheets/sheet1.xml"))
                zip.write(xml.toByteArray())
                zip.closeEntry()
            }
            val preview = GuestImport.read(context, Uri.fromFile(source))
            assertEquals("wedy", preview.source)
            assertEquals("CONFIRMED", preview.guests.single().status)
            assertEquals("Família Silva", preview.guests.single().groupName)
        } finally {
            source.delete()
        }
    }
}
