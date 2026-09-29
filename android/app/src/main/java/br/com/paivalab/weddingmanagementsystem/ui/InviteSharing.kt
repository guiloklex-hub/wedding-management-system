package br.com.paivalab.weddingmanagementsystem.ui

import android.app.Activity
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord

internal fun inviteMessage(template: PlannerRecord, guest: PlannerRecord): String =
    (template.notes.ifBlank { template.subtitle.ifBlank { template.title } })
        .replace("{nome}", guest.title).replace("{name}", guest.title)

internal fun openInviteWhatsApp(activity: Activity, template: PlannerRecord, guest: PlannerRecord): Boolean = runCatching {
    val number = guest.phone.filter { it.isDigit() }
    require(number.isNotBlank())
    val uri = Uri.parse("https://wa.me/$number?text=${Uri.encode(inviteMessage(template, guest))}")
    activity.startActivity(Intent(Intent.ACTION_VIEW, uri))
    true
}.getOrDefault(false)

internal fun shareInviteText(activity: Activity, template: PlannerRecord, guest: PlannerRecord): Boolean = runCatching {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, inviteMessage(template, guest))
    }
    activity.startActivity(Intent.createChooser(intent, guest.title))
    true
}.getOrDefault(false)

internal fun shareInviteAttachment(
    activity: Activity,
    template: PlannerRecord,
    guest: PlannerRecord,
    file: PlannerFile,
    uri: Uri,
    whatsapp: Boolean,
): String? {
    val intent = buildInviteAttachmentIntent(activity, template, guest, file, uri)
    if (whatsapp) {
        for (packageName in listOf("com.whatsapp", "com.whatsapp.w4b")) {
            if (runCatching { activity.startActivity(Intent(intent).setPackage(packageName)) }.isSuccess) {
                return "WHATSAPP"
            }
        }
    }
    return if (runCatching { activity.startActivity(Intent.createChooser(intent, guest.title)) }.isSuccess) {
        "SHARE"
    } else null
}

internal fun buildInviteAttachmentIntent(
    context: Context,
    template: PlannerRecord,
    guest: PlannerRecord,
    file: PlannerFile,
    uri: Uri,
): Intent = Intent(Intent.ACTION_SEND).apply {
        type = file.mimeType.ifBlank { "application/octet-stream" }
        putExtra(Intent.EXTRA_TEXT, inviteMessage(template, guest))
        putExtra(Intent.EXTRA_STREAM, uri)
        clipData = ClipData.newUri(context.contentResolver, file.fileName, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
}
