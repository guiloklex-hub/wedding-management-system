package br.com.paivalab.weddingmanagementsystem.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import java.time.LocalDate
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.stateIn

data class ModuleListState(
    val items: List<PlannerRecord> = emptyList(),
    val total: Int = 0,
    val statusCounts: Map<String, Int> = emptyMap(),
    val overdue: Int = 0,
)

/** Estado de busca, filtro e ordenação de uma lista de módulo; sobrevive à rotação. */
class ModuleListViewModel(
    private val state: SavedStateHandle,
    private val kind: String,
    index: StateFlow<RecordIndex>,
) : ViewModel() {
    val query: StateFlow<String> = state.getStateFlow(QUERY, "")
    val status: StateFlow<String?> = state.getStateFlow(STATUS, null)
    val tag: StateFlow<String?> = state.getStateFlow(TAG, null)
    val sort: StateFlow<String> = state.getStateFlow(SORT, SORT_RECENT)

    fun setQuery(value: String) { state[QUERY] = value.take(120) }
    fun setStatus(value: String?) { state[STATUS] = value }
    fun setTag(value: String?) { state[TAG] = value }
    fun setSort(value: String) { state[SORT] = value }

    val list: StateFlow<ModuleListState> = combine(index, query, status, tag, sort) { idx, q, st, tg, so ->
        filter(idx, kind, q, st, tg, so)
    }.flowOn(Dispatchers.Default).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ModuleListState())

    companion object {
        const val STATUS_OVERDUE = "OVERDUE"
        const val SORT_RECENT = "recent"
        const val SORT_NAME = "name"
        const val SORT_DATE = "date"
        private const val QUERY = "query"
        private const val STATUS = "status"
        private const val TAG = "tag"
        private const val SORT = "sort"
        private val doneStatuses = setOf("PAID", "DONE", "RECEIVED", "BOUGHT", "PROCESSED")

        fun isOverdue(record: PlannerRecord, today: String = LocalDate.now().toString()): Boolean =
            !record.date.isNullOrBlank() && record.date < today && record.status !in doneStatuses

        fun filter(index: RecordIndex, kind: String, query: String, status: String?, tag: String?, sort: String): ModuleListState {
            val all = index.kind(kind)
            val today = LocalDate.now().toString()
            val needle = query.trim().lowercase(Locale.ROOT)
            val items = all.filter { record ->
                (needle.isEmpty() || record.title.lowercase(Locale.ROOT).contains(needle) ||
                    record.subtitle.lowercase(Locale.ROOT).contains(needle) || record.phone.contains(needle) ||
                    record.email.lowercase(Locale.ROOT).contains(needle)) &&
                    (kind != Kinds.GUEST || tag == null || tag in index.tagIdsByGuest[record.id].orEmpty()) &&
                    when (status) {
                        null -> true
                        STATUS_OVERDUE -> isOverdue(record, today)
                        else -> record.status == status
                    }
            }.let { list ->
                when (sort) {
                    SORT_NAME -> list.sortedBy { it.title.lowercase(Locale.ROOT) }
                    SORT_DATE -> list.sortedWith(compareBy(nullsLast()) { it.date })
                    else -> list.sortedByDescending { it.updatedAt }
                }
            }
            return ModuleListState(
                items = items,
                total = all.size,
                statusCounts = all.groupingBy { it.status }.eachCount(),
                overdue = if (kind in setOf(Kinds.PAYMENT, Kinds.TASK)) all.count { isOverdue(it, today) } else 0,
            )
        }
    }
}
