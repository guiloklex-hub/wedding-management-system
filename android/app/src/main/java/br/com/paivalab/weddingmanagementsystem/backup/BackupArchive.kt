package br.com.paivalab.weddingmanagementsystem.backup

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import androidx.room.withTransaction
import br.com.paivalab.weddingmanagementsystem.data.PlannerAudit
import br.com.paivalab.weddingmanagementsystem.data.PlannerBlob
import br.com.paivalab.weddingmanagementsystem.data.PlannerDatabase
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerPreferences
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.PlannerSetting
import br.com.paivalab.weddingmanagementsystem.data.PortableState
import java.io.File
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.time.LocalDate
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

data class BackupPreview(val records: Int, val files: Int, val exportedAt: Long,
                         val complete: Boolean = false, val webTables: Int = 0,
                         val areas: Map<String, Int> = emptyMap(), val requiredBytes: Long = 0,
                         val changed: Int = 0, val created: Int = 0, val deleted: Int = 0)

private data class ValidatedBackup(
    val manifest: JSONObject,
    val records: List<PlannerRecord>,
    val files: List<PlannerFile>,
    val settings: List<PlannerSetting>,
    val audits: List<PlannerAudit>,
    val baseline: String,
    val webEntries: List<String>,
) {
    val preview get(): BackupPreview {
        val initial = JSONArray(baseline)
        val initialRows = (0 until initial.length()).associate { index ->
            val row = initial.getJSONObject(index)
            row.getString("id") to row
        }
        val currentIds = records.map { it.id }.toSet()
        val uploads = manifest.optJSONObject("uploads")
        val uploadBytes = uploads?.keys()?.asSequence()?.sumOf { uploads.getJSONObject(it).getLong("size") } ?: 0L
        val webBytes = manifest.optJSONObject("webDatabase")?.optLong("size") ?: 0L
        return BackupPreview(records.size, files.size, manifest.getLong("exportedAt"),
            manifest.optInt("version") == 2, manifest.optJSONObject("webTables")?.length() ?: 0,
            records.groupingBy { it.kind }.eachCount(),
            uploadBytes + webBytes + files.sumOf { it.byteSize },
            records.count { record ->
                val old = initialRows[record.id]
                old != null && (old.optLong("updatedAt") != record.updatedAt ||
                    old.optNullableLong("deletedAt") != record.deletedAt)
            },
            records.count { it.id !in initialRows }, initialRows.keys.count { it !in currentIds })
    }
}

class BackupArchive(
    private val context: Context,
    private val database: PlannerDatabase,
    private val preferences: PlannerPreferences,
) {
    private val dao = database.dao()
    private val idPattern = Regex("^[A-Za-z0-9_-]{1,100}$")
    private val vault = PortableVault(context)

    init {
        context.cacheDir.listFiles()?.filter {
            it.name.startsWith("wfp-import-") && System.currentTimeMillis() - it.lastModified() > 86_400_000
        }?.forEach(File::delete)
    }

    suspend fun export(uri: Uri, password: CharArray): BackupPreview = withContext(Dispatchers.IO) {
        val temporary = File.createTempFile("wfp-export-", ".zip", context.cacheDir)
        try {
            val preview = buildZip(temporary)
            context.contentResolver.openOutputStream(uri, "w")?.use { output ->
                temporary.inputStream().buffered().use { input -> PortableCrypto.encrypt(input, output, password) }
            } ?: error("Não foi possível criar o arquivo")
            val verified = inspect(uri, password)
            require(verified.records == preview.records && verified.files == preview.files) {
                "Backup gerado não corresponde aos dados exportados"
            }
            preferences.markBackup()
            preview
        } finally {
            temporary.delete()
        }
    }

    private suspend fun buildZip(temporary: File): BackupPreview {
            val locale = preferences.locale.first()
            val currency = preferences.currency.first()
            return database.withTransaction {
                val records = dao.allRecords()
                val files = dao.allFiles()
                val settings = dao.allSettings()
                val audits = dao.allAudit()
                val vaultName = dao.portableState("webVault")?.value
                val savedManifest = dao.portableState("webManifest")?.value?.let(::JSONObject)
                val baseline = dao.portableState("baseline")?.value ?: "[]"
                val hashes = JSONObject()
                val exportedAt = System.currentTimeMillis()
                ZipOutputStream(temporary.outputStream().buffered()).use { zip ->
                    writeJson(zip, "records.json", JSONArray().also { array -> records.forEach { array.put(it.asJson()) } })
                    writeRaw(zip, "baseline.json", baseline.toByteArray(Charsets.UTF_8))
                    writeJson(zip, "files.json", JSONArray().also { array -> files.forEach { array.put(it.asJson()) } })
                    writeJson(zip, "settings.json", JSONArray().also { array -> settings.forEach { array.put(it.asJson()) } })
                    writeJson(zip, "audit.json", JSONArray().also { array -> audits.forEach { array.put(it.asJson()) } })
                    files.forEach { file ->
                        require(idPattern.matches(file.id)) { "ID de anexo inválido" }
                        val bytes = dao.blob(file.id)?.bytes ?: error("Anexo ausente: ${file.fileName}")
                        require(bytes.size.toLong() == file.byteSize && sha256(bytes) == file.sha256) {
                            "Anexo alterado: ${file.fileName}"
                        }
                        hashes.put(file.id, file.sha256)
                        zip.putNextEntry(ZipEntry("blobs/${file.id}"))
                        zip.write(bytes)
                        zip.closeEntry()
                    }
                    if (vaultName != null) {
                        require(savedManifest != null) { "Metadados web ausentes" }
                        vault.withOpen(vaultName) { webZip ->
                            webZip.entries().asSequence().forEach { entry ->
                                require(entry.name == "web.sqlite" || entry.name.startsWith("uploads/"))
                                zip.putNextEntry(ZipEntry(entry.name))
                                webZip.getInputStream(entry).use { it.copyTo(zip) }
                                zip.closeEntry()
                            }
                        }
                    }
                    writeJson(zip, "manifest.json", JSONObject()
                        .put("format", "wfp-portable")
                        .put("version", 2)
                        .put("origin", "android")
                        .put("lineageId", savedManifest?.optString("lineageId")?.takeIf { it.isNotBlank() }
                            ?: java.util.UUID.randomUUID().toString())
                        .put("generation", (savedManifest?.optInt("generation") ?: 0) + 1)
                        .put("exportedAt", exportedAt)
                        .put("records", records.size)
                        .put("files", files.size)
                        .put("hashes", hashes)
                        .put("webTables", savedManifest?.optJSONObject("webTables") ?: JSONObject())
                        .put("schemas", savedManifest?.optJSONObject("schemas")
                            ?: JSONObject().put("web", JSONObject.NULL).put("android", 2))
                        .put("uploads", savedManifest?.optJSONObject("uploads") ?: JSONObject())
                        .put("webDatabase", savedManifest?.optJSONObject("webDatabase") ?: JSONObject.NULL)
                        .put("locale", locale)
                        .put("currency", currency))
                }
                BackupPreview(records.size, files.size, exportedAt, true,
                    savedManifest?.optJSONObject("webTables")?.length() ?: 0)
            }
    }

    suspend fun inspect(uri: Uri, password: CharArray): BackupPreview =
        withDecrypted(uri, password) { zip -> validate(zip).preview }

    suspend fun hasReversal(): Boolean = withContext(Dispatchers.IO) {
        dao.portableState("lastReversal")?.value?.isNotBlank() == true
    }

    suspend fun exportLastReversal(uri: Uri, password: CharArray): BackupPreview = withContext(Dispatchers.IO) {
        val name = dao.portableState("lastReversal")?.value ?: error("Não existe cópia de reversão")
        val plain = File.createTempFile("wfp-reversal-export-", ".zip", context.cacheDir)
        try {
            vault.copyReversalPlain(name, plain)
            val expected = ZipFile(plain).use { validate(it).preview }
            context.contentResolver.openOutputStream(uri, "w")?.use { output ->
                plain.inputStream().buffered().use { PortableCrypto.encrypt(it, output, password) }
            } ?: error("Não foi possível criar o arquivo")
            val verified = inspect(uri, password)
            require(expected.records == verified.records && expected.files == verified.files) { "Reversão alterada" }
            verified
        } finally { plain.delete() }
    }

    suspend fun restore(uri: Uri, password: CharArray): BackupPreview = withDecrypted(uri, password) { zip ->
        val backup = validate(zip)
        if (!backup.preview.complete) {
            require(dao.allRecords().isEmpty()) { "Backup antigo é parcial; restaure somente em instalação vazia" }
        }
        val existingBytes = context.getDatabasePath("wedding-planner.db").length()
        val incomingBytes = zip.entries().asSequence().sumOf { it.size }
        require(context.cacheDir.usableSpace > existingBytes * 2 + incomingBytes * 2 + 20_000_000) {
            "Espaço insuficiente para restaurar"
        }
        val reversalArchive = File.createTempFile("wfp-reversal-", ".zip", context.cacheDir)
        val reversalName = try {
            buildZip(reversalArchive)
            vault.sealReversal(reversalArchive)
        } finally { reversalArchive.delete() }
        val oldVault = dao.portableState("webVault")?.value
        val stagedVault = if (backup.webEntries.isNotEmpty()) vault.seal(zip, backup.webEntries) else null
        try {
            database.withTransaction {
                dao.clearBlobs()
                dao.clearFiles()
                dao.clearAudit()
                dao.clearSettings()
                dao.clearRecords()
                dao.clearPortableState()
                dao.saveRecords(backup.records)
                dao.saveFiles(backup.files)
                dao.saveSettings(backup.settings)
                dao.addAudit(backup.audits)
                backup.files.forEach { file -> dao.saveBlob(PlannerBlob(file.id, readBytes(zip, "blobs/${file.id}", Int.MAX_VALUE))) }
                dao.savePortableState(PortableState("lastReversal", reversalName))
                if (stagedVault != null) {
                    dao.savePortableState(PortableState("webVault", stagedVault))
                    dao.savePortableState(PortableState("webManifest", backup.manifest.toString()))
                    dao.savePortableState(PortableState("baseline", backup.baseline))
                }
            }
        } catch (error: Exception) {
            vault.delete(stagedVault)
            throw error
        }
        if (oldVault != stagedVault) vault.delete(oldVault)
        val locale = backup.manifest.optString("locale", "pt-BR")
        val currency = backup.manifest.optString("currency", "BRL")
        if (locale in setOf("pt-BR", "en", "es")) preferences.setLocale(locale)
        if (currency in setOf("BRL", "USD", "EUR")) preferences.setCurrency(currency)
        preferences.markBackup()
        backup.preview
    }

    private fun validate(zip: ZipFile): ValidatedBackup {
        val manifest = validatedManifest(zip)
        val complete = manifest.getInt("version") == 2
        val records = readArray(zip, "records.json").map(::recordFromJson)
        val files = readArray(zip, "files.json").map(::fileFromJson)
        val settings = readArray(zip, "settings.json").map(::settingFromJson)
        val audits = readArray(zip, "audit.json").map(::auditFromJson)
        val baseline = if (complete) String(readBytes(zip, "baseline.json", Int.MAX_VALUE), Charsets.UTF_8) else "[]"
        if (complete) JSONArray(baseline)
        require(records.size == manifest.getInt("records") && files.size == manifest.getInt("files")) { "Contagem do backup inválida" }
        require(records.map { it.id }.toSet().size == records.size) { "IDs de registro repetidos" }
        require(files.map { it.id }.toSet().size == files.size) { "IDs de arquivo repetidos" }
        require(settings.map { it.key }.toSet().size == settings.size) { "Ajustes repetidos" }
        require(audits.map { it.id }.toSet().size == audits.size) { "Histórico repetido" }
        val recordIds = records.map { it.id }.toSet()
        val byId = records.associateBy { it.id }
        require(manifest.getJSONObject("hashes").length() == files.size) { "Contagem de hashes inválida" }
        files.forEach { file ->
            require(file.recordId == null || file.recordId in recordIds) { "Anexo sem registro" }
            require(idPattern.matches(file.id)) { "ID de anexo inválido" }
            require(file.byteSize in 0..Int.MAX_VALUE.toLong()) { "Anexo não cabe no armazenamento Room" }
            require(file.sha256 == manifest.getJSONObject("hashes").getString(file.id)) { "Hash inconsistente" }
            val bytes = readBytes(zip, "blobs/${file.id}", Int.MAX_VALUE)
            require(bytes.size.toLong() == file.byteSize && sha256(bytes) == file.sha256) { "Anexo corrompido" }
        }
        records.forEach { record ->
            require(idPattern.matches(record.id) && record.title.isNotBlank()) { "Registro inválido" }
            require(record.date == null || runCatching { LocalDate.parse(record.date) }.isSuccess) { "Data inválida" }
            require(record.amountCents == null || record.amountCents >= 0) { "Valor inválido" }
            require(record.estimatedCents == null || record.estimatedCents >= 0) { "Estimativa inválida" }
            require(record.plusOnesAllowed in 0..10 && record.plusOnesConfirmed in 0..record.plusOnesAllowed) {
                "Acompanhantes inválidos"
            }
            require(record.parentId == null || record.parentId in recordIds) { "Relação de registro inválida" }
            require(record.guestGroupId == null || byId[record.guestGroupId]?.kind == "group") { "Grupo inválido" }
            require(record.seatingTableId == null || byId[record.seatingTableId]?.kind == "table") { "Mesa inválida" }
            val extra = JSONObject(record.extraJson)
            if (record.kind == "guest" && extra.has("tagIds")) {
                val tagIds = extra.getJSONArray("tagIds")
                require(tagIds.length() <= 100) { "Tags demais" }
                for (index in 0 until tagIds.length()) {
                    require(byId[tagIds.getString(index)]?.kind == "tag") { "Tag inválida" }
                }
            }
        }
        records.filter { it.kind == "table" && it.deletedAt == null }.forEach { table ->
            val occupied = records.filter { it.kind == "guest" && it.deletedAt == null && it.seatingTableId == table.id }
                .sumOf { 1 + it.plusOnesConfirmed }
            require(occupied <= (table.amountCents ?: 0)) { "Mesa acima da capacidade" }
        }
        val webEntries = mutableListOf<String>()
        if (complete) {
            val schemas = manifest.getJSONObject("schemas")
            require(schemas.getInt("android") == 2) { "Esquema Android incompatível" }
            val webDatabase = manifest.optJSONObject("webDatabase")
            require(if (webDatabase == null) schemas.isNull("web") else !schemas.isNull("web")) {
                "Esquema web incompatível"
            }
            if (webDatabase != null) {
                val result = hashEntry(zip, "web.sqlite")
                require(result.first == webDatabase.getString("sha256") && result.second == webDatabase.getLong("size")) {
                    "SQLite web alterado"
                }
                validateWebSqlite(zip, manifest)
                webEntries += "web.sqlite"
            }
            val uploads = manifest.getJSONObject("uploads")
            uploads.keys().forEach { relative ->
                require(relative.isNotBlank() && !relative.startsWith('/') && !relative.contains('\\') &&
                    relative.split('/').none { it.isBlank() || it == "." || it == ".." }) { "Caminho web inválido" }
                val entry = "uploads/$relative"
                val metadata = uploads.getJSONObject(relative)
                val result = hashEntry(zip, entry)
                require(result.first == metadata.getString("sha256") && result.second == metadata.getLong("size")) {
                    "Arquivo web alterado"
                }
                webEntries += entry
            }
            require(manifest.getJSONObject("webTables").length() == 0 || webDatabase != null) { "Banco web ausente" }
        }
        val expected = setOf("manifest.json", "records.json", "files.json", "settings.json", "audit.json") +
            (if (complete) setOf("baseline.json") else emptySet()) + files.map { "blobs/${it.id}" } + webEntries
        require(zip.size() == expected.size) { "Entradas repetidas no backup" }
        require(zip.entries().asSequence().map { it.name }.toSet() == expected) { "Entradas inesperadas no backup" }
        return ValidatedBackup(manifest, records, files, settings, audits, baseline, webEntries)
    }

    private suspend fun <T> withDecrypted(uri: Uri, password: CharArray, block: suspend (ZipFile) -> T): T = withContext(Dispatchers.IO) {
        val temporary = File.createTempFile("wfp-import-", ".zip", context.cacheDir)
        try {
            context.contentResolver.openInputStream(uri)?.use { source ->
            temporary.outputStream().buffered().use { output ->
                PortableCrypto.decrypt(source, output, password, context.cacheDir.usableSpace - 20_000_000)
            }
            } ?: error("Não foi possível abrir o arquivo")
            ZipFile(temporary).use { zip -> block(zip) }
        } finally {
            temporary.delete()
        }
    }

    private fun validatedManifest(zip: ZipFile): JSONObject {
        require(zip.size() >= 5) { "Número de entradas inválido" }
        zip.entries().asSequence().forEach { entry ->
            require(!entry.isDirectory && !entry.name.startsWith('/') && !entry.name.contains('\\') &&
                entry.name.split('/').none { it.isBlank() || it == "." || it == ".." }) { "Caminho inválido" }
            require(entry.size >= 0) { "Tamanho inválido" }
        }
        val manifest = JSONObject(String(readBytes(zip, "manifest.json", Int.MAX_VALUE), Charsets.UTF_8))
        val old = manifest.optString("format") == "wfp-android" && manifest.optInt("version") == 1
        val portable = manifest.optString("format") == "wfp-portable" && manifest.optInt("version") == 2
        require(old || portable) { "Versão de backup não suportada" }
        require(manifest.getInt("records") >= 0 && manifest.getInt("files") >= 0) { "Contagem inválida" }
        require(readArray(zip, "records.json").size == manifest.getInt("records")) { "Contagem de registros inválida" }
        require(readArray(zip, "files.json").size == manifest.getInt("files")) { "Contagem de anexos inválida" }
        return manifest
    }

    private fun readArray(zip: ZipFile, name: String): List<JSONObject> {
        val data = JSONArray(String(readBytes(zip, name, Int.MAX_VALUE), Charsets.UTF_8))
        return (0 until data.length()).map { data.getJSONObject(it) }
    }

    private fun readBytes(zip: ZipFile, name: String, limit: Int): ByteArray {
        val entry = zip.getEntry(name) ?: error("Arquivo ausente: $name")
        require(entry.size in 0..limit.toLong()) { "Arquivo grande demais: $name" }
        return zip.getInputStream(entry).use { input ->
            val bytes = ByteArrayOutputStream()
            val chunk = ByteArray(8192)
            while (true) {
                val count = input.read(chunk)
                if (count < 0) break
                require(bytes.size() + count <= limit) { "Arquivo grande demais: $name" }
                bytes.write(chunk, 0, count)
            }
            require(bytes.size().toLong() == entry.size) { "Arquivo truncado" }
            bytes.toByteArray()
        }
    }

    private fun writeJson(zip: ZipOutputStream, name: String, json: Any) {
        writeRaw(zip, name, json.toString().toByteArray(Charsets.UTF_8))
    }

    private fun writeRaw(zip: ZipOutputStream, name: String, bytes: ByteArray) {
        zip.putNextEntry(ZipEntry(name))
        zip.write(bytes)
        zip.closeEntry()
    }

    private fun hashEntry(zip: ZipFile, name: String): Pair<String, Long> {
        val entry = zip.getEntry(name) ?: error("Arquivo ausente: $name")
        val digest = MessageDigest.getInstance("SHA-256")
        var size = 0L
        zip.getInputStream(entry).use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
                size += count
            }
        }
        require(size == entry.size) { "Arquivo truncado: $name" }
        return digest.digest().joinToString("") { "%02x".format(it) } to size
    }

    private fun validateWebSqlite(zip: ZipFile, manifest: JSONObject) {
        val temporary = File.createTempFile("wfp-web-check-", ".sqlite", context.cacheDir)
        try {
            zip.getInputStream(zip.getEntry("web.sqlite")).use { input ->
                temporary.outputStream().buffered().use { input.copyTo(it) }
            }
            SQLiteDatabase.openDatabase(temporary.path, null, SQLiteDatabase.OPEN_READONLY).use { database ->
                database.rawQuery("PRAGMA quick_check", null).use { cursor ->
                    require(cursor.moveToFirst() && cursor.getString(0) == "ok") { "SQLite web inválido" }
                }
                database.rawQuery("PRAGMA foreign_key_check", null).use { cursor ->
                    require(!cursor.moveToFirst()) { "Relações web inválidas" }
                }
                val schemaLines = mutableListOf<String>()
                database.rawQuery("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name", null).use { cursor ->
                    while (cursor.moveToNext()) {
                        schemaLines += "${cursor.getString(0)}\t${cursor.getString(1)}\t${cursor.getString(2)}"
                    }
                }
                require(sha256(schemaLines.joinToString("\n").toByteArray(Charsets.UTF_8)) ==
                    manifest.getJSONObject("schemas").getString("web")) { "Esquema web alterado" }
                val tables = manifest.getJSONObject("webTables")
                tables.keys().forEach { table ->
                    require(Regex("^[A-Za-z_][A-Za-z0-9_]*$").matches(table)) { "Tabela inválida" }
                    database.rawQuery("SELECT count(*) FROM \"$table\"", null).use { cursor ->
                        require(cursor.moveToFirst() && cursor.getLong(0) == tables.getLong(table)) {
                            "Contagem divergente: $table"
                        }
                    }
                }
                val uploads = manifest.getJSONObject("uploads")
                database.rawQuery("SELECT storagePath FROM Attachment", null).use { cursor ->
                    while (cursor.moveToNext()) {
                        val relative = cursor.getString(0).removePrefix("uploads/")
                        require(uploads.has(relative)) { "Anexo web ausente: $relative" }
                    }
                }
                database.rawQuery("SELECT invitationFilePath, saveTheDateFilePath FROM EventSettings", null).use { cursor ->
                    while (cursor.moveToNext()) for (column in 0..1) {
                        if (!cursor.isNull(column)) {
                            val relative = cursor.getString(column).removePrefix("uploads/")
                            require(uploads.has(relative)) { "Arte web ausente: $relative" }
                        }
                    }
                }
            }
        } finally { temporary.delete() }
    }
}

private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
    .digest(bytes).joinToString("") { "%02x".format(it) }

private fun JSONObject.optNullableString(name: String): String? = if (isNull(name)) null else getString(name)
private fun JSONObject.optNullableLong(name: String): Long? = if (isNull(name)) null else getLong(name)
private fun JSONObject.putNullable(name: String, value: Any?): JSONObject = put(name, value ?: JSONObject.NULL)

private fun PlannerRecord.asJson(): JSONObject = JSONObject()
    .put("id", id).put("kind", kind).put("title", title).put("subtitle", subtitle)
    .putNullable("amountCents", amountCents).putNullable("estimatedCents", estimatedCents)
    .putNullable("date", date).put("status", status).putNullable("parentId", parentId)
    .putNullable("guestGroupId", guestGroupId).putNullable("seatingTableId", seatingTableId)
    .put("plusOnesAllowed", plusOnesAllowed).put("plusOnesConfirmed", plusOnesConfirmed)
    .put("phone", phone).put("email", email).put("notes", notes).put("extraJson", extraJson)
    .put("createdAt", createdAt).put("updatedAt", updatedAt).putNullable("deletedAt", deletedAt)

private fun PlannerFile.asJson(): JSONObject = JSONObject()
    .put("id", id).putNullable("recordId", recordId).put("kind", kind)
    .put("fileName", fileName).put("mimeType", mimeType).put("byteSize", byteSize)
    .put("sha256", sha256).put("createdAt", createdAt).putNullable("deletedAt", deletedAt)

private fun PlannerSetting.asJson(): JSONObject = JSONObject().put("key", key).put("value", value)
private fun PlannerAudit.asJson(): JSONObject = JSONObject().put("id", id).putNullable("recordId", recordId)
    .put("action", action).put("at", at).put("details", details)

private fun recordFromJson(json: JSONObject): PlannerRecord = PlannerRecord(
    id = json.getString("id"), kind = json.getString("kind"), title = json.getString("title"),
    subtitle = json.optString("subtitle"), amountCents = json.optNullableLong("amountCents"),
    estimatedCents = json.optNullableLong("estimatedCents"), date = json.optNullableString("date"),
    status = json.optString("status"), parentId = json.optNullableString("parentId"),
    guestGroupId = json.optNullableString("guestGroupId"), seatingTableId = json.optNullableString("seatingTableId"),
    plusOnesAllowed = json.optInt("plusOnesAllowed"), plusOnesConfirmed = json.optInt("plusOnesConfirmed"),
    phone = json.optString("phone"), email = json.optString("email"), notes = json.optString("notes"),
    extraJson = json.optString("extraJson", "{}"), createdAt = json.getLong("createdAt"),
    updatedAt = json.getLong("updatedAt"), deletedAt = json.optNullableLong("deletedAt"),
)

private fun fileFromJson(json: JSONObject): PlannerFile = PlannerFile(
    id = json.getString("id"), recordId = json.optNullableString("recordId"), kind = json.getString("kind"),
    fileName = json.getString("fileName"), mimeType = json.getString("mimeType"),
    byteSize = json.getLong("byteSize"), sha256 = json.getString("sha256"),
    createdAt = json.getLong("createdAt"), deletedAt = json.optNullableLong("deletedAt"),
)

private fun settingFromJson(json: JSONObject): PlannerSetting =
    PlannerSetting(json.getString("key"), json.getString("value"))

private fun auditFromJson(json: JSONObject): PlannerAudit =
    PlannerAudit(json.getString("id"), json.optNullableString("recordId"),
        json.getString("action"), json.getLong("at"), json.optString("details"))
