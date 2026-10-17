package br.com.paivalab.weddingmanagementsystem.ui

import androidx.annotation.StringRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.VenueChecklist

@StringRes
fun incomeSourceLabel(source: String): Int = when (source) {
    "SALARY" -> R.string.income_source_salary
    "BONUS" -> R.string.income_source_bonus
    "GIFT" -> R.string.income_source_gift
    "FREELANCE" -> R.string.income_source_freelance
    "SALE" -> R.string.income_source_sale
    "RESTITUTION" -> R.string.income_source_restitution
    else -> R.string.income_source_other
}

/** Linha do checklist: marcar, abrir para responder ou editar, e mudar a ordem. */
@Composable
internal fun ChecklistItemRow(
    item: PlannerRecord,
    first: Boolean,
    last: Boolean,
    onToggle: (Boolean) -> Unit,
    onOpen: () -> Unit,
    onMove: (Int) -> Unit,
) {
    val checked = item.status == "DONE"
    val value = VenueChecklist.value(item)
    val checkedLabel = stringResource(R.string.checklist_checked)
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked = checked, onCheckedChange = onToggle,
            modifier = Modifier.semantics { contentDescription = "$checkedLabel: ${item.title}" })
        Column(Modifier.weight(1f).clickable(onClick = onOpen).padding(vertical = 6.dp)) {
            Text(item.title, textDecoration = if (checked) TextDecoration.LineThrough else null,
                color = if (checked) PlannerMuted else MaterialTheme.colorScheme.onSurface)
            Text(value.ifBlank { stringResource(R.string.checklist_answer) }, style = MaterialTheme.typography.bodySmall,
                color = if (value.isBlank()) PlannerChampagne else PlannerMuted)
        }
        IconButton(onClick = { onMove(-1) }, enabled = !first) {
            Icon(Icons.Default.KeyboardArrowUp, stringResource(R.string.checklist_move_up, item.title))
        }
        IconButton(onClick = { onMove(1) }, enabled = !last) {
            Icon(Icons.Default.KeyboardArrowDown, stringResource(R.string.checklist_move_down, item.title))
        }
    }
}
