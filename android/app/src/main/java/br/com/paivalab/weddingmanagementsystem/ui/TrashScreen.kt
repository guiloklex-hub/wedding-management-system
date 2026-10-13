package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord

/** Registros excluídos; restaurar devolve também os filhos excluídos em cascata. */
@Composable
fun TrashScreen(deleted: List<PlannerRecord>, language: String, onRestore: (PlannerRecord) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text(stringResource(R.string.trash_hint), color = PlannerMuted, style = MaterialTheme.typography.bodySmall) }
        if (deleted.isEmpty()) item { Text(stringResource(R.string.trash_empty), color = PlannerMuted, modifier = Modifier.padding(top = 12.dp)) }
        items(deleted, key = { it.id }) { record ->
            val module = modules.firstOrNull { it.kind == record.kind }
            Card(
                colors = CardDefaults.cardColors(containerColor = PlannerSurface),
                border = BorderStroke(1.dp, PlannerBorder),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(Modifier.padding(14.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(record.title, fontWeight = FontWeight.SemiBold)
                        Text(
                            listOfNotNull(module?.let { stringResource(it.title) }, record.deletedAt?.let { formatTimestamp(it, language) })
                                .joinToString(" · "),
                            color = PlannerMuted, style = MaterialTheme.typography.labelSmall,
                        )
                    }
                    TextButton(onClick = { onRestore(record) }) { Text(stringResource(R.string.restore)) }
                }
            }
        }
    }
}
