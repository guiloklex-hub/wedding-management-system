package br.com.paivalab.weddingmanagementsystem.data

import java.time.LocalDate

data class TaskTemplate(val key: String, val title: String, val monthsBefore: Long, val daysOffset: Long, val priority: String)

object TaskTemplates {
    val all = listOf(
        TaskTemplate("12m-budget", "Fechar orçamento total", 12, 0, "HIGH"),
        TaskTemplate("12m-guest-draft", "Esboço inicial da lista de convidados", 12, 0, "MEDIUM"),
        TaskTemplate("12m-venue", "Visitar e escolher o local (cerimônia + recepção)", 12, 0, "URGENT"),
        TaskTemplate("12m-style", "Definir estilo / paleta / mood board", 12, 0, "MEDIUM"),
        TaskTemplate("9m-photo", "Contratar foto e vídeo", 9, 0, "HIGH"),
        TaskTemplate("9m-buffet", "Contratar buffet ou catering", 9, 0, "HIGH"),
        TaskTemplate("9m-dress", "Começar busca de vestido", 9, 0, "MEDIUM"),
        TaskTemplate("9m-dj", "Contratar DJ ou banda", 9, 0, "MEDIUM"),
        TaskTemplate("6m-invites", "Definir convites (modelo, gráfica)", 6, 0, "MEDIUM"),
        TaskTemplate("6m-rings", "Comprar alianças", 6, 0, "HIGH"),
        TaskTemplate("6m-decor", "Fechar decoradora / floricultura", 6, 0, "HIGH"),
        TaskTemplate("6m-suit", "Definir traje do noivo", 6, 0, "MEDIUM"),
        TaskTemplate("6m-cake", "Fechar bolo e doces", 6, 0, "MEDIUM"),
        TaskTemplate("6m-honeymoon-start", "Pesquisar e reservar lua de mel", 6, 0, "MEDIUM"),
        TaskTemplate("6m-celebrant", "Fechar celebrante / mestre de cerimônia", 6, 0, "HIGH"),
        TaskTemplate("3m-makeup", "Contratar maquiagem e cabelo", 3, 0, "HIGH"),
        TaskTemplate("3m-send-invites", "Enviar convites", 3, 0, "URGENT"),
        TaskTemplate("3m-civil-papers", "Reunir documentação do casamento civil", 3, 0, "URGENT"),
        TaskTemplate("3m-rehearsal", "Marcar dia da prova final do vestido", 3, 0, "MEDIUM"),
        TaskTemplate("3m-transport", "Definir transporte (carro noivos, padrinhos)", 3, 0, "MEDIUM"),
        TaskTemplate("2m-cabeleireiro-teste", "Teste de cabelo e maquiagem", 2, 0, "MEDIUM"),
        TaskTemplate("2m-civil-marcado", "Marcar casamento civil no cartório", 2, 0, "URGENT"),
        TaskTemplate("1m-rsvp-followup", "Cobrar RSVPs pendentes", 1, 0, "HIGH"),
        TaskTemplate("1m-headcount", "Confirmar número final de convidados com buffet", 1, 0, "URGENT"),
        TaskTemplate("1m-seating", "Fechar plano de mesa", 1, 0, "HIGH"),
        TaskTemplate("1m-final-payments", "Programar pagamentos finais dos fornecedores", 1, 0, "URGENT"),
        TaskTemplate("1m-vows", "Escrever os votos", 1, 0, "MEDIUM"),
        TaskTemplate("1w-emergency-kit", "Montar kit emergência (agulha, esparadrapo, etc.)", 0, -7, "HIGH"),
        TaskTemplate("1w-confirmar-fornecedores", "Confirmar fornecedores um a um", 0, -7, "URGENT"),
        TaskTemplate("1w-rings-check", "Conferir alianças e documentos", 0, -3, "URGENT"),
        TaskTemplate("+1w-devolucao", "Devolver vestido, smoking, decoração alugada", -1, 0, "HIGH"),
        TaskTemplate("+1w-agradecimentos", "Enviar mensagens de agradecimento", -1, 0, "MEDIUM"),
        TaskTemplate("+1m-fotos", "Cobrar entrega de fotos e vídeo", -1, 30, "MEDIUM"),
    )

    fun deadline(eventDate: LocalDate, template: TaskTemplate): LocalDate =
        eventDate.minusMonths(template.monthsBefore).plusDays(template.daysOffset)
}
