import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BarChart3,
  CalendarHeart,
  CheckCircle2,
  CreditCard,
  Database,
  FileText,
  Gift,
  Lock,
  MessageSquare,
  PiggyBank,
  Plane,
  Rocket,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Target,
  Upload,
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
  | "reports"
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
    id: "reports",
    label: "Relatórios de BI",
    description: "Curva S, Funil, RSVP, Risk Radar e mais",
    icon: BarChart3,
    color: "violet",
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
      {
        title: "Trocar o e-mail de um usuário",
        body: "Em Ajustes › Time, edite o membro e altere o campo 'E-mail'. É assim que você corrige o admin@admin.com padrão e cadastra os e-mails reais dos noivos. Cada um também pode trocar o próprio e-mail em Perfil (pedindo a senha atual).",
      },
    ],
    tips: [
      "O e-mail é o login. Ao trocá-lo, use o novo no próximo login — a sessão aberta continua valendo.",
      "Sem um e-mail real cadastrado, lembretes e avisos de RSVP falham no envio (veja Ajustes › Notificações).",
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
    id: "save-the-date",
    title: "Enviar Save the Date aos convidados",
    category: "communications",
    keywords: ["save the date", "convite", "aviso", "site dos noivos", "lista de presentes", "whatsapp", "anexo"],
    icon: MessageSquare,
    summary: "Avise a data com uma arte (imagem/PDF) + mensagem, por WhatsApp/e-mail, antes do convite oficial.",
    steps: [
      {
        title: "Monte o conteúdo",
        body: "Em Save the Date, suba a arte (PNG, JPG, WEBP ou PDF, até 10 MB), preencha o Site dos noivos e a Lista de presentes (opcionais — links externos como Wedy) e escreva a mensagem.",
      },
      {
        title: "Use as variáveis",
        body: "Na mensagem, {nomes}, {convidados}, {data} e {local} são preenchidos automaticamente por destinatário. Se ficar em branco, uma mensagem padrão é usada. Os links de site/presentes aparecem sozinhos quando preenchidos.",
      },
      {
        title: "Faça um teste",
        body: "Clique em 'Testar no WhatsApp' ou 'Testar por e-mail' para receber o Save the Date no seu próprio contato antes do disparo.",
      },
      {
        title: "Dispare para todos",
        body: "'Iniciar envio' manda uma mensagem por grupo (no telefone do grupo, citando os integrantes) e uma por convidado avulso. A fila respeita um intervalo entre mensagens para não ser bloqueada pelo WhatsApp; acompanhe a barra de progresso e reenvie as falhas.",
      },
    ],
    tips: [
      "Telefones devem ter código do país (ex.: +5511999990000) para o WhatsApp. Sem telefone válido, cai no e-mail; sem nenhum dos dois, o destinatário é ignorado.",
      "O ritmo do envio é configurável via `BROADCAST_INTERVAL_MS` no .env (padrão 4000ms).",
    ],
    warnings: [
      "Defina a data e os nomes do casal (no onboarding) antes de enviar.",
      "Envios disparam mensagens reais — use sempre o teste primeiro.",
    ],
  },
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
      {
        title: "Diagnostique falhas em Ajustes › Notificações",
        body: "Os últimos 50 envios aparecem ali com status SENT/FAILED e a mensagem de erro do SMTP. Erros repetidos para admin@admin.com indicam que o e-mail placeholder do seed ainda não foi trocado (faça isso em Ajustes › Time ou no Perfil).",
      },
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
    id: "whatsapp-auto-recovery",
    title: "Auto-ressurect do WhatsApp e alertas por email",
    category: "communications",
    keywords: ["whatsapp", "queda", "alerta", "email", "reconexão", "watchdog"],
    icon: MessageSquare,
    summary:
      "Se o WhatsApp cair, o sistema tenta voltar sozinho e te avisa por email quando precisa de ação.",
    steps: [
      {
        title: "Boot automático",
        body: "O socket sobe junto com o servidor (via instrumentation.ts). Não precisa abrir o painel pra começar a enviar.",
      },
      {
        title: "Reconexão com back-off",
        body: "Em caso de queda, tenta de novo em 3s, 6s, 12s, 24s, 48s e teto de 60s. Um watchdog cuida pra cadeia não travar.",
      },
      {
        title: "Email para admins",
        body: "Após ~1 min sem reconectar (3 tentativas falhas) ou quando o WhatsApp pede QR novo, todos os usuários com role ADMIN ativos recebem um email com o motivo e o link para abrir as configurações.",
      },
      {
        title: "Email de recuperação",
        body: "Quando a conexão volta após uma queda já alertada, sai um email '✅ WhatsApp voltou' com o tempo de downtime.",
      },
    ],
    tips: [
      "Para desativar o autostart em dev, defina `WHATSAPP_AUTOSTART=\"false\"` no .env.",
      "Anti-spam: no máximo 1 email DOWN por dia + 1 RECOVERED por dia para o mesmo incidente.",
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
    tips: [
      "O dia do vencimento no lembrete é exibido sempre como a data cadastrada (em UTC) — sem 'voltar um dia' por causa do fuso horário.",
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
    keywords: ["backup", "json", "exportar", "download", "lgpd", "checksum"],
    icon: Database,
    summary: "Exporte todos os dados (v3, com checksum SHA-256) em um único JSON.",
    steps: [
      { title: "Logue como ADMIN, GROOM ou BRIDE", body: "/dashboard/settings → aba 'Backup'." },
      { title: "Clique em 'Exportar backup JSON'", body: "Arquivo nomeado `wedding-finance-backup-YYYY-MM-DD.json` com envelope `{ checksum, payload }`." },
      { title: "Guarde em local seguro", body: "Inclui hashes bcrypt das senhas e secrets de 2FA — trate como secret. Faça backup semanal mais antes/depois do casamento." },
    ],
    tips: [
      "O checksum SHA-256 é validado automaticamente antes de qualquer restauração.",
      "v3 inclui Users, NotificationLog e AuditLog quando exportado por ADMIN. Roles GROOM/BRIDE exportam só dados de negócio.",
    ],
  },
  {
    id: "backup-restore",
    title: "Restaurar backup",
    category: "backup-calendar",
    keywords: ["restore", "restaurar", "backup", "import", "wipe"],
    icon: Database,
    summary: "Apaga e recria todos os dados a partir de um arquivo JSON exportado pelo sistema.",
    steps: [
      { title: "Faça backup do estado atual primeiro", body: "Antes de restaurar, exporte um backup novo. O restore é IRREVERSÍVEL." },
      { title: "Logue como ADMIN", body: "Restore é restrito a admins. Outras roles só conseguem validar o arquivo." },
      { title: "Ajustes → Backup → Restaurar backup", body: "Selecione o arquivo. Clique em 'Validar arquivo' primeiro para conferir checksum, versão e contagens." },
      { title: "Confirme com sua senha", body: "Digite a senha do admin logado, marque o aviso de irreversibilidade e clique 'Restaurar agora'." },
    ],
    warnings: [
      "Apaga e recria todos os dados em uma transação Prisma única. Em caso de erro, nenhum registro é commitado.",
      "Rate-limit: 3 tentativas por hora por usuário+IP.",
      "Se o backup contém seu próprio usuário, sua sessão pode expirar logo após o restore — relogue com as credenciais do backup.",
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
      "**Login trava na própria tela após submeter:** o sistema agora redireciona direto pra `/dashboard` (ou o `callbackUrl` válido). Se ainda travar, confira se há service worker antigo cacheado.",
      "**Templates de tarefas dão erro:** configure a data do evento em Ajustes › Casamento.",
    ],
    externalDoc: "/docs/troubleshooting.md",
  },
  // ============ novos artigos (0.3.2) ============
  {
    id: "mobile-nav",
    title: "Como navegar no celular",
    category: "getting-started",
    keywords: ["menu", "mobile", "celular", "navegação", "barra inferior", "bottom"],
    icon: Sparkles,
    summary:
      "No celular, todo o menu vive na barra inferior. Os 4 atalhos mais usados ficam à vista e o resto está em 'Mais'.",
    steps: [
      {
        title: "Quatro atalhos sempre à mão",
        body: "Dashboard, Tarefas, Fornecedores e Convidados ficam fixos no rodapé, em qualquer tela.",
      },
      {
        title: "Botão 'Mais' abre o menu completo",
        body: "Toque no quinto ícone (grade) para abrir uma gaveta com todos os módulos agrupados em Financeiro, Casamento, Pessoas & Negócios e Sistema.",
      },
      {
        title: "Atalho por gesto",
        body: "Também dá pra arrastar para cima na barrinha do topo do rodapé para abrir a gaveta — e arrastar para baixo (ou tocar fora) para fechar.",
      },
      {
        title: "Mapa de assentos",
        body: "Saiu do menu principal — entre em 'Dia D' e o atalho para o mapa aparece lá dentro.",
      },
    ],
    tips: [
      "Cerimonialistas (role PLANNER) não veem o grupo 'Financeiro' na gaveta.",
      "No desktop nada mudou: a barra lateral à esquerda continua igual.",
    ],
  },
  // ============ novos artigos (0.3.0) ============
  {
    id: "seating-chart",
    title: "Mapa visual de assentos",
    category: "wedding-day",
    keywords: ["mesa", "assento", "lugar", "seating", "salão", "layout", "drag", "reordenar"],
    icon: Users,
    summary:
      "Arraste convidados confirmados para mesas com capacidade definida. Abra pelo menu 'Mapa de assentos' (grupo Casamento) ou pelo card no topo de 'Dia do casamento'.",
    steps: [
      { title: "Abra o mapa", body: "Menu lateral → 'Mapa de assentos' (logo abaixo de 'Dia D'), ou card de atalho no topo da tela 'Dia do casamento'." },
      { title: "Crie mesas", body: "Botão 'Nova mesa' — defina nome, capacidade e formato (redonda/retangular/quadrada)." },
      { title: "Arraste convidados", body: "O pool lateral lista só quem está CONFIRMADO. Solte um chip em cima da mesa; a capacidade considera +1 confirmados." },
      { title: "Reordene as mesas", body: "Arraste cada mesa pela alça (ícone de cabo no cabeçalho) para mudar a ordem no grid. A nova ordem fica salva." },
      { title: "Desaloque ou reorganize", body: "Solte de volta no pool para liberar o assento, ou em outra mesa para realocar." },
    ],
    tips: [
      "Capacidade leva em conta acompanhantes. Convidado com +2 ocupa 3 assentos.",
      "Mesa cheia recusa o drop e mostra toast.",
      "Só a alça move a mesa — assim os chips de convidado dentro do card continuam clicáveis e arrastáveis.",
    ],
  },
  {
    id: "guest-groups",
    title: "Grupos / Famílias e RSVP coletivo",
    category: "guests",
    keywords: ["grupo", "família", "rsvp", "convite", "household"],
    icon: Users,
    summary:
      "Junte convidados em um grupo e envie um único link de RSVP — o responsável confirma por todos.",
    steps: [
      { title: "Crie um grupo", body: "Em Convidados, clique 'Grupos' › 'Novo grupo'. Preencha nome (ex.: Família Silva) e contato do responsável." },
      { title: "Adicione membros", body: "Clique 'Membros' no grupo, marque os convidados que pertencem a ele." },
      { title: "Envie o link", body: "Botão 'Copiar link' gera /rsvp/group/{token}. Envie pelo WhatsApp ao responsável." },
    ],
    tips: [
      "RSVP individual continua funcionando — o link de grupo é alternativa, não substituto.",
      "Cada convidado pode estar em apenas um grupo.",
      "Importou um CSV com a coluna 'Grupo' preenchida? Os grupos são criados automaticamente (e os existentes reaproveitados pelo nome) — basta abrir o grupo depois para preencher contato e copiar o link.",
    ],
    warnings: [
      "Convidados ou grupos arquivados não aparecem mais no RSVP de grupo — ninguém confirma em nome de quem já saiu da lista.",
      "A página tem limite de tentativas por IP: links de grupo divulgados em excesso podem ser temporariamente barrados como proteção anti-abuso.",
    ],
  },
  {
    id: "guest-import-wedy",
    title: "Importar lista do Wedy (.xlsx) ou do próprio sistema (.csv)",
    category: "guests",
    keywords: ["importar", "wedy", "xlsx", "csv", "planilha", "migrar", "excel"],
    icon: Upload,
    summary:
      "Trazer convidados de outros sistemas (Wedy) ou reimportar um CSV exportado pelo próprio sistema.",
    steps: [
      {
        title: "Acesse Convidados → Importar lista",
        body: "Vai abrir /dashboard/guests/import. Selecione o arquivo .xlsx (Wedy) ou .csv (exportado pelo próprio sistema). Até 5 MB, 2000 linhas.",
      },
      {
        title: "Confira o preview",
        body: "O sistema mostra X novos, Y já existem (mesmo grupo) e Z divergem. Grupos, tags e PINs detectados aparecem listados.",
      },
      {
        title: "Escolha como tratar duplicatas",
        body: "Pular existentes (padrão, mais seguro), atualizar os existentes com os dados do arquivo, ou criar tudo (útil para homônimos em famílias diferentes).",
      },
      {
        title: "Confirme",
        body: "Tudo é gravado em uma transação. Tags e grupos novos são criados automaticamente. Tags 'Padrinhos', 'Madrinha', etc. marcam também a flag de padrinho.",
      },
    ],
    tips: [
      "Você ainda pode importar via texto colado: dentro da página de import há um link 'Prefere colar texto?'.",
      "O Wedy traz tags com os nomes dos noivos — elas viram tags normais, mas o lado (NOIVO/NOIVA) precisa ser ajustado manualmente em cada convidado.",
      "Importou do Wedy? O telefone/email vai automaticamente para o contato do grupo (cabeça da família), não para cada convidado.",
      "Reimportar o CSV exportado pelo botão 'CSV' funciona como um backup manual — fecha o ciclo export/import.",
    ],
    warnings: [
      "Status fora do mapeamento conhecido (Sem resposta/Confirmado/Recusado/Talvez) é tratado como 'Convidado'.",
      "O PIN do convite (4 dígitos do Wedy) é salvo só como referência. O link público continua usando o token do sistema.",
    ],
  },
  {
    id: "gift-pix-static",
    title: "QR Code Pix nos presentes (cota lua de mel)",
    category: "gifts",
    keywords: ["pix", "qr", "cota", "lua de mel", "dinheiro", "presente"],
    icon: Gift,
    summary:
      "Gere um QR Code Pix estático para qualquer presente em dinheiro e dê baixa manual quando receber.",
    steps: [
      { title: "Configure a chave Pix", body: "Ajustes › Casamento › 'Pix (cota lua de mel)'. Informe chave, tipo, nome do recebedor (max 25 chars) e cidade (max 15)." },
      { title: "Marque 'Cota de lua de mel' no presente", body: "Crie ou edite um presente em dinheiro e ative a opção." },
      { title: "Compartilhe o QR", body: "Botão de QR na lista de presentes abre a tela com QR + Pix copia-e-cola. Envie ao convidado." },
      { title: "Confirme recebimento", body: "Após ver o Pix entrar na conta, clique 'Marcar como recebido'. Opcionalmente cria entrada em Caixa." },
    ],
    warnings: [
      "Pix estático não valida o valor — confira o extrato antes de marcar como recebido.",
      "Dar baixa em um presente exige permissão adequada e fica registrado na auditoria (quem confirmou o recebimento e quando).",
    ],
  },
  {
    id: "generate-installments",
    title: "Gerar N parcelas de uma vez",
    category: "financial",
    keywords: ["parcela", "parcelamento", "buffet", "contrato", "10x"],
    icon: CreditCard,
    summary:
      "Para contratos parcelados (ex.: buffet em 10x), gere todos os pagamentos pendentes de uma vez.",
    steps: [
      { title: "Abra o gerador", body: "Em Pagamentos, clique 'Gerar Parcelas'." },
      { title: "Defina dados", body: "Fornecedor, valor total, número de parcelas (1–60), 1ª data, intervalo (padrão 30 dias)." },
      { title: "Multa e juros (opcional)", body: "Aplica os mesmos valores em todas as parcelas geradas." },
    ],
    tips: [
      "A última parcela absorve o resto dos centavos para a soma bater exatamente.",
    ],
  },
  {
    id: "late-fee-interest",
    title: "Multa e juros em pagamentos atrasados",
    category: "financial",
    keywords: ["multa", "juros", "atraso", "vencido"],
    icon: CreditCard,
    summary:
      "Adicione multa e juros %/mês em qualquer pagamento. O valor ajustado é mostrado em lista e nas notificações.",
    steps: [
      { title: "Configure os campos", body: "No form de pagamento, preencha 'Multa (%)' e 'Juros %/mês'. Exemplo padrão: 2% multa + 1%/mês." },
      { title: "Veja o ajuste", body: "Se o pagamento ficar atrasado, a lista mostra valor original riscado e valor ajustado ao lado." },
    ],
    tips: [
      "Juros são proporcionais aos dias de atraso (1%/mês × 15 dias = 0,5%).",
      "Cálculo é sempre on-demand — não há campo persistido.",
    ],
  },
  {
    id: "role-planner",
    title: "Role Planner (cerimonialista)",
    category: "security",
    keywords: ["role", "cerimonial", "planner", "permissão", "acesso"],
    icon: Lock,
    summary:
      "Convide o cerimonialista com role PLANNER. Ele gerencia fornecedores, tarefas e dia D — mas não vê valores.",
    tips: [
      "PLANNER NÃO acessa: Receitas, Caixa, Metas, Pagamentos, Insights.",
      "PLANNER acessa: Fornecedores, Locais, Tarefas, Convidados, Presentes, Dia D, Lua de mel, Enxoval.",
      "Contratos: PLANNER pode subir e ver, mas não pode marcar como assinado nem excluir.",
    ],
  },
  // ============ reports ============
  {
    id: "reports-hub",
    title: "Onde achar os relatórios de BI",
    category: "reports",
    keywords: ["relatórios", "bi", "gráficos", "insights", "kpi", "dashboard"],
    icon: BarChart3,
    summary:
      "Hub de relatórios analíticos em /dashboard/reports — funil de fornecedores, RSVP, presentes, risk radar, lua de mel, enxoval e timeline de atividade.",
    steps: [
      {
        title: "Abra Relatórios",
        body: "Menu lateral › Relatórios. Lista os relatórios disponíveis ao seu perfil.",
      },
      {
        title: "Insights continua o lar dos gráficos financeiros",
        body: "Curva S, Burndown e Waterfall ficam em /dashboard/insights (financeiros). Os atalhos no hub levam direto para a seção.",
      },
      {
        title: "FAMILY/VIEWER",
        body: "Esses perfis veem versão sem valores em R$ — métricas operacionais permanecem visíveis.",
      },
    ],
    tips: [
      "Risk Radar consolida liquidez, contratos expirando, tarefas atrasadas e fornecedores estourando o orçamento.",
      "Audit Timeline aparece só para ADMIN/GROOM/BRIDE.",
    ],
  },
  {
    id: "contract-upload",
    title: "Como anexar o PDF do contrato",
    category: "vendors",
    keywords: ["contrato", "pdf", "upload", "anexar", "versão", "assinar"],
    icon: FileText,
    summary:
      "Cada contrato aceita um PDF (até 8 MB). O primeiro envio fica na versão atual do contrato; só a substituição posterior cria uma nova versão.",
    steps: [
      {
        title: "Crie o contrato primeiro",
        body: "Em Fornecedores › abra o fornecedor › seção Contratos › Novo. Preencha título, valor, etc. O contrato começa em v1.",
      },
      {
        title: "Envie o PDF (continua v1)",
        body: "Dentro do contrato criado, o bloco 'Arquivo do contrato' aceita PDF até 8 MB. O primeiro PDF é gravado na mesma versão do contrato — se você criou em v1, o PDF também fica como v1. O preview aparece embutido logo após o envio.",
      },
      {
        title: "Substituir = nova versão",
        body: "Subir um PDF novo no lugar de um já anexado arquiva o anterior e gera v2, v3… O histórico fica acessível para ADMIN/GROOM/BRIDE.",
      },
      {
        title: "Registrar assinatura",
        body: "ADMIN, GROOM ou BRIDE podem marcar o contrato como SIGNED_DIGITAL ou SIGNED_PHYSICAL com data de hoje.",
      },
    ],
    warnings: [
      "Apenas PDF é aceito para CONTRACT. JPG/PNG/HEIC continuam liberados para anexos não-sensíveis (PHOTO, PROPOSAL).",
      "FAMILY e VIEWER não conseguem visualizar contratos — apenas o restante dos dados do fornecedor.",
    ],
  },
  {
    id: "contract-security",
    title: "Segurança e auditoria de anexos",
    category: "security",
    keywords: ["upload", "magic bytes", "audit", "contrato", "anexo", "segurança"],
    icon: ShieldCheck,
    summary:
      "Validação por magic bytes, hash SHA-256, ownership por kind, rate-limit em upload e download, audit log de UPLOAD/DOWNLOAD/REPLACE/SIGN.",
    tips: [
      "Tentativas de subir .exe renomeado como .pdf são bloqueadas (não passa no magic byte).",
      "Arquivos soft-deletados são removidos do disco depois de 30 dias pelo cron /api/cron/cleanup-files.",
      "Toda visualização de contrato registra um evento DOWNLOAD na auditoria.",
    ],
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
    question: "Minhas listas estão grandes — dá para navegar por páginas?",
    answer:
      "Sim. Listas como Convidados, Tarefas, Pagamentos, Presentes, Enxoval, Fornecedores, Receitas e Caixa mostram 20 itens por página, com controle de páginas no rodapé (Anterior/Próxima + números) e o indicador 'Mostrando X–Y de Z'. A busca e os filtros continuam valendo: a paginação recai sobre o resultado filtrado e volta para a primeira página quando você muda o filtro.",
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
