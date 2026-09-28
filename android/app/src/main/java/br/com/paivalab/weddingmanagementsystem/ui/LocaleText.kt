package br.com.paivalab.weddingmanagementsystem.ui

import android.content.Context
import android.content.res.Configuration
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
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
