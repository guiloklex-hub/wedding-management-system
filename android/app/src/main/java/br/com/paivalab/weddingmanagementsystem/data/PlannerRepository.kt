package br.com.paivalab.weddingmanagementsystem.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.room.withTransaction
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.util.UUID
import java.security.MessageDigest
import org.json.JSONObject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object Kinds {
    const val VENDOR = "vendor"
    const val VENUE = "venue"
    const val BUDGET = "budget"
    const val PAYMENT = "payment"
    const val INCOME = "income"
    const val ASSET = "asset"
    const val GOAL = "goal"
    const val TASK = "task"
    const val GUEST = "guest"
    const val GROUP = "group"
    const val TAG = "tag"
    const val GIFT = "gift"
    const val HONEYMOON = "honeymoon"
    const val HONEYMOON_ITEM = "honeymoon_item"
    const val TROUSSEAU = "trousseau"
    const val TABLE = "table"
    const val CONTRACT = "contract"
    const val CONTACT = "contact"
    const val VENUE_CHECK = "venue_check"
    const val VENDOR_NOTE = "vendor_note"
    const val INVITATION = "invitation"
    const val SAVE_THE_DATE = "save_the_date"
}

object Money {
    fun parseToCents(input: String): Long {
        val normalized = input.trim().replace(',', '.')
        val value = BigDecimal(normalized)
        require(value >= BigDecimal.ZERO && value <= BigDecimal("1000000"))
        return value.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact()
    }

    fun fromWebNumber(number: Double): Long =
        BigDecimal.valueOf(number).movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact()
}

class PlannerRepository(private val database: PlannerDatabase) {
    private val dao = database.dao()
    val records: Flow<List<PlannerRecord>> = dao.observeRecords()
    val files: Flow<List<PlannerFile>> = dao.observeFiles()
    val audits: Flow<List<PlannerAudit>> = dao.observeAudit()

    suspend fun previewGuestImport(context: Context, uri: Uri): GuestImportPreview = withContext(Dispatchers.IO) {
        GuestImport.read(context, uri)
    }

    suspend fun importGuests(preview: GuestImportPreview): Pair<Int, Int> = database.withTransaction {
        require(preview.guests.size in 1..2000)
        val existing = dao.allRecords().filter { it.deletedAt == null }
        val groups = existing.filter { it.kind == Kinds.GROUP }.associateBy { it.title.lowercase() }.toMutableMap()
        val tags = existing.filter { it.kind == Kinds.TAG }.associateBy { it.title.lowercase() }.toMutableMap()
        val guestKeys = existing.filter { it.kind == Kinds.GUEST }
            .map { it.title.lowercase() to it.guestGroupId }.toMutableSet()
        val additions = mutableListOf<PlannerRecord>()
        var added = 0
        var skipped = 0
        preview.guests.forEach { guest ->
            val group = guest.groupName?.let { name ->
                groups.getOrPut(name.lowercase()) {
                    PlannerRecord(UUID.randomUUID().toString(), Kinds.GROUP, name,
                        phone = if (preview.source == "wedy") guest.phone else "",
                        email = if (preview.source == "wedy") guest.email else "").also(additions::add)
                }
            }
            val key = guest.name.lowercase() to group?.id
            if (!guestKeys.add(key)) { skipped++; return@forEach }
            val tagIds = guest.tags.map { name ->
                tags.getOrPut(name.lowercase()) {
                    PlannerRecord(UUID.randomUUID().toString(), Kinds.TAG, name).also(additions::add)
                }.id
            }
            val extra = JSONObject(guest.extra).put("tagIds", org.json.JSONArray(tagIds))
            additions.add(PlannerRecord(UUID.randomUUID().toString(), Kinds.GUEST, guest.name,
                status = guest.status, guestGroupId = group?.id,
                phone = if (preview.source == "wedy" && group != null) "" else guest.phone,
                email = if (preview.source == "wedy" && group != null) "" else guest.email,
                plusOnesAllowed = guest.plusOnes, plusOnesConfirmed = guest.plusOnes,
                extraJson = extra.toString()))
            added++
        }
        dao.saveRecords(additions)
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), null, "IMPORT_GUESTS", details = "$added/$skipped"))
        added to skipped
    }

    suspend fun seedTaskTemplates(eventDate: LocalDate): Int = database.withTransaction {
        val existingKeys = dao.allRecords().filter { it.kind == Kinds.TASK && it.deletedAt == null }
            .map { JSONObject(it.extraJson).optString("templateKey") }.toSet()
        val tasks = TaskTemplates.all.filterNot { it.key in existingKeys }.map { template ->
            PlannerRecord(UUID.randomUUID().toString(), Kinds.TASK, template.title,
                date = TaskTemplates.deadline(eventDate, template).toString(), status = "TODO",
                extraJson = JSONObject().put("templateKey", template.key).put("priority", template.priority).toString())
        }
        dao.saveRecords(tasks)
        if (tasks.isNotEmpty()) dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), null, "SEED_TASK_TEMPLATES", details = tasks.size.toString()))
        tasks.size
    }

    suspend fun seedVenueChecklist(venueId: String): Int = database.withTransaction {
        require(dao.find(venueId)?.kind == Kinds.VENUE) { "Local inválido" }
        val existingTitles = dao.allRecords().filter {
            it.kind == Kinds.VENUE_CHECK && it.parentId == venueId && it.deletedAt == null
        }.map { it.title.lowercase() }.toSet()
        val additions = VenueChecklistTemplates.all.filterNot { it.lowercase() in existingTitles }.mapIndexed { idx, label ->
            PlannerRecord(
                id = UUID.randomUUID().toString(),
                kind = Kinds.VENUE_CHECK,
                title = label,
                subtitle = "Vistoria técnica #${idx + 1}",
                status = "TODO",
                parentId = venueId,
            )
        }
        dao.saveRecords(additions)
        if (additions.isNotEmpty()) {
            dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), venueId, "SEED_VENUE_CHECKLIST", details = additions.size.toString()))
        }
        additions.size
    }

    suspend fun createInstallments(vendorId: String?, title: String, totalCents: Long,
                                   count: Int, firstDueDate: LocalDate) = database.withTransaction {
        require(title.isNotBlank() && title.length <= 160)
        require(vendorId == null || dao.find(vendorId)?.kind == Kinds.VENDOR)
        val payments = InstallmentMath.split(totalCents, count).mapIndexed { index, amount ->
            PlannerRecord(UUID.randomUUID().toString(), Kinds.PAYMENT, title,
                amountCents = amount, date = firstDueDate.plusMonths(index.toLong()).toString(),
                status = "PENDING", parentId = vendorId,
                extraJson = JSONObject().put("installmentNumber", index + 1).put("totalInstallments", count).toString())
        }
        dao.saveRecords(payments)
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), null, "CREATE_INSTALLMENTS", details = "$count:$totalCents"))
    }

    suspend fun addAttachment(context: Context, recordId: String, uri: Uri) {
        require(dao.find(recordId) != null)
        val resolver = context.contentResolver
        val bytes = resolver.openInputStream(uri)?.use { input ->
            val output = java.io.ByteArrayOutputStream()
            val chunk = ByteArray(8192)
            while (true) {
                val count = input.read(chunk)
                if (count < 0) break
                require(output.size() + count <= 20_000_000) { "Arquivo maior que 20 MB" }
                output.write(chunk, 0, count)
            }
            output.toByteArray()
        } ?: error("Não foi possível abrir o arquivo")
        val name = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        } ?: "anexo"
        val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        val file = PlannerFile(UUID.randomUUID().toString(), recordId, "ATTACHMENT", name.take(160),
            resolver.getType(uri) ?: "application/octet-stream", bytes.size.toLong(), hash)
        database.withTransaction {
            dao.saveFile(file)
            dao.saveBlob(PlannerBlob(file.id, bytes))
            dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), recordId, "ADD_FILE", details = file.id))
        }
    }

    suspend fun exportAttachment(context: Context, file: PlannerFile, destination: Uri) {
        val bytes = dao.blob(file.id)?.bytes ?: error("Arquivo ausente")
        require(bytes.size.toLong() == file.byteSize)
        context.contentResolver.openOutputStream(destination, "w")?.use { it.write(bytes) }
            ?: error("Não foi possível salvar o arquivo")
    }

    suspend fun setting(key: String): String? = dao.setting(key)?.value

    suspend fun setSetting(key: String, value: String) = database.withTransaction {
        dao.saveSetting(PlannerSetting(key, value))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), null, "SETTING", details = key))
    }

    suspend fun save(record: PlannerRecord) = database.withTransaction {
        require(record.title.isNotBlank() && record.title.length <= 160)
        require(record.date == null || runCatching { LocalDate.parse(record.date) }.isSuccess)
        require(record.amountCents == null || record.amountCents >= 0)
        require(record.parentId == null || (record.parentId != record.id && dao.find(record.parentId) != null))
        require(record.guestGroupId == null || dao.find(record.guestGroupId)?.kind == Kinds.GROUP)
        require(record.seatingTableId == null || dao.find(record.seatingTableId)?.kind == Kinds.TABLE)
        require(record.plusOnesAllowed in 0..10 && record.plusOnesConfirmed in 0..record.plusOnesAllowed)
        if (record.kind == Kinds.GUEST && record.seatingTableId != null && record.deletedAt == null) {
            val capacity = dao.find(record.seatingTableId)?.amountCents?.toInt() ?: 0
            val occupied = dao.allRecords().filter {
                it.kind == Kinds.GUEST && it.seatingTableId == record.seatingTableId && it.deletedAt == null && it.id != record.id
            }.sumOf { 1 + it.plusOnesConfirmed }
            require(occupied + 1 + record.plusOnesConfirmed <= capacity) { "Mesa sem lugares" }
        }
        dao.save(record.copy(updatedAt = System.currentTimeMillis()))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), record.id, "SAVE"))
    }

    suspend fun create(kind: String, title: String, subtitle: String = "", amountCents: Long? = null,
                       date: String? = null, status: String = "", phone: String = "", email: String = "",
                       notes: String = "", parentId: String? = null): PlannerRecord {
        val record = PlannerRecord(UUID.randomUUID().toString(), kind, title.trim(), subtitle.trim(),
            amountCents = amountCents, date = date, status = status, phone = phone.trim(),
            email = email.trim(), notes = notes.trim(), parentId = parentId)
        save(record)
        return record
    }

    suspend fun delete(id: String) = database.withTransaction {
        val current = dao.find(id) ?: return@withTransaction
        dao.save(current.copy(deletedAt = System.currentTimeMillis()))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "DELETE"))
    }

    suspend fun setStatus(id: String, status: String) = database.withTransaction {
        val current = dao.find(id) ?: error("Registro não encontrado")
        dao.save(current.copy(status = status, updatedAt = System.currentTimeMillis()))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "STATUS", details = status))
    }

    suspend fun setGroupRsvp(groupId: String, status: String) = database.withTransaction {
        require(status in setOf("CONFIRMED", "DECLINED", "MAYBE"))
        val group = dao.find(groupId) ?: error("Grupo não encontrado")
        require(group.kind == Kinds.GROUP)
        val now = System.currentTimeMillis()
        dao.save(group.copy(status = status, updatedAt = now))
        dao.allRecords().filter { it.kind == Kinds.GUEST && it.guestGroupId == groupId && it.deletedAt == null }
            .forEach { guest -> dao.save(guest.copy(status = status, updatedAt = now)) }
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), groupId, "GROUP_RSVP", details = status))
    }

    suspend fun markPaid(id: String) = database.withTransaction {
        val payment = dao.find(id) ?: error("Pagamento não encontrado")
        require(payment.kind == Kinds.PAYMENT)
        if (payment.status != "PAID") {
            dao.save(payment.copy(status = "PAID", updatedAt = System.currentTimeMillis()))
            dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "MARK_PAID"))
        }
    }

    suspend fun convertGift(id: String, targetKind: String) = database.withTransaction {
        require(targetKind == Kinds.INCOME || targetKind == Kinds.ASSET)
        val gift = dao.find(id) ?: error("Presente não encontrado")
        require(gift.kind == Kinds.GIFT && gift.amountCents != null)
        require(gift.status != "PROCESSED") { "Presente já lançado" }
        val target = PlannerRecord(UUID.randomUUID().toString(), targetKind, gift.title,
            amountCents = gift.amountCents, date = LocalDate.now().toString(), parentId = gift.id,
            status = if (targetKind == Kinds.INCOME) "RECEIVED" else "SAVED")
        dao.save(target)
        dao.save(gift.copy(status = "PROCESSED", updatedAt = System.currentTimeMillis()))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "CONVERT_TO_FINANCE", details = target.id))
    }

    suspend fun assignGuestToTable(guestId: String, tableId: String?) = database.withTransaction {
        val guest = dao.find(guestId) ?: error("Convidado não encontrado")
        require(guest.kind == Kinds.GUEST)
        if (tableId != null) {
            val table = dao.find(tableId) ?: error("Mesa não encontrada")
            require(table.kind == Kinds.TABLE)
            val capacity = table.amountCents?.toInt() ?: 0
            val occupied = dao.allRecords().filter { it.kind == Kinds.GUEST && it.seatingTableId == tableId && it.deletedAt == null && it.id != guestId }
                .sumOf { 1 + it.plusOnesConfirmed }
            val seats = 1 + guest.plusOnesConfirmed
            require(occupied + seats <= capacity) { "Mesa sem lugares" }
        }
        dao.save(guest.copy(seatingTableId = tableId, updatedAt = System.currentTimeMillis()))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), guestId, "ASSIGN_TABLE", details = tableId.orEmpty()))
    }

    suspend fun confirmInvitationSent(templateId: String, guestId: String, channel: String) = database.withTransaction {
        val template = dao.find(templateId) ?: error("Convite não encontrado")
        require(template.kind in setOf(Kinds.INVITATION, Kinds.SAVE_THE_DATE))
        val guest = dao.find(guestId) ?: error("Convidado não encontrado")
        require(guest.kind == Kinds.GUEST)
        val kind = if (template.kind == Kinds.INVITATION) "invitation_log" else "save_the_date_log"
        val log = PlannerRecord(UUID.randomUUID().toString(), kind, guest.title,
            parentId = templateId, status = "SENT", phone = guest.phone,
            extraJson = JSONObject().put("guestId", guestId).put("channel", channel).toString())
        dao.save(log)
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), log.id, "CONFIRM_SENT", details = channel))
    }

    suspend fun checkInGuest(guestId: String) = database.withTransaction {
        val guest = dao.find(guestId) ?: error("Convidado não encontrado")
        require(guest.kind == Kinds.GUEST && guest.status == "CONFIRMED")
        val extra = JSONObject(guest.extraJson)
        if (!extra.has("checkedInAt")) {
            extra.put("checkedInAt", System.currentTimeMillis())
            dao.save(guest.copy(extraJson = extra.toString(), updatedAt = System.currentTimeMillis()))
            dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), guestId, "CHECK_IN"))
        }
    }
}
