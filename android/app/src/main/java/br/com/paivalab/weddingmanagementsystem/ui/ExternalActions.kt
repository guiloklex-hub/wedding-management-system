package br.com.paivalab.weddingmanagementsystem.ui

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import br.com.paivalab.weddingmanagementsystem.data.ExtraFields
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord

internal fun openWhatsApp(activity: Activity, record: PlannerRecord): Boolean {
    val number = record.phone.filter { it.isDigit() }
    if (number.isBlank()) return false
    return runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$number"))) }.isSuccess
}

internal fun dialPhone(activity: Activity, phone: String): Boolean {
    val number = phone.filter { it.isDigit() || it == '+' }
    if (number.isBlank()) return false
    return runCatching { activity.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))) }.isSuccess
}

internal fun openMap(activity: Activity, record: PlannerRecord): Boolean {
    val details = ExtraFields.parse(record.extraJson)
    val mapsUrl = Uri.parse(ExtraFields.text(details, "mapsUrl"))
    if (mapsUrl.scheme in listOf("http", "https") &&
        runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, mapsUrl)) }.isSuccess) return true
    val query = ExtraFields.text(details, "address").ifBlank { record.title }
    val geo = Uri.parse("geo:0,0?q=${Uri.encode(query)}")
    if (runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, geo)) }.isSuccess) return true
    val web = Uri.parse("https://www.google.com/maps/search/?api=1&query=${Uri.encode(query)}")
    return runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, web)) }.isSuccess
}

internal fun openLink(activity: Activity, url: String): Boolean {
    val uri = Uri.parse(url)
    if (uri.scheme !in listOf("http", "https")) return false
    return runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, uri)) }.isSuccess
}

/** Abre o anexo no app padrão do sistema com permissão temporária de leitura. */
internal fun viewFile(activity: Activity, file: PlannerFile, uri: Uri): Boolean {
    val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, file.mimeType.ifBlank { "application/octet-stream" })
        clipData = ClipData.newUri(activity.contentResolver, file.fileName, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    return runCatching { activity.startActivity(intent) }.isSuccess
}
