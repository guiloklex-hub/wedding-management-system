package br.com.paivalab.weddingmanagementsystem.data

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

object CalendarExport {
    private val dateFormat = DateTimeFormatter.BASIC_ISO_DATE
    private val stampFormat = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC)

    fun generate(records: List<PlannerRecord>, generatedAt: Instant = Instant.now()): String {
        val events = records.filter { it.deletedAt == null && it.kind in setOf(Kinds.TASK, Kinds.PAYMENT) && it.date != null }
        return buildString {
            append("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PaivaLab//Wedding Finance Planner Android//PT\r\n")
            append("CALSCALE:GREGORIAN\r\n")
            events.forEach { record ->
                val day = runCatching { LocalDate.parse(record.date) }.getOrNull() ?: return@forEach
                append("BEGIN:VEVENT\r\nUID:").append(record.id).append("@weddingmanagementsystem.paivalab.com.br\r\n")
                append("DTSTAMP:").append(stampFormat.format(generatedAt)).append("\r\n")
                append("DTSTART;VALUE=DATE:").append(dateFormat.format(day)).append("\r\n")
                append("DTEND;VALUE=DATE:").append(dateFormat.format(day.plusDays(1))).append("\r\n")
                append("SUMMARY:").append(escape(record.title)).append("\r\n")
                if (record.notes.isNotBlank()) append("DESCRIPTION:").append(escape(record.notes)).append("\r\n")
                append("END:VEVENT\r\n")
            }
            append("END:VCALENDAR\r\n")
        }
    }

    private fun escape(value: String): String = value.replace("\\", "\\\\")
        .replace("\n", "\\n").replace("\r", "").replace(",", "\\,").replace(";", "\\;")
}
