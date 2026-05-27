export type ChangelogEntry = {
  version: string;
  date: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.6.5",
    date: "2026-05-27",
    highlights: [
      "📄 Listas longas agora são paginadas (20 itens por página) com controle numerado + Anterior/Próxima e o indicador 'Mostrando X–Y de Z'. Vale para Convidados, Tarefas (visão Lista), Pagamentos (visão Lista), Presentes, Enxoval, Fornecedores, Receitas, Caixa e o histórico de envios em Ajustes › Notificações.",
      "🔎 A busca e os filtros continuam instantâneos: a paginação recai sobre o resultado já filtrado e volta para a primeira página sempre que você muda o filtro.",
    ],
  },
  {
    version: "0.6.4",
    date: "2026-05-27",
    highlights: [
      "✉️ Agora dá para trocar o e-mail de qualquer usuário em Ajustes › Time (corrige o admin@admin.com padrão e cadastra os e-mails reais dos noivos) e o seu próprio e-mail em Perfil, confirmando a senha atual.",
      "📋 Nova aba Ajustes › Notificações: lista os últimos 50 envios de e-mail/WhatsApp com status (enviado/falhou) e a mensagem de erro — fim do mistério de 'o e-mail não chega'.",
      "💌 Quando um convidado responde o RSVP (individual ou em grupo), os noivos/gestores recebem um aviso por e-mail/WhatsApp (deduplicado por dia).",
    ],
  },
  {
    version: "0.6.3",
    date: "2026-05-27",
    highlights: [
      "🪑 'Mapa de assentos' voltou a ter porta de entrada na interface: item no menu lateral (grupo Casamento, abaixo de 'Dia D') e card de atalho no topo de 'Dia do casamento'. Antes só dava para chegar digitando a URL.",
      "↕️ As mesas agora podem ser reordenadas: arraste cada mesa pela alça (ícone de cabo no cabeçalho) para mudar a ordem no grid — a nova ordem fica salva. Os convidados continuam sendo arrastados normalmente para dentro das mesas.",
    ],
  },
  {
    version: "0.6.2",
    date: "2026-05-26",
    highlights: [
      "📥 Importação de convidados por arquivo em /dashboard/guests/import. Suporta planilhas do Wedy (.xlsx) e o CSV exportado pelo próprio sistema (.csv) — fecha o ciclo de export/reimport. Preview de novos vs. duplicados, lista de grupos detectados, PINs preservados e modo configurável (pular existentes / atualizar / criar tudo).",
      "🏷️ Novo model GuestTag (M:N). Tags vindas do import viram tags reais; 'Padrinhos', 'Madrinha' etc. ativam também a flag isPadrinho.",
      "🔢 GuestGroup agora tem rsvpPin (4-8 chars, informativo, vindo do convite original) e Guest ganhou age (idade exata para crianças).",
      "📞 No import do Wedy o telefone/email do responsável vai para GuestGroup.contactPhone/contactEmail (não para o Guest individual), refletindo que no Wedy o contato é por convite/família.",
    ],
  },
  {
    version: "0.6.1",
    date: "2026-05-26",
    highlights: [
      "👨‍👩‍👧 Importação CSV de convidados agora cria automaticamente os grupos/famílias presentes na coluna 'Grupo' (e reaproveita os existentes pelo nome). Convidados da mesma família já saem com `groupId` preenchido — basta abrir o grupo depois para configurar contato e copiar o link de RSVP coletivo.",
      "↩️ Tela de grupos (`/dashboard/guests/groups`) ganhou link 'Voltar para convidados' no topo, eliminando a necessidade de usar o botão do navegador.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-05-23",
    highlights: [
      "💾 Backup JSON v3 com envelope `{ checksum, payload }` (SHA-256), metadata do host/app/exporter e nome de arquivo padronizado (`wedding-finance-backup-YYYY-MM-DD.json`). ADMIN exporta também `users` (com bcrypt + 2FA secrets), `notificationLogs` e `auditLogs`. GROOM/BRIDE continuam exportando só os 22 modelos de negócio.",
      "🛡️ Endpoint `POST /api/backup/validate` faz dry-run do arquivo (Zod schema + checksum) sem tocar no banco. Retorna versão, contagens, warnings e issues.",
      "♻️ Endpoint `POST /api/backup/restore` apaga e recria todos os dados em uma única transação Prisma (timeout 120s). Exige role ADMIN, re-autenticação com senha bcrypt, confirmação explícita `WIPE_AND_RESTORE` e respeita rate-limit (3/h por usuário+IP). Preserva o admin logado quando ele não está no backup. Audit `BACKUP_RESTORE` ao final.",
      "🖥️ Tela Ajustes → Backup ganhou seção 'Restaurar backup' com seletor de arquivo, botão 'Validar arquivo' (mostra versão, contagens, host, checksum) e fluxo de restauração com senha + checkbox de irreversibilidade + confirm dialog.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-05-17",
    highlights: [
      "🌐 i18n: suporte a português (Brasil), inglês e espanhol. Cada usuário escolhe seu idioma no wizard de onboarding ou em /dashboard/profile.",
      "📨 Emails e WhatsApp são enviados no idioma do destinatário (User.locale propagado pelos crons e Server Actions).",
      "🤝 RSVP público respeita Guest.language e aceita override via ?lang=en (ou es). Páginas de login, esqueci-senha e reset também respondem ao idioma do navegador.",
      "🏗️ Toda a infraestrutura (next-intl 4 + catálogos em src/messages/) foi padronizada para que contribuições futuras adicionem chaves nos três idiomas no mesmo PR.",
    ],
  },
  {
    version: "0.4.5",
    date: "2026-05-17",
    highlights: [
      "🔍 Causa raiz do scroll horizontal encontrada: grids como `grid gap-6 md:grid-cols-2 lg:grid-cols-3` não tinham `grid-cols-1` como base. Em mobile (< md), sem `grid-template-columns` explícito, o CSS Grid usa colunas implícitas auto-sized (`grid-auto-columns: auto`) que se ajustam ao maior conteúdo — então o SVG do Recharts ou um nome de categoria longo esticava o grid além da viewport. Adicionado `grid-cols-1` como base em todos os 64 grids do dashboard.",
      "📱 Varredura complementar: componentes que tinham `min-w-0` mas faltavam `flex-1` (UpcomingTasks, RiskAlertStrip) e mini-cards (RsvpMini, GiftsMini) que não tinham nenhum dos dois ganharam ambos. Subtítulo do header e legenda do pie chart também receberam `break-words` + `min-w-0 max-w-full` para nomes longos.",
    ],
  },
  {
    version: "0.4.4",
    date: "2026-05-17",
    highlights: [
      "📱 Reforço contra scroll horizontal no mobile: `<html>` e `<body>` agora têm `overflow-x-clip` (defesa em profundidade) — mesmo se algum descendente futuro renderizar mais largo que a viewport, o document não rola.",
      "🥧 Gráfico de pizza 'Distribuição do Orçamento' agora aparece também no mobile. O container do chart tinha apenas `flex-1` sem altura definida em mobile (`lg:max-h-[380px]` só aplicava em desktop), o que resolvia em 0px de altura e o Recharts loga 'width(-1) and height(-1) of chart should be greater than 0' no console. Agora o wrapper recebe `h-[260px]` em mobile e mantém o comportamento `flex-1` em `lg+`.",
    ],
  },
  {
    version: "0.4.3",
    date: "2026-05-17",
    highlights: [
      "📱 Dashboard no mobile não rola mais lateralmente: cards do KPI ('Resumo do Orçamento', 'Total Já Pago' etc.) e o conteúdo principal ficavam mais largos que a viewport por causa do espaço inquebrável que o `R$` recebe no `Intl.NumberFormat` pt-BR — corrigido com `min-w-0` + `break-words` no valor e `overflow-x-hidden` no container principal.",
      "🔐 Tela de login não acusa mais 'Hydration mismatch' quando o navegador tem Keeper/1Password/LastPass instalado — os inputs e seus wrappers ganharam `suppressHydrationWarning`, ignorando os elementos que a extensão injeta antes do React rehydratar.",
      "🎯 Fim do loop de redirect no onboarding: quando o JWT estava com `onboardingCompleted: false` mas o banco já tinha o onboarding finalizado, a página fazia `redirect('/dashboard')` e o middleware mandava de volta para `/dashboard/onboarding`, derrubando o RSC com 'An unexpected response was received from the server'. Agora a página renderiza uma tela de transição que força o refresh do JWT via `window.location.assign` para o dashboard.",
      "🚀 Conclusão do onboarding usa `window.location.assign('/dashboard')` em vez de `router.push` + `router.refresh` — garante que o cookie da sessão seja reemitido antes da navegação, mesmo se o `useSession().update()` falhar no NextAuth v5 beta.",
    ],
  },
  {
    version: "0.4.2",
    date: "2026-05-16",
    highlights: [
      "📎 Primeiro PDF anexado a um contrato agora respeita a versão atual do contrato — antes, criar o contrato (v1) e enviar o PDF imediatamente já saltava para v2 sem motivo. Substituições posteriores continuam incrementando v2, v3…",
      "💬 O confirm dialog 'Criar nova versão?' só aparece quando já existe PDF anexado — primeiro upload é direto.",
    ],
  },
  {
    version: "0.4.1",
    date: "2026-05-16",
    highlights: [
      "📄 Preview do PDF do contrato voltou a abrir embutido no Chrome — o CSP `sandbox` que bloqueava o visualizador foi substituído por `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`, mantendo a proteção contra clickjacking.",
      "📱 Modais com muitos campos agora rolam corretamente em telas pequenas — antes o botão Salvar/Cancelar ficava cortado fora da tela em telefones. Padronizamos a abertura em `items-start` no mobile + `overflow-y-auto`.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-05-16",
    highlights: [
      "📊 Dashboard reformulado: KPIs com sparkline, Risk Strip de alertas consolidados, mini-cards de RSVP e presentes, próximas tarefas e funil de fornecedores no overview.",
      "🪞 Versão sanitizada do dashboard para FAMILY/VIEWER — sem expor valores em R$.",
      "📈 Novo hub /dashboard/reports com Funil de Fornecedores, Risk Radar, RSVP/Convidados, Presentes, Lua de Mel, Enxoval e Timeline de Atividade.",
      "📉 Insights ganhou três novas seções: Curva S (previsto vs realizado), Burndown de Tarefas e Waterfall de Variação por Categoria.",
      "🔐 Upload seguro de contratos: validação por magic bytes (PDF/PNG/JPEG/WEBP/HEIC), MIME por kind, hash SHA-256 completo e quem fez upload registrado.",
      "🧾 Versionamento de contrato: cada substituição cria v2, v3… A versão antiga fica arquivada (soft-delete) e o ciclo de assinatura digital/física pode ser registrado.",
      "🛡️ Endurecimento da rota /api/files: ownership granular por kind de anexo, rate-limit, CSP sandbox + nosniff, audit DOWNLOAD.",
      "🧹 Cron diário /api/cron/cleanup-files remove anexos soft-deletados após 30 dias e órfãos no FS.",
      "👀 Roles que veem contrato: ADMIN, GROOM, BRIDE e PLANNER. FAMILY/VIEWER continuam sem acesso a contratos.",
    ],
  },
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
