export type ChangelogEntry = {
  version: string;
  date: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.3.2",
    date: "2026-05-16",
    highlights: [
      "📱 Menu mobile unificado: o hamburger e o drawer lateral saíram. Agora só existe uma barra inferior com 4 atalhos fixos (Dashboard, Tarefas, Fornecedores, Convidados) + botão 'Mais'.",
      "👆 'Mais' abre uma gaveta deslizante (bottom sheet) com todos os itens agrupados por categoria (Financeiro / Casamento / Pessoas & Negócios / Sistema).",
      "↕️ Dá pra abrir a gaveta também arrastando para cima na barra inferior, e fechar arrastando para baixo, tocando fora ou pressionando Esc.",
      "🧭 'Mapa de assentos' deixou de aparecer no menu top-level — continua acessível dentro de 'Dia D'.",
      "♿ Foco preso dentro da gaveta enquanto aberta e devolvido ao botão 'Mais' ao fechar.",
    ],
  },
  {
    version: "0.3.1",
    date: "2026-05-16",
    highlights: [
      "🔌 WhatsApp agora sobe sozinho no boot do servidor (instrumentation.ts) — não depende mais do admin abrir o painel.",
      "🔁 Reconexão automática com back-off exponencial (3s → 60s) e watchdog que destrava a cadeia se algo prender.",
      "📧 Alerta por email para todos os ADMINs se a conexão ficar fora do ar > 1 min, ou se o WhatsApp pedir novo QR Code.",
      "✅ Email de recuperação quando a conexão volta. Anti-spam: no máximo 1 alerta por dia + 1 recovery por dia.",
      "ℹ️ Painel `/dashboard/settings` agora mostra contador de tentativas e horário da última queda enquanto o sistema reconecta.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-05-16",
    highlights: [
      "🪑 Mapa visual de assentos com drag-and-drop em /dashboard/wedding-day/seating.",
      "👨‍👩‍👧 Grupos de convidados (família) com link único de RSVP em /rsvp/group/[token].",
      "💸 QR Code Pix estático nos presentes (cota lua de mel) e baixa manual com criação opcional de Asset.",
      "📑 Gerador de N parcelas automáticas para contratos parcelados.",
      "📈 Multa e juros %/mês em pagamentos; valor ajustado aparece em listas e emails de cobrança.",
      "🛡️ Role PLANNER aplicada: cerimonialistas perdem acesso a Receitas, Caixa, Metas, Pagamentos e Insights.",
      "🧹 Soft delete global via Prisma Client Extension (sem precisar lembrar de filtrar deletedAt em queries).",
      "⚡ SQLite em modo WAL com busy_timeout de 5s (menos travamentos sob escrita concorrente).",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-05-15",
    highlights: [
      "🪄 Wizard de onboarding guiado para o primeiro acesso.",
      "🏠 Sistema generalizado: qualquer casal pode usar (sem hardcodes de data).",
      "🪟 Suporte oficial a Windows nativo via setup.ps1.",
      "📚 Pasta docs/ completa: instalação, arquitetura, módulos, segurança, deploy, etc.",
      "❓ Central de Ajuda interna (/dashboard/help) com busca, filtros, passo-a-passo e FAQ.",
      "📝 AGENTS.md reescrito como fonte de verdade técnica.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-04-01",
    highlights: [
      "✅ Versão inicial pública no GitHub (MIT).",
      "💍 14 módulos do dashboard: vendors, venues, tasks, payments, income, assets, goals, guests, gifts, honeymoon, trousseau, wedding-day, insights, settings.",
      "📨 Notificações por email (SMTP) e WhatsApp (Baileys).",
      "🔐 2FA TOTP, password reset por email/WhatsApp, audit log.",
      "📅 Export iCal e backup JSON.",
      "📱 PWA com service worker.",
    ],
  },
];
