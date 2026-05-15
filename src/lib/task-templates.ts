export type TaskTemplate = {
  key: string;
  title: string;
  monthsBefore: number;
  daysOffset?: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  responsible?: "noivo" | "noiva" | "ambos" | "cerimonial";
  description?: string;
};

export const TASK_TEMPLATES: readonly TaskTemplate[] = [
  // 12+ meses
  { key: "12m-budget", title: "Fechar orçamento total", monthsBefore: 12, priority: "HIGH", responsible: "ambos" },
  { key: "12m-guest-draft", title: "Esboço inicial da lista de convidados", monthsBefore: 12, priority: "MEDIUM", responsible: "ambos" },
  { key: "12m-venue", title: "Visitar e escolher o local (cerimônia + recepção)", monthsBefore: 12, priority: "URGENT", responsible: "ambos" },
  { key: "12m-style", title: "Definir estilo / paleta / mood board", monthsBefore: 12, priority: "MEDIUM", responsible: "noiva" },

  // 9 meses
  { key: "9m-photo", title: "Contratar foto e vídeo", monthsBefore: 9, priority: "HIGH", responsible: "ambos" },
  { key: "9m-buffet", title: "Contratar buffet ou catering", monthsBefore: 9, priority: "HIGH", responsible: "ambos" },
  { key: "9m-dress", title: "Começar busca de vestido", monthsBefore: 9, priority: "MEDIUM", responsible: "noiva" },
  { key: "9m-dj", title: "Contratar DJ ou banda", monthsBefore: 9, priority: "MEDIUM", responsible: "ambos" },

  // 6 meses
  { key: "6m-invites", title: "Definir convites (modelo, gráfica)", monthsBefore: 6, priority: "MEDIUM", responsible: "noiva" },
  { key: "6m-rings", title: "Comprar alianças", monthsBefore: 6, priority: "HIGH", responsible: "ambos" },
  { key: "6m-decor", title: "Fechar decoradora / floricultura", monthsBefore: 6, priority: "HIGH", responsible: "noiva" },
  { key: "6m-suit", title: "Definir traje do noivo", monthsBefore: 6, priority: "MEDIUM", responsible: "noivo" },
  { key: "6m-cake", title: "Fechar bolo e doces", monthsBefore: 6, priority: "MEDIUM", responsible: "noiva" },
  { key: "6m-honeymoon-start", title: "Pesquisar e reservar lua de mel", monthsBefore: 6, priority: "MEDIUM", responsible: "ambos" },
  { key: "6m-celebrant", title: "Fechar celebrante / mestre de cerimônia", monthsBefore: 6, priority: "HIGH", responsible: "ambos" },

  // 3 meses
  { key: "3m-makeup", title: "Contratar maquiagem e cabelo", monthsBefore: 3, priority: "HIGH", responsible: "noiva" },
  { key: "3m-send-invites", title: "Enviar convites", monthsBefore: 3, priority: "URGENT", responsible: "ambos" },
  { key: "3m-civil-papers", title: "Reunir documentação do casamento civil", monthsBefore: 3, priority: "URGENT", responsible: "ambos" },
  { key: "3m-rehearsal", title: "Marcar dia da prova final do vestido", monthsBefore: 3, priority: "MEDIUM", responsible: "noiva" },
  { key: "3m-transport", title: "Definir transporte (carro noivos, padrinhos)", monthsBefore: 3, priority: "MEDIUM", responsible: "ambos" },

  // 2 meses
  { key: "2m-cabeleireiro-teste", title: "Teste de cabelo e maquiagem", monthsBefore: 2, priority: "MEDIUM", responsible: "noiva" },
  { key: "2m-civil-marcado", title: "Marcar casamento civil no cartório", monthsBefore: 2, priority: "URGENT", responsible: "ambos" },

  // 1 mês
  { key: "1m-rsvp-followup", title: "Cobrar RSVPs pendentes", monthsBefore: 1, priority: "HIGH", responsible: "ambos" },
  { key: "1m-headcount", title: "Confirmar número final de convidados com buffet", monthsBefore: 1, priority: "URGENT", responsible: "cerimonial" },
  { key: "1m-seating", title: "Fechar plano de mesa", monthsBefore: 1, priority: "HIGH", responsible: "ambos" },
  { key: "1m-final-payments", title: "Programar pagamentos finais dos fornecedores", monthsBefore: 1, priority: "URGENT", responsible: "ambos" },
  { key: "1m-vows", title: "Escrever os votos", monthsBefore: 1, priority: "MEDIUM", responsible: "ambos" },

  // Semana do evento
  { key: "1w-emergency-kit", title: "Montar kit emergência (agulha, esparadrapo, etc.)", monthsBefore: 0, daysOffset: -7, priority: "HIGH", responsible: "noiva" },
  { key: "1w-confirmar-fornecedores", title: "Confirmar fornecedores um a um", monthsBefore: 0, daysOffset: -7, priority: "URGENT", responsible: "cerimonial" },
  { key: "1w-rings-check", title: "Conferir alianças e documentos", monthsBefore: 0, daysOffset: -3, priority: "URGENT", responsible: "noivo" },

  // Pós casamento
  { key: "+1w-devolucao", title: "Devolver vestido, smoking, decoração alugada", monthsBefore: -1, priority: "HIGH", responsible: "ambos" },
  { key: "+1w-agradecimentos", title: "Enviar mensagens de agradecimento", monthsBefore: -1, priority: "MEDIUM", responsible: "ambos" },
  { key: "+1m-fotos", title: "Cobrar entrega de fotos e vídeo", monthsBefore: -1, daysOffset: 30, priority: "MEDIUM", responsible: "ambos" },
] as const;

export function templateDeadline(eventDate: Date, t: TaskTemplate): Date {
  const d = new Date(eventDate.getTime());
  d.setUTCMonth(d.getUTCMonth() - t.monthsBefore);
  if (t.daysOffset) d.setUTCDate(d.getUTCDate() + t.daysOffset);
  return d;
}
