package br.com.paivalab.weddingmanagementsystem.data

/** Indicadores do topo da lista de convidados, como em `guests-client.tsx`. */
data class GuestStats(
    val total: Int,
    val confirmed: Int,
    val declined: Int,
    val pending: Int,
    val seats: Int,
    val children: Int,
    val dietary: Int,
)

/** Resumo de um grupo, como `summarizeGroup` em `guests/groups/group-summary.ts`. */
data class GroupSummary(
    val members: Int,
    val confirmed: Int,
    val declined: Int,
    val pending: Int,
    val willReceive: Boolean,
    /** Integrante cujo contato será usado quando o grupo não tem contato próprio. */
    val fallbackName: String?,
)

object GuestRules {
    const val FILTER_CONFIRMED = "CONFIRMED"
    const val FILTER_PENDING = "GUEST_PENDING"
    const val FILTER_PADRINHOS = "PADRINHOS"
    const val FILTER_CHILDREN = "CHILDREN"
    const val FILTER_CHECKED_IN = "CHECKED_IN"

    val languages = listOf("pt-BR", "en", "es")

    fun isPending(guest: PlannerRecord) = guest.status == "INVITED" || guest.status == "MAYBE"

    fun stats(guests: List<PlannerRecord>, extra: (PlannerRecord) -> org.json.JSONObject): GuestStats {
        val confirmed = guests.filter { it.status == "CONFIRMED" }
        return GuestStats(
            total = guests.size,
            confirmed = confirmed.size,
            declined = guests.count { it.status == "DECLINED" },
            pending = guests.count(::isPending),
            seats = confirmed.sumOf { 1 + it.plusOnesConfirmed },
            children = confirmed.count { ExtraFields.bool(extra(it), "isChild") },
            dietary = confirmed.count { ExtraFields.text(extra(it), "dietary").isNotBlank() },
        )
    }

    /** Filtros rápidos da web; `null` quando `filter` não é um deles. */
    fun matches(guest: PlannerRecord, filter: String, extra: org.json.JSONObject): Boolean? = when (filter) {
        FILTER_CONFIRMED -> guest.status == "CONFIRMED"
        FILTER_PENDING -> isPending(guest)
        FILTER_PADRINHOS -> ExtraFields.bool(extra, "isPadrinho")
        FILTER_CHILDREN -> ExtraFields.bool(extra, "isChild")
        FILTER_CHECKED_IN -> ExtraFields.has(extra, "checkedInAt")
        else -> null
    }

    /** E.164 estrito, como `toValidMsisdn` da web (assume Brasil para 10 ou 11 dígitos). */
    fun validMsisdn(raw: String): String? {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return null
        val digits = trimmed.filter(Char::isDigit)
        val normalized = when {
            trimmed.startsWith("+") -> "+$digits"
            (digits.length == 12 || digits.length == 13) && digits.startsWith("55") -> "+$digits"
            digits.length == 10 || digits.length == 11 -> "+55$digits"
            else -> return null
        }
        return normalized.takeIf { it.matches(Regex("^\\+\\d{10,15}$")) }
    }

    fun summarizeGroup(group: PlannerRecord, members: List<PlannerRecord>): GroupSummary {
        val confirmed = members.count { it.status == "CONFIRMED" }
        val declined = members.count { it.status == "DECLINED" }
        val ownPhone = validMsisdn(group.phone)
        val ownEmail = group.email.takeIf { it.isNotBlank() }
        val fallbackPhone = if (ownPhone == null) members.firstOrNull { validMsisdn(it.phone) != null } else null
        val fallbackEmail = if (ownEmail == null) members.firstOrNull { it.email.isNotBlank() } else null
        val willReceive = ownPhone != null || ownEmail != null || fallbackPhone != null || fallbackEmail != null
        val fallback = if (ownPhone == null && ownEmail == null) fallbackPhone ?: fallbackEmail else null
        return GroupSummary(members.size, confirmed, declined, members.size - confirmed - declined, willReceive,
            fallback?.title?.takeIf { willReceive })
    }

    /** Linhas do CSV de convidados com as mesmas colunas da web; o cabeçalho vem traduzido. */
    fun csvRows(
        guests: List<PlannerRecord>,
        index: RecordIndex,
        header: List<String>,
        yes: String,
        statusLabel: (String) -> String,
    ): List<List<String>> {
        require(header.size == 13)
        return listOf(header) + guests.sortedBy { it.title.lowercase() }.map { guest ->
            val extra = index.extra(guest)
            fun flag(key: String) = if (ExtraFields.bool(extra, key)) yes else ""
            listOf(
                guest.title, guest.phone, guest.email, ExtraFields.text(extra, "side"),
                index.find(guest.guestGroupId)?.title.orEmpty(), statusLabel(guest.status), guest.plusOnesConfirmed.toString(),
                index.find(guest.seatingTableId)?.title.orEmpty(), ExtraFields.text(extra, "dietary"), ExtraFields.text(extra, "city"),
                flag("isPadrinho"), flag("isVIP"), flag("isChild"),
            )
        }
    }
}

data class GiftStats(val cashCents: Long, val cashPendingCents: Long, val items: Int, val pendingThanks: Int)

object GiftRules {
    const val FILTER_PENDING_THANK = "PENDING_THANK"
    val types = listOf("CASH", "ITEM")
    val statuses = listOf("RECEIVED", "THANKED")

    /** A web só olha `thankedAt`; o status THANKED vem de backups antigos do Android. */
    fun thanked(gift: PlannerRecord, extra: org.json.JSONObject): Boolean =
        ExtraFields.has(extra, "thankedAt") || gift.status == "THANKED"

    /** Sem `type` gravado vale o padrão da coluna web (`CASH`). */
    fun type(extra: org.json.JSONObject): String = ExtraFields.text(extra, "type").takeIf { it in types } ?: "CASH"

    fun processed(gift: PlannerRecord, extra: org.json.JSONObject): Boolean =
        ExtraFields.has(extra, "processedAt") || gift.status == "PROCESSED"

    fun canPost(gift: PlannerRecord, extra: org.json.JSONObject): Boolean =
        type(extra) == "CASH" && (gift.amountCents ?: 0L) > 0L && !processed(gift, extra)

    /** Quem deu: convidado vinculado ou o nome digitado. */
    fun giver(gift: PlannerRecord, index: RecordIndex): String? =
        index.find(gift.parentId)?.title ?: ExtraFields.text(index.extra(gift), "giverName").ifBlank { null }

    fun stats(gifts: List<PlannerRecord>, extra: (PlannerRecord) -> org.json.JSONObject): GiftStats {
        val cash = gifts.filter { type(extra(it)) == "CASH" }
        return GiftStats(
            cashCents = cash.sumOf { it.amountCents ?: 0L },
            cashPendingCents = cash.filter { (it.amountCents ?: 0L) > 0L && !processed(it, extra(it)) }.sumOf { it.amountCents ?: 0L },
            items = gifts.count { type(extra(it)) == "ITEM" },
            pendingThanks = gifts.count { it.status != "THANKED" },
        )
    }

    /**
     * Status e datas como `markGiftThanked` da web: só RECEIVED ou THANKED, com
     * `thankedAt` acompanhando o status. PENDING e PROCESSED de versões antigas
     * do Android viram RECEIVED (PROCESSED mantém o lançamento em `processedAt`).
     */
    fun normalize(previous: PlannerRecord?, next: PlannerRecord, now: Long): PlannerRecord {
        if (next.kind != Kinds.GIFT) return next
        val extra = ExtraFields.parse(next.extraJson)
        if (next.status == "PROCESSED" && !ExtraFields.has(extra, "processedAt")) extra.put("processedAt", now)
        val status = if (next.status == "THANKED") "THANKED" else "RECEIVED"
        if (status == "THANKED") {
            if (!ExtraFields.has(extra, "thankedAt")) {
                val original = previous?.takeIf { it.status == "THANKED" }
                    ?.let { ExtraFields.instant(ExtraFields.parse(it.extraJson), "thankedAt") }
                extra.put("thankedAt", original ?: now)
            }
        } else {
            extra.remove("thankedAt")
        }
        if (type(extra) == "ITEM") extra.remove("isHoneymoonShare")
        val json = extra.toString()
        return if (status == next.status && json == ExtraFields.parse(next.extraJson).toString()) next
            else next.copy(status = status, extraJson = json)
    }
}
