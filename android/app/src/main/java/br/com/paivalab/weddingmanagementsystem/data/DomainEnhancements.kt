package br.com.paivalab.weddingmanagementsystem.data

import java.text.Normalizer
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.roundToLong
import org.json.JSONObject

object PixBrCode {
    private const val PIX_GUI = "br.gov.bcb.pix"

    private fun tlv(id: String, value: String): String {
        require(id.length == 2) { "BR Code: ID must be 2 chars" }
        val len = value.length.toString().padStart(2, '0')
        require(len.length == 2) { "BR Code: value too long for TLV" }
        return "$id$len$value"
    }

    fun sanitizeAscii(input: String, max: Int): String {
        val folded = Normalizer.normalize(input, Normalizer.Form.NFKD)
            .replace(Regex("[\\u0300-\\u036f]"), "")
            .replace(Regex("[^A-Za-z0-9 ]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
        return folded.take(max)
    }

    private fun sanitizeTxid(txid: String?): String {
        if (txid.isNullOrBlank()) return "***"
        val cleaned = txid.replace(Regex("[^A-Za-z0-9]"), "").take(25)
        return cleaned.ifEmpty { "***" }
    }

    fun crc16(payload: String): String {
        var crc = 0xFFFF
        val polynomial = 0x1021
        for (ch in payload) {
            crc = crc xor (ch.code shl 8)
            for (bit in 0 until 8) {
                crc = if ((crc and 0x8000) != 0) {
                    ((crc shl 1) xor polynomial) and 0xFFFF
                } else {
                    (crc shl 1) and 0xFFFF
                }
            }
        }
        return crc.toString(16).uppercase(Locale.ROOT).padStart(4, '0')
    }

    fun generate(
        key: String,
        merchantName: String,
        merchantCity: String = "SAO PAULO",
        amountCents: Long? = null,
        txid: String? = "***",
    ): String {
        val cleanKey = key.trim()
        require(cleanKey.isNotEmpty() && cleanKey.length <= 77) { "Chave Pix inválida" }
        val name = sanitizeAscii(merchantName.ifBlank { "Casamento" }, 25).ifBlank { "CASAMENTO" }
        val city = sanitizeAscii(merchantCity.ifBlank { "SAO PAULO" }, 15).uppercase(Locale.ROOT).ifBlank { "SAO PAULO" }

        val merchantAccount = tlv("00", PIX_GUI) + tlv("01", cleanKey)
        val additional = tlv("05", sanitizeTxid(txid))

        val parts = buildString {
            append(tlv("00", "01"))
            append(tlv("01", "11"))
            append(tlv("26", merchantAccount))
            append(tlv("52", "0000"))
            append(tlv("53", "986"))
            if (amountCents != null && amountCents > 0L) {
                val formatted = String.format(Locale.US, "%.2f", amountCents / 100.0)
                append(tlv("54", formatted))
            }
            append(tlv("58", "BR"))
            append(tlv("59", name))
            append(tlv("60", city))
            append(tlv("62", additional))
            append("6304")
        }
        return parts + crc16(parts)
    }
}

/**
 * Compact ISO/IEC 18004 QR Code Matrix Generator (Byte mode, ECC Level L, Versions 4..6)
 * Capable of encoding up to 134 bytes (covers all standard Pix EMV BR Codes).
 */
object QrCodeMatrix {
    private data class VersionSpec(val version: Int, val size: Int, val totalCodewords: Int, val ecCodewordsPerBlock: Int, val numBlocks: Int, val alignmentCenters: IntArray)

    private val specs = listOf(
        VersionSpec(4, 33, 100, 20, 1, intArrayOf(6, 26)),
        VersionSpec(5, 37, 134, 26, 1, intArrayOf(6, 30)),
        VersionSpec(6, 41, 172, 18, 2, intArrayOf(6, 34)),
    )

    fun encode(payload: String): Array<BooleanArray> {
        val bytes = payload.toByteArray(Charsets.ISO_8859_1)
        val spec = specs.firstOrNull { bytes.size + 3 <= it.totalCodewords - it.ecCodewordsPerBlock * it.numBlocks } ?: specs.last()
        val dataCapacity = spec.totalCodewords - spec.ecCodewordsPerBlock * spec.numBlocks
        val clipped = if (bytes.size + 3 > dataCapacity) bytes.copyOf(dataCapacity - 3) else bytes

        val bits = mutableListOf<Int>()
        fun pushBits(value: Int, count: Int) {
            for (i in count - 1 downTo 0) bits.add((value ushr i) and 1)
        }
        pushBits(0b0100, 4) // Byte mode
        pushBits(clipped.size, 8)
        for (b in clipped) pushBits(b.toInt() and 0xFF, 8)
        repeat(minOf(4, dataCapacity * 8 - bits.size)) { bits.add(0) }
        while (bits.size % 8 != 0) bits.add(0)
        val padBytes = intArrayOf(0xEC, 0x11)
        var padIdx = 0
        while (bits.size < dataCapacity * 8) {
            pushBits(padBytes[padIdx % 2], 8)
            padIdx++
        }

        val dataWords = IntArray(dataCapacity) { i ->
            var v = 0
            for (b in 0 until 8) v = (v shl 1) or bits[i * 8 + b]
            v
        }

        val allWords = if (spec.numBlocks == 1) {
            val ec = reedSolomonRemainder(dataWords, spec.ecCodewordsPerBlock)
            dataWords + ec
        } else {
            val blockSize = dataCapacity / spec.numBlocks
            val blocks = (0 until spec.numBlocks).map { b -> dataWords.sliceArray(b * blockSize until (b + 1) * blockSize) }
            val ecBlocks = blocks.map { reedSolomonRemainder(it, spec.ecCodewordsPerBlock) }
            val interleaved = IntArray(spec.totalCodewords)
            var idx = 0
            for (i in 0 until blockSize) for (b in 0 until spec.numBlocks) interleaved[idx++] = blocks[b][i]
            for (i in 0 until spec.ecCodewordsPerBlock) for (b in 0 until spec.numBlocks) interleaved[idx++] = ecBlocks[b][i]
            interleaved
        }

        val n = spec.size
        val modules = Array(n) { BooleanArray(n) }
        val isFunction = Array(n) { BooleanArray(n) }

        fun setFunc(r: Int, c: Int, dark: Boolean) {
            if (r in 0 until n && c in 0 until n) {
                modules[r][c] = dark
                isFunction[r][c] = true
            }
        }

        fun drawFinder(r: Int, c: Int) {
            for (dy in -1..7) for (dx in -1..7) {
                val rr = r + dy
                val cc = c + dx
                val dark = dy in 0..6 && dx in 0..6 && (dy == 0 || dy == 6 || dx == 0 || dx == 6 || (dy in 2..4 && dx in 2..4))
                setFunc(rr, cc, dark)
            }
        }
        drawFinder(0, 0)
        drawFinder(0, n - 7)
        drawFinder(n - 7, 0)

        for (i in 8 until n - 8) {
            setFunc(6, i, i % 2 == 0)
            setFunc(i, 6, i % 2 == 0)
        }

        val centers = spec.alignmentCenters
        for (cy in centers) for (cx in centers) {
            if ((cy == 6 && cx == 6) || (cy == 6 && cx == n - 7) || (cy == n - 7 && cx == 6)) continue
            for (dy in -2..2) for (dx in -2..2) {
                val dark = kotlin.math.max(kotlin.math.abs(dy), kotlin.math.abs(dx)) != 1
                setFunc(cy + dy, cx + dx, dark)
            }
        }

        for (i in 0..8) {
            if (i != 6) {
                setFunc(8, i, false)
                setFunc(i, 8, false)
            }
            if (i < 8) {
                setFunc(8, n - 1 - i, false)
                setFunc(n - 1 - i, 8, false)
            }
        }
        setFunc(n - 8, 8, true)

        var bitIdx = 0
        val totalBits = allWords.size * 8
        var right = n - 1
        while (right >= 1) {
            if (right == 6) right = 5
            for (vert in 0 until n) {
                val y = if (((right + 1) and 2) == 0) n - 1 - vert else vert
                for (j in 0..1) {
                    val x = right - j
                    if (!isFunction[y][x]) {
                        val dark = if (bitIdx < totalBits) {
                            ((allWords[bitIdx ushr 3] ushr (7 - (bitIdx and 7))) and 1) != 0
                        } else false
                        val masked = if ((y + x) % 2 == 0) !dark else dark // Mask 0
                        modules[y][x] = masked
                        bitIdx++
                    }
                }
            }
            right -= 2
        }

        // Format bits for ECC Level L (01) + Mask 0 (000) -> 0x77C4
        val formatBits = 0x77C4
        for (i in 0..5) setFunc(8, i, ((formatBits ushr i) and 1) != 0)
        setFunc(8, 7, ((formatBits ushr 6) and 1) != 0)
        setFunc(8, 8, ((formatBits ushr 7) and 1) != 0)
        setFunc(7, 8, ((formatBits ushr 8) and 1) != 0)
        for (i in 9..14) setFunc(14 - i, 8, ((formatBits ushr i) and 1) != 0)
        for (i in 0..7) setFunc(n - 1 - i, 8, ((formatBits ushr i) and 1) != 0)
        for (i in 8..14) setFunc(8, n - 15 + i, ((formatBits ushr i) and 1) != 0)

        return modules
    }

    private fun gfMul(x: Int, y: Int): Int {
        var res = 0
        var a = x
        var b = y
        while (b > 0) {
            if ((b and 1) != 0) res = res xor a
            a = a shl 1
            if ((a and 0x100) != 0) a = a xor 0x11D
            b = b ushr 1
        }
        return res
    }

    private fun reedSolomonRemainder(data: IntArray, degree: Int): IntArray {
        var poly = intArrayOf(1)
        var root = 1
        repeat(degree) {
            val next = IntArray(poly.size + 1)
            for (i in poly.indices) {
                next[i] = next[i] xor poly[i]
                next[i + 1] = next[i + 1] xor gfMul(poly[i], root)
            }
            poly = next
            root = gfMul(root, 2)
        }
        val rem = IntArray(degree)
        for (b in data) {
            val factor = b xor rem[0]
            System.arraycopy(rem, 1, rem, 0, degree - 1)
            rem[degree - 1] = 0
            for (i in 0 until degree) {
                rem[i] = rem[i] xor gfMul(poly[i + 1], factor)
            }
        }
        return rem
    }
}

internal object ExtraJsonParser {
    fun optDouble(json: String, key: String, default: Double = 0.0): Double {
        val m = Regex("\"$key\"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)").find(json)
        return m?.groupValues?.get(1)?.toDoubleOrNull() ?: default
    }

    fun optBoolean(json: String, key: String, default: Boolean = false): Boolean {
        val m = Regex("\"$key\"\\s*:\\s*(true|false)", RegexOption.IGNORE_CASE).find(json)
        return m?.groupValues?.get(1)?.lowercase(Locale.ROOT)?.toBooleanStrictOrNull() ?: default
    }

    fun optString(json: String, key: String, default: String = ""): String {
        val m = Regex("\"$key\"\\s*:\\s*\"([^\"]*)\"").find(json)
        return m?.groupValues?.get(1) ?: default
    }
}

data class PaymentAdjustmentResult(
    val baseCents: Long,
    val adjustedCents: Long,
    val lateDays: Long,
    val feeCents: Long,
    val interestCents: Long,
    val hasAdjustment: Boolean,
)

object PaymentAdjustment {
    fun compute(record: PlannerRecord, today: LocalDate = LocalDate.now()): PaymentAdjustmentResult {
        val base = record.amountCents ?: 0L
        val empty = PaymentAdjustmentResult(base, base, 0L, 0L, 0L, false)
        if (record.kind != Kinds.PAYMENT || record.status == "PAID" || base <= 0L) return empty
        val due = record.date?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return empty
        val lateDays = ChronoUnit.DAYS.between(due, today)
        if (lateDays <= 0L) return empty
        val feePct = ExtraJsonParser.optDouble(record.extraJson, "lateFeePercent", 0.0).coerceAtLeast(0.0)
        val interestPct = ExtraJsonParser.optDouble(record.extraJson, "interestPercentPerMonth", 0.0).coerceAtLeast(0.0)
        if (feePct <= 0.0 && interestPct <= 0.0) {
            return empty.copy(lateDays = lateDays)
        }
        val feeCents = ((base * feePct) / 100.0).roundToLong()
        val interestCents = ((base * interestPct * lateDays) / (100.0 * 30.0)).roundToLong()
        val adjusted = base + feeCents + interestCents
        return PaymentAdjustmentResult(
            baseCents = base,
            adjustedCents = adjusted,
            lateDays = lateDays,
            feeCents = feeCents,
            interestCents = interestCents,
            hasAdjustment = feeCents > 0L || interestCents > 0L,
        )
    }
}

data class RiskAlertItem(
    val id: String,
    val severity: String, // "HIGH" or "MEDIUM"
    val title: String,
    val body: String,
    val targetSection: String,
)

object RiskRadar {
    fun compute(
        activeRecords: List<PlannerRecord>,
        cashflow: List<MonthlyCashflow>,
        daysToEvent: Long?,
        formatMoney: (Long) -> String,
        today: LocalDate = LocalDate.now(),
    ): List<RiskAlertItem> {
        val alerts = mutableListOf<RiskAlertItem>()
        val vendorsById = activeRecords.filter { it.kind == Kinds.VENDOR }.associateBy { it.id }

        // 1. Overdue payments
        val overduePayments = activeRecords.filter {
            it.kind == Kinds.PAYMENT && it.status != "PAID" &&
                it.date?.let { d -> runCatching { LocalDate.parse(d).isBefore(today) }.getOrDefault(false) } == true
        }
        if (overduePayments.isNotEmpty()) {
            val totalAdjusted = overduePayments.sumOf { PaymentAdjustment.compute(it, today).adjustedCents }
            alerts.add(
                RiskAlertItem(
                    id = "overdue-payments",
                    severity = "HIGH",
                    title = "${overduePayments.size} pagamento(s) vencido(s)",
                    body = "Total corrigido de ${formatMoney(totalAdjusted)}. Toque para regularizar.",
                    targetSection = Kinds.PAYMENT,
                ),
            )
        }

        // 2. Negative cashflow projection
        val firstNegative = cashflow.firstOrNull { it.negative }
        if (firstNegative != null) {
            alerts.add(
                RiskAlertItem(
                    id = "negative-cashflow",
                    severity = "HIGH",
                    title = "Projeção de caixa negativa (${firstNegative.month})",
                    body = "Saldo projetado fecha em ${formatMoney(firstNegative.endingCents)}. Revise entradas e parcelas.",
                    targetSection = "insights",
                ),
            )
        }

        // 3. Unsigned contracts expiring within 90 days
        activeRecords.filter { it.kind == Kinds.CONTRACT && it.status == "DRAFT" }.forEach { contract ->
            val expDate = contract.date?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
            if (expDate != null) {
                val daysLeft = ChronoUnit.DAYS.between(today, expDate)
                if (daysLeft <= 90L) {
                    val vendorName = contract.parentId?.let { vendorsById[it]?.title } ?: contract.title
                    alerts.add(
                        RiskAlertItem(
                            id = "contract-${contract.id}",
                            severity = if (daysLeft <= 30L) "HIGH" else "MEDIUM",
                            title = "Minuta pendente: $vendorName",
                            body = if (daysLeft < 0) "Prazo venceu há ${-daysLeft} dia(s) sem assinatura." else "Vence em $daysLeft dia(s) com status Minuta.",
                            targetSection = Kinds.CONTRACT,
                        ),
                    )
                }
            }
        }

        // 4. Budget creep per item / vendor (> 5% or > 15%)
        activeRecords.filter { it.kind == Kinds.BUDGET }.forEach { budget ->
            val est = budget.estimatedCents ?: 0L
            val real = budget.amountCents ?: 0L
            if (est > 0L && real > est) {
                val overPct = (((real - est).toDouble() / est) * 100.0).roundToLong()
                if (overPct >= 5L) {
                    alerts.add(
                        RiskAlertItem(
                            id = "budget-creep-${budget.id}",
                            severity = if (overPct >= 15L) "HIGH" else "MEDIUM",
                            title = "Acima do previsto: ${budget.title} (+$overPct%)",
                            body = "Real ${formatMoney(real)} vs estimado ${formatMoney(est)} (+${formatMoney(real - est)}).",
                            targetSection = Kinds.BUDGET,
                        ),
                    )
                }
            }
        }

        // 5. Overdue urgent / high tasks
        val overdueTasks = activeRecords.filter {
            it.kind == Kinds.TASK && it.status != "DONE" &&
                it.date?.let { d -> runCatching { LocalDate.parse(d).isBefore(today) }.getOrDefault(false) } == true
        }
        if (overdueTasks.isNotEmpty()) {
            alerts.add(
                RiskAlertItem(
                    id = "overdue-tasks",
                    severity = "HIGH",
                    title = "${overdueTasks.size} tarefa(s) com prazo vencido",
                    body = overdueTasks.take(2).joinToString(" · ") { it.title },
                    targetSection = Kinds.TASK,
                ),
            )
        }

        // 6. Vendors not finalized near event
        if (daysToEvent != null && daysToEvent <= 60L) {
            val pendingVendors = activeRecords.filter { it.kind == Kinds.VENDOR && it.status != "FINALIZED" }
            if (pendingVendors.isNotEmpty()) {
                alerts.add(
                    RiskAlertItem(
                        id = "vendors-pending",
                        severity = "MEDIUM",
                        title = "${pendingVendors.size} fornecedor(es) ainda não finalizado(s)",
                        body = "Confirme entregáveis e alinhamento final para o Grande Dia.",
                        targetSection = Kinds.VENDOR,
                    ),
                )
            }
        }

        return alerts.sortedBy { if (it.severity == "HIGH") 0 else 1 }
    }
}

object VenueChecklistTemplates {
    val all: List<String> = listOf(
        "Estacionamento (quantas vagas?)",
        "Acessibilidade para PCD",
        "Banheiros suficientes para a quantidade prevista",
        "Gerador ou no-break em caso de queda de energia",
        "Cobertura/plano B para chuva",
        "Climatização (ar condicionado / ventilação)",
        "Suíte ou espaço para a noiva se preparar",
        "Cozinha estruturada para o buffet",
        "Horário máximo de término obrigatório?",
        "Restrição de som / decibéis após X horas?",
        "Área externa / fumódromo",
        "Permite fogos / sparklers / fumaça?",
        "Permite buffet externo?",
        "Permite bolo / doces externos?",
        "Taxa de rolha para bebidas externas?",
        "Hospedagem nos arredores para convidados",
        "Política de cancelamento (até quantos dias?)",
        "Caução exigida?",
        "Seguro de evento incluso?",
        "Mobiliário incluso (mesas, cadeiras, louça)?",
    )
}

data class GuestDemographicsSummary(
    val totalInvites: Int,
    val confirmedSeats: Int,
    val childrenCount: Int,
    val vipCount: Int,
    val padrinhosCount: Int,
    val brideSideCount: Int,
    val groomSideCount: Int,
    val bothSideCount: Int,
    val dietaryItems: List<Pair<String, String>>, // guestName to restriction
)

object GuestDemographics {
    fun analyze(activeRecords: List<PlannerRecord>): GuestDemographicsSummary {
        val guests = activeRecords.filter { it.kind == Kinds.GUEST }
        var children = 0
        var vips = 0
        var padrinhos = 0
        var bride = 0
        var groom = 0
        var both = 0
        val dietary = mutableListOf<Pair<String, String>>()
        val confirmedSeats = guests.filter { it.status == "CONFIRMED" }.sumOf { 1 + it.plusOnesConfirmed }

        guests.forEach { g ->
            if (ExtraJsonParser.optBoolean(g.extraJson, "isChild", false)) children++
            if (ExtraJsonParser.optBoolean(g.extraJson, "isVIP", false)) vips++
            if (ExtraJsonParser.optBoolean(g.extraJson, "isPadrinho", false)) padrinhos++
            when (ExtraJsonParser.optString(g.extraJson, "side", "").uppercase(Locale.ROOT)) {
                "BRIDE", "NOIVA" -> bride += 1 + g.plusOnesConfirmed
                "GROOM", "NOIVO" -> groom += 1 + g.plusOnesConfirmed
                "BOTH", "AMBOS" -> both += 1 + g.plusOnesConfirmed
            }
            val diet = ExtraJsonParser.optString(g.extraJson, "dietary", "").trim()
            if (diet.isNotEmpty()) {
                dietary.add(g.title to diet)
            }
        }
        return GuestDemographicsSummary(
            totalInvites = guests.size,
            confirmedSeats = confirmedSeats,
            childrenCount = children,
            vipCount = vips,
            padrinhosCount = padrinhos,
            brideSideCount = bride,
            groomSideCount = groom,
            bothSideCount = both,
            dietaryItems = dietary,
        )
    }
}
