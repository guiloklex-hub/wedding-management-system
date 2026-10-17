package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.GiftRules
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import java.time.LocalDate

/** Lançar presente em dinheiro como receita ou ativo, como o diálogo "Converter" da web. */
@Composable
internal fun GiftPostDialog(
    gift: PlannerRecord,
    index: RecordIndex,
    currency: String,
    language: String,
    onDismiss: () -> Unit,
    onPost: (targetKind: String, title: String, date: LocalDate, notes: String) -> Unit,
) {
    val giver = GiftRules.giver(gift, index) ?: stringResource(R.string.gift_anonymous)
    val defaultTitle = stringResource(R.string.gift_post_default_title, giver)
    val notes = stringResource(R.string.gift_post_notes, gift.title)
    var target by rememberSaveable { mutableStateOf(Kinds.INCOME) }
    var title by rememberSaveable { mutableStateOf(defaultTitle) }
    var date by rememberSaveable { mutableStateOf(gift.date ?: LocalDate.now().toString()) }
    var titleError by rememberSaveable { mutableStateOf(false) }
    var dateError by rememberSaveable { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.gift_post_title)) },
        text = {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.gift_post_amount, localizedCurrency(gift.amountCents ?: 0L, currency, language)),
                    style = MaterialTheme.typography.titleSmall)
                ChoiceRow(stringResource(R.string.gift_post_as), listOf(Kinds.INCOME to stringResource(R.string.income),
                    Kinds.ASSET to stringResource(R.string.assets)), target) { target = it }
                EditorTextField(title, { title = it.take(EditorLimits.NAME); titleError = false }, stringResource(R.string.title),
                    if (titleError) stringResource(R.string.err_required) else null)
                DatePickerOutlinedField(date, { date = it; dateError = false }, stringResource(R.string.date),
                    error = if (dateError) stringResource(R.string.err_date) else null)
                Text(stringResource(R.string.gift_post_once), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val parsed = runCatching { LocalDate.parse(normalizeDateInput(date)) }.getOrNull()
                titleError = title.isBlank()
                dateError = parsed == null
                if (!titleError && parsed != null) onPost(target, title.trim(), parsed, notes)
            }) { Text(stringResource(R.string.post_gift)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

/** Escolhe exatamente quem pertence ao grupo, como "Gerenciar integrantes" da web. */
@Composable
internal fun GroupMembersDialog(
    group: PlannerRecord,
    index: RecordIndex,
    onDismiss: () -> Unit,
    onSave: (Set<String>) -> Unit,
) {
    var selected by rememberSaveable { mutableStateOf(index.groupMembers(group.id).map { it.id }.toSet()) }
    var query by rememberSaveable { mutableStateOf("") }
    val guests = index.kind(Kinds.GUEST)
        .filter { query.isBlank() || it.title.contains(query.trim(), ignoreCase = true) }
        .sortedWith(compareByDescending<PlannerRecord> { it.id in selected }.thenBy { it.title.lowercase() })

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.group_members_title, group.title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                EditorTextField(query, { query = it.take(EditorLimits.NAME) }, stringResource(R.string.search), null)
                Text(plural(R.plurals.group_members_selected, selected.size, selected.size), style = MaterialTheme.typography.labelMedium,
                    color = PlannerMuted)
                LazyColumn(Modifier.heightIn(max = 360.dp)) {
                    if (guests.isEmpty()) item { Text(stringResource(R.string.empty_filtered), color = PlannerMuted) }
                    items(guests, key = { it.id }) { guest ->
                        val checked = guest.id in selected
                        val otherGroup = index.find(guest.guestGroupId)?.takeIf { it.id != group.id }
                        Row(
                            Modifier.fillMaxWidth().heightIn(min = 48.dp).toggleable(checked, role = Role.Checkbox) {
                                selected = if (it) selected + guest.id else selected - guest.id
                            },
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Checkbox(checked = checked, onCheckedChange = null)
                            Column(Modifier.weight(1f).padding(start = 8.dp)) {
                                Text(guest.title)
                                if (otherGroup != null) {
                                    Text(stringResource(if (checked) R.string.group_members_moves_from else R.string.group_members_in,
                                        otherGroup.title), style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = { onSave(selected) }) { Text(stringResource(R.string.save)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}
