package br.com.paivalab.weddingmanagementsystem.ui

import android.content.Context
import android.net.Uri
import androidx.annotation.AnyRes
import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import br.com.paivalab.weddingmanagementsystem.data.PlannerPreferences
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.PlannerRepository
import br.com.paivalab.weddingmanagementsystem.data.GuestImportPreview
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.DEMO_REQUIRES_EMPTY
import br.com.paivalab.weddingmanagementsystem.data.HONEYMOON_NOT_DELETABLE
import br.com.paivalab.weddingmanagementsystem.data.PARENT_DELETED
import br.com.paivalab.weddingmanagementsystem.data.PAYMENT_NEEDS_VENDOR
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import br.com.paivalab.weddingmanagementsystem.data.UndoSnapshot
import br.com.paivalab.weddingmanagementsystem.data.VENDOR_NEEDS_CATEGORY
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class UserMessage(
    /** Recurso `string`, ou `plurals` quando `quantity` não é nulo. */
    @AnyRes val text: Int,
    val args: List<Any> = emptyList(),
    val undo: UndoSnapshot? = null,
    val quantity: Int? = null,
)

/** Traduz os códigos de erro do repositório em mensagens para o usuário. */
@StringRes
fun errorMessage(code: String?): Int = when (code) {
    "Mesa sem lugares" -> R.string.table_full
    PAYMENT_NEEDS_VENDOR -> R.string.payment_needs_vendor
    VENDOR_NEEDS_CATEGORY -> R.string.vendor_needs_category
    HONEYMOON_NOT_DELETABLE -> R.string.honeymoon_not_deletable
    PARENT_DELETED -> R.string.parent_deleted
    DEMO_REQUIRES_EMPTY -> R.string.demo_requires_empty
    "Presente já lançado" -> R.string.gift_already_processed
    else -> R.string.error_generic
}

class PlannerViewModel(
    private val repository: PlannerRepository,
    private val preferences: PlannerPreferences,
) : ViewModel() {
    val records = repository.records.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val files = repository.files.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val allFiles = repository.allFiles.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val audits = repository.audits.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val index = combine(repository.records, repository.files) { records, files -> RecordIndex(records, files) }
        .flowOn(Dispatchers.Default)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), RecordIndex.EMPTY)
    val locale = preferences.locale.stateIn(viewModelScope, SharingStarted.Eagerly, "pt-BR")
    val currency = preferences.currency.stateIn(viewModelScope, SharingStarted.Eagerly, "BRL")
    val themeMode = preferences.themeMode.stateIn(viewModelScope, SharingStarted.Eagerly, "system")
    private val _coupleNames = MutableStateFlow("")
    val coupleNames = _coupleNames.asStateFlow()
    private val _eventDate = MutableStateFlow("")
    val eventDate = _eventDate.asStateFlow()
    private val _daySchedule = MutableStateFlow("")
    val daySchedule = _daySchedule.asStateFlow()
    private val _rainPlan = MutableStateFlow("")
    val rainPlan = _rainPlan.asStateFlow()
    private val _specialNotes = MutableStateFlow("")
    val specialNotes = _specialNotes.asStateFlow()
    private val _pixKey = MutableStateFlow("")
    val pixKey = _pixKey.asStateFlow()
    private val _pixHolderName = MutableStateFlow("")
    val pixHolderName = _pixHolderName.asStateFlow()
    private val _pixCity = MutableStateFlow("SAO PAULO")
    val pixCity = _pixCity.asStateFlow()
    private val _contingencyPercent = MutableStateFlow(10)
    val contingencyPercent = _contingencyPercent.asStateFlow()
    private val _messages = MutableSharedFlow<UserMessage>(extraBufferCapacity = 16)
    /** Mensagens para o snackbar; `undo` habilita o botão "Desfazer". */
    val messages = _messages.asSharedFlow()
    val deleted = repository.deleted.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    private val _onboardingNeeded = MutableStateFlow<Boolean?>(null)
    /** Nulo enquanto carrega; verdadeiro só numa instalação nova, sem dados nem data do evento. */
    val onboardingNeeded = _onboardingNeeded.asStateFlow()
    private val _guestImport = MutableStateFlow<GuestImportPreview?>(null)
    val guestImport = _guestImport.asStateFlow()

    init {
        refreshEvent()
    }

    fun refreshEvent() {
        viewModelScope.launch {
            _coupleNames.value = repository.setting("coupleNames").orEmpty()
            _eventDate.value = repository.setting("eventDate").orEmpty()
            _daySchedule.value = repository.setting("daySchedule").orEmpty()
            _rainPlan.value = repository.setting("rainPlanB").orEmpty()
            _specialNotes.value = repository.setting("daySpecialNotes").orEmpty()
            _pixKey.value = repository.setting("pixKey").orEmpty()
            _pixHolderName.value = repository.setting("pixHolderName").orEmpty()
            _pixCity.value = repository.setting("pixCity")?.takeIf { it.isNotBlank() } ?: "SAO PAULO"
            _contingencyPercent.value = repository.setting("contingencyPercent")?.toIntOrNull()?.coerceIn(0, 50) ?: 10
            _onboardingNeeded.value = when {
                repository.setting(ONBOARDING_DONE) != null -> false
                _eventDate.value.isNotBlank() || repository.hasRecords() -> {
                    repository.setSetting(ONBOARDING_DONE, System.currentTimeMillis().toString())
                    false
                }
                else -> true
            }
        }
    }

    fun completeOnboarding(
        coupleNames: String, eventDate: String, contingencyPct: Int,
        currency: String, seedTasks: Boolean,
    ) = launchAction {
        val date = eventDate.takeIf { it.isNotBlank() }?.let(java.time.LocalDate::parse)
        val pct = contingencyPct.coerceIn(0, 30)
        preferences.setCurrency(currency)
        repository.setSetting("coupleNames", coupleNames.take(120).trim())
        repository.setSetting("eventDate", date?.toString().orEmpty())
        repository.setSetting("contingencyPercent", pct.toString())
        val added = if (seedTasks && date != null) repository.seedTaskTemplates(date) else 0
        repository.setSetting(ONBOARDING_DONE, System.currentTimeMillis().toString())
        _coupleNames.value = coupleNames.take(120).trim()
        _eventDate.value = date?.toString().orEmpty()
        _contingencyPercent.value = pct
        _onboardingNeeded.value = false
        if (added > 0) notify(R.plurals.msg_templates_added, added, quantity = added)
    }

    /** Pula o assistente carregando os dados de exemplo (só com o banco vazio). */
    fun startWithDemo(
        database: br.com.paivalab.weddingmanagementsystem.data.PlannerDatabase,
        blobs: br.com.paivalab.weddingmanagementsystem.data.BlobStore,
    ) = launchAction {
        br.com.paivalab.weddingmanagementsystem.data.DemoSeed.populate(database, preferences, blobs)
        repository.setSetting(ONBOARDING_DONE, System.currentTimeMillis().toString())
        refreshEvent()
    }

    private fun notify(@AnyRes text: Int, vararg args: Any, undo: UndoSnapshot? = null, quantity: Int? = null) {
        _messages.tryEmit(UserMessage(text, args.toList(), undo?.takeUnless { it.isEmpty }, quantity))
    }

    fun save(record: PlannerRecord, done: () -> Unit = {}) = launchAction {
        repository.save(record)
        notify(R.string.msg_saved)
        done()
    }

    fun delete(id: String, done: () -> Unit = {}) = launchAction {
        val undo = repository.delete(id)
        notify(R.string.msg_deleted, undo = undo)
        done()
    }

    fun undo(snapshot: UndoSnapshot) = launchAction {
        repository.undo(snapshot)
        notify(R.string.msg_undone)
    }

    fun restore(id: String) = launchAction {
        repository.restore(id)
        notify(R.string.msg_restored)
    }

    fun setStatus(id: String, status: String) = launchAction {
        notify(R.string.msg_status_changed, undo = repository.setStatus(id, status))
    }
    fun setGroupRsvp(id: String, status: String) = launchAction {
        notify(R.string.msg_group_rsvp, undo = repository.setGroupRsvp(id, status))
    }
    fun markPaid(id: String) = launchAction { notify(R.string.msg_paid, undo = repository.markPaid(id)) }
    fun undoPaid(id: String) = launchAction { notify(R.string.msg_payment_reverted, undo = repository.undoPaid(id)) }
    fun convertGift(id: String, targetKind: String) = launchAction {
        notify(R.string.msg_gift_posted, undo = repository.convertGift(id, targetKind))
    }
    fun assignGuest(guestId: String, tableId: String?) = launchAction { repository.assignGuestToTable(guestId, tableId) }
    fun confirmInvitationSent(templateId: String, guestId: String, channel: String) = launchAction {
        repository.confirmInvitationSent(templateId, guestId, channel)
    }
    fun previewGuestImport(context: Context, uri: Uri) = launchAction {
        _guestImport.value = repository.previewGuestImport(context, uri)
    }
    fun dismissGuestImport() { _guestImport.value = null }
    fun commitGuestImport() = launchAction {
        val preview = _guestImport.value ?: return@launchAction
        val (added, skipped) = repository.importGuests(preview)
        _guestImport.value = null
        notify(R.string.guest_import_result_format, added, skipped)
    }
    fun seedTaskTemplates() = launchAction {
        val date = runCatching { java.time.LocalDate.parse(_eventDate.value) }.getOrNull()
        if (date == null) {
            notify(R.string.report_event_date_needed)
            return@launchAction
        }
        val count = repository.seedTaskTemplates(date)
        notify(R.plurals.msg_templates_added, count, quantity = count)
    }
    fun seedVenueChecklist(venueId: String) = launchAction {
        val count = repository.seedVenueChecklist(venueId)
        notify(R.plurals.msg_checklist_added, count, quantity = count)
    }
    fun createInstallments(plan: br.com.paivalab.weddingmanagementsystem.data.InstallmentPlan) = launchAction {
        val count = repository.createInstallments(plan)
        notify(R.plurals.msg_installments_created, count, quantity = count)
    }
    fun createSplitPayment(
        vendorId: String, title: String, depositCents: Long, depositMethod: String,
        finalCents: Long, finalDueDate: java.time.LocalDate, finalMethod: String,
    ) = launchAction {
        notify(R.string.msg_split_created, undo = repository.createSplitPayment(vendorId, title, depositCents, depositMethod,
            finalCents, finalDueDate, finalMethod))
    }
    fun saveWeddingDay(schedule: String, rainPlan: String, specialNotes: String) = launchAction {
        repository.setSetting("daySchedule", schedule.take(8000))
        repository.setSetting("rainPlanB", rainPlan.take(8000))
        repository.setSetting("daySpecialNotes", specialNotes.take(8000))
        _daySchedule.value = schedule.take(8000)
        _rainPlan.value = rainPlan.take(8000)
        _specialNotes.value = specialNotes.take(8000)
    }
    fun checkInGuest(id: String) = launchAction { notify(R.string.msg_checked_in, undo = repository.checkInGuest(id)) }
    fun addAttachment(context: Context, recordId: String, uri: Uri) = launchAction {
        repository.addAttachment(context, recordId, uri)
    }
    fun exportAttachment(context: Context, file: PlannerFile, destination: Uri) = launchAction {
        repository.exportAttachment(context, file, destination)
    }
    fun prepareSharedFile(context: Context, file: PlannerFile, onReady: (Uri) -> Unit) = launchAction {
        onReady(repository.prepareSharedFile(context, file))
    }
    fun setLocale(value: String) = launchAction { preferences.setLocale(value) }
    fun setCurrency(value: String) = launchAction { preferences.setCurrency(value) }
    fun setThemeMode(value: String) = launchAction { preferences.setThemeMode(value) }
    fun savePix(key: String, holderName: String, city: String = "SAO PAULO") = launchAction {
        require(key.length <= 120 && holderName.length <= 120 && city.length <= 60)
        repository.setSetting("pixKey", key.trim())
        repository.setSetting("pixHolderName", holderName.trim())
        repository.setSetting("pixCity", city.trim().ifBlank { "SAO PAULO" })
        _pixKey.value = key.trim()
        _pixHolderName.value = holderName.trim()
        _pixCity.value = city.trim().ifBlank { "SAO PAULO" }
    }
    fun saveEvent(coupleNames: String, eventDate: String, contingencyPct: Int = _contingencyPercent.value) = launchAction {
        if (eventDate.isNotBlank()) java.time.LocalDate.parse(eventDate)
        val cleanPct = contingencyPct.coerceIn(0, 50)
        repository.setSetting("coupleNames", coupleNames.take(120).trim())
        repository.setSetting("eventDate", eventDate)
        repository.setSetting("contingencyPercent", cleanPct.toString())
        _coupleNames.value = coupleNames.take(120).trim()
        _eventDate.value = eventDate
        _contingencyPercent.value = cleanPct
    }

    fun loadDemoSeed(
        database: br.com.paivalab.weddingmanagementsystem.data.PlannerDatabase,
        blobs: br.com.paivalab.weddingmanagementsystem.data.BlobStore,
    ) = launchAction {
        br.com.paivalab.weddingmanagementsystem.data.DemoSeed.populate(database, preferences, blobs)
        refreshEvent()
    }

    private fun launchAction(block: suspend () -> Unit) {
        viewModelScope.launch {
            try { block() } catch (error: Exception) { _messages.tryEmit(UserMessage(errorMessage(error.message))) }
        }
    }

    companion object {
        const val ONBOARDING_DONE = "onboardingCompletedAt"
    }

    class Factory(
        private val repository: PlannerRepository,
        private val preferences: PlannerPreferences,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            PlannerViewModel(repository, preferences) as T
    }
}
