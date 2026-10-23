package br.com.paivalab.weddingmanagementsystem.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.core.content.FileProvider
import androidx.room.withTransaction
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.util.UUID
import java.security.MessageDigest
import java.io.File
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

const val PAYMENT_NEEDS_VENDOR = "PAYMENT_NEEDS_VENDOR"
const val VENDOR_NEEDS_CATEGORY = "VENDOR_NEEDS_CATEGORY"
const val HONEYMOON_NOT_DELETABLE = "HONEYMOON_NOT_DELETABLE"
const val GIFT_ALREADY_POSTED = "GIFT_ALREADY_POSTED"
const val GIFT_NOT_CASH = "GIFT_NOT_CASH"

private val VENDOR_OWNED = setOf(Kinds.BUDGET, Kinds.PAYMENT, Kinds.CONTACT, Kinds.VENDOR_NOTE, Kinds.CONTRACT)
private val UNLINK_ON_DELETE = setOf(Kinds.GOAL, Kinds.VENDOR, Kinds.GUEST)

const val PARENT_DELETED = "PARENT_DELETED"

/** Estado anterior de uma ação, para o botão "Desfazer". */
data class UndoSnapshot(val previous: List<PlannerRecord>, val created: List<String> = emptyList()) {
    val isEmpty: Boolean get() = previous.isEmpty() && created.isEmpty()

    companion object {
        val EMPTY = UndoSnapshot(emptyList())
    }
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

class PlannerRepository(private val database: PlannerDatabase, private val blobs: BlobStore) {
    private val dao = database.dao()
    val records: Flow<List<PlannerRecord>> = dao.observeRecords()
    val files: Flow<List<PlannerFile>> = dao.observeFiles()
    val allFiles: Flow<List<PlannerFile>> = dao.observeAllFiles()
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
        val existing = dao.allRecords().filter { it.kind == Kinds.VENUE_CHECK && it.parentId == venueId && it.deletedAt == null }
        val existingTitles = existing.map { it.title.lowercase() }.toSet()
        val first = VenueChecklist.nextSortOrder(existing)
        val additions = VenueChecklistTemplates.all.filterNot { it.lowercase() in existingTitles }.mapIndexed { idx, label ->
            PlannerRecord(
                id = UUID.randomUUID().toString(),
                kind = Kinds.VENUE_CHECK,
                title = label,
                status = "TODO",
                parentId = venueId,
                extraJson = JSONObject().put("sortOrder", first + idx).toString(),
            )
        }
        dao.saveRecords(additions)
        if (additions.isNotEmpty()) {
            dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), venueId, "SEED_VENUE_CHECKLIST", details = additions.size.toString()))
        }
        additions.size
    }

    /** Cria o local e, por padrão, o checklist de vistoria, como `createVenue` da web. */
    suspend fun createVenue(venue: PlannerRecord, seedChecklist: Boolean): Int = database.withTransaction {
        require(venue.kind == Kinds.VENUE && dao.findAny(venue.id) == null)
        save(venue)
        if (seedChecklist) seedVenueChecklist(venue.id) else 0
    }

    /** Viagem única, como `ensureHoneymoon` da web: devolve a existente ou cria a `singleton`. */
    suspend fun ensureHoneymoon(currency: String): String = database.withTransaction {
        dao.allRecords().filter { it.kind == Kinds.HONEYMOON && it.deletedAt == null }
            .minWithOrNull(compareBy({ it.createdAt }, { it.id }))?.id ?: run {
            val id = if (dao.findAny("singleton") == null) "singleton" else UUID.randomUUID().toString()
            val tripCurrency = currency.takeIf { it in HoneymoonRules.currencies } ?: "BRL"
            save(PlannerRecord(id, Kinds.HONEYMOON, HoneymoonRules.PLACEHOLDER, extraJson = JSONObject().put("currency", tripCurrency).toString()))
            id
        }
    }

    /** Marca o item e grava a resposta, como `toggleChecklistItem` da web. */
    suspend fun setChecklistItem(id: String, checked: Boolean, value: String): UndoSnapshot = database.withTransaction {
        val item = dao.find(id) ?: error("Item não encontrado")
        require(item.kind == Kinds.VENUE_CHECK)
        val extra = ExtraFields.parse(item.extraJson).apply {
            val trimmed = value.trim().take(VenueChecklist.VALUE_MAX)
            if (trimmed.isEmpty()) remove("value") else put("value", trimmed)
        }
        dao.save(item.copy(status = if (checked) "DONE" else "TODO", extraJson = extra.toString(), updatedAt = System.currentTimeMillis()))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "STATUS", details = if (checked) "DONE" else "TODO"))
        UndoSnapshot(listOf(item))
    }

    suspend fun moveChecklistItem(id: String, delta: Int) = database.withTransaction {
        val item = dao.find(id) ?: return@withTransaction
        val venueId = item.parentId ?: return@withTransaction
        val siblings = dao.allRecords().filter { it.kind == Kinds.VENUE_CHECK && it.parentId == venueId && it.deletedAt == null }
            .sortedWith(compareBy<PlannerRecord>(VenueChecklist::sortOrder).thenBy { it.createdAt })
        val now = System.currentTimeMillis()
        dao.saveRecords(VenueChecklist.moved(siblings, id, delta).map { it.copy(updatedAt = now) })
    }

    suspend fun createInstallments(plan: InstallmentPlan): Int = database.withTransaction {
        require(plan.title.isNotBlank() && plan.title.length <= 160)
        require(dao.find(plan.vendorId)?.kind == Kinds.VENDOR) { PAYMENT_NEEDS_VENDOR }
        val dates = InstallmentMath.dueDates(plan.firstDueDate, plan.count, plan.intervalDays)
        val payments = InstallmentMath.split(plan.totalCents, plan.count).mapIndexed { index, amount ->
            val extra = JSONObject().put("installmentNumber", index + 1).put("totalInstallments", plan.count)
                .put("method", plan.method)
            plan.lateFeePercent?.let { extra.put("lateFeePercent", it) }
            plan.interestPercentPerMonth?.let { extra.put("interestPercentPerMonth", it) }
            PlannerRecord(UUID.randomUUID().toString(), Kinds.PAYMENT, plan.title.trim(),
                amountCents = amount, date = dates[index].toString(),
                status = "PENDING", parentId = plan.vendorId, extraJson = extra.toString())
        }
        dao.saveRecords(payments)
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), null, "CREATE_INSTALLMENTS", details = "${plan.count}:${plan.totalCents}"))
        payments.size
    }

    /** Sinal pago hoje e saldo pendente, como `createSplitPayment` da web. */
    suspend fun createSplitPayment(
        vendorId: String, title: String, depositCents: Long, depositMethod: String,
        finalCents: Long, finalDueDate: LocalDate, finalMethod: String,
    ): UndoSnapshot = database.withTransaction {
        require(title.isNotBlank() && title.length <= 160)
        require(dao.find(vendorId)?.kind == Kinds.VENDOR) { PAYMENT_NEEDS_VENDOR }
        require(depositCents > 0 && finalCents > 0)
        require(depositMethod in WebValues.paymentMethods && finalMethod in WebValues.paymentMethods)
        val now = System.currentTimeMillis()
        fun extra(number: Int, method: String) =
            JSONObject().put("installmentNumber", number).put("totalInstallments", 2).put("method", method)
        val deposit = PlannerRecord(UUID.randomUUID().toString(), Kinds.PAYMENT, title.trim(), amountCents = depositCents,
            date = LocalDate.now().toString(), status = "PAID", parentId = vendorId,
            extraJson = extra(1, depositMethod).put("paidAt", now).toString())
        val balance = PlannerRecord(UUID.randomUUID().toString(), Kinds.PAYMENT, title.trim(), amountCents = finalCents,
            date = finalDueDate.toString(), status = "PENDING", parentId = vendorId,
            extraJson = extra(2, finalMethod).toString())
        dao.saveRecords(listOf(deposit, balance))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), deposit.id, "CREATE_SPLIT_PAYMENT", details = balance.id))
        UndoSnapshot(emptyList(), listOf(deposit.id, balance.id))
    }

    suspend fun addAttachment(context: Context, recordId: String, uri: Uri, kind: String = "OTHER") {
        val record = dao.find(recordId) ?: error("Registro ausente")
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
        val contractFile = record.kind == Kinds.CONTRACT
        if (contractFile) require(bytes.size >= 5 && bytes.copyOfRange(0, 5).contentEquals("%PDF-".toByteArray())) {
            context.getString(br.com.paivalab.weddingmanagementsystem.R.string.contract_pdf_required)
        }
        val file = PlannerFile(UUID.randomUUID().toString(), recordId,
            if (contractFile) AttachmentKinds.CONTRACT else AttachmentKinds.normalize(kind), name.take(160),
            if (contractFile) "application/pdf" else resolver.getType(uri) ?: "application/octet-stream",
            bytes.size.toLong(), hash)
        blobs.write(file.id, bytes)
        try {
            database.withTransaction {
                if (contractFile) replaceContractFile(record, file) else dao.saveFile(file)
                dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), recordId, "ADD_FILE", details = file.id))
            }
        } catch (error: Exception) {
            blobs.delete(file.id)
            throw error
        }
    }

    /**
     * Como `replaceContractFile` da web: o primeiro PDF fica com a versão do
     * contrato; os seguintes arquivam o atual e incrementam a versão.
     */
    private suspend fun replaceContractFile(contract: PlannerRecord, file: PlannerFile) {
        val now = System.currentTimeMillis()
        val extra = ExtraFields.parse(contract.extraJson)
        val current = (ExtraFields.int(extra, "version") ?: 1).coerceAtLeast(1)
        val active = dao.allFiles().filter { it.recordId == contract.id && it.kind == AttachmentKinds.CONTRACT && it.deletedAt == null }
        val version = if (active.isEmpty()) current else current + 1
        active.forEach { dao.saveFile(it.copy(deletedAt = now)) }
        dao.saveFile(file.copy(version = version))
        if (version != current) dao.save(contract.copy(extraJson = extra.put("version", version).toString(), updatedAt = now))
    }

    suspend fun exportAttachment(context: Context, file: PlannerFile, destination: Uri) {
        val bytes = blobs.read(file.id, dao) ?: error("Arquivo ausente")
        require(bytes.size.toLong() == file.byteSize)
        context.contentResolver.openOutputStream(destination, "w")?.use { it.write(bytes) }
            ?: error("Não foi possível salvar o arquivo")
    }

    suspend fun prepareSharedFile(context: Context, file: PlannerFile): Uri = withContext(Dispatchers.IO) {
        val bytes = blobs.read(file.id, dao) ?: error("Arquivo ausente")
        require(bytes.size.toLong() == file.byteSize) { "Tamanho do arquivo divergente" }
        val actualHash = MessageDigest.getInstance("SHA-256").digest(bytes)
            .joinToString("") { "%02x".format(it) }
        require(actualHash.equals(file.sha256, ignoreCase = true)) { "Hash do arquivo divergente" }
        val sharedRoot = File(context.cacheDir, "shared")
        sharedRoot.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 86_400_000L }
            ?.forEach { it.deleteRecursively() }
        val directory = File(sharedRoot, file.id.filter { it.isLetterOrDigit() }.ifBlank { "file" })
        require(directory.mkdirs() || directory.isDirectory)
        val safeName = file.fileName.substringAfterLast('/').substringAfterLast('\\')
            .replace(Regex("[^\\p{L}\\p{N}._ -]"), "_").take(160).trim('.', ' ').ifBlank { "anexo" }
        val output = File(directory, safeName)
        output.writeBytes(bytes)
        FileProvider.getUriForFile(context, "${context.packageName}.sharedfiles", output)
    }

    suspend fun setting(key: String): String? = dao.setting(key)?.value

    suspend fun hasRecords(): Boolean = dao.activeRecordCount() > 0

    suspend fun setSetting(key: String, value: String) = database.withTransaction {
        dao.saveSetting(PlannerSetting(key, value))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), null, "SETTING", details = key))
    }

    suspend fun save(input: PlannerRecord) = database.withTransaction {
        val record = WebValues.normalize(input)
        require(record.title.isNotBlank() && record.title.length <= 160)
        require(record.date == null || runCatching { LocalDate.parse(record.date) }.isSuccess)
        require(record.amountCents == null || record.amountCents >= 0)
        require(record.parentId == null || (record.parentId != record.id && dao.findAny(record.parentId) != null))
        if (record.deletedAt == null) when (record.kind) {
            Kinds.PAYMENT -> require(record.date != null && record.parentId != null &&
                dao.find(record.parentId)?.kind == Kinds.VENDOR) { PAYMENT_NEEDS_VENDOR }
            Kinds.VENDOR -> require(record.subtitle.isNotBlank()) { VENDOR_NEEDS_CATEGORY }
        }
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
        val now = System.currentTimeMillis()
        val previous = dao.findAny(record.id)
        dao.save(stamped(previous, record, now))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), record.id, "SAVE"))
    }

    /** Instantes que a web grava ao mudar a situação: conclusão, recebimento e agradecimento. */
    private fun stamped(previous: PlannerRecord?, next: PlannerRecord, now: Long): PlannerRecord =
        GiftRules.normalize(previous, IncomeRules.withReceipt(previous, TaskRules.withCompletion(previous, next, now), now), now)
            .copy(updatedAt = now)

    suspend fun create(kind: String, title: String, subtitle: String = "", amountCents: Long? = null,
                       date: String? = null, status: String = "", phone: String = "", email: String = "",
                       notes: String = "", parentId: String? = null): PlannerRecord {
        val record = PlannerRecord(UUID.randomUUID().toString(), kind, title.trim(), subtitle.trim(),
            amountCents = amountCents, date = date, status = status, phone = phone.trim(),
            email = email.trim(), notes = notes.trim(), parentId = parentId)
        save(record)
        return record
    }

    /** Exclusão lógica com os mesmos efeitos colaterais das Server Actions web. */
    suspend fun delete(id: String): UndoSnapshot = database.withTransaction {
        val current = dao.find(id) ?: return@withTransaction UndoSnapshot.EMPTY
        require(current.kind != Kinds.HONEYMOON) { HONEYMOON_NOT_DELETABLE }
        val now = System.currentTimeMillis()
        val previous = mutableListOf(current)
        val children = dao.allRecords().filter { it.deletedAt == null && it.id != id }
        children.forEach { child ->
            val updated = when {
                child.parentId == id && current.kind == Kinds.VENDOR && child.kind in VENDOR_OWNED ->
                    child.copy(deletedAt = now, updatedAt = now)
                child.parentId == id && current.kind in UNLINK_ON_DELETE -> child.copy(parentId = null, updatedAt = now)
                child.guestGroupId == id -> child.copy(guestGroupId = null, updatedAt = now)
                child.seatingTableId == id -> child.copy(seatingTableId = null, updatedAt = now)
                else -> null
            }
            if (updated != null) {
                previous.add(child)
                dao.save(updated)
            }
        }
        dao.save(current.copy(deletedAt = now, updatedAt = now))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "DELETE"))
        UndoSnapshot(previous)
    }

    /** Volta os registros ao estado anterior e exclui o que a ação tinha criado. */
    suspend fun undo(snapshot: UndoSnapshot) = database.withTransaction {
        if (snapshot.previous.isEmpty() && snapshot.created.isEmpty()) return@withTransaction
        val now = System.currentTimeMillis()
        dao.saveRecords(snapshot.previous.map { it.copy(updatedAt = now) })
        snapshot.created.forEach { id -> dao.findAny(id)?.let { dao.save(it.copy(deletedAt = now, updatedAt = now)) } }
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), snapshot.previous.firstOrNull()?.id, "UNDO"))
    }

    val deleted: Flow<List<PlannerRecord>> = dao.observeDeleted()

    /** Restaura da lixeira junto com os filhos excluídos em cascata no mesmo instante. */
    suspend fun restore(id: String) = database.withTransaction {
        val record = dao.findAny(id) ?: return@withTransaction
        val deletedAt = record.deletedAt ?: return@withTransaction
        record.parentId?.let { parent -> require(dao.find(parent) != null) { PARENT_DELETED } }
        val now = System.currentTimeMillis()
        val cascade = dao.allRecords().filter { it.parentId == id && it.deletedAt == deletedAt }
        dao.saveRecords((cascade + record).map { it.copy(deletedAt = null, updatedAt = now) })
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "RESTORE"))
    }

    suspend fun setStatus(id: String, status: String): UndoSnapshot = database.withTransaction {
        val current = dao.find(id) ?: error("Registro não encontrado")
        val now = System.currentTimeMillis()
        val next = current.copy(status = status)
        dao.save(stamped(current, next, now))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "STATUS", details = status))
        UndoSnapshot(listOf(current))
    }

    suspend fun setGroupRsvp(groupId: String, status: String): UndoSnapshot = database.withTransaction {
        require(status in setOf("CONFIRMED", "DECLINED", "MAYBE"))
        val group = dao.find(groupId) ?: error("Grupo não encontrado")
        require(group.kind == Kinds.GROUP)
        val now = System.currentTimeMillis()
        val members = dao.allRecords().filter { it.kind == Kinds.GUEST && it.guestGroupId == groupId && it.deletedAt == null }
        dao.save(group.copy(status = status, updatedAt = now))
        members.forEach { guest -> dao.save(guest.copy(status = status, updatedAt = now)) }
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), groupId, "GROUP_RSVP", details = status))
        UndoSnapshot(listOf(group) + members)
    }

    suspend fun markPaid(id: String): UndoSnapshot = database.withTransaction {
        val payment = dao.find(id) ?: error("Pagamento não encontrado")
        require(payment.kind == Kinds.PAYMENT)
        if (payment.status == "PAID") return@withTransaction UndoSnapshot.EMPTY
        val now = System.currentTimeMillis()
        val extra = ExtraFields.parse(payment.extraJson).put("paidAt", now)
        dao.save(payment.copy(status = "PAID", extraJson = extra.toString(), updatedAt = now))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "MARK_PAID"))
        UndoSnapshot(listOf(payment))
    }

    /** Cria o fornecedor com o item de orçamento inicial, como `createVendor` da web. */
    suspend fun createVendor(vendor: PlannerRecord, estimatedCents: Long?, budgetTitle: String) = database.withTransaction {
        require(dao.findAny(vendor.id) == null)
        save(vendor)
        if (estimatedCents != null) {
            dao.save(PlannerRecord(UUID.randomUUID().toString(), Kinds.BUDGET, budgetTitle.take(160), estimatedCents = estimatedCents,
                parentId = vendor.id))
        }
    }

    /**
     * Muda a situação do fornecedor; ao contratar com valor informado, grava o
     * valor real nos itens de orçamento, como `updateVendorStatus` da web.
     */
    suspend fun setVendorStatus(id: String, status: String, actualCents: Long?): UndoSnapshot = database.withTransaction {
        require(status in setOf("NEGOTIATION", "CONTRACTED", "FINALIZED"))
        val vendor = dao.find(id) ?: error("Fornecedor não encontrado")
        require(vendor.kind == Kinds.VENDOR)
        val now = System.currentTimeMillis()
        val budgets = if (status == "CONTRACTED" && actualCents != null && actualCents >= 0) {
            dao.allRecords().filter { it.kind == Kinds.BUDGET && it.parentId == id && it.deletedAt == null }
        } else emptyList()
        dao.save(vendor.copy(status = status, updatedAt = now))
        dao.saveRecords(budgets.map { it.copy(amountCents = actualCents, updatedAt = now) })
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "STATUS", details = status))
        UndoSnapshot(listOf(vendor) + budgets)
    }

    /** "Marcar assinado", como `signContract` da web. */
    suspend fun signContract(id: String, method: String, signedAt: LocalDate): UndoSnapshot = database.withTransaction {
        val contract = dao.find(id) ?: error("Contrato não encontrado")
        require(contract.kind == Kinds.CONTRACT)
        dao.save(contract.copy(status = ContractRules.signedStatus(method), date = signedAt.toString(), updatedAt = System.currentTimeMillis()))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "SIGN_CONTRACT", details = method))
        UndoSnapshot(listOf(contract))
    }

    /** Volta um pagamento para pendente, como `undoPaymentPaid` da web. */
    suspend fun undoPaid(id: String): UndoSnapshot = database.withTransaction {
        val payment = dao.find(id) ?: error("Pagamento não encontrado")
        require(payment.kind == Kinds.PAYMENT)
        if (payment.status != "PAID") return@withTransaction UndoSnapshot.EMPTY
        val extra = ExtraFields.parse(payment.extraJson).apply { remove("paidAt") }
        dao.save(payment.copy(status = "PENDING", extraJson = extra.toString(), updatedAt = System.currentTimeMillis()))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "UNDO_PAID"))
        UndoSnapshot(listOf(payment))
    }

    /**
     * Lança um presente em dinheiro como receita (fonte GIFT) ou ativo, uma
     * única vez, como `convertGiftCashToIncomeOrAsset` da web.
     */
    suspend fun convertGift(
        id: String, targetKind: String, title: String, date: LocalDate = LocalDate.now(), notes: String = "",
    ): UndoSnapshot = database.withTransaction {
        require(targetKind == Kinds.INCOME || targetKind == Kinds.ASSET)
        require(title.isNotBlank() && title.length <= 120)
        val gift = dao.find(id) ?: error("Presente não encontrado")
        require(gift.kind == Kinds.GIFT)
        val giftExtra = ExtraFields.parse(gift.extraJson)
        require(!GiftRules.processed(gift, giftExtra)) { GIFT_ALREADY_POSTED }
        require(GiftRules.type(giftExtra) == "CASH" && (gift.amountCents ?: 0L) > 0L) { GIFT_NOT_CASH }
        val now = System.currentTimeMillis()
        val incomeExtra = JSONObject().put("frequency", "ONE_TIME")
            .put("receivedAt", date.atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli())
        ExtraFields.text(giftExtra, "giverName").takeIf { it.isNotBlank() }?.let { incomeExtra.put("givenByName", it) }
        val target = PlannerRecord(UUID.randomUUID().toString(), targetKind, title.trim(),
            amountCents = gift.amountCents, date = date.toString(), notes = notes.take(8000),
            status = if (targetKind == Kinds.INCOME) "RECEIVED" else "",
            subtitle = if (targetKind == Kinds.INCOME) "GIFT" else "",
            extraJson = if (targetKind == Kinds.INCOME) incomeExtra.toString() else "{}")
        dao.save(target)
        dao.save(gift.copy(extraJson = giftExtra.put("processedAt", now).toString(), updatedAt = now))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, "CONVERT_TO_FINANCE", details = target.id))
        UndoSnapshot(listOf(gift), listOf(target.id))
    }

    /** Marca ou desmarca o agradecimento, como `markGiftThanked` da web. */
    suspend fun setGiftThanked(id: String, thanked: Boolean): UndoSnapshot = database.withTransaction {
        val gift = dao.find(id) ?: error("Presente não encontrado")
        require(gift.kind == Kinds.GIFT)
        val now = System.currentTimeMillis()
        val extra = ExtraFields.parse(gift.extraJson)
        if (thanked) extra.put("thankedAt", now) else extra.remove("thankedAt")
        dao.save(gift.copy(status = if (thanked) "THANKED" else "RECEIVED", extraJson = extra.toString(), updatedAt = now))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), id, if (thanked) "GIFT_THANKED" else "GIFT_UNTHANKED"))
        UndoSnapshot(listOf(gift))
    }

    /** Define exatamente quem pertence ao grupo, como `setGroupMembers` da web. */
    suspend fun setGroupMembers(groupId: String, guestIds: Set<String>): UndoSnapshot = database.withTransaction {
        val group = dao.find(groupId) ?: error("Grupo não encontrado")
        require(group.kind == Kinds.GROUP && guestIds.size <= 500)
        val now = System.currentTimeMillis()
        val changed = dao.allRecords().filter { it.kind == Kinds.GUEST && it.deletedAt == null }
            .filter { (it.guestGroupId == groupId) != (it.id in guestIds) }
        dao.saveRecords(changed.map { guest ->
            guest.copy(guestGroupId = if (guest.id in guestIds) groupId else null, updatedAt = now)
        })
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), groupId, "GROUP_MEMBERS", details = guestIds.size.toString()))
        UndoSnapshot(changed)
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

    /** Marca ou desfaz a chegada do convidado, como `toggleCheckin` da web. */
    suspend fun setCheckedIn(guestId: String, present: Boolean): UndoSnapshot = database.withTransaction {
        val guest = dao.find(guestId) ?: error("Convidado não encontrado")
        require(guest.kind == Kinds.GUEST)
        val extra = ExtraFields.parse(guest.extraJson)
        if (ExtraFields.has(extra, "checkedInAt") == present) return@withTransaction UndoSnapshot.EMPTY
        if (present) extra.put("checkedInAt", System.currentTimeMillis()) else extra.remove("checkedInAt")
        dao.save(guest.copy(extraJson = extra.toString(), updatedAt = System.currentTimeMillis()))
        dao.addAudit(PlannerAudit(UUID.randomUUID().toString(), guestId, if (present) "CHECK_IN" else "CHECK_IN_UNDONE"))
        UndoSnapshot(listOf(guest))
    }
}
