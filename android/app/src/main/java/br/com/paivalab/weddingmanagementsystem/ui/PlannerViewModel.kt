package br.com.paivalab.weddingmanagementsystem.ui

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import br.com.paivalab.weddingmanagementsystem.data.PlannerPreferences
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.PlannerRepository
import br.com.paivalab.weddingmanagementsystem.data.GuestImportPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class PlannerViewModel(
    private val repository: PlannerRepository,
    private val preferences: PlannerPreferences,
) : ViewModel() {
    val records = repository.records.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val files = repository.files.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val audits = repository.audits.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val locale = preferences.locale.stateIn(viewModelScope, SharingStarted.Eagerly, "pt-BR")
    val currency = preferences.currency.stateIn(viewModelScope, SharingStarted.Eagerly, "BRL")
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
    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()
    private val _guestImport = MutableStateFlow<GuestImportPreview?>(null)
    val guestImport = _guestImport.asStateFlow()
    private val _guestImportResult = MutableStateFlow<Pair<Int, Int>?>(null)
    val guestImportResult = _guestImportResult.asStateFlow()

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
        }
    }

    fun clearError() { _error.value = null }

    fun save(record: PlannerRecord, done: () -> Unit = {}) = launchAction {
        repository.save(record)
        done()
    }

    fun delete(id: String, done: () -> Unit = {}) = launchAction {
        repository.delete(id)
        done()
    }

    fun setStatus(id: String, status: String) = launchAction { repository.setStatus(id, status) }
    fun setGroupRsvp(id: String, status: String) = launchAction { repository.setGroupRsvp(id, status) }
    fun markPaid(id: String) = launchAction { repository.markPaid(id) }
    fun convertGift(id: String, targetKind: String) = launchAction { repository.convertGift(id, targetKind) }
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
        _guestImportResult.value = repository.importGuests(preview)
        _guestImport.value = null
    }
    fun seedTaskTemplates() = launchAction {
        val date = java.time.LocalDate.parse(_eventDate.value)
        repository.seedTaskTemplates(date)
    }
    fun seedVenueChecklist(venueId: String, onDone: (Int) -> Unit = {}) = launchAction {
        val count = repository.seedVenueChecklist(venueId)
        onDone(count)
    }
    fun createInstallments(vendorId: String?, title: String, totalCents: Long,
                           count: Int, firstDueDate: java.time.LocalDate) = launchAction {
        repository.createInstallments(vendorId, title, totalCents, count, firstDueDate)
    }
    fun saveWeddingDay(schedule: String, rainPlan: String, specialNotes: String) = launchAction {
        repository.setSetting("daySchedule", schedule.take(8000))
        repository.setSetting("rainPlanB", rainPlan.take(8000))
        repository.setSetting("daySpecialNotes", specialNotes.take(8000))
        _daySchedule.value = schedule.take(8000)
        _rainPlan.value = rainPlan.take(8000)
        _specialNotes.value = specialNotes.take(8000)
    }
    fun checkInGuest(id: String) = launchAction { repository.checkInGuest(id) }
    fun addAttachment(context: Context, recordId: String, uri: Uri) = launchAction {
        repository.addAttachment(context, recordId, uri)
    }
    fun exportAttachment(context: Context, file: PlannerFile, destination: Uri) = launchAction {
        repository.exportAttachment(context, file, destination)
    }
    fun setLocale(value: String) = launchAction { preferences.setLocale(value) }
    fun setCurrency(value: String) = launchAction { preferences.setCurrency(value) }
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

    fun loadDemoSeed(database: br.com.paivalab.weddingmanagementsystem.data.PlannerDatabase) = launchAction {
        br.com.paivalab.weddingmanagementsystem.data.DemoSeed.populate(database, preferences)
        refreshEvent()
    }

    private fun launchAction(block: suspend () -> Unit) {
        viewModelScope.launch {
            try { block() } catch (error: Exception) { _error.value = error.message ?: "Erro" }
        }
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
