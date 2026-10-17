package br.com.paivalab.weddingmanagementsystem.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.paivalab.weddingmanagementsystem.data.GiftRules
import br.com.paivalab.weddingmanagementsystem.data.GuestRules
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
    val open: Int = 0,
    val week: Int = 0,
    /** Contagens dos filtros rápidos de convidados e presentes. */
    val quick: Map<String, Int> = emptyMap(),
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
    val view: StateFlow<String> = state.getStateFlow(VIEW, VIEW_LIST)
    /** Mês exibido no calendário de pagamentos (`YYYY-MM`) e dia selecionado (`YYYY-MM-DD`). */
    val month: StateFlow<String> = state.getStateFlow(MONTH, java.time.YearMonth.now().toString())
    val day: StateFlow<String?> = state.getStateFlow(DAY, null)

    fun setQuery(value: String) { state[QUERY] = value.take(120) }
    fun setStatus(value: String?) { state[STATUS] = value }
    fun setTag(value: String?) { state[TAG] = value }
    fun setSort(value: String) { state[SORT] = value }
    fun setView(value: String) { state[VIEW] = value }
    fun setMonth(value: java.time.YearMonth) { state[MONTH] = value.toString(); state[DAY] = null }
    fun setDay(value: String?) { state[DAY] = value }

    val list: StateFlow<ModuleListState> = combine(index, query, status, tag, sort) { idx, q, st, tg, so ->
        filter(idx, kind, q, st, tg, so)
    }.flowOn(Dispatchers.Default).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ModuleListState())

    companion object {
        const val STATUS_OVERDUE = "OVERDUE"
        const val STATUS_OPEN = "OPEN"
        const val STATUS_WEEK = "WEEK"
        const val VIEW_LIST = "list"
        const val VIEW_KANBAN = "kanban"
        const val VIEW_CALENDAR = "calendar"
        const val SORT_RECENT = "recent"
        const val SORT_NAME = "name"
        const val SORT_DATE = "date"
        private const val QUERY = "query"
        private const val STATUS = "status"
        private const val TAG = "tag"
        private const val SORT = "sort"
        private const val VIEW = "view"
        private const val MONTH = "month"
        private const val DAY = "day"
        val guestFilters = listOf(GuestRules.FILTER_CONFIRMED, GuestRules.FILTER_PENDING, GuestRules.FILTER_PADRINHOS,
            GuestRules.FILTER_CHILDREN, GuestRules.FILTER_CHECKED_IN)
        private val doneStatuses = setOf("PAID", "DONE", "RECEIVED", "BOUGHT", "PROCESSED")

        fun isOverdue(record: PlannerRecord, today: String = LocalDate.now().toString()): Boolean =
            !record.date.isNullOrBlank() && record.date < today && record.status !in doneStatuses

        fun filter(index: RecordIndex, kind: String, query: String, status: String?, tag: String?, sort: String): ModuleListState {
            val all = index.kind(kind)
            val today = LocalDate.now().toString()
            val week = LocalDate.now().plusDays(7).toString()
            val needle = query.trim().lowercase(Locale.ROOT)
            val items = all.filter { record ->
                (needle.isEmpty() || record.title.lowercase(Locale.ROOT).contains(needle) ||
                    record.subtitle.lowercase(Locale.ROOT).contains(needle) || record.phone.contains(needle) ||
                    record.email.lowercase(Locale.ROOT).contains(needle)) &&
                    (kind != Kinds.GUEST || tag == null || tag in index.tagIdsByGuest[record.id].orEmpty()) &&
                    when (status) {
                        null -> true
                        STATUS_OVERDUE -> isOverdue(record, today)
                        GiftRules.FILTER_PENDING_THANK -> record.status != "THANKED"
                        STATUS_OPEN -> record.status !in doneStatuses
                        // Como o filtro "próximos 7 dias" da web: inclui as já atrasadas.
                        STATUS_WEEK -> record.status !in doneStatuses && !record.date.isNullOrBlank() && record.date <= week
                        else -> (if (kind == Kinds.GUEST) GuestRules.matches(record, status, index.extra(record)) else null)
                            ?: (record.status == status)
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
                open = all.count { it.status !in doneStatuses },
                week = all.count { it.status !in doneStatuses && !it.date.isNullOrBlank() && it.date <= week },
                quick = when (kind) {
                    Kinds.GUEST -> guestFilters.associateWith { filter -> all.count { GuestRules.matches(it, filter, index.extra(it)) == true } }
                    Kinds.GIFT -> mapOf(GiftRules.FILTER_PENDING_THANK to all.count { it.status != "THANKED" })
                    else -> emptyMap()
                },
            )
        }
    }
}
