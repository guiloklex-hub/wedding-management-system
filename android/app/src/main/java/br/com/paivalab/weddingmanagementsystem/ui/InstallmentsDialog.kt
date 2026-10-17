package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.InstallmentMath
import br.com.paivalab.weddingmanagementsystem.data.InstallmentPlan
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.Money
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import br.com.paivalab.weddingmanagementsystem.data.WebValues
import java.time.LocalDate

private fun optionalPercent(raw: String): Result<Double?> {
    if (raw.isBlank()) return Result.success(null)
    val value = raw.trim().replace(',', '.').toDoubleOrNull()
    return if (value != null && value in 0.0..100.0) Result.success(value) else Result.failure(IllegalArgumentException())
}

@Composable
internal fun InstallmentsDialog(
    index: RecordIndex,
    currency: String,
    language: String,
    onDismiss: () -> Unit,
    onSave: (InstallmentPlan) -> Unit,
) {
    var title by rememberSaveable { mutableStateOf("") }
    var amount by rememberSaveable { mutableStateOf("") }
    var count by rememberSaveable { mutableStateOf("2") }
    var interval by rememberSaveable { mutableStateOf("30") }
    var firstDate by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var vendorId by rememberSaveable { mutableStateOf<String?>(null) }
    var method by rememberSaveable { mutableStateOf("PIX") }
    var lateFee by rememberSaveable { mutableStateOf("") }
    var interest by rememberSaveable { mutableStateOf("") }
    var errors by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }

    val preview = remember(amount, count) {
        runCatching {
            InstallmentMath.split(Money.parseToCents(amount), count.toInt().also { require(it in 1..InstallmentMath.MAX_COUNT) })
        }.getOrNull()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.create_installments)) },
        text = {
            Column(Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                EditorTextField(title, { title = it.take(EditorLimits.NAME) }, stringResource(R.string.title), errors["title"]?.let { stringResource(it) })
                RecordPickerField(stringResource(R.string.label_vendor), vendorId, index.kind(Kinds.VENDOR), allowNone = false,
                    error = errors["vendor"]?.let { stringResource(it) }) { vendorId = it }
                EditorTextField(amount, { amount = it }, stringResource(R.string.amount), errors["amount"]?.let { stringResource(it) },
                    KeyboardType.Decimal)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    EditorTextField(count, { count = it.filter(Char::isDigit).take(2) }, stringResource(R.string.installment_count),
                        errors["count"]?.let { stringResource(it) }, KeyboardType.Number, Modifier.weight(1f))
                    EditorTextField(interval, { interval = it.filter(Char::isDigit).take(3) }, stringResource(R.string.installment_interval_days),
                        errors["interval"]?.let { stringResource(it) }, KeyboardType.Number, Modifier.weight(1f))
                }
                DatePickerOutlinedField(firstDate, { firstDate = it }, stringResource(R.string.first_due_date),
                    error = errors["date"]?.let { stringResource(it) })
                ChoiceRow(stringResource(R.string.payment_method), WebValues.paymentMethods.map { it to webValueLabel(it, language) }, method) {
                    method = it
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    EditorTextField(lateFee, { lateFee = it.take(6) }, stringResource(R.string.late_fee_percent),
                        errors["lateFee"]?.let { stringResource(it) }, KeyboardType.Decimal, Modifier.weight(1f))
                    EditorTextField(interest, { interest = it.take(6) }, stringResource(R.string.interest_percent_month),
                        errors["interest"]?.let { stringResource(it) }, KeyboardType.Decimal, Modifier.weight(1f))
                }
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
                val installmentsCount = count.toIntOrNull()?.takeIf { it in 1..InstallmentMath.MAX_COUNT }
                if (installmentsCount == null) found["count"] = R.string.err_range
                val intervalDays = interval.toIntOrNull()?.takeIf { it in 1..366 }
                if (intervalDays == null) found["interval"] = R.string.err_range
                val due = runCatching { LocalDate.parse(normalizeDateInput(firstDate)) }.getOrNull()
                if (due == null) found["date"] = R.string.err_date
                val fee = optionalPercent(lateFee).onFailure { found["lateFee"] = R.string.err_percent }.getOrNull()
                val monthly = optionalPercent(interest).onFailure { found["interest"] = R.string.err_percent }.getOrNull()
                errors = found
                if (found.isEmpty()) {
                    onSave(InstallmentPlan(vendorId!!, title.trim(), total!!, installmentsCount!!, due!!, intervalDays!!, method, fee, monthly))
                }
            }) { Text(stringResource(R.string.save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

/** Sinal pago hoje e saldo com vencimento, como o "Sinal + saldo" da web. */
@Composable
internal fun SplitPaymentDialog(
    index: RecordIndex,
    language: String,
    onDismiss: () -> Unit,
    onSave: (vendorId: String, title: String, deposit: Long, depositMethod: String, balance: Long, due: LocalDate, balanceMethod: String) -> Unit,
) {
    var title by rememberSaveable { mutableStateOf("") }
    var vendorId by rememberSaveable { mutableStateOf<String?>(null) }
    var deposit by rememberSaveable { mutableStateOf("") }
    var depositMethod by rememberSaveable { mutableStateOf("PIX") }
    var balance by rememberSaveable { mutableStateOf("") }
    var balanceMethod by rememberSaveable { mutableStateOf("PIX") }
    var dueDate by rememberSaveable { mutableStateOf("") }
    var errors by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
    val methods = WebValues.paymentMethods.map { it to webValueLabel(it, language) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.split_payment)) },
        text = {
            Column(Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                EditorTextField(title, { title = it.take(EditorLimits.NAME) }, stringResource(R.string.title), errors["title"]?.let { stringResource(it) })
                RecordPickerField(stringResource(R.string.label_vendor), vendorId, index.kind(Kinds.VENDOR), allowNone = false,
                    error = errors["vendor"]?.let { stringResource(it) }) { vendorId = it }
                SectionLabel(stringResource(R.string.split_deposit_title))
                EditorTextField(deposit, { deposit = it }, stringResource(R.string.split_deposit_amount), errors["deposit"]?.let { stringResource(it) },
                    KeyboardType.Decimal)
                ChoiceRow(stringResource(R.string.payment_method), methods, depositMethod) { depositMethod = it }
                SectionLabel(stringResource(R.string.split_balance_title))
                EditorTextField(balance, { balance = it }, stringResource(R.string.split_balance_amount), errors["balance"]?.let { stringResource(it) },
                    KeyboardType.Decimal)
                DatePickerOutlinedField(dueDate, { dueDate = it }, stringResource(R.string.split_balance_due),
                    error = errors["date"]?.let { stringResource(it) })
                ChoiceRow(stringResource(R.string.payment_method), methods, balanceMethod) { balanceMethod = it }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val found = linkedMapOf<String, Int>()
                if (title.isBlank()) found["title"] = R.string.err_required
                if (vendorId == null) found["vendor"] = R.string.err_vendor_required
                val depositCents = runCatching { Money.parseToCents(deposit) }.getOrNull()?.takeIf { it > 0L }
                if (depositCents == null) found["deposit"] = R.string.err_money
                val balanceCents = runCatching { Money.parseToCents(balance) }.getOrNull()?.takeIf { it > 0L }
                if (balanceCents == null) found["balance"] = R.string.err_money
                val due = runCatching { LocalDate.parse(normalizeDateInput(dueDate)) }.getOrNull()
                if (due == null) found["date"] = R.string.err_date
                errors = found
                if (found.isEmpty()) onSave(vendorId!!, title.trim(), depositCents!!, depositMethod, balanceCents!!, due!!, balanceMethod)
            }) { Text(stringResource(R.string.save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
}
