package br.com.paivalab.weddingmanagementsystem.ui

import android.content.Context
import android.content.res.Configuration
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun localized(@StringRes id: Int, language: String): String = localizedText(LocalContext.current, id, language)

fun localizedText(context: Context, @StringRes id: Int, language: String): String {
    val configuration = Configuration(context.resources.configuration)
    configuration.setLocale(Locale.forLanguageTag(language))
    return context.createConfigurationContext(configuration).getString(id)
}

fun localizedCurrency(cents: Long, currency: String, language: String): String {
    val format = java.text.NumberFormat.getCurrencyInstance(Locale.forLanguageTag(language))
    format.currency = java.util.Currency.getInstance(currency)
    return format.format(java.math.BigDecimal.valueOf(cents, 2))
}

fun formatDisplayDate(dateStr: String?, language: String): String {
    if (dateStr.isNullOrBlank()) return ""
    return runCatching {
        val date = LocalDate.parse(dateStr.trim())
        val pattern = if (language.startsWith("en")) "MMM dd, yyyy" else "dd/MM/yyyy"
        date.format(DateTimeFormatter.ofPattern(pattern, Locale.forLanguageTag(language)))
    }.getOrDefault(dateStr)
}

fun formatYearMonth(ymStr: String, language: String): String {
    return runCatching {
        val ym = YearMonth.parse(ymStr.trim())
        val formatted = ym.format(DateTimeFormatter.ofPattern("MMM / yyyy", Locale.forLanguageTag(language)))
        formatted.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.forLanguageTag(language)) else it.toString() }
    }.getOrDefault(ymStr)
}

fun formatTimestamp(epochMillis: Long, language: String): String {
    return runCatching {
        val pattern = if (language.startsWith("en")) "MMM dd, yyyy HH:mm" else "dd/MM/yyyy HH:mm"
        DateTimeFormatter.ofPattern(pattern, Locale.forLanguageTag(language))
            .withZone(ZoneId.systemDefault())
            .format(Instant.ofEpochMilli(epochMillis))
    }.getOrDefault("")
}

fun normalizeDateInput(input: String): String {
    val trimmed = input.trim()
    if (trimmed.isBlank()) return ""
    if (Regex("""^\d{2}/\d{2}/\d{4}$""").matches(trimmed)) {
        val parts = trimmed.split("/")
        return "${parts[2]}-${parts[1]}-${parts[0]}"
    }
    return trimmed
}
