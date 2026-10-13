package br.com.paivalab.weddingmanagementsystem.ui

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.Money
import br.com.paivalab.weddingmanagementsystem.data.PixBrCode
import br.com.paivalab.weddingmanagementsystem.data.QrCodeMatrix
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

@Composable
fun PixQrDialog(
    activity: Activity,
    pixKey: String,
    pixHolderName: String,
    pixCity: String,
    initialAmountCents: Long? = null,
    transactionId: String? = null,
    language: String,
    onDismiss: () -> Unit,
    onNotify: (String) -> Unit,
) {
    var customAmountText by remember(transactionId, initialAmountCents) {
        mutableStateOf(initialAmountCents?.let { String.format("%.2f", it / 100.0) } ?: "")
    }
    val parsedCents = remember(customAmountText) {
        if (customAmountText.isBlank()) null else runCatching { Money.parseToCents(customAmountText) }.getOrNull()
    }
    val brCode = remember(pixKey, pixHolderName, pixCity, parsedCents, transactionId) {
        if (pixKey.isBlank()) "" else runCatching {
            PixBrCode.generate(
                key = pixKey,
                merchantName = pixHolderName.ifBlank { "Casamento" },
                merchantCity = pixCity.ifBlank { "SAO PAULO" },
                amountCents = parsedCents,
                txid = transactionId,
            )
        }.getOrElse { "" }
    }
    val copiedMessage = stringResource(R.string.pix_copied)
    val shareTemplate = stringResource(R.string.pix_share_text)
    val shareTitle = stringResource(R.string.share_pix)
    val matrix = remember(brCode) {
        if (brCode.isNotBlank()) runCatching { QrCodeMatrix.encode(brCode) }.getOrNull() else null
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(stringResource(R.string.pix_dialog_title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(stringResource(R.string.pix_dialog_subtitle), style = MaterialTheme.typography.labelSmall, color = PlannerChampagne)
            }
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                if (pixKey.isBlank()) {
                    Text(localized(R.string.pix_key_missing, language), color = MaterialTheme.colorScheme.error)
                }
                if (matrix != null) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(2.dp, PlannerChampagne),
                        modifier = Modifier.size(204.dp),
                    ) {
                        Box(Modifier.fillMaxSize().padding(12.dp), contentAlignment = Alignment.Center) {
                            Canvas(modifier = Modifier.fillMaxSize()) {
                                val n = matrix.size
                                val cell = size.minDimension / n
                                for (r in 0 until n) {
                                    for (c in 0 until n) {
                                        if (matrix[r][c]) {
                                            drawRect(
                                                color = Color(0xFF111115),
                                                topLeft = Offset(c * cell, r * cell),
                                                size = Size(cell + 0.6f, cell + 0.6f),
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    InfoBadge(stringResource(R.string.pix_key_value, pixKey.ifBlank { stringResource(R.string.not_configured) }), PlannerChampagne)
                    Text(
                        stringResource(R.string.pix_receiver_value, pixHolderName, pixCity),
                        style = MaterialTheme.typography.labelSmall,
                        color = PlannerMuted,
                    )
                }

                OutlinedTextField(
                    value = customAmountText,
                    onValueChange = { customAmountText = it },
                    label = { Text(stringResource(R.string.pix_amount_optional)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                )

                if (brCode.isNotBlank()) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = PlannerRaised),
                        border = BorderStroke(1.dp, PlannerBorder),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(stringResource(R.string.pix_copy_paste_code), style = MaterialTheme.typography.labelSmall, color = PlannerEmerald)
                            Text(
                                brCode,
                                style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }

                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                clipboard.setPrimaryClip(ClipData.newPlainText("Pix Copia e Cola", brCode))
                                onNotify(copiedMessage)
                            },
                            modifier = Modifier.weight(1f),
                        ) {
                            Text(stringResource(R.string.copy_code))
                        }
                        OutlinedButton(
                            onClick = {
                                val msg = shareTemplate.format(pixHolderName, pixKey, brCode)
                                activity.startActivity(
                                    Intent.createChooser(
                                        Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, msg),
                                        shareTitle,
                                    ),
                                )
                            },
                            modifier = Modifier.weight(1f),
                        ) {
                            Text(stringResource(R.string.share))
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.close)) }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DatePickerOutlinedField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    error: String? = null,
) {
    var openPicker by rememberSaveable { mutableStateOf(false) }

    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = { Text(stringResource(R.string.date_placeholder)) },
        singleLine = true,
        isError = error != null,
        supportingText = error?.let { { Text(it) } },
        trailingIcon = {
            IconButton(onClick = { openPicker = true }) {
                Icon(Icons.Default.CalendarMonth, contentDescription = stringResource(R.string.pick_date), tint = PlannerChampagne)
            }
        },
        modifier = modifier.fillMaxWidth(),
    )

    if (openPicker) {
        val initialMillis = remember(value) {
            val normalized = normalizeDateInput(value)
            runCatching {
                LocalDate.parse(normalized).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
            }.getOrNull() ?: System.currentTimeMillis()
        }
        val pickerState = rememberDatePickerState(initialSelectedDateMillis = initialMillis)
        DatePickerDialog(
            onDismissRequest = { openPicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        pickerState.selectedDateMillis?.let { millis ->
                            val picked = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()
                            onValueChange(picked.toString())
                        }
                        openPicker = false
                    },
                ) {
                    Text(stringResource(R.string.select))
                }
            },
            dismissButton = {
                TextButton(onClick = { openPicker = false }) {
                    Text(stringResource(R.string.cancel))
                }
            },
        ) {
            DatePicker(state = pickerState)
        }
    }
}
