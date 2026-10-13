package br.com.paivalab.weddingmanagementsystem.ui

import androidx.annotation.StringRes
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.ExtraFields
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.Money
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import br.com.paivalab.weddingmanagementsystem.data.WebValues
import java.math.BigDecimal
import java.time.LocalDate
import java.util.UUID
import kotlinx.serialization.Serializable
import org.json.JSONArray

@Serializable
data class EditorFormState(
    val title: String = "",
    val subtitle: String = "",
    val amount: String = "",
    val estimated: String = "",
    val date: String = "",
    val status: String = "",
    val phone: String = "",
    val email: String = "",
    val notes: String = "",
    val venueAddress: String = "",
    val venueCapacitySeated: String = "",
    val venueCapacityStanding: String = "",
    val venuePricingNotes: String = "",
    val venueRestrictions: String = "",
    val venuePros: String = "",
    val venueCons: String = "",
    val venueContactName: String = "",
    val venueMapsUrl: String = "",
    val venueShortlisted: Boolean = false,
    val rating: Int = 0,
    val vendorIndicatedBy: String = "",
    val vendorTags: String = "",
    val vendorContractLink: String = "",
    val incomeFrequency: String = "ONE_TIME",
    val contractVersion: String = "1",
    val contractExpiresAt: String = "",
    val contractPaymentTerms: String = "",
    val contractCancellationPolicy: String = "",
    val contractIncludedItems: String = "",
    val contractExcludedItems: String = "",
    val contactRole: String = "",
    val contactPrimary: Boolean = false,
    val guestSide: String = "",
    val guestDietary: String = "",
    val guestCity: String = "",
    val guestIsVip: Boolean = false,
    val guestIsPadrinho: Boolean = false,
    val guestIsChild: Boolean = false,
    val paymentMethod: String = "",
    val lateFeePercent: String = "",
    val interestPercentPerMonth: String = "",
    val honeymoonItemKind: String = "FLIGHT",
    val honeymoonConfirmation: String = "",
    val trousseauRoom: String = "OTHER",
    val trousseauStore: String = "",
    val itemPriority: String = "MEDIUM",
    val parentId: String? = null,
    val guestGroupId: String? = null,
    val seatingTableId: String? = null,
    val plusAllowed: String = "0",
    val plusConfirmed: String = "0",
    val selectedTagIds: Set<String> = emptySet(),
)

enum class EditorField {
    TITLE, SUBTITLE, AMOUNT, ESTIMATED, DATE, PHONE, EMAIL, PARENT, LATE_FEE, INTEREST, CONTRACT_VERSION,
    CONTRACT_EXPIRES, CAPACITY_SEATED, CAPACITY_STANDING, MAPS_URL, CONTRACT_LINK, PLUS_ALLOWED, PLUS_CONFIRMED, TABLE,
}

sealed interface EditorOutcome {
    data class Valid(val record: PlannerRecord) : EditorOutcome
    data class Invalid(val errors: Map<EditorField, Int>) : EditorOutcome
}

object EditorLimits {
    const val NAME = 120
    const val SHORT_TEXT = 500
    const val TEXT = 2000
    const val LONG_TEXT = 8000
    const val PHONE = 40
    const val EMAIL = 160
    const val URL = 2000
    private val phonePattern = Regex("^[0-9+()\\-\\s]+$")
    private val emailPattern = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

    fun validPhone(value: String) = value.isBlank() || (value.length <= PHONE && phonePattern.matches(value.trim()))
    fun validEmail(value: String) = value.isBlank() || (value.length <= EMAIL && emailPattern.matches(value.trim()))
    fun validUrl(value: String) = value.isBlank() || value.trim().let { it.startsWith("https://") || it.startsWith("http://") }
}

private fun centsText(cents: Long?): String = cents?.let { BigDecimal.valueOf(it, 2).toPlainString() }.orEmpty()

fun editorFormFrom(module: ModuleDefinition, initial: PlannerRecord?, parentId: String?): EditorFormState {
    val json = ExtraFields.parse(WebValues.normalizeExtra(module.kind, initial?.extraJson ?: "{}"))
    fun text(key: String, default: String = "") = ExtraFields.text(json, key, default)
    return EditorFormState(
        title = initial?.title.orEmpty(),
        subtitle = initial?.subtitle.orEmpty(),
        amount = if (module.kind == Kinds.TABLE) initial?.amountCents?.toString().orEmpty() else centsText(initial?.amountCents),
        estimated = centsText(initial?.estimatedCents),
        date = initial?.date.orEmpty(),
        status = initial?.status ?: module.statuses.firstOrNull().orEmpty(),
        phone = initial?.phone.orEmpty(),
        email = initial?.email.orEmpty(),
        notes = initial?.notes.orEmpty(),
        venueAddress = text("address"),
        venueCapacitySeated = ExtraFields.int(json, "capacitySeated")?.toString().orEmpty(),
        venueCapacityStanding = ExtraFields.int(json, "capacityStanding")?.toString().orEmpty(),
        venuePricingNotes = text("pricingNotes"),
        venueRestrictions = text("restrictions"),
        venuePros = text("pros"),
        venueCons = text("cons"),
        venueContactName = text("contactName"),
        venueMapsUrl = text("mapsUrl"),
        venueShortlisted = ExtraFields.bool(json, "isShortlisted"),
        rating = ExtraFields.int(json, "rating")?.coerceIn(0, 5) ?: 0,
        vendorIndicatedBy = text("indicatedBy"),
        vendorTags = text("tags"),
        vendorContractLink = text("contractLink"),
        incomeFrequency = text("frequency", "ONE_TIME"),
        contractVersion = (ExtraFields.int(json, "version") ?: 1).toString(),
        contractExpiresAt = ExtraFields.day(json, "expiresAt")?.toString().orEmpty(),
        contractPaymentTerms = text("paymentTerms"),
        contractCancellationPolicy = text("cancellationPolicy"),
        contractIncludedItems = text("includedItems"),
        contractExcludedItems = text("excludedItems"),
        contactRole = text("role"),
        contactPrimary = ExtraFields.bool(json, "isPrimary"),
        guestSide = text("side"),
        guestDietary = text("dietary"),
        guestCity = text("city"),
        guestIsVip = ExtraFields.bool(json, "isVIP"),
        guestIsPadrinho = ExtraFields.bool(json, "isPadrinho"),
        guestIsChild = ExtraFields.bool(json, "isChild"),
        paymentMethod = text("method"),
        lateFeePercent = ExtraFields.double(json, "lateFeePercent")?.toString().orEmpty(),
        interestPercentPerMonth = ExtraFields.double(json, "interestPercentPerMonth")?.toString().orEmpty(),
        honeymoonItemKind = text("kind", "FLIGHT"),
        honeymoonConfirmation = text("confirmationNumber"),
        trousseauRoom = text("room", "OTHER"),
        trousseauStore = text("store"),
        itemPriority = text("priority", if (module.kind == Kinds.TROUSSEAU) "NICE_TO_HAVE" else "MEDIUM"),
        parentId = initial?.parentId ?: parentId,
        guestGroupId = initial?.guestGroupId,
        seatingTableId = initial?.seatingTableId,
        plusAllowed = (initial?.plusOnesAllowed ?: 0).toString(),
        plusConfirmed = (initial?.plusOnesConfirmed ?: 0).toString(),
        selectedTagIds = initial?.let(RecordIndex::tagIds).orEmpty(),
    )
}

/**
 * Valida o formulário campo a campo e monta o registro. As regras espelham os
 * limites do Zod na web e os requisitos de `PlannerRepository.save`.
 */
fun buildEditorRecord(
    module: ModuleDefinition,
    form: EditorFormState,
    initial: PlannerRecord?,
    index: RecordIndex,
    newId: () -> String = { UUID.randomUUID().toString() },
): EditorOutcome {
    val errors = linkedMapOf<EditorField, Int>()
    fun fail(field: EditorField, @StringRes message: Int) { errors.putIfAbsent(field, message) }
    fun day(field: EditorField, raw: String): String? {
        val normalized = normalizeDateInput(raw)
        if (normalized.isBlank()) return null
        return runCatching { LocalDate.parse(normalized).toString() }.getOrElse { fail(field, R.string.err_date); null }
    }
    fun money(field: EditorField, raw: String, required: Boolean): Long? {
        if (raw.isBlank()) { if (required) fail(field, R.string.err_required); return null }
        return runCatching { Money.parseToCents(raw) }.getOrElse { fail(field, R.string.err_money); null }
    }
    fun int(field: EditorField, raw: String, range: IntRange): Int? {
        if (raw.isBlank()) return null
        val value = raw.trim().toIntOrNull()
        if (value == null || value !in range) { fail(field, R.string.err_range); return null }
        return value
    }
    fun percent(field: EditorField, raw: String): Double? {
        if (raw.isBlank()) return null
        val value = raw.trim().replace(',', '.').toDoubleOrNull()
        if (value == null || value !in 0.0..100.0) { fail(field, R.string.err_percent); return null }
        return value
    }

    if (form.title.isBlank()) fail(EditorField.TITLE, R.string.err_required)
    if (module.kind == Kinds.VENDOR && form.subtitle.isBlank()) fail(EditorField.SUBTITLE, R.string.vendor_needs_category)
    if (module.hasContact) {
        if (!EditorLimits.validPhone(form.phone)) fail(EditorField.PHONE, R.string.err_phone)
        if (!EditorLimits.validEmail(form.email)) fail(EditorField.EMAIL, R.string.err_email)
    }
    val amount = when {
        !module.hasAmount || (form.amount.isBlank() && module.kind != Kinds.TABLE) -> null
        module.kind == Kinds.TABLE -> int(EditorField.AMOUNT, form.amount, 1..1000)
            ?.toLong().also { if (form.amount.isBlank()) fail(EditorField.AMOUNT, R.string.err_required) }
        else -> money(EditorField.AMOUNT, form.amount, required = false)
    }
    val estimated = when (module.kind) {
        Kinds.BUDGET -> money(EditorField.ESTIMATED, form.estimated, required = true)
        Kinds.TROUSSEAU -> money(EditorField.ESTIMATED, form.estimated, required = false)
        else -> initial?.estimatedCents
    }
    val date = if (module.hasDate) day(EditorField.DATE, form.date) else initial?.date
    if (module.kind == Kinds.PAYMENT) {
        if (date == null && form.date.isBlank()) fail(EditorField.DATE, R.string.err_required)
        if (form.parentId == null || index.find(form.parentId)?.kind != Kinds.VENDOR) fail(EditorField.PARENT, R.string.err_vendor_required)
    }
    val lateFee = if (module.kind == Kinds.PAYMENT) percent(EditorField.LATE_FEE, form.lateFeePercent) else null
    val interest = if (module.kind == Kinds.PAYMENT) percent(EditorField.INTEREST, form.interestPercentPerMonth) else null
    val version = if (module.kind == Kinds.CONTRACT) int(EditorField.CONTRACT_VERSION, form.contractVersion.ifBlank { "1" }, 1..999) else null
    val expiresAt = if (module.kind == Kinds.CONTRACT) day(EditorField.CONTRACT_EXPIRES, form.contractExpiresAt) else null
    val seated = if (module.kind == Kinds.VENUE) int(EditorField.CAPACITY_SEATED, form.venueCapacitySeated, 0..100_000) else null
    val standing = if (module.kind == Kinds.VENUE) int(EditorField.CAPACITY_STANDING, form.venueCapacityStanding, 0..100_000) else null
    if (module.kind == Kinds.VENUE && !EditorLimits.validUrl(form.venueMapsUrl)) fail(EditorField.MAPS_URL, R.string.err_url)
    if (module.kind == Kinds.VENDOR && !EditorLimits.validUrl(form.vendorContractLink)) fail(EditorField.CONTRACT_LINK, R.string.err_url)
    var plusAllowed = 0
    var plusConfirmed = 0
    if (module.kind == Kinds.GUEST) {
        plusAllowed = int(EditorField.PLUS_ALLOWED, form.plusAllowed.ifBlank { "0" }, 0..10) ?: 0
        plusConfirmed = int(EditorField.PLUS_CONFIRMED, form.plusConfirmed.ifBlank { "0" }, 0..10) ?: 0
        if (plusConfirmed > plusAllowed) fail(EditorField.PLUS_CONFIRMED, R.string.err_plus_confirmed)
        val tableId = form.seatingTableId
        if (tableId != null) {
            val capacity = index.find(tableId)?.amountCents ?: 0L
            val occupied = index.tableGuests(tableId).filter { it.id != initial?.id }.sumOf { 1 + it.plusOnesConfirmed }
            if (occupied + 1 + plusConfirmed > capacity) fail(EditorField.TABLE, R.string.table_full)
        }
    }
    if (errors.isNotEmpty()) return EditorOutcome.Invalid(errors)

    val extra = ExtraFields.parse(WebValues.normalizeExtra(module.kind, initial?.extraJson ?: "{}")).apply {
        fun putText(key: String, value: String) { if (value.isBlank()) remove(key) else put(key, value.trim()) }
        when (module.kind) {
            Kinds.VENUE -> {
                putText("address", form.venueAddress)
                putText("mapsUrl", form.venueMapsUrl)
                if (seated == null) remove("capacitySeated") else put("capacitySeated", seated)
                if (standing == null) remove("capacityStanding") else put("capacityStanding", standing)
                putText("contactName", form.venueContactName)
                putText("pricingNotes", form.venuePricingNotes)
                putText("restrictions", form.venueRestrictions)
                putText("pros", form.venuePros)
                putText("cons", form.venueCons)
                put("isShortlisted", form.venueShortlisted)
            }
            Kinds.VENDOR -> {
                if (form.rating in 1..5) put("rating", form.rating) else remove("rating")
                putText("indicatedBy", form.vendorIndicatedBy)
                putText("tags", form.vendorTags)
                putText("contractLink", form.vendorContractLink)
            }
            Kinds.GUEST -> {
                put("tagIds", JSONArray(form.selectedTagIds.sorted()))
                putText("side", form.guestSide)
                putText("dietary", form.guestDietary)
                putText("city", form.guestCity)
                put("isVIP", form.guestIsVip)
                put("isPadrinho", form.guestIsPadrinho)
                put("isChild", form.guestIsChild)
            }
            Kinds.PAYMENT -> {
                putText("method", form.paymentMethod)
                if (lateFee == null) remove("lateFeePercent") else put("lateFeePercent", lateFee)
                if (interest == null) remove("interestPercentPerMonth") else put("interestPercentPerMonth", interest)
            }
            Kinds.HONEYMOON_ITEM -> {
                put("kind", form.honeymoonItemKind)
                putText("confirmationNumber", form.honeymoonConfirmation)
            }
            Kinds.TROUSSEAU -> {
                put("room", form.trousseauRoom)
                putText("store", form.trousseauStore)
                put("priority", form.itemPriority)
            }
            Kinds.TASK -> put("priority", form.itemPriority)
            Kinds.INCOME -> put("frequency", form.incomeFrequency)
            Kinds.CONTRACT -> {
                put("version", version ?: 1)
                if (expiresAt == null) remove("expiresAt") else put("expiresAt", expiresAt)
                putText("paymentTerms", form.contractPaymentTerms)
                putText("cancellationPolicy", form.contractCancellationPolicy)
                putText("includedItems", form.contractIncludedItems)
                putText("excludedItems", form.contractExcludedItems)
            }
            Kinds.CONTACT -> {
                putText("role", form.contactRole)
                put("isPrimary", form.contactPrimary)
            }
        }
    }
    val base = initial ?: PlannerRecord(newId(), module.kind, form.title.trim())
    return EditorOutcome.Valid(
        base.copy(
            title = form.title.trim(), subtitle = form.subtitle.trim(), amountCents = amount, estimatedCents = estimated,
            date = date, status = form.status, phone = form.phone.trim(), email = form.email.trim(), notes = form.notes.trim(),
            parentId = form.parentId,
            guestGroupId = if (module.kind == Kinds.GUEST) form.guestGroupId else base.guestGroupId,
            seatingTableId = if (module.kind == Kinds.GUEST) form.seatingTableId else base.seatingTableId,
            plusOnesAllowed = plusAllowed, plusOnesConfirmed = plusConfirmed,
            extraJson = extra.toString(),
        ),
    )
}
