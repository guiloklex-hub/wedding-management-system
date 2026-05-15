import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CalendarHeart,
  CheckCircle2,
  CreditCard,
  Database,
  Gift,
  Lock,
  MessageSquare,
  PiggyBank,
  Plane,
  Rocket,
  ShoppingBasket,
  Sparkles,
  Target,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

export type HelpCategoryId =
  | "getting-started"
  | "financial"
  | "vendors"
  | "venues"
  | "tasks"
  | "guests"
  | "gifts"
  | "honeymoon-trousseau"
  | "wedding-day"
  | "communications"
  | "security"
  | "backup-calendar"
  | "troubleshooting";

export type HelpCategory = {
  id: HelpCategoryId;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
};

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "getting-started",
    label: "Primeiros passos",
    description: "Configure o sistema do zero",
    icon: Rocket,
    color: "rose",
  },
  {
    id: "financial",
    label: "Financeiro",
    description: "Orçamento, pagamentos e fluxo de caixa",
    icon: Wallet,
    color: "emerald",
  },
  {
    id: "vendors",
    label: "Fornecedores",
    description: "Negociação até contratação",
    icon: Users,
    color: "blue",
  },
  {
    id: "venues",
    label: "Locais",
    description: "Espaço, capacidade, checklist",
    icon: Banknote,
    color: "amber",
  },
  {
    id: "tasks",
    label: "Tarefas",
    description: "Templates e prazos",
    icon: CheckCircle2,
    color: "violet",
  },
  {
    id: "guests",
    label: "Convidados & RSVP",
    description: "Lista, presença, +1s, checkin",
    icon: Users,
    color: "cyan",
  },
  {
    id: "gifts",
    label: "Presentes",
    description: "Recebidos e agradecimentos",
    icon: Gift,
    color: "pink",
  },
  {
    id: "honeymoon-trousseau",
    label: "Lua de mel & Enxoval",
    description: "Viagem e compras pós-casamento",
    icon: Plane,
    color: "teal",
  },
  {
    id: "wedding-day",
    label: "Dia do Casamento",
    description: "Cronograma e plano B",
    icon: CalendarHeart,
    color: "rose",
  },
  {
    id: "communications",
    label: "Comunicações",
    description: "Email e WhatsApp",
    icon: MessageSquare,
    color: "emerald",
  },
  {
    id: "security",
    label: "Segurança",
    description: "2FA, senhas, audit log",
    icon: Lock,
    color: "amber",
  },
  {
    id: "backup-calendar",
    label: "Backup & Calendário",
    description: "Exportações e backup JSON",
    icon: Database,
    color: "blue",
  },
  {
    id: "troubleshooting",
    label: "Solução de problemas",
    description: "Erros comuns e como resolver",
    icon: Wrench,
    color: "zinc",
  },
];

export type HelpArticleStep = { title: string; body: string };

export type HelpArticle = {
  id: string;
  title: string;
  category: HelpCategoryId;
  keywords: string[];
  icon: LucideIcon;
  summary: string;
  steps?: HelpArticleStep[];
  tips?: string[];
  warnings?: string[];
  externalDoc?: string;
};

export const HELP_ARTICLES: HelpArticle[] = [
  // ============ getting-started ============
  {
    id: "first-login",
    title: "Primeiro acesso ao sistema",
    category: "getting-started",
    keywords: ["login", "primeiro", "começar", "admin", "senha provisória"],
    icon: Sparkles,
    summary: "Como entrar pela primeira vez e o que esperar.",
    steps: [
      {
        title: "Acesse http://localhost:3005",
        body: "Após rodar `./setup.sh` (ou `setup.ps1` no Windows) e `npm run dev`, abra esse endereço no navegador.",
      },
      {
        title: "Login com credenciais do seed",
        body: "Email: `admin@admin.com` — Senha: `admin` (ou o valor de ADMIN_PASSWORD no .env).",
      },
      {
        title: "Defina uma nova senha",
        body: "O sistema força você a trocar a senha provisória antes de continuar. Use uma senha forte (mínimo 8 caracteres).",
      },
      {
        title: "Complete o Wizard de Configuração",
        body: "Em seguida, o assistente de onboarding abre automaticamente. Preencha os 4 passos: casal, orçamento, comunicações e revisão.",
      },
    ],
    tips: ["Anote a senha em um gerenciador (1Password, Bitwarden, etc.)."],
  },
  {
    id: "onboarding-wizard",
    title: "Wizard de configuração inicial",
    category: "getting-started",
    keywords: ["onboarding", "wizard", "configurar", "evento", "nomes casal", "data"],
    icon: Rocket,
    summary: "Os 4 passos do assistente que personalizam o sistema para o seu casamento.",
    steps: [
      {
        title: "Passo 1 — O casal",
        body: "Preencha os nomes (ex.: 'Maria & João'), a data do casamento e a moeda (BRL por padrão).",
      },
      {
        title: "Passo 2 — Orçamento",
        body: "Defina a porcentagem de contingência (reserva para imprevistos). Recomendado: 10%.",
      },
      {
        title: "Passo 3 — Comunicações",
        body: "Aqui apenas explicamos como configurar email e WhatsApp depois — você ajusta em Ajustes.",
      },
      {
        title: "Passo 4 — Revisão",
        body: "Confira o resumo e clique em 'Concluir e ir ao painel'.",
      },
    ],
    tips: [
      "Você pode editar tudo depois em **Ajustes › Casamento**.",
      "A data do casamento influencia: templates de tarefas, contagem regressiva, alertas e fluxo de caixa.",
    ],
  },
  {
    id: "add-team-members",
    title: "Adicionar outro usuário (admin)",
    category: "getting-started",
    keywords: ["usuário", "membro", "convite", "noivo", "noiva", "admin"],
    icon: Users,
    summary: "Como criar outras contas para que o(a) parceiro(a) ou cerimonial também acessem.",
    steps: [
      { title: "Vá em Ajustes › Time", body: "Como ADMIN, abra o menu Ajustes e vá na aba 'Time'." },
      { title: "Clique em 'Novo usuário'", body: "Preencha nome, email, telefone (opcional) e role." },
      {
        title: "O sistema envia credenciais",
        body: "Uma senha provisória é gerada e enviada por email (e WhatsApp, se configurado) ao novo usuário.",
      },
      { title: "Primeiro login do convidado", body: "Ele(a) será forçado(a) a trocar a senha imediatamente." },
    ],
    warnings: ["O cadastro público está desativado — só admins criam contas."],
  },

  // ============ financial ============
  {
    id: "budget-overview",
    title: "Entendendo o orçamento",
    category: "financial",
    keywords: ["orçamento", "valor estimado", "valor real", "contratado", "pago"],
    icon: PiggyBank,
    summary: "Como o sistema calcula o orçamento total e os indicadores do dashboard.",
    steps: [
      {
        title: "Cada fornecedor tem itens orçamentários",
        body: "Em /dashboard/vendors/[id], você adiciona itens (BudgetItem) com 'valor estimado' e, depois, 'valor real'.",
      },
      {
        title: "Cálculo do total",
        body: "O dashboard soma o real (se preenchido) ou o estimado de cada item, mais o fundo de contingência.",
      },
      {
        title: "Pago vs Devedor",
        body: "Pagamentos com status PAID entram em 'Total Pago'. O saldo devedor é total - pago.",
      },
    ],
  },
  {
    id: "register-payment",
    title: "Registrar um pagamento",
    category: "financial",
    keywords: ["pagamento", "parcela", "PIX", "boleto", "vencimento"],
    icon: CreditCard,
    summary: "Cadastrar um pagamento pontual ou parcelado para um fornecedor.",
    steps: [
      { title: "Abra Pagamentos no menu", body: "/dashboard/payments." },
      { title: "Novo pagamento", body: "Selecione o fornecedor, valor, vencimento e método (PIX, boleto, cartão, transferência, dinheiro)." },
      {
        title: "Parcelado?",
        body: "Marque a opção e informe quantas parcelas. O sistema cria N entradas com vencimentos mensais.",
      },
      {
        title: "Marcar como pago",
        body: "Quando pagar, clique no ✓. O campo `paidAt` é preenchido com o agora e o status vira PAID.",
      },
    ],
    tips: [
      "Lembretes automáticos por email/WhatsApp começam **3 dias antes** do vencimento (se cron estiver configurado).",
    ],
  },
  {
    id: "cashflow-insights",
    title: "Insights e Health Score",
    category: "financial",
    keywords: ["insights", "fluxo de caixa", "saúde", "projeção", "heatmap"],
    icon: Target,
    summary: "Como ler o painel de Insights — projeção financeira até o dia do casamento.",
    tips: [
      "**Worst monthly balance** vermelho? Antecipe receita ou negocie parcela.",
      "**Health Score** abaixo de 50 sugere risco: olhe quais tarefas estão atrasadas e qual o saldo de caixa.",
      "O **heatmap** mostra concentração de pagamentos por dia — útil para nivelar.",
    ],
  },

  // ============ vendors ============
  {
    id: "vendor-flow",
    title: "Fluxo de fornecedores",
    category: "vendors",
    keywords: ["fornecedor", "negociação", "contratado", "finalizado", "vendor"],
    icon: Users,
    summary: "Os 3 status e o que cada um significa.",
    steps: [
      {
        title: "NEGOTIATION",
        body: "Você está conversando, comparando preços. Não conta no orçamento total ainda.",
      },
      {
        title: "CONTRACTED",
        body: "Contrato assinado, entra no orçamento e no fundo de contingência.",
      },
      {
        title: "FINALIZED",
        body: "Serviço prestado e tudo pago. Vai para histórico.",
      },
    ],
  },
  {
    id: "vendor-compare",
    title: "Comparar fornecedores lado-a-lado",
    category: "vendors",
    keywords: ["comparar", "comparador", "vendor compare"],
    icon: Users,
    summary: "Use o comparador para decidir entre concorrentes.",
    steps: [
      { title: "Acesse /dashboard/vendors/compare", body: "Botão 'Comparar' na lista de fornecedores." },
      { title: "Selecione 2 a 4", body: "Marque os fornecedores que quer comparar." },
      { title: "Veja a tabela", body: "Aparecem itens orçamentários, contratos, contatos e notas lado-a-lado." },
    ],
  },

  // ============ venues ============
  {
    id: "venue-shortlist",
    title: "Shortlist de locais",
    category: "venues",
    keywords: ["local", "venue", "shortlist", "visitar"],
    icon: Banknote,
    summary: "Marque os locais favoritos com a estrela e use o checklist na visita.",
    steps: [
      { title: "Cadastre o local", body: "Nome, endereço, capacidade (sentados/em pé), preço base." },
      { title: "Adicione checklist", body: "Itens ordenáveis para conferir durante a visita técnica." },
      { title: "Marque como shortlisted", body: "Os destacados aparecem com badge na lista principal." },
      { title: "Registre a visita", body: "Preencha `visitedAt` com a data da visita." },
    ],
  },

  // ============ tasks ============
  {
    id: "task-templates",
    title: "Usar templates de tarefas",
    category: "tasks",
    keywords: ["tarefa", "template", "checklist", "noivo", "noiva", "cerimonial"],
    icon: CheckCircle2,
    summary: "Importe ~40 tarefas pré-prontas calculadas a partir da data do casamento.",
    steps: [
      { title: "Tenha a data configurada", body: "Sem data não dá — vá em Ajustes › Casamento se faltar." },
      { title: "Em /dashboard/tasks, clique em 'Importar templates'", body: "O sistema cria tarefas com deadlines relativos ao seu evento." },
      { title: "Responsáveis sugeridos", body: "Cada tarefa vem com um responsável-padrão (noivo, noiva, ambos, cerimonial). Edite se quiser." },
    ],
    tips: ["Importar é **idempotente** — rodar de novo não duplica tarefas já criadas."],
  },

  // ============ guests ============
  {
    id: "guest-rsvp",
    title: "Como funciona o RSVP",
    category: "guests",
    keywords: ["rsvp", "convidado", "link", "presença", "confirmação"],
    icon: Users,
    summary: "Cada convidado recebe um link único para confirmar presença.",
    steps: [
      {
        title: "Cadastre o convidado",
        body: "Vá em /dashboard/guests e adicione (nome, telefone, lado da família, +1s permitidos).",
      },
      {
        title: "O sistema gera um token único",
        body: "URL: `https://seudominio/rsvp/[token]`. Você compartilha esse link via mensagem.",
      },
      {
        title: "Convidado abre o link",
        body: "Vê 'Oi NOME!' + formulário para confirmar (ou não) presença, +1s e restrição alimentar.",
      },
      {
        title: "Você acompanha em /dashboard/guests",
        body: "Status (INVITED → CONFIRMED/DECLINED/MAYBE) atualiza em tempo real.",
      },
    ],
    warnings: ["Token vazado? Regenere via Prisma Studio ou abra issue."],
  },
  {
    id: "guest-checkin",
    title: "Check-in no dia",
    category: "guests",
    keywords: ["checkin", "dia d", "chegada"],
    icon: CheckCircle2,
    summary: "Marque quem chegou diretamente da tela 'Dia D'.",
    steps: [
      { title: "Acesse /dashboard/wedding-day", body: "Bloco 'Check-in rápido' lá embaixo." },
      { title: "Busque pelo nome", body: "Filtro instantâneo." },
      { title: "Clique no botão 'Marcar'", body: "Vira 'Chegou' (com `checkedInAt` setado para agora)." },
    ],
  },

  // ============ gifts ============
  {
    id: "gift-track",
    title: "Acompanhar presentes",
    category: "gifts",
    keywords: ["presente", "agradecimento", "thanked", "dinheiro", "item"],
    icon: Gift,
    summary: "Registre presentes recebidos e marque quando agradecer.",
    steps: [
      { title: "Vá em /dashboard/gifts", body: "Clique em 'Novo presente'." },
      { title: "Tipo", body: "CASH (dinheiro) ou ITEM (objeto físico). Cash exige `amount`." },
      { title: "Vincule a um convidado (opcional)", body: "Útil para mandar agradecimento personalizado." },
      { title: "Marque 'Agradecido'", body: "Quando enviar a nota de agradecimento, atualize `thankedAt`." },
    ],
  },

  // ============ honeymoon-trousseau ============
  {
    id: "honeymoon-plan",
    title: "Planejar a lua de mel",
    category: "honeymoon-trousseau",
    keywords: ["lua de mel", "honeymoon", "viagem", "destino"],
    icon: Plane,
    summary: "Tela dedicada com destino, datas, orçamento e itens (atividades/voos/hotéis).",
    steps: [
      { title: "Defina destino e datas", body: "Em /dashboard/honeymoon." },
      { title: "Adicione itens", body: "Cada item tem tipo (ACTIVITY/FLIGHT/STAY), valor, status, `confirmationNumber`." },
      { title: "Acompanhe orçamento", body: "O total dos itens vs. `budget` configurado é exibido no topo." },
    ],
  },
  {
    id: "trousseau",
    title: "Lista de enxoval",
    category: "honeymoon-trousseau",
    keywords: ["enxoval", "casa", "compras", "cômodo", "lista"],
    icon: ShoppingBasket,
    summary: "Itens da casa nova, organizados por cômodo e prioridade.",
    steps: [
      { title: "Cadastre por cômodo", body: "COZINHA, SALA, QUARTO, BANHEIRO, LAVANDERIA, OUTRO." },
      { title: "Defina prioridade", body: "MUST_HAVE (indispensável) vs NICE_TO_HAVE (opcional)." },
      { title: "Marque como comprado", body: "Status muda de TO_BUY para BOUGHT; informe `actualPrice` para tracking financeiro." },
    ],
  },

  // ============ wedding-day ============
  {
    id: "wedding-day-prep",
    title: "Preparar o painel do dia D",
    category: "wedding-day",
    keywords: ["dia d", "cronograma", "plano b", "chuva", "checkin"],
    icon: CalendarHeart,
    summary: "Tudo o que precisa estar pronto antes do dia 0.",
    steps: [
      {
        title: "Cronograma do dia",
        body: "Texto livre. Liste horários: '07:00 cabeleireiro · 11:00 fotógrafo · 16:30 cerimônia...'",
      },
      {
        title: "Plano B chuva",
        body: "Outro texto livre — o que fazer se chover (tendas, mudar para coberto).",
      },
      {
        title: "Observações especiais",
        body: "Música primeira dança, valsa, sabores do bolo, surpresas.",
      },
      {
        title: "Contatos críticos aparecem sozinhos",
        body: "Todos os fornecedores CONTRACTED/FINALIZED com contato primário ficam visíveis com botão wa.me direto.",
      },
    ],
  },

  // ============ communications ============
  {
    id: "smtp-config",
    title: "Configurar SMTP (email)",
    category: "communications",
    keywords: ["smtp", "email", "gmail", "app password", "outlook"],
    icon: MessageSquare,
    summary: "Como conectar o sistema ao seu provedor de email.",
    steps: [
      { title: "Tenha as credenciais", body: "Para Gmail, gere uma App Password em https://myaccount.google.com/apppasswords." },
      {
        title: "Edite `.env` (ou Ajustes)",
        body: "Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM. Reinicie o servidor após mudar .env.",
      },
      { title: "Teste", body: "Crie uma tarefa com deadline em alguns minutos e rode o cron manualmente para validar." },
    ],
    warnings: [
      "Gmail só aceita **App Password** (16 caracteres). Senha normal **não** funciona desde 2022.",
      "Office 365 costuma ter SMTP basic auth bloqueado por padrão — use SendGrid/Amazon SES como relay.",
    ],
  },
  {
    id: "whatsapp-connect",
    title: "Conectar WhatsApp via QR Code",
    category: "communications",
    keywords: ["whatsapp", "baileys", "qr code", "notificação"],
    icon: MessageSquare,
    summary: "Pareie um número WhatsApp para enviar lembretes.",
    steps: [
      { title: "Logue como ADMIN", body: "Vá em /dashboard/settings, aba 'WhatsApp'." },
      { title: "Clique em 'Conectar'", body: "Um QR Code aparece na tela." },
      {
        title: "Escaneie pelo celular",
        body: "WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho → escaneie.",
      },
      { title: "Pronto!", body: "Status muda para 'Conectado'. Use o botão 'Enviar teste' para validar." },
    ],
    warnings: [
      "**Não use o mesmo número** para enviar e receber — Baileys rejeita.",
      "Sessão fica em `.whatsapp-auth/` — não comitar! Já está gitignored.",
    ],
  },
  {
    id: "cron-reminders",
    title: "Cron de lembretes automáticos",
    category: "communications",
    keywords: ["cron", "lembrete", "automático", "vencimento"],
    icon: MessageSquare,
    summary: "Como configurar o sistema para enviar lembretes sem você precisar fazer nada.",
    steps: [
      { title: "Pegue o CRON_SECRET", body: "Está no seu .env (o setup gera um automaticamente)." },
      {
        title: "Adicione ao crontab (Linux/Mac/WSL)",
        body: "`*/30 * * * * curl -fsS -H \"Authorization: Bearer SEU_CRON_SECRET\" http://localhost:3005/api/cron/reminders`",
      },
      {
        title: "No Windows, use o Agendador de Tarefas",
        body: "Veja docs/instalacao-windows.md seção 'Cron de lembretes'.",
      },
    ],
  },

  // ============ security ============
  {
    id: "enable-2fa",
    title: "Ativar 2FA (autenticação de dois fatores)",
    category: "security",
    keywords: ["2fa", "totp", "google authenticator", "authy", "1password"],
    icon: Lock,
    summary: "Camada extra de segurança no login com código de 6 dígitos.",
    steps: [
      { title: "Vá em /dashboard/settings → Segurança", body: "Botão 'Ativar 2FA'." },
      {
        title: "Escaneie o QR no seu app",
        body: "Google Authenticator, Authy, 1Password ou similar.",
      },
      {
        title: "Digite o código atual",
        body: "Para confirmar que o app está sincronizado.",
      },
      {
        title: "Guarde os backup codes",
        body: "10 códigos one-time que funcionam se você perder o celular. Imprima ou salve no gerenciador.",
      },
    ],
  },
  {
    id: "password-reset",
    title: "Esqueceu a senha?",
    category: "security",
    keywords: ["esqueci", "reset", "senha", "recuperar"],
    icon: Lock,
    summary: "Use /forgot-password — o sistema envia link de reset por email e WhatsApp.",
    steps: [
      { title: "Acesse /forgot-password", body: "Botão 'Esqueci minha senha' na tela de login." },
      { title: "Digite seu email", body: "Se a conta existir, link é enviado." },
      { title: "Verifique caixa de entrada e WhatsApp", body: "Link expira em 60 minutos." },
      { title: "Defina nova senha", body: "Mínimo 8 caracteres (ou o que estiver configurado em SecuritySettings)." },
    ],
  },

  // ============ backup-calendar ============
  {
    id: "backup-download",
    title: "Baixar backup dos dados",
    category: "backup-calendar",
    keywords: ["backup", "json", "exportar", "download", "lgpd"],
    icon: Database,
    summary: "Exporte todos os seus dados em um único arquivo JSON.",
    steps: [
      { title: "Logue como ADMIN", body: "/dashboard/settings → aba 'Backup'." },
      { title: "Clique em 'Baixar JSON'", body: "Arquivo nomeado `wedding-finance-backup-YYYY-MM-DD.json`." },
      { title: "Guarde em local seguro", body: "Recomendamos fazer backup semanalmente." },
    ],
  },
  {
    id: "calendar-subscribe",
    title: "Importar tarefas no Google Calendar",
    category: "backup-calendar",
    keywords: ["calendário", "google calendar", "apple", "ics", "icalendar"],
    icon: CalendarHeart,
    summary: "Tenha suas tarefas e pagamentos sincronizados na agenda do celular.",
    steps: [
      {
        title: "Copie a URL do feed",
        body: "https://seu-dominio/api/calendar.ics — exige login.",
      },
      {
        title: "Google Calendar → Adicionar calendário → Por URL",
        body: "Cole o link. Aparece como calendário 'Wedding Finance' nas suas agendas.",
      },
      {
        title: "Atualizações automáticas",
        body: "Google sincroniza periodicamente (algumas horas).",
      },
    ],
    warnings: [
      "Como exige login, o Google não consegue acessar a URL em alguns cenários. Para uma versão pública (com token opaco), abra uma issue.",
    ],
  },

  // ============ troubleshooting ============
  {
    id: "common-errors",
    title: "Problemas mais comuns",
    category: "troubleshooting",
    keywords: ["erro", "problema", "não funciona", "ajuda"],
    icon: Wrench,
    summary: "Lista rápida dos erros mais frequentes. Para detalhes, veja docs/troubleshooting.md.",
    tips: [
      "**SQLITE_BUSY:** outro processo está com o banco aberto. Feche o Prisma Studio.",
      "**Gmail rejeitando email:** use App Password, não a senha normal.",
      "**WhatsApp desconectou:** reconecte em Ajustes › WhatsApp.",
      "**Loop login → dashboard → login:** apague cookies e reload.",
      "**Templates de tarefas dão erro:** configure a data do evento em Ajustes › Casamento.",
    ],
    externalDoc: "/docs/troubleshooting.md",
  },
];

export type FaqItem = { question: string; answer: string };

export const HELP_FAQ: FaqItem[] = [
  {
    question: "O sistema é gratuito?",
    answer:
      "Sim! É open-source com licença MIT. Você instala na sua máquina e usa sem pagar nada. Os custos podem ser apenas se você quiser uma VPS ou usar provedores pagos de SMTP.",
  },
  {
    question: "Vários casais podem usar a mesma instalação?",
    answer:
      "Não — o sistema é single-tenant (uma instalação = um casamento). Cada casal precisa de uma instalação separada.",
  },
  {
    question: "Funciona offline?",
    answer:
      "Parcialmente. Há um Service Worker que cacheia o app shell, mas as ações (criar pagamento, salvar tarefa) precisam de conexão com o servidor local.",
  },
  {
    question: "Posso usar em produção sem domínio próprio?",
    answer:
      "Tecnicamente sim (acessando por IP), mas o Auth.js v5 exige domínio e HTTPS para cookies seguros. Recomendamos um domínio + Cloudflare Tunnel ou Let's Encrypt.",
  },
  {
    question: "Os convidados precisam criar conta para responder o RSVP?",
    answer:
      "Não — cada convidado tem um link único `/rsvp/[token]` que funciona sem login. Você compartilha pelo WhatsApp ou outro canal.",
  },
  {
    question: "Como mudar a data do casamento depois do onboarding?",
    answer:
      "Ajustes › Casamento. Mude a data e salve. Tarefas geradas por template **não** recalculam automaticamente — exclua-as antes de importar de novo.",
  },
  {
    question: "Posso compartilhar o acesso com o cerimonial?",
    answer:
      "Sim. Em Ajustes › Time, crie um usuário com role 'USER' para o cerimonial. Ele(a) vai ter acesso ao painel.",
  },
  {
    question: "Como zerar o banco e começar do zero?",
    answer: "Rode `./setup.sh --reset-db` (ou `.\\setup.ps1 -ResetDb`). Apaga TUDO. Faça backup antes.",
  },
  {
    question: "Suporta múltiplas moedas?",
    answer:
      "A moeda principal é definida no evento (BRL/USD/EUR). Lua de mel pode ter moeda própria nos itens. Não há conversão automática.",
  },
  {
    question: "Como obter ajuda quando trava algo?",
    answer:
      "1) Verifique `docs/troubleshooting.md`. 2) Abra issue no GitHub com detalhes (SO, Node version, erro completo). 3) Para perguntas de produto, use Discussions.",
  },
];
