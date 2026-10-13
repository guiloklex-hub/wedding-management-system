package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.InstallmentMath
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.Money
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import java.time.LocalDate

@Composable
internal fun InstallmentsDialog(
    index: RecordIndex,
    currency: String,
    language: String,
    onDismiss: () -> Unit,
    onSave: (String, String, Long, Int, LocalDate) -> Unit,
) {
    var title by rememberSaveable { mutableStateOf("") }
    var amount by rememberSaveable { mutableStateOf("") }
    var count by rememberSaveable { mutableStateOf("2") }
    var firstDate by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var vendorId by rememberSaveable { mutableStateOf<String?>(null) }
    var errors by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }

    val preview = remember(amount, count) {
        runCatching { InstallmentMath.split(Money.parseToCents(amount), count.toInt().also { require(it in 1..120) }) }.getOrNull()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.create_installments)) },
        text = {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                EditorTextField(title, { title = it.take(EditorLimits.NAME) }, stringResource(R.string.title), errors["title"]?.let { stringResource(it) })
                RecordPickerField(stringResource(R.string.vendors), vendorId, index.kind(Kinds.VENDOR), allowNone = false,
                    error = errors["vendor"]?.let { stringResource(it) }) { vendorId = it }
                EditorTextField(amount, { amount = it }, stringResource(R.string.amount), errors["amount"]?.let { stringResource(it) },
                    KeyboardType.Decimal)
                EditorTextField(count, { count = it.filter(Char::isDigit).take(3) }, stringResource(R.string.installment_count),
                    errors["count"]?.let { stringResource(it) }, KeyboardType.Number)
                DatePickerOutlinedField(firstDate, { firstDate = it }, stringResource(R.string.first_due_date),
                    error = errors["date"]?.let { stringResource(it) })
                if (!preview.isNullOrEmpty()) {
                    InfoBadge(stringResource(R.string.installments_preview, preview.size, localizedCurrency(preview.first(), currency, language)),
                        PlannerEmerald)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val found = linkedMapOf<String, Int>()
                if (title.isBlank()) found["title"] = R.string.err_required
                if (vendorId == null) found["vendor"] = R.string.err_vendor_required
                val total = runCatching { Money.parseToCents(amount) }.getOrNull()
                if (total == null || total <= 0L) found["amount"] = R.string.err_money
                val installmentsCount = count.toIntOrNull()?.takeIf { it in 1..120 }
                if (installmentsCount == null) found["count"] = R.string.err_range
                val due = runCatching { LocalDate.parse(normalizeDateInput(firstDate)) }.getOrNull()
                if (due == null) found["date"] = R.string.err_date
                errors = found
                if (found.isEmpty()) onSave(vendorId!!, title.trim(), total!!, installmentsCount!!, due!!)
            }) { Text(stringResource(R.string.save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}
