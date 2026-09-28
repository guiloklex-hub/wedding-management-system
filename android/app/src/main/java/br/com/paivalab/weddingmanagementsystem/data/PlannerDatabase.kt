package br.com.paivalab.weddingmanagementsystem.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "records", indices = [Index("kind"), Index("parentId"), Index("guestGroupId"), Index("seatingTableId"), Index("date")])
data class PlannerRecord(
    @PrimaryKey val id: String,
    val kind: String,
    val title: String,
    val subtitle: String = "",
    val amountCents: Long? = null,
    val estimatedCents: Long? = null,
    val date: String? = null,
    val status: String = "",
    val parentId: String? = null,
    val guestGroupId: String? = null,
    val seatingTableId: String? = null,
    val plusOnesAllowed: Int = 0,
    val plusOnesConfirmed: Int = 0,
    val phone: String = "",
    val email: String = "",
    val notes: String = "",
    val extraJson: String = "{}",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val deletedAt: Long? = null,
)

@Entity(tableName = "files", indices = [Index("recordId")])
data class PlannerFile(
    @PrimaryKey val id: String,
    val recordId: String?,
    val kind: String,
    val fileName: String,
    val mimeType: String,
    val byteSize: Long,
    val sha256: String,
    val createdAt: Long = System.currentTimeMillis(),
    val deletedAt: Long? = null,
)

@Entity(tableName = "file_blobs")
data class PlannerBlob(@PrimaryKey val id: String, val bytes: ByteArray)

@Entity(tableName = "settings")
data class PlannerSetting(@PrimaryKey val key: String, val value: String)

@Entity(tableName = "audit", indices = [Index("recordId"), Index("at")])
data class PlannerAudit(
    @PrimaryKey val id: String,
    val recordId: String?,
    val action: String,
    val at: Long = System.currentTimeMillis(),
    val details: String = "",
)

@Entity(tableName = "portable_state")
data class PortableState(@PrimaryKey val key: String, val value: String)

@Dao
interface PlannerDao {
    @Query("SELECT * FROM records WHERE deletedAt IS NULL ORDER BY updatedAt DESC")
    fun observeRecords(): Flow<List<PlannerRecord>>

    @Query("SELECT * FROM records WHERE kind = :kind AND deletedAt IS NULL ORDER BY updatedAt DESC")
    fun observeKind(kind: String): Flow<List<PlannerRecord>>

    @Query("SELECT * FROM audit ORDER BY at DESC LIMIT 200")
    fun observeAudit(): Flow<List<PlannerAudit>>

    @Query("SELECT * FROM records WHERE id = :id AND deletedAt IS NULL LIMIT 1")
    suspend fun find(id: String): PlannerRecord?

    @Query("SELECT * FROM records ORDER BY createdAt ASC")
    suspend fun allRecords(): List<PlannerRecord>

    @Query("SELECT * FROM files ORDER BY createdAt ASC")
    suspend fun allFiles(): List<PlannerFile>

    @Query("SELECT * FROM files WHERE deletedAt IS NULL ORDER BY createdAt DESC")
    fun observeFiles(): Flow<List<PlannerFile>>

    @Query("SELECT * FROM file_blobs WHERE id = :id LIMIT 1")
    suspend fun blob(id: String): PlannerBlob?

    @Query("SELECT * FROM settings ORDER BY key")
    suspend fun allSettings(): List<PlannerSetting>

    @Query("SELECT * FROM audit ORDER BY at ASC")
    suspend fun allAudit(): List<PlannerAudit>

    @Query("SELECT * FROM settings WHERE key = :key LIMIT 1")
    suspend fun setting(key: String): PlannerSetting?

    @Query("SELECT * FROM portable_state WHERE `key` = :key LIMIT 1")
    suspend fun portableState(key: String): PortableState?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun savePortableState(state: PortableState)

    @Query("DELETE FROM portable_state")
    suspend fun clearPortableState()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(record: PlannerRecord)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveRecords(records: List<PlannerRecord>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveFile(file: PlannerFile)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveFiles(files: List<PlannerFile>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveBlob(blob: PlannerBlob)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveSetting(setting: PlannerSetting)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveSettings(settings: List<PlannerSetting>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun addAudit(event: PlannerAudit)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun addAudit(events: List<PlannerAudit>)

    @Query("DELETE FROM records")
    suspend fun clearRecords()

    @Query("DELETE FROM files")
    suspend fun clearFiles()

    @Query("DELETE FROM file_blobs")
    suspend fun clearBlobs()

    @Query("DELETE FROM settings")
    suspend fun clearSettings()

    @Query("DELETE FROM audit")
    suspend fun clearAudit()
}

@Database(
    entities = [PlannerRecord::class, PlannerFile::class, PlannerBlob::class, PlannerSetting::class, PlannerAudit::class,
        PortableState::class],
    version = 2,
    exportSchema = true,
)
abstract class PlannerDatabase : RoomDatabase() {
    abstract fun dao(): PlannerDao

    companion object {
        @Volatile private var instance: PlannerDatabase? = null

        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS `portable_state` (`key` TEXT NOT NULL, `value` TEXT NOT NULL, PRIMARY KEY(`key`))")
            }
        }

        fun get(context: Context): PlannerDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                PlannerDatabase::class.java,
                "wedding-planner.db",
            ).addMigrations(MIGRATION_1_2).build().also { instance = it }
        }
    }
}
