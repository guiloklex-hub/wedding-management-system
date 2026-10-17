package br.com.paivalab.weddingmanagementsystem.data

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.Locale
import org.json.JSONObject

/**
 * Leitura tolerante do `extraJson`. Dados vindos do SQLite web trazem booleanos
 * como 0/1, datas em milissegundos (ou segundos) e chaves com `null`.
 */
object ExtraFields {
    fun parse(json: String): JSONObject = runCatching { JSONObject(json) }.getOrElse { JSONObject() }

    fun has(json: JSONObject, key: String): Boolean = json.has(key) && !json.isNull(key)

    fun text(json: JSONObject, key: String, default: String = ""): String =
        if (has(json, key)) json.opt(key).toString() else default

    fun bool(json: JSONObject, key: String, default: Boolean = false): Boolean {
        if (!has(json, key)) return default
        return when (val value = json.opt(key)) {
            is Boolean -> value
            is Number -> value.toInt() != 0
            else -> when (value.toString().trim().lowercase(Locale.ROOT)) {
                "true", "1" -> true
                "false", "0" -> false
                else -> default
            }
        }
    }

    fun double(json: JSONObject, key: String): Double? {
        if (!has(json, key)) return null
        return when (val value = json.opt(key)) {
            is Number -> value.toDouble()
            else -> value.toString().trim().replace(',', '.').toDoubleOrNull()
        }?.takeIf { it.isFinite() }
    }

    fun int(json: JSONObject, key: String): Int? = double(json, key)?.toInt()

    /** Instante em milissegundos; aceita ISO, `YYYY-MM-DD`, segundos ou milissegundos. */
    fun instant(json: JSONObject, key: String): Long? {
        if (!has(json, key)) return null
        return epochMillis(json.opt(key))
    }

    fun day(json: JSONObject, key: String): LocalDate? =
        instant(json, key)?.let { Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }

    fun epochMillis(value: Any?): Long? = when (value) {
        null, JSONObject.NULL -> null
        is Number -> value.toLong().let { if (kotlin.math.abs(it) > 100_000_000_000L) it else it * 1000 }
        else -> {
            val text = value.toString().trim()
            when {
                text.isEmpty() -> null
                text.matches(Regex("\\d{9,13}")) -> epochMillis(text.toLong())
                text.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) ->
                    runCatching { LocalDate.parse(text).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() }.getOrNull()
                else -> runCatching { Instant.parse(text).toEpochMilli() }.getOrNull()
            }
        }
    }
}

/** Versão do mapeamento de `extraJson` gravada no manifesto; a web só aplica extras quando >= 1. */
const val FIELD_MAP_VERSION = 1

/** Valores aceitos pelas colunas web (Prisma), para o backup voltar sem perda. */
object WebValues {
    val guestSides = listOf("NOIVA", "NOIVO", "AMBOS")
    val paymentMethods = listOf("PIX", "BOLETO", "CREDIT", "TRANSFER", "CASH")
    val taskPriorities = listOf("URGENT", "HIGH", "MEDIUM", "LOW")
    val trousseauRooms = listOf("KITCHEN", "BATHROOM", "BEDROOM", "LIVING", "LAUNDRY", "ELECTRONICS", "OTHER")
    val trousseauPriorities = listOf("ESSENTIAL", "NICE_TO_HAVE", "LUXURY")
    val honeymoonItemKinds = listOf("FLIGHT", "HOTEL", "TRANSFER", "ACTIVITY", "DOCUMENT", "BAGGAGE", "OTHER")

    private val legacySides = mapOf("BRIDE" to "NOIVA", "GROOM" to "NOIVO", "BOTH" to "AMBOS")
    private val legacyMethods = mapOf("CREDIT_CARD" to "CREDIT", "TED" to "TRANSFER")
    private val legacyTrousseauPriorities = mapOf("HIGH" to "ESSENTIAL", "MEDIUM" to "NICE_TO_HAVE", "LOW" to "LUXURY")
    private val legacyRooms = mapOf(
        "COZINHA" to "KITCHEN", "BANHEIRO" to "BATHROOM", "QUARTO" to "BEDROOM", "SALA" to "LIVING",
        "LAVANDERIA" to "LAUNDRY", "ELETRONICOS" to "ELECTRONICS", "ELETRÔNICOS" to "ELECTRONICS", "OUTRO" to "OTHER",
    )

    private val boolKeys = mapOf(
        Kinds.CONTACT to setOf("isPrimary"), Kinds.VENUE to setOf("isShortlisted"), Kinds.GOAL to setOf("isActive"),
        Kinds.GUEST to setOf("isVIP", "isPadrinho", "isChild"), Kinds.GIFT to setOf("isHoneymoonShare"),
    )
    private val dayKeys = mapOf(
        Kinds.CONTRACT to setOf("expiresAt"), Kinds.HONEYMOON to setOf("endDate"), Kinds.HONEYMOON_ITEM to setOf("endAt"),
    )
    private val instantKeys = mapOf(
        Kinds.PAYMENT to setOf("paidAt"), Kinds.GUEST to setOf("checkedInAt"), Kinds.TASK to setOf("completedAt"),
        Kinds.INCOME to setOf("receivedAt"),
        Kinds.GIFT to setOf("thankedAt", "pixPaidAt", "processedAt"),
    )

    private fun canonical(value: String, allowed: List<String>, legacy: Map<String, String> = emptyMap()): String? {
        val upper = value.trim().uppercase(Locale.ROOT)
        return allowed.firstOrNull { it == upper } ?: legacy[upper]
    }

    fun guestSide(value: String): String? = canonical(value, guestSides, legacySides)
    fun paymentMethod(value: String): String? = canonical(value, paymentMethods, legacyMethods)
    fun trousseauRoom(value: String): String? = canonical(value, trousseauRooms, legacyRooms)
    fun trousseauPriority(value: String): String? = canonical(value, trousseauPriorities, legacyTrousseauPriorities)

    /**
     * Converte metadados antigos (Android v1.1.0 ou web cru) para nomes e
     * valores das colunas web. Idempotente: pode rodar em toda gravação.
     */
    fun normalizeExtra(kind: String, extraJson: String): String {
        val source = ExtraFields.parse(extraJson)
        val result = JSONObject()
        source.keys().forEach { key -> if (!source.isNull(key)) result.put(key, source.get(key)) }
        boolKeys[kind]?.forEach { key ->
            if (ExtraFields.has(result, key)) result.put(key, ExtraFields.bool(result, key))
        }
        dayKeys[kind]?.forEach { key ->
            val day = ExtraFields.day(result, key)
            if (day != null) result.put(key, day.toString()) else result.remove(key)
        }
        instantKeys[kind]?.forEach { key ->
            val instant = ExtraFields.instant(result, key)
            if (instant != null) result.put(key, instant) else result.remove(key)
        }
        fun mapValue(key: String, transform: (String) -> String?) {
            if (!ExtraFields.has(result, key)) return
            val mapped = transform(result.get(key).toString())
            if (mapped != null) result.put(key, mapped) else result.remove(key)
        }
        when (kind) {
            Kinds.GUEST -> mapValue("side", ::guestSide)
            Kinds.PAYMENT -> mapValue("method", ::paymentMethod)
            Kinds.TROUSSEAU -> {
                mapValue("room") { trousseauRoom(it) ?: "OTHER" }
                mapValue("priority", ::trousseauPriority)
            }
            Kinds.HONEYMOON_ITEM -> {
                if (!ExtraFields.has(result, "kind") && ExtraFields.has(result, "itemKind")) {
                    result.put("kind", result.get("itemKind"))
                }
                result.remove("itemKind")
                mapValue("kind") { canonical(it, honeymoonItemKinds) }
            }
            Kinds.TASK -> mapValue("priority") { canonical(it, taskPriorities) }
        }
        return result.toString()
    }

    fun normalize(record: PlannerRecord): PlannerRecord {
        val extra = normalizeExtra(record.kind, record.extraJson)
        return if (extra == record.extraJson) record else record.copy(extraJson = extra)
    }
}

/**
 * Desfaz valores que o editor da v1.1.0 gravava sem intenção do usuário,
 * usando a cópia web importada (`baseline`) como referência:
 * booleanos 0/1 lidos como `false` e padrões inseridos em campos vazios.
 */
object LegacyRepair {
    private val boolKeys = mapOf(
        Kinds.CONTACT to listOf("isPrimary"), Kinds.VENUE to listOf("isShortlisted"),
        Kinds.GUEST to listOf("isVIP", "isPadrinho", "isChild"),
    )

    private fun numericTrue(value: Any?): Boolean = value is Number && value.toInt() != 0 || value == "1"

    private fun absent(json: JSONObject, key: String) = !ExtraFields.has(json, key)

    fun repair(record: PlannerRecord, baselineExtra: JSONObject?): PlannerRecord {
        if (baselineExtra == null) return record
        val current = ExtraFields.parse(record.extraJson)
        var changed = false
        boolKeys[record.kind]?.forEach { key ->
            if (numericTrue(baselineExtra.opt(key)) && current.opt(key) == false) {
                current.put(key, true)
                changed = true
            }
        }
        when (record.kind) {
            Kinds.GUEST -> if (absent(baselineExtra, "side") && current.opt("side") == "BOTH") {
                current.remove("side"); changed = true
            }
            Kinds.PAYMENT -> {
                if (absent(baselineExtra, "lateFeePercent") && absent(baselineExtra, "interestPercentPerMonth") &&
                    ExtraFields.double(current, "lateFeePercent") == 2.0 &&
                    ExtraFields.double(current, "interestPercentPerMonth") == 1.0) {
                    current.remove("lateFeePercent"); current.remove("interestPercentPerMonth"); changed = true
                }
                if (absent(baselineExtra, "method") && current.opt("method") == "PIX") {
                    current.remove("method"); changed = true
                }
            }
            Kinds.HONEYMOON_ITEM -> if (ExtraFields.has(baselineExtra, "kind") && current.has("itemKind")) {
                current.remove("itemKind"); changed = true
            }
        }
        return if (changed) record.copy(extraJson = current.toString()) else record
    }

    fun baselineExtras(baselineJson: String): Map<String, JSONObject> {
        val array = runCatching { org.json.JSONArray(baselineJson) }.getOrNull() ?: return emptyMap()
        return (0 until array.length()).mapNotNull { index ->
            val item = array.optJSONObject(index) ?: return@mapNotNull null
            item.optString("id").takeIf { it.isNotBlank() }?.let { it to ExtraFields.parse(item.optString("extraJson", "{}")) }
        }.toMap()
    }
}
