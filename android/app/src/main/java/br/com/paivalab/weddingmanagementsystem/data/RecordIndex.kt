package br.com.paivalab.weddingmanagementsystem.data

import java.util.concurrent.ConcurrentHashMap
import org.json.JSONObject

/**
 * Visão indexada dos registros ativos, montada fora da thread principal a cada
 * mudança do banco. As telas consultam mapas em vez de varrer a lista inteira.
 */
class RecordIndex(records: List<PlannerRecord>, files: List<PlannerFile> = emptyList()) {
    val active: List<PlannerRecord> = records.filter { it.deletedAt == null }
    val byId: Map<String, PlannerRecord> = active.associateBy { it.id }
    private val byKind: Map<String, List<PlannerRecord>> = active.groupBy { it.kind }
    private val children: Map<String, List<PlannerRecord>> = active.filter { it.parentId != null }.groupBy { it.parentId!! }
    private val guestsByGroup: Map<String, List<PlannerRecord>> =
        kind(Kinds.GUEST).filter { it.guestGroupId != null }.groupBy { it.guestGroupId!! }
    private val guestsByTable: Map<String, List<PlannerRecord>> =
        kind(Kinds.GUEST).filter { it.seatingTableId != null }.groupBy { it.seatingTableId!! }
    private val filesByRecord: Map<String, List<PlannerFile>> = files.filter { it.recordId != null }.groupBy { it.recordId!! }
    private val extras = ConcurrentHashMap<String, JSONObject>()

    val tagIdsByGuest: Map<String, Set<String>> = kind(Kinds.GUEST).associate { it.id to tagIds(it) }
    private val guestCountByTag: Map<String, Int> = tagIdsByGuest.values.flatten().groupingBy { it }.eachCount()

    fun kind(kind: String): List<PlannerRecord> = byKind[kind].orEmpty()
    fun count(kind: String): Int = byKind[kind]?.size ?: 0
    fun find(id: String?): PlannerRecord? = id?.let(byId::get)
    fun children(parentId: String, kind: String? = null): List<PlannerRecord> =
        children[parentId].orEmpty().let { list -> if (kind == null) list else list.filter { it.kind == kind } }
    fun groupMembers(groupId: String): List<PlannerRecord> = guestsByGroup[groupId].orEmpty()
    fun tableGuests(tableId: String): List<PlannerRecord> = guestsByTable[tableId].orEmpty()
    fun tableOccupancy(tableId: String): Int = tableGuests(tableId).sumOf { 1 + it.plusOnesConfirmed }
    fun guestsWithTag(tagId: String): Int = guestCountByTag[tagId] ?: 0
    fun files(recordId: String): List<PlannerFile> = filesByRecord[recordId].orEmpty()

    /** `extraJson` já interpretado; o mesmo objeto é reaproveitado entre recomposições. */
    fun extra(record: PlannerRecord): JSONObject =
        extras.getOrPut(record.id + "@" + record.updatedAt) { ExtraFields.parse(record.extraJson) }

    companion object {
        val EMPTY = RecordIndex(emptyList())

        fun tagIds(record: PlannerRecord): Set<String> {
            val array = ExtraFields.parse(record.extraJson).optJSONArray("tagIds") ?: return emptySet()
            return (0 until array.length()).mapNotNull { array.optString(it).takeIf(String::isNotBlank) }.toSet()
        }
    }
}
