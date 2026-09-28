package br.com.paivalab.weddingmanagementsystem.data

import java.math.BigDecimal

object ReportExport {
    fun generate(records: List<PlannerRecord>, headers: List<String>, kindNames: Map<String, String>): ByteArray {
        require(headers.size == 7)
        val rows = sequenceOf(headers) + records.asSequence().filter { it.deletedAt == null }
            .sortedWith(compareBy<PlannerRecord> { it.kind }.thenBy { it.title })
            .map { record ->
                listOf(
                    kindNames[record.kind] ?: record.kind,
                    record.title,
                    record.amountCents?.let(::amount).orEmpty(),
                    record.estimatedCents?.let(::amount).orEmpty(),
                    record.date.orEmpty(),
                    record.status,
                    record.notes,
                )
            }
        return ("\uFEFF" + rows.joinToString("\r\n", postfix = "\r\n") { row ->
            row.joinToString(";") { cell ->
                val first = cell.trimStart().firstOrNull()
                val safe = if (first != null && first in "=+-@") "'$cell" else cell
                "\"${safe.replace("\"", "\"\"")}\""
            }
        }).toByteArray(Charsets.UTF_8)
    }

    private fun amount(cents: Long): String = BigDecimal.valueOf(cents, 2).toPlainString()
}
