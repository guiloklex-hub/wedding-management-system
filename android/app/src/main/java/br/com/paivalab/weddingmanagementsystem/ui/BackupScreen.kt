package br.com.paivalab.weddingmanagementsystem.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.backup.BackupArchive
import br.com.paivalab.weddingmanagementsystem.backup.BackupPreview
import java.time.LocalDate
import kotlinx.coroutines.launch

@Composable
fun BackupScreen(archive: BackupArchive, language: String, authenticate: ((() -> Unit)?) -> Unit,
                 onRestored: () -> Unit) {
    val scope = rememberCoroutineScope()
    val createdMessage = localized(R.string.backup_created, language)
    val restoredMessage = localized(R.string.backup_restored, language)
    val failedMessage = localized(R.string.backup_failed, language)
    var password by remember { mutableStateOf("") }
    var repeated by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf<Pair<Uri, BackupPreview>?>(null) }
    var hasReversal by remember { mutableStateOf(false) }

    LaunchedEffect(archive) { hasReversal = archive.hasReversal() }

    val export = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        if (uri != null) scope.launch {
            busy = true
            val secret = password.toCharArray()
            try {
                archive.export(uri, secret)
                message = createdMessage
                password = ""
                repeated = ""
            } catch (_: Exception) {
                message = failedMessage
            } finally {
                secret.fill('\u0000')
                busy = false
            }
        }
    }
    val import = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) scope.launch {
            busy = true
            val secret = password.toCharArray()
            try {
                pending = uri to archive.inspect(uri, secret)
                message = ""
            } catch (_: Exception) {
                message = failedMessage
            } finally {
                secret.fill('\u0000')
                busy = false
            }
        }
    }
    val reversal = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        if (uri != null) scope.launch {
            busy = true
            val secret = password.toCharArray()
            try {
                archive.exportLastReversal(uri, secret)
                message = createdMessage
            } catch (_: Exception) { message = failedMessage }
            finally { secret.fill('\u0000'); busy = false }
        }
    }

    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(localized(R.string.backup_password_hint, language))
        OutlinedTextField(password, { password = it },
            label = { Text(localized(R.string.backup_password, language)) },
            visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(repeated, { repeated = it },
            label = { Text(localized(R.string.backup_password_repeat, language)) },
            visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        Button(enabled = !busy && password.length >= 12 && password == repeated,
            onClick = { authenticate { export.launch("wedding-finance-${LocalDate.now()}.wfpbackup") } }) {
            Text(localized(R.string.backup_export, language))
        }
        Button(enabled = !busy && password.isNotEmpty(), onClick = { import.launch(arrayOf("*/*")) }) {
            Text(localized(R.string.backup_import, language))
        }
        if (hasReversal) Button(enabled = !busy && password.length >= 12 && password == repeated,
            onClick = { authenticate { reversal.launch("wedding-finance-reversal-${LocalDate.now()}.wfpbackup") } }) {
            Text(localized(R.string.backup_export_reversal, language))
        }
        if (busy) CircularProgressIndicator()
        if (message.isNotEmpty()) Text(message)
    }

    pending?.let { (uri, preview) ->
        AlertDialog(
            onDismissRequest = { pending = null },
            title = { Text(localized(R.string.backup_replace_warning, language)) },
            text = { Text((if (preview.complete) localized(R.string.backup_complete_preview, language)
                else localized(R.string.backup_partial_preview, language))
                .replace("{records}", preview.records.toString())
                .replace("{files}", preview.files.toString())
                .replace("{tables}", preview.webTables.toString()) + "\n" +
                localized(R.string.backup_preview_details, language)
                    .replace("{areas}", preview.areas.entries.joinToString { "${it.key}: ${it.value}" })
                    .replace("{bytes}", preview.requiredBytes.toString())
                    .replace("{changed}", preview.changed.toString())
                    .replace("{created}", preview.created.toString())
                    .replace("{deleted}", preview.deleted.toString())) },
            confirmButton = { TextButton(onClick = {
                pending = null
                authenticate {
                    scope.launch {
                        busy = true
                        val secret = password.toCharArray()
                        try {
                            archive.restore(uri, secret)
                            hasReversal = true
                            onRestored()
                            message = restoredMessage
                            password = ""
                            repeated = ""
                        } catch (_: Exception) {
                            message = failedMessage
                        } finally {
                            secret.fill('\u0000')
                            busy = false
                        }
                    }
                }
            }) { Text(localized(R.string.backup_import, language)) } },
            dismissButton = { TextButton(onClick = { pending = null }) { Text(localized(R.string.cancel, language)) } },
        )
    }
}
