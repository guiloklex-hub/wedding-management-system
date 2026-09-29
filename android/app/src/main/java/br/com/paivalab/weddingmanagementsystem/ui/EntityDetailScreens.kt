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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import org.json.JSONObject

private fun fields(record: PlannerRecord): JSONObject =
    runCatching { JSONObject(record.extraJson) }.getOrElse { JSONObject() }

private fun JSONObject.text(key: String): String =
    if (isNull(key)) "" else optString(key).takeUnless { it == "null" }.orEmpty()

@Composable
private fun DetailSection(title: String, onAdd: (() -> Unit)? = null, content: @Composable () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = PlannerSurface),
        border = BorderStroke(1.dp, PlannerBorder),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                if (onAdd != null) TextButton(onClick = onAdd) { Text("+") }
            }
            content()
        }
    }
}

@Composable
private fun DetailValue(label: String, value: String) {
    if (value.isNotBlank()) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, color = PlannerMuted, style = MaterialTheme.typography.labelSmall)
            Text(value, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun FileActions(file: PlannerFile, language: String, onOpen: (PlannerFile) -> Unit, onExport: (PlannerFile) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text("📎 ${file.fileName}" + (if (file.kind == "CONTRACT") " · v${file.version}" else "") +
            (if (file.deletedAt != null) " · ${localized(R.string.archived_version, language)}" else ""),
            modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
        TextButton(onClick = { onOpen(file) }) { Text(localized(R.string.open_file, language)) }
        TextButton(onClick = { onExport(file) }) { Text(localized(R.string.save_copy, language)) }
    }
}

@Composable
fun VendorDetailScreen(
    vendor: PlannerRecord,
    records: List<PlannerRecord>,
    files: List<PlannerFile>,
    language: String,
    currency: String,
    onEdit: (PlannerRecord) -> Unit,
    onAddRelated: (String, String) -> Unit,
    onDelete: (PlannerRecord) -> Unit,
    onAttach: (PlannerRecord) -> Unit,
    onOpenFile: (PlannerFile) -> Unit,
    onExportFile: (PlannerFile) -> Unit,
    onPaid: (String) -> Unit,
    onDial: (String) -> Unit,
    onWhatsApp: (PlannerRecord) -> Unit,
    onOpenLink: (String) -> Unit,
) {
    val vendorFields = fields(vendor)
    val contacts = records.filter { it.kind == Kinds.CONTACT && it.parentId == vendor.id }
        .sortedByDescending { fields(it).optBoolean("isPrimary") }
    val notes = records.filter { it.kind == Kinds.VENDOR_NOTE && it.parentId == vendor.id }.sortedByDescending { it.createdAt }
    val contracts = records.filter { it.kind == Kinds.CONTRACT && it.parentId == vendor.id }.sortedByDescending { fields(it).optInt("version", 1) }
    val budgets = records.filter { it.kind == Kinds.BUDGET && it.parentId == vendor.id }
    val payments = records.filter { it.kind == Kinds.PAYMENT && it.parentId == vendor.id }.sortedBy { it.date }
    val vendorFiles = files.filter { it.recordId == vendor.id && it.deletedAt == null }
    val budgeted = budgets.sumOf { it.amountCents ?: it.estimatedCents ?: 0L }
    val paid = payments.filter { it.status == "PAID" }.sumOf { it.amountCents ?: 0L }

    LazyColumn(contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            DetailSection(vendor.title) {
                DetailValue(localized(R.string.category, language), vendor.subtitle)
                if (vendor.status.isNotBlank()) StatusBadge(vendor.status, language)
                val rating = vendorFields.optInt("rating", 0)
                if (rating in 1..5) Text("${"★".repeat(rating)}${"☆".repeat(5 - rating)}", color = PlannerChampagne)
                DetailValue(localized(R.string.indicated_by, language), vendorFields.text("indicatedBy"))
                DetailValue(localized(R.string.tags, language), vendorFields.text("tags"))
                DetailValue(localized(R.string.notes, language), vendor.notes)
                if (vendorFields.text("contractLink").isNotBlank()) {
                    TextButton(onClick = { onOpenLink(vendorFields.text("contractLink")) }) { Text(localized(R.string.contract_link, language)) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { onEdit(vendor) }) { Text(localized(R.string.edit, language)) }
                    if (vendor.phone.isNotBlank()) OutlinedButton(onClick = { onDial(vendor.phone) }) { Text(localized(R.string.call_phone, language)) }
                    if (vendor.phone.isNotBlank()) OutlinedButton(onClick = { onWhatsApp(vendor) }) { Text("WhatsApp") }
                }
                DetailValue(localized(R.string.phone, language), vendor.phone)
                DetailValue(localized(R.string.email, language), vendor.email)
            }
        }
        item {
            DetailSection(localized(R.string.vendor_finance, language)) {
                DetailValue(localized(R.string.total_budget, language), localizedCurrency(budgeted, currency, language))
                DetailValue(localized(R.string.total_paid, language), localizedCurrency(paid, currency, language))
                DetailValue(localized(R.string.vendor_balance, language), localizedCurrency(budgeted - paid, currency, language))
            }
        }
        item {
            DetailSection(localized(R.string.contacts, language), { onAddRelated(Kinds.CONTACT, vendor.id) }) {
                if (contacts.isEmpty()) Text(localized(R.string.empty, language), color = PlannerMuted)
                contacts.forEach { contact ->
                    DetailValue(contact.title, listOf(fields(contact).text("role"), contact.phone, contact.email).filter { it.isNotBlank() }.joinToString(" · "))
                    if (fields(contact).optBoolean("isPrimary")) Text(localized(R.string.primary_contact, language), color = PlannerChampagne)
                    Row {
                        TextButton(onClick = { onEdit(contact) }) { Text(localized(R.string.edit, language)) }
                        if (contact.phone.isNotBlank()) TextButton(onClick = { onDial(contact.phone) }) { Text(localized(R.string.call_phone, language)) }
                        TextButton(onClick = { onDelete(contact) }) { Text(localized(R.string.delete, language)) }
                    }
                    HorizontalDivider(color = PlannerBorder)
                }
            }
        }
        item {
            DetailSection(localized(R.string.vendor_notes, language), { onAddRelated(Kinds.VENDOR_NOTE, vendor.id) }) {
                if (notes.isEmpty()) Text(localized(R.string.empty, language), color = PlannerMuted)
                notes.forEach { note ->
                    DetailValue(note.status.ifBlank { localized(R.string.notes, language) }, note.notes.ifBlank { note.title })
                    Row {
                        TextButton(onClick = { onEdit(note) }) { Text(localized(R.string.edit, language)) }
                        TextButton(onClick = { onDelete(note) }) { Text(localized(R.string.delete, language)) }
                    }
                    HorizontalDivider(color = PlannerBorder)
                }
            }
        }
        item {
            DetailSection(localized(R.string.contracts, language), { onAddRelated(Kinds.CONTRACT, vendor.id) }) {
                if (contracts.isEmpty()) Text(localized(R.string.empty, language), color = PlannerMuted)
                contracts.forEach { contract ->
                    val data = fields(contract)
                    val contractFiles = files.filter { it.recordId == contract.id }.sortedByDescending { it.createdAt }
                    Text(contract.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    DetailValue(localized(R.string.contract_version, language), data.optInt("version", 1).toString())
                    if (contract.status.isNotBlank()) StatusBadge(contract.status, language)
                    contract.amountCents?.let { DetailValue(localized(R.string.amount, language), localizedCurrency(it, currency, language)) }
                    DetailValue(localized(R.string.contract_signed, language), formatDisplayDate(contract.date, language))
                    DetailValue(localized(R.string.contract_expires, language), formatDisplayDate(data.text("expiresAt"), language))
                    DetailValue(localized(R.string.payment_terms, language), data.text("paymentTerms"))
                    DetailValue(localized(R.string.cancellation_policy, language), data.text("cancellationPolicy"))
                    DetailValue(localized(R.string.included_items, language), data.text("includedItems"))
                    DetailValue(localized(R.string.excluded_items, language), data.text("excludedItems"))
                    DetailValue(localized(R.string.notes, language), contract.notes)
                    Row {
                        TextButton(onClick = { onEdit(contract) }) { Text(localized(R.string.edit, language)) }
                        TextButton(onClick = { onAttach(contract) }) { Text(localized(R.string.attach_file, language)) }
                        TextButton(onClick = { onDelete(contract) }) { Text(localized(R.string.delete, language)) }
                    }
                    contractFiles.forEach { FileActions(it, language, onOpenFile, onExportFile) }
                    HorizontalDivider(color = PlannerBorder)
                }
            }
        }
        item {
            DetailSection(localized(R.string.attach_file, language), { onAttach(vendor) }) {
                if (vendorFiles.isEmpty()) Text(localized(R.string.empty, language), color = PlannerMuted)
                vendorFiles.forEach { FileActions(it, language, onOpenFile, onExportFile) }
            }
        }
        item {
            DetailSection(localized(R.string.budget, language), { onAddRelated(Kinds.BUDGET, vendor.id) }) {
                if (budgets.isEmpty()) Text(localized(R.string.empty, language), color = PlannerMuted)
                budgets.forEach { budget ->
                    Text(budget.title)
                    DetailValue(localized(R.string.report_estimated, language), localizedCurrency(budget.estimatedCents ?: 0L, currency, language))
                    budget.amountCents?.let { DetailValue(localized(R.string.budget_actual, language), localizedCurrency(it, currency, language)) }
                    TextButton(onClick = { onEdit(budget) }) { Text(localized(R.string.edit, language)) }
                }
            }
        }
        item {
            DetailSection(localized(R.string.payments, language), { onAddRelated(Kinds.PAYMENT, vendor.id) }) {
                if (payments.isEmpty()) Text(localized(R.string.empty, language), color = PlannerMuted)
                payments.forEach { payment ->
                    Text(payment.title)
                    DetailValue(localized(R.string.amount, language), localizedCurrency(payment.amountCents ?: 0L, currency, language))
                    DetailValue(localized(R.string.date, language), formatDisplayDate(payment.date, language))
                    if (payment.status.isNotBlank()) StatusBadge(payment.status, language)
                    Row {
                        TextButton(onClick = { onEdit(payment) }) { Text(localized(R.string.edit, language)) }
                        if (payment.status != "PAID") TextButton(onClick = { onPaid(payment.id) }) { Text(localized(R.string.mark_paid, language)) }
                    }
                    HorizontalDivider(color = PlannerBorder)
                }
            }
        }
    }
}

@Composable
fun VenueDetailScreen(
    venue: PlannerRecord,
    records: List<PlannerRecord>,
    files: List<PlannerFile>,
    language: String,
    currency: String,
    onEdit: (PlannerRecord) -> Unit,
    onAddRelated: (String, String) -> Unit,
    onAttach: (PlannerRecord) -> Unit,
    onOpenFile: (PlannerFile) -> Unit,
    onExportFile: (PlannerFile) -> Unit,
    onChecklistStatus: (String, String) -> Unit,
    onSeedChecklist: (String) -> Unit,
    onMaps: (PlannerRecord) -> Unit,
) {
    val data = fields(venue)
    val checks = records.filter { it.kind == Kinds.VENUE_CHECK && it.parentId == venue.id }
    val venueFiles = files.filter { it.recordId == venue.id }
    LazyColumn(contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            DetailSection(venue.title) {
                DetailValue(localized(R.string.address, language), data.text("address"))
                DetailValue(localized(R.string.venue_capacity_seated, language), data.text("capacitySeated"))
                DetailValue(localized(R.string.venue_capacity_standing, language), data.text("capacityStanding"))
                venue.amountCents?.let { DetailValue(localized(R.string.amount, language), localizedCurrency(it, currency, language)) }
                DetailValue(localized(R.string.venue_contact_name, language), data.text("contactName"))
                if (data.optBoolean("isShortlisted")) Text(localized(R.string.venue_shortlisted, language), color = PlannerChampagne)
                DetailValue(localized(R.string.venue_pricing, language), data.text("pricingNotes"))
                DetailValue(localized(R.string.venue_restrictions, language), data.text("restrictions"))
                DetailValue(localized(R.string.venue_pros, language), data.text("pros"))
                DetailValue(localized(R.string.venue_cons, language), data.text("cons"))
                DetailValue(localized(R.string.phone, language), venue.phone)
                DetailValue(localized(R.string.notes, language), venue.notes)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { onEdit(venue) }) { Text(localized(R.string.edit, language)) }
                    OutlinedButton(onClick = { onMaps(venue) }) { Text(localized(R.string.open_maps, language)) }
                }
            }
        }
        item {
            DetailSection(localized(R.string.venue_check, language), { onAddRelated(Kinds.VENUE_CHECK, venue.id) }) {
                OutlinedButton(onClick = { onSeedChecklist(venue.id) }) { Text(localized(R.string.seed_venue_checklist, language)) }
                if (checks.isEmpty()) Text(localized(R.string.empty, language), color = PlannerMuted)
                checks.forEach { check ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(check.title, modifier = Modifier.weight(1f))
                        TextButton(onClick = { onChecklistStatus(check.id, if (check.status == "DONE") "TODO" else "DONE") }) {
                            Text(localized(if (check.status == "DONE") R.string.status_done else R.string.status_todo, language))
                        }
                    }
                }
            }
        }
        item {
            DetailSection(localized(R.string.attach_file, language), { onAttach(venue) }) {
                if (venueFiles.isEmpty()) Text(localized(R.string.empty, language), color = PlannerMuted)
                venueFiles.forEach { FileActions(it, language, onOpenFile, onExportFile) }
            }
        }
    }
}
