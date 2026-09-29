package br.com.paivalab.weddingmanagementsystem.data

import android.content.Context
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PlannerMigrationTest {
    @Test fun migrationPreservesExistingData() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val assets = InstrumentationRegistry.getInstrumentation().context.assets
        val schema = assets.open("br.com.paivalab.weddingmanagementsystem.data.PlannerDatabase/1.json")
            .bufferedReader().use { JSONObject(it.readText()) }.getJSONObject("database")
        val name = "planner-v1-to-v3.db"
        context.deleteDatabase(name)
        context.openOrCreateDatabase(name, Context.MODE_PRIVATE, null).use { database ->
            val entities = schema.getJSONArray("entities")
            for (index in 0 until entities.length()) {
                val entity = entities.getJSONObject(index)
                val table = entity.getString("tableName")
                database.execSQL(entity.getString("createSql").replace("\${TABLE_NAME}", table))
                val indexes = entity.optJSONArray("indices") ?: JSONArray()
                for (item in 0 until indexes.length()) {
                    database.execSQL(indexes.getJSONObject(item).getString("createSql").replace("\${TABLE_NAME}", table))
                }
            }
            database.execSQL("INSERT INTO settings (`key`, `value`) VALUES ('currency', 'BRL')")
            database.version = 1
        }
        val migrated = Room.databaseBuilder(context, PlannerDatabase::class.java, name)
            .addMigrations(PlannerDatabase.MIGRATION_1_2, PlannerDatabase.MIGRATION_2_3).build()
        try {
            assertEquals("BRL", migrated.dao().allSettings().first { it.key == "currency" }.value)
            migrated.dao().savePortableState(PortableState("lineage", "v3"))
            assertEquals("v3", migrated.dao().portableState("lineage")?.value)
        } finally {
            migrated.close()
            context.deleteDatabase(name)
        }
    }

    @Test fun migrationAddsFileVersionWithoutLosingPdf() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val assets = InstrumentationRegistry.getInstrumentation().context.assets
        val schema = assets.open("br.com.paivalab.weddingmanagementsystem.data.PlannerDatabase/2.json")
            .bufferedReader().use { JSONObject(it.readText()) }.getJSONObject("database")
        val name = "planner-v2-to-v3.db"
        context.deleteDatabase(name)
        context.openOrCreateDatabase(name, Context.MODE_PRIVATE, null).use { database ->
            val entities = schema.getJSONArray("entities")
            for (index in 0 until entities.length()) {
                val entity = entities.getJSONObject(index)
                val table = entity.getString("tableName")
                database.execSQL(entity.getString("createSql").replace("\${TABLE_NAME}", table))
                val indexes = entity.optJSONArray("indices") ?: JSONArray()
                for (item in 0 until indexes.length()) {
                    database.execSQL(indexes.getJSONObject(item).getString("createSql").replace("\${TABLE_NAME}", table))
                }
            }
            database.execSQL("INSERT INTO files (id, recordId, kind, fileName, mimeType, byteSize, sha256, createdAt, deletedAt) " +
                "VALUES ('pdf', NULL, 'CONTRACT', 'contrato.pdf', 'application/pdf', 3, 'hash', 1, NULL)")
            database.version = 2
        }
        val migrated = Room.databaseBuilder(context, PlannerDatabase::class.java, name)
            .addMigrations(PlannerDatabase.MIGRATION_1_2, PlannerDatabase.MIGRATION_2_3).build()
        try {
            assertEquals(1, migrated.dao().allFiles().single().version)
            assertEquals("contrato.pdf", migrated.dao().allFiles().single().fileName)
        } finally {
            migrated.close()
            context.deleteDatabase(name)
        }
    }
}
