package br.com.paivalab.weddingmanagementsystem.ui

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.AttachmentKinds
import br.com.paivalab.weddingmanagementsystem.data.ContractRules
import br.com.paivalab.weddingmanagementsystem.data.Money
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.VendorCategories
import java.math.BigDecimal
import java.time.LocalDate

@StringRes
fun categoryLabel(key: String): Int = when (key) {
    "VENUE" -> R.string.cat_venue
    "BUFFET" -> R.string.cat_buffet
    "BARTENDER" -> R.string.cat_bartender
    "DECOR" -> R.string.cat_decor
    "PHOTO_VIDEO" -> R.string.cat_photo_video
    "MUSIC_DJ" -> R.string.cat_music_dj
    "DRESS" -> R.string.cat_dress
    "SUIT" -> R.string.cat_suit
    "BEAUTY" -> R.string.cat_beauty
    "RINGS" -> R.string.cat_rings
    "INVITES" -> R.string.cat_invites
    "STATIONERY" -> R.string.cat_stationery
    "FAVORS" -> R.string.cat_favors
    "CAKE_SWEETS" -> R.string.cat_cake_sweets
    "TRANSPORT" -> R.string.cat_transport
    "CEREMONY" -> R.string.cat_ceremony
    "CELEBRANT" -> R.string.cat_celebrant
    "PLANNER" -> R.string.cat_planner
    "HOTEL" -> R.string.cat_hotel
    "HONEYMOON" -> R.string.cat_honeymoon
    "GIFTS" -> R.string.cat_gifts
    "INSURANCE" -> R.string.cat_insurance
    else -> R.string.cat_other
}

fun categoryColor(key: String): Color = Color(VendorCategories.colors[key] ?: VendorCategories.colors.getValue("OTHER"))

@StringRes
fun attachmentKindLabel(kind: String): Int = when (AttachmentKinds.normalize(kind)) {
    "CONTRACT" -> R.string.file_kind_contract
    "PROPOSAL" -> R.string.file_kind_proposal
    "RECEIPT" -> R.string.file_kind_receipt
    "INVOICE" -> R.string.file_kind_invoice
    "ID_DOC" -> R.string.file_kind_id_doc
    "PHOTO" -> R.string.file_kind_photo
    else -> R.string.file_kind_other
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun CategoryPicker(selected: String, labels: Map<String, String>, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(stringResource(R.string.vendor_category_key), style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            VendorCategories.keys.forEach { key ->
                FilterChip(selected = selected == key, onClick = { onSelect(key) }, label = { Text(labels[key].orEmpty()) })
            }
        }
    }
}

/**
 * Troca a situação do fornecedor. Ao contratar sem valor real, pede o valor
 * contratado (pré-preenchido com o estimado), como o `prompt` da web.
 */
@Composable
internal fun VendorStatusDialog(
    vendor: PlannerRecord,
    language: String,
    estimatedCents: Long?,
    needsActual: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (status: String, actualCents: Long?) -> Unit,
) {
    var status by rememberSaveable { mutableStateOf(vendor.status.ifBlank { "NEGOTIATION" }) }
    var actual by rememberSaveable { mutableStateOf(estimatedCents?.let { BigDecimal.valueOf(it, 2).toPlainString() }.orEmpty()) }
    var error by rememberSaveable { mutableStateOf(false) }
    val asksActual = status == "CONTRACTED" && needsActual
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.vendor_change_status, vendor.title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ChoiceRow(stringResource(R.string.status), listOf("NEGOTIATION", "CONTRACTED", "FINALIZED").map { it to statusLabel(it, language) },
                    status) { status = it }
                if (asksActual) {
                    EditorTextField(actual, { actual = it; error = false }, stringResource(R.string.vendor_contracted_value),
                        if (error) stringResource(R.string.err_money) else null, KeyboardType.Decimal)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val cents = if (asksActual) runCatching { Money.parseToCents(actual) }.getOrNull() else null
                if (asksActual && cents == null) error = true else onConfirm(status, cents)
            }) { Text(stringResource(R.string.save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

/** "Marcar assinado", com forma de assinatura e data, como na web. */
@Composable
internal fun ContractSignDialog(
    contract: PlannerRecord,
    onDismiss: () -> Unit,
    onSign: (method: String, date: LocalDate) -> Unit,
) {
    var method by rememberSaveable { mutableStateOf(ContractRules.DIGITAL) }
    var date by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var error by rememberSaveable { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.contract_sign_title, contract.title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ChoiceRow(stringResource(R.string.contract_sign_method), listOf(
                    ContractRules.DIGITAL to stringResource(R.string.status_signed_digital),
                    ContractRules.PHYSICAL to stringResource(R.string.status_signed_physical),
                ), method) { method = it }
                DatePickerOutlinedField(date, { date = it; error = false }, stringResource(R.string.contract_signed),
                    error = if (error) stringResource(R.string.err_date) else null)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val parsed = runCatching { LocalDate.parse(normalizeDateInput(date)) }.getOrNull()
                if (parsed == null) error = true else onSign(method, parsed)
            }) { Text(stringResource(R.string.contract_mark_signed)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

/** Tipo do anexo, escolhido depois do arquivo, com os valores aceitos pela web. */
@Composable
internal fun AttachmentKindDialog(fileName: String?, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var kind by rememberSaveable { mutableStateOf("OTHER") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.file_kind_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!fileName.isNullOrBlank()) Text(fileName, style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                ChoiceRow(stringResource(R.string.file_kind), AttachmentKinds.choices.map { it to stringResource(attachmentKindLabel(it)) }, kind) {
                    kind = it
                }
            }
        },
        confirmButton = { TextButton(onClick = { onConfirm(kind) }) { Text(stringResource(R.string.attach_file)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}
