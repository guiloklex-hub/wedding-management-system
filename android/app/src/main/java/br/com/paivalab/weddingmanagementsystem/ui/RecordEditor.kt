package br.com.paivalab.weddingmanagementsystem.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import br.com.paivalab.weddingmanagementsystem.data.WebValues
import kotlinx.serialization.json.Json

private val formSaver = Saver<EditorFormState, String>(
    save = { Json.encodeToString(EditorFormState.serializer(), it) },
    restore = { Json.decodeFromString(EditorFormState.serializer(), it) },
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun RecordEditorScreen(
    module: ModuleDefinition,
    initial: PlannerRecord?,
    initialParentId: String?,
    index: RecordIndex,
    language: String,
    onClose: () -> Unit,
    onSave: (PlannerRecord) -> Unit,
    onDelete: (PlannerRecord) -> Unit,
) {
    val original = remember(initial?.id, module.kind) { editorFormFrom(module, initial, initialParentId) }
    var form by rememberSaveable(initial?.id, module.kind, stateSaver = formSaver) { mutableStateOf(original) }
    var errors by remember { mutableStateOf<Map<EditorField, Int>>(emptyMap()) }
    var confirmDiscard by rememberSaveable { mutableStateOf(false) }
    val dirty = form != original
    val close = { if (dirty) confirmDiscard = true else onClose() }
    BackHandler(onBack = close)

    fun update(change: EditorFormState.() -> EditorFormState) { form = form.change() }
    @Composable fun error(field: EditorField): String? = errors[field]?.let { stringResource(it) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(if (initial == null) R.string.add else R.string.edit) + " · " + stringResource(module.title),
                        maxLines = 1,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = close) { Icon(Icons.Default.Close, stringResource(R.string.cancel)) }
                },
                actions = {
                    if (initial != null) {
                        IconButton(onClick = { onDelete(initial) }) { Icon(Icons.Default.Delete, stringResource(R.string.delete)) }
                    }
                    TextButton(onClick = {
                        when (val outcome = buildEditorRecord(module, form, initial, index)) {
                            is EditorOutcome.Valid -> onSave(outcome.record)
                            is EditorOutcome.Invalid -> errors = outcome.errors
                        }
                    }) { Text(stringResource(R.string.save), fontWeight = FontWeight.SemiBold) }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = PlannerBackground),
            )
        },
        containerColor = PlannerBackground,
    ) { inner ->
        Column(
            Modifier.fillMaxSize().padding(inner).imePadding().verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp).widthIn(max = 720.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (errors.isNotEmpty()) {
                Text(stringResource(R.string.invalid_fields), color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
            }
            EditorTextField(form.title, { update { copy(title = it.take(EditorLimits.NAME)) } },
                stringResource(R.string.title), error(EditorField.TITLE))
            EditorTextField(form.subtitle, { update { copy(subtitle = it.take(EditorLimits.SHORT_TEXT)) } },
                stringResource(if (module.kind == Kinds.VENDOR) R.string.category else R.string.subtitle), error(EditorField.SUBTITLE))
            if (module.kind in setOf(Kinds.BUDGET, Kinds.TROUSSEAU)) {
                EditorTextField(form.estimated, { update { copy(estimated = it) } }, stringResource(R.string.report_estimated),
                    error(EditorField.ESTIMATED), KeyboardType.Decimal)
            }
            if (module.hasAmount) {
                EditorTextField(
                    form.amount, { update { copy(amount = it) } },
                    stringResource(when (module.kind) {
                        Kinds.TABLE -> R.string.capacity
                        Kinds.BUDGET, Kinds.TROUSSEAU -> R.string.budget_actual
                        else -> R.string.amount
                    }),
                    error(EditorField.AMOUNT), if (module.kind == Kinds.TABLE) KeyboardType.Number else KeyboardType.Decimal,
                )
            }
            if (module.hasDate) {
                DatePickerOutlinedField(form.date, { update { copy(date = it) } }, stringResource(R.string.date),
                    error = error(EditorField.DATE))
            }
            if (module.kind == Kinds.INCOME) {
                ChoiceRow(stringResource(R.string.frequency), listOf("ONE_TIME" to R.string.one_time, "MONTHLY" to R.string.monthly)
                    .map { it.first to stringResource(it.second) }, form.incomeFrequency) { update { copy(incomeFrequency = it) } }
            }
            if (module.statuses.isNotEmpty()) {
                ChoiceRow(stringResource(R.string.status), module.statuses.map { it to statusLabel(it, language) }, form.status) {
                    update { copy(status = it) }
                }
            }
            if (module.parentKind != null) {
                val parentModule = modules.first { it.kind == module.parentKind }
                RecordPickerField(
                    label = stringResource(parentModule.title),
                    selectedId = form.parentId,
                    options = index.kind(module.parentKind),
                    allowNone = module.kind != Kinds.PAYMENT,
                    error = error(EditorField.PARENT),
                ) { update { copy(parentId = it) } }
            }
            if (module.kind == Kinds.PAYMENT) {
                ChoiceRow(stringResource(R.string.payment_method), WebValues.paymentMethods.map { it to webValueLabel(it, language) },
                    form.paymentMethod, allowNone = true) { update { copy(paymentMethod = it) } }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    EditorTextField(form.lateFeePercent, { update { copy(lateFeePercent = it.take(6)) } },
                        stringResource(R.string.late_fee_percent), error(EditorField.LATE_FEE), KeyboardType.Decimal, Modifier.weight(1f))
                    EditorTextField(form.interestPercentPerMonth, { update { copy(interestPercentPerMonth = it.take(6)) } },
                        stringResource(R.string.interest_percent_month), error(EditorField.INTEREST), KeyboardType.Decimal, Modifier.weight(1f))
                }
            }
            if (module.kind == Kinds.HONEYMOON_ITEM) {
                ChoiceRow(stringResource(R.string.honeymoon_item_kind), WebValues.honeymoonItemKinds.map { it to honeymoonKindLabel(it) },
                    form.honeymoonItemKind) { update { copy(honeymoonItemKind = it) } }
                EditorTextField(form.honeymoonConfirmation, { update { copy(honeymoonConfirmation = it.take(EditorLimits.NAME)) } },
                    stringResource(R.string.booking_code_label), null)
            }
            if (module.kind == Kinds.TROUSSEAU) {
                ChoiceRow(stringResource(R.string.trousseau_room), WebValues.trousseauRooms.map { it to webValueLabel(it, language) },
                    form.trousseauRoom) { update { copy(trousseauRoom = it) } }
                EditorTextField(form.trousseauStore, { update { copy(trousseauStore = it.take(EditorLimits.NAME)) } },
                    stringResource(R.string.store), null)
            }
            if (module.kind == Kinds.TASK) {
                EditorTextField(form.taskResponsible, { update { copy(taskResponsible = it.take(EditorLimits.NAME)) } },
                    stringResource(R.string.task_responsible), null)
                RecordPickerField(stringResource(R.string.venues), form.taskVenueId, index.kind(Kinds.VENUE), allowNone = true) {
                    update { copy(taskVenueId = it) }
                }
            }
            if (module.kind in setOf(Kinds.TASK, Kinds.TROUSSEAU)) {
                val priorities = if (module.kind == Kinds.TASK) WebValues.taskPriorities else WebValues.trousseauPriorities
                ChoiceRow(stringResource(R.string.priority), priorities.map { it to webValueLabel(it, language) }, form.itemPriority) {
                    update { copy(itemPriority = it) }
                }
            }
            if (module.hasContact) {
                EditorTextField(form.phone, { update { copy(phone = it.take(EditorLimits.PHONE)) } }, stringResource(R.string.phone),
                    error(EditorField.PHONE), KeyboardType.Phone)
                EditorTextField(form.email, { update { copy(email = it.take(EditorLimits.EMAIL)) } }, stringResource(R.string.email),
                    error(EditorField.EMAIL), KeyboardType.Email)
            }
            if (module.kind == Kinds.VENUE) {
                EditorTextField(form.venueAddress, { update { copy(venueAddress = it.take(EditorLimits.TEXT)) } }, stringResource(R.string.address), null)
                EditorTextField(form.venueMapsUrl, { update { copy(venueMapsUrl = it.take(EditorLimits.URL)) } },
                    stringResource(R.string.venue_maps_url), error(EditorField.MAPS_URL), KeyboardType.Uri)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    EditorTextField(form.venueCapacitySeated, { update { copy(venueCapacitySeated = it.filter(Char::isDigit).take(6)) } },
                        stringResource(R.string.venue_capacity_seated), error(EditorField.CAPACITY_SEATED), KeyboardType.Number, Modifier.weight(1f))
                    EditorTextField(form.venueCapacityStanding, { update { copy(venueCapacityStanding = it.filter(Char::isDigit).take(6)) } },
                        stringResource(R.string.venue_capacity_standing), error(EditorField.CAPACITY_STANDING), KeyboardType.Number, Modifier.weight(1f))
                }
                EditorTextField(form.venueContactName, { update { copy(venueContactName = it.take(EditorLimits.NAME)) } },
                    stringResource(R.string.venue_contact_name), null)
                EditorTextField(form.venuePricingNotes, { update { copy(venuePricingNotes = it.take(EditorLimits.LONG_TEXT)) } },
                    stringResource(R.string.venue_pricing), null, singleLine = false)
                EditorTextField(form.venueRestrictions, { update { copy(venueRestrictions = it.take(EditorLimits.LONG_TEXT)) } },
                    stringResource(R.string.venue_restrictions), null, singleLine = false)
                EditorTextField(form.venuePros, { update { copy(venuePros = it.take(EditorLimits.LONG_TEXT)) } },
                    stringResource(R.string.venue_pros), null, singleLine = false)
                EditorTextField(form.venueCons, { update { copy(venueCons = it.take(EditorLimits.LONG_TEXT)) } },
                    stringResource(R.string.venue_cons), null, singleLine = false)
                ToggleChip(stringResource(R.string.venue_shortlisted), form.venueShortlisted) { update { copy(venueShortlisted = it) } }
            }
            if (module.kind == Kinds.VENDOR) {
                RatingInput(form.rating) { update { copy(rating = it) } }
                EditorTextField(form.vendorIndicatedBy, { update { copy(vendorIndicatedBy = it.take(EditorLimits.NAME)) } },
                    stringResource(R.string.indicated_by), null)
                EditorTextField(form.vendorTags, { update { copy(vendorTags = it.take(EditorLimits.TEXT)) } }, stringResource(R.string.tags), null)
                EditorTextField(form.vendorContractLink, { update { copy(vendorContractLink = it.take(EditorLimits.URL)) } },
                    stringResource(R.string.contract_link), error(EditorField.CONTRACT_LINK), KeyboardType.Uri)
            }
            if (module.kind == Kinds.CONTRACT) {
                EditorTextField(form.contractVersion, { update { copy(contractVersion = it.filter(Char::isDigit).take(3)) } },
                    stringResource(R.string.contract_version), error(EditorField.CONTRACT_VERSION), KeyboardType.Number)
                DatePickerOutlinedField(form.contractExpiresAt, { update { copy(contractExpiresAt = it) } },
                    stringResource(R.string.contract_expires), error = error(EditorField.CONTRACT_EXPIRES))
                EditorTextField(form.contractPaymentTerms, { update { copy(contractPaymentTerms = it.take(EditorLimits.LONG_TEXT)) } },
                    stringResource(R.string.payment_terms), null, singleLine = false)
                EditorTextField(form.contractCancellationPolicy, { update { copy(contractCancellationPolicy = it.take(EditorLimits.LONG_TEXT)) } },
                    stringResource(R.string.cancellation_policy), null, singleLine = false)
                EditorTextField(form.contractIncludedItems, { update { copy(contractIncludedItems = it.take(EditorLimits.LONG_TEXT)) } },
                    stringResource(R.string.included_items), null, singleLine = false)
                EditorTextField(form.contractExcludedItems, { update { copy(contractExcludedItems = it.take(EditorLimits.LONG_TEXT)) } },
                    stringResource(R.string.excluded_items), null, singleLine = false)
            }
            if (module.kind == Kinds.CONTACT) {
                EditorTextField(form.contactRole, { update { copy(contactRole = it.take(EditorLimits.NAME)) } }, stringResource(R.string.contact_role), null)
                ToggleChip(stringResource(R.string.primary_contact), form.contactPrimary) { update { copy(contactPrimary = it) } }
            }
            if (module.kind == Kinds.GUEST) {
                ChoiceRow(stringResource(R.string.guest_side), WebValues.guestSides.map { it to webValueLabel(it, language) },
                    form.guestSide, allowNone = true) { update { copy(guestSide = it) } }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    ToggleChip(stringResource(R.string.guest_vip), form.guestIsVip) { update { copy(guestIsVip = it) } }
                    ToggleChip(stringResource(R.string.guest_padrinho), form.guestIsPadrinho) { update { copy(guestIsPadrinho = it) } }
                    ToggleChip(stringResource(R.string.guest_child), form.guestIsChild) { update { copy(guestIsChild = it) } }
                }
                EditorTextField(form.guestDietary, { update { copy(guestDietary = it.take(EditorLimits.TEXT)) } },
                    stringResource(R.string.guest_dietary), null, placeholder = stringResource(R.string.guest_dietary_hint))
                EditorTextField(form.guestCity, { update { copy(guestCity = it.take(EditorLimits.NAME)) } }, stringResource(R.string.guest_city), null)
                RecordPickerField(stringResource(R.string.groups), form.guestGroupId, index.kind(Kinds.GROUP), allowNone = true) {
                    update { copy(guestGroupId = it) }
                }
                val tags = index.kind(Kinds.TAG).sortedBy { it.title.lowercase() }
                if (tags.isNotEmpty()) {
                    Text(stringResource(R.string.tags), style = MaterialTheme.typography.labelLarge)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        tags.forEach { tag ->
                            ToggleChip(tag.title, tag.id in form.selectedTagIds) { checked ->
                                update { copy(selectedTagIds = if (checked) selectedTagIds + tag.id else selectedTagIds - tag.id) }
                            }
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    EditorTextField(form.plusAllowed, { update { copy(plusAllowed = it.filter(Char::isDigit).take(2)) } },
                        stringResource(R.string.plus_allowed), error(EditorField.PLUS_ALLOWED), KeyboardType.Number, Modifier.weight(1f))
                    EditorTextField(form.plusConfirmed, { update { copy(plusConfirmed = it.filter(Char::isDigit).take(2)) } },
                        stringResource(R.string.plus_confirmed), error(EditorField.PLUS_CONFIRMED), KeyboardType.Number, Modifier.weight(1f))
                }
                RecordPickerField(stringResource(R.string.seating), form.seatingTableId, index.kind(Kinds.TABLE), allowNone = true,
                    error = error(EditorField.TABLE)) { update { copy(seatingTableId = it) } }
            }
            EditorTextField(form.notes, { update { copy(notes = it.take(EditorLimits.LONG_TEXT)) } }, stringResource(R.string.notes), null,
                singleLine = false)
        }
    }

    if (confirmDiscard) {
        AlertDialog(
            onDismissRequest = { confirmDiscard = false },
            title = { Text(stringResource(R.string.discard_changes_title)) },
            text = { Text(stringResource(R.string.discard_changes_body)) },
            confirmButton = {
                TextButton(onClick = { confirmDiscard = false; onClose() }) { Text(stringResource(R.string.discard), color = PlannerRose) }
            },
            dismissButton = { TextButton(onClick = { confirmDiscard = false }) { Text(stringResource(R.string.keep_editing)) } },
        )
    }
}

@Composable
internal fun EditorTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    error: String?,
    keyboardType: KeyboardType = KeyboardType.Text,
    modifier: Modifier = Modifier.fillMaxWidth(),
    singleLine: Boolean = true,
    placeholder: String? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it) } },
        isError = error != null,
        supportingText = error?.let { { Text(it) } },
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        singleLine = singleLine,
        minLines = if (singleLine) 1 else 2,
        modifier = modifier,
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ChoiceRow(
    label: String,
    options: List<Pair<String, String>>,
    selected: String,
    allowNone: Boolean = false,
    onSelect: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            options.forEach { (key, text) ->
                FilterChip(
                    selected = selected == key,
                    onClick = { onSelect(if (allowNone && selected == key) "" else key) },
                    label = { Text(text) },
                )
            }
        }
    }
}

@Composable
internal fun ToggleChip(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    FilterChip(selected = checked, onClick = { onChange(!checked) }, label = { Text(label) })
}

@Composable
private fun RatingInput(value: Int, onChange: (Int) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(stringResource(R.string.rating), style = MaterialTheme.typography.labelLarge)
        Row {
            (1..5).forEach { star ->
                val description = stringResource(R.string.rating_value, star)
                IconButton(
                    onClick = { onChange(if (value == star) 0 else star) },
                    modifier = Modifier.semantics { contentDescription = description },
                ) {
                    Icon(if (star <= value) Icons.Default.Star else Icons.Default.StarBorder, null, tint = PlannerChampagne)
                }
            }
        }
    }
}

/** Campo somente leitura que abre uma lista com busca; serve para listas longas de registros. */
@Composable
internal fun RecordPickerField(
    label: String,
    selectedId: String?,
    options: List<PlannerRecord>,
    allowNone: Boolean,
    error: String? = null,
    onSelect: (String?) -> Unit,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    val none = stringResource(R.string.none_option)
    val selected = options.firstOrNull { it.id == selectedId }
    Column {
        OutlinedTextField(
            value = selected?.title ?: none,
            onValueChange = {},
            readOnly = true,
            enabled = false,
            label = { Text(label) },
            isError = error != null,
            supportingText = error?.let { { Text(it) } },
            trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
            colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                disabledTextColor = MaterialTheme.colorScheme.onSurface,
                disabledLabelColor = if (error != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                disabledBorderColor = if (error != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.outline,
                disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                disabledSupportingTextColor = MaterialTheme.colorScheme.error,
            ),
            modifier = Modifier.fillMaxWidth().clickable(role = Role.DropdownList, onClickLabel = label) { open = true },
        )
    }
    if (open) {
        var query by rememberSaveable { mutableStateOf("") }
        val filtered = remember(options, query) {
            options.filter { query.isBlank() || it.title.contains(query, ignoreCase = true) || it.subtitle.contains(query, ignoreCase = true) }
                .sortedBy { it.title.lowercase() }
        }
        AlertDialog(
            onDismissRequest = { open = false },
            title = { Text(label) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        query, { query = it }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.Search, null) },
                        label = { Text(stringResource(R.string.search)) },
                    )
                    LazyColumn(Modifier.heightIn(max = 360.dp), contentPadding = PaddingValues(vertical = 4.dp)) {
                        if (allowNone) item {
                            ListItem(headlineContent = { Text(none) }, modifier = Modifier.clickable { onSelect(null); open = false })
                            HorizontalDivider()
                        }
                        items(filtered, key = { it.id }) { option ->
                            ListItem(
                                headlineContent = {
                                    Text(option.title, fontWeight = if (option.id == selectedId) FontWeight.Bold else FontWeight.Normal)
                                },
                                supportingContent = option.subtitle.takeIf { it.isNotBlank() }?.let { { Text(it) } },
                                modifier = Modifier.clickable { onSelect(option.id); open = false },
                            )
                        }
                        if (filtered.isEmpty()) item {
                            Text(stringResource(R.string.empty), color = PlannerMuted, modifier = Modifier.padding(12.dp))
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { open = false }) { Text(stringResource(R.string.cancel)) } },
        )
    }
}
