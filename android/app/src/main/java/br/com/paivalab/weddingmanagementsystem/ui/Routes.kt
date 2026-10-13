package br.com.paivalab.weddingmanagementsystem.ui

import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import kotlinx.serialization.Serializable

@Serializable object DashboardRoute
@Serializable object MoreRoute
@Serializable data class ModuleRoute(val kind: String)

/** As abas precisam de destinos distintos para o `saveState`/`restoreState` de cada pilha. */
@Serializable object TasksTabRoute
@Serializable object VendorsTabRoute
@Serializable object GuestsTabRoute
@Serializable data class DetailRoute(val id: String)
@Serializable data class EditorRoute(val kind: String, val id: String? = null, val parentId: String? = null)
@Serializable object SettingsRoute
@Serializable object InsightsRoute
@Serializable object ReportsRoute
@Serializable data class ReportRoute(val route: String)
@Serializable object HelpRoute
@Serializable object AuditRoute
@Serializable object TrashRoute
@Serializable object VendorCompareRoute
@Serializable object WeddingDayRoute
@Serializable object BackupRoute

/** Abas da barra inferior; as demais telas empilham por cima delas. */
internal val primaryTabs = listOf(Kinds.TASK, Kinds.VENDOR, Kinds.GUEST)

/**
 * Converte as seções em texto usadas pelas telas (e por intents) em rotas tipadas.
 * Abas principais trocam de pilha preservando o estado de cada uma.
 */
fun NavController.openSection(section: String) {
    val route: Any = when (section) {
        "dashboard" -> DashboardRoute
        "more" -> MoreRoute
        "settings" -> SettingsRoute
        "insights" -> InsightsRoute
        "reports" -> ReportsRoute
        "help" -> HelpRoute
        "audit" -> AuditRoute
        "trash" -> TrashRoute
        "vendor-compare" -> VendorCompareRoute
        "wedding-day" -> WeddingDayRoute
        "backup" -> BackupRoute
        Kinds.TASK -> TasksTabRoute
        Kinds.VENDOR -> VendorsTabRoute
        Kinds.GUEST -> GuestsTabRoute
        else -> when {
            section.startsWith("report-") -> ReportRoute(section)
            modules.any { it.kind == section } -> ModuleRoute(section)
            else -> return
        }
    }
    if (section == "dashboard" || section == "more" || section in primaryTabs) openTab(route) else navigate(route)
}

fun NavController.openTab(route: Any) {
    navigate(route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

/** Fornecedores e locais têm tela de detalhe; os demais registros abrem direto no editor. */
fun NavController.openRecord(kind: String, id: String) {
    if (kind == Kinds.VENDOR || kind == Kinds.VENUE) navigate(DetailRoute(id)) else navigate(EditorRoute(kind, id))
}
