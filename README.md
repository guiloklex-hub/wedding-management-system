<h1 align="center">💍 Wedding Finance Planner</h1>

<p align="center">
  <strong>Sistema open-source para casais organizarem o casamento.</strong><br/>
  Orçamento, fornecedores, convidados, lua de mel e enxoval — tudo em um só lugar, no seu próprio servidor.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-ready-5A0FC8">
  <img alt="Made with ❤" src="https://img.shields.io/badge/feito_com-♥-rose">
</p>

---

## ✨ O que faz

Um app web completo para o **casal organizar a vida durante o noivado** —
sem planilhas dispersas, sem perder prazo de pagamento, sem esquecer quem
confirmou a presença.

- 💸 Orçamento detalhado com **fluxo de caixa projetado** mês a mês
- 🤝 Catálogo de **fornecedores** (negociação → contratado → finalizado)
- 📄 **Contratos versionados** com anexos
- 🏛️ **Locais** com checklist de visitação
- 💳 **Pagamentos parcelados** com lembretes automáticos
- 💰 **Receitas** (salário, donativos, ajuda dos pais)
- 🏦 **Caixa e metas de poupança**
- ✅ **Tarefas** com ~40 templates pré-prontos baseados na data do casamento
- 👥 **Convidados** com **RSVP por link público**, +1s, dietary, padrinhos
- 💌 **Save the Date** — arte (imagem/PDF) + mensagem com variáveis, site dos noivos e lista de presentes, envio em massa por WhatsApp/e-mail com fila e throttle
- 🎁 **Presentes** (cash/item) com controle de agradecimentos
- 🌴 **Lua de mel** (destino, atividades, hospedagens, vôos)
- 🛏️ **Enxoval** por cômodo
- 💍 **Painel do Dia D** (cronograma, plano B chuva, contatos críticos, check-in)
- 🪑 **Mapa de assentos** — arraste convidados confirmados para as mesas e reordene as mesas pela alça; capacidade considera +1s
- 📊 **Insights** financeiros (health score, heatmap, detector de creep)
- 🤖 **Assistente de IA** (Google Gemini) — **opcional, desligado por padrão**: resumo em linguagem natural da saúde financeira nos Insights
- 📨 **Notificações por email + WhatsApp** (Baileys) — no idioma do destinatário, com aviso aos noivos quando um convidado responde o RSVP e painel de diagnóstico de envios (Ajustes › Notificações)
- 🌐 **Multi-idioma** (pt-BR, inglês, espanhol) — escolhido por usuário e respeitado em emails/WhatsApp/RSVP
- 🔐 **2FA TOTP**, reset por email/WhatsApp, audit log
- 📅 **iCalendar (.ics)** para sincronizar com Google/Apple Calendar
- 💾 **Backup e restore JSON** com checksum SHA-256, validação Zod e restauração transacional
- 📱 **PWA** — instalável no celular, funciona offline básico
- ❓ **Central de Ajuda interna** com busca, filtros, passo-a-passo e FAQ

---

## 🚀 Começando (3 passos)

> 📖 Guias detalhados:
> [Linux/macOS](docs/instalacao-linux.md) ·
> [Windows](docs/instalacao-windows.md) ·
> [WSL2](docs/instalacao-wsl.md)

### 🐧 Linux, macOS ou WSL2

```bash
git clone https://github.com/guiloklex-hub/wedding-management-system.git
cd wedding-management-system
./setup.sh
npm run dev
```

### 🪟 Windows (PowerShell)

```powershell
git clone https://github.com/guiloklex-hub/wedding-management-system.git
cd wedding-management-system
.\setup.ps1
npm run dev
```

Abra <http://localhost:3005> no navegador.

**Login inicial:** `admin@admin.com` / `admin`

> 🪄 No primeiro acesso você é guiado(a) por um **wizard de configuração**
> que personaliza o sistema para o seu casamento (nomes, data, moeda,
> **idioma**, contingência). Em ~2 minutos está tudo pronto. Você pode
> trocar o idioma depois em `/dashboard/profile`.

### Pré-requisitos

- **Node.js 20+** ([nodejs.org](https://nodejs.org/))
- **Git** ([git-scm.com](https://git-scm.com/))

---

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, Server Components) |
| UI | [React 19](https://react.dev/) + [Tailwind CSS 4](https://tailwindcss.com/) |
| Banco | [SQLite](https://sqlite.org/) + [Prisma 6](https://www.prisma.io/) |
| Auth | [Auth.js v5](https://authjs.dev/) + TOTP 2FA |
| Email | [Nodemailer](https://nodemailer.com/) |
| WhatsApp | [Baileys](https://github.com/WhiskeySockets/Baileys) |
| Validação | [Zod 4](https://zod.dev/) |
| Gráficos | [Recharts](https://recharts.org/) |
| Testes | [Vitest 4](https://vitest.dev/) + Testing Library |
| i18n | [next-intl 4](https://next-intl.dev/) (pt-BR, en, es) |

---

## 📚 Documentação

| Tópico | Documento |
|---|---|
| **Instalar no Linux/macOS** | [docs/instalacao-linux.md](docs/instalacao-linux.md) |
| **Instalar no Windows** | [docs/instalacao-windows.md](docs/instalacao-windows.md) |
| **Instalar via WSL2** | [docs/instalacao-wsl.md](docs/instalacao-wsl.md) |
| Arquitetura geral | [docs/arquitetura.md](docs/arquitetura.md) |
| Módulos e como usar | [docs/modulos.md](docs/modulos.md) |
| Modelo de dados (Prisma) | [docs/banco-de-dados.md](docs/banco-de-dados.md) |
| Endpoints da API | [docs/api.md](docs/api.md) |
| Notificações (email + WhatsApp) | [docs/notificacoes.md](docs/notificacoes.md) |
| IA (Google Gemini) — opcional, opt-in | [docs/ia.md](docs/ia.md) |
| Internacionalização (i18n) | [docs/i18n.md](docs/i18n.md) |
| Segurança e 2FA | [docs/seguranca.md](docs/seguranca.md) |
| Backup e restauração | [docs/backup-restore.md](docs/backup-restore.md) |
| **Deploy em produção** | [docs/deploy.md](docs/deploy.md) |
| **Solução de problemas** | [docs/troubleshooting.md](docs/troubleshooting.md) |
| Como contribuir | [docs/contribuindo.md](docs/contribuindo.md) |
| Glossário do app | [docs/glossario.md](docs/glossario.md) |

Tudo organizado em [docs/README.md](docs/README.md).

E dentro do app: **Menu → Ajuda** abre a Central de Ajuda interativa.

---

## ⚙️ Comandos úteis

```bash
npm run dev            # servidor de desenvolvimento (porta 3005)
npm run build          # build de produção
npm run start          # servidor de produção
npm run lint           # ESLint

npm run db:push        # aplicar schema ao SQLite (sem perder dados)
npm run db:seed        # rodar o seed (cria admin@admin.com)
npm run db:studio      # abre o Prisma Studio em http://localhost:5555

npm run test           # vitest em watch
npm run test:run       # vitest single run
npm run test:coverage  # cobertura

./setup.sh             # reinstala/atualiza tudo (Linux/Mac/WSL)
./setup.sh --prod      # build + PM2
./setup.sh --reset-db  # ⚠️ apaga o banco e refaz

.\setup.ps1            # equivalente Windows nativo
.\setup.ps1 -Prod      # build + PM2
.\setup.ps1 -ResetDb   # ⚠️ apaga o banco e refaz
```

---

## 🌐 Deploy em produção

Veja [docs/deploy.md](docs/deploy.md) para um passo-a-passo completo com:

- VPS Ubuntu + PM2
- Cloudflare Tunnel (HTTPS automático, sem abrir portas) **ou** nginx + Let's Encrypt
- Cron de lembretes (`*/30 * * * *`)
- Cron de backup diário
- Conexão WhatsApp via QR Code
- Atualizações com zero downtime (`git pull && ./setup.sh --prod --skip-seed`)

---

## 🤝 Contribuindo

PRs são muito bem-vindos! Antes de mandar, leia
[docs/contribuindo.md](docs/contribuindo.md) — basicamente:

1. Discuta features grandes em uma issue antes.
2. `npm run lint` e `npm run test:run` precisam passar.
3. Atualize a documentação (`docs/`, `/help`) na mesma PR.
4. Mensagem de commit clara em pt-BR ou en (`feat(payments): …`).

Para agentes de IA (Claude Code, Gemini Code, Cursor, etc.), leia
[AGENTS.md](AGENTS.md) — é a fonte de verdade técnica.

---

## 🔐 Privacidade

- **Single-tenant.** Uma instalação = um casamento. Nada é compartilhado
  entre casais.
- **Sem cloud obrigatória.** SQLite local. Você decide se hospeda na
  nuvem ou no PC de casa.
- **Sem telemetria.** Zero "phone home". Zero analytics. O projeto não
  envia nada para lugar nenhum — **exceto** se você ativar a IA opcional
  (Google Gemini), que envia dados do casamento ao provedor **apenas quando
  ligada**. Desligada por padrão. Veja [docs/ia.md](docs/ia.md).

---

## 📄 Licença

[MIT](LICENSE) — use, modifique e distribua livremente, inclusive
comercialmente.

---

## 💬 Suporte

- 🐛 **Bugs:** abra uma [issue](https://github.com/guiloklex-hub/wedding-management-system/issues/new?template=bug.md)
- 💡 **Ideias:** abra uma [issue de feature](https://github.com/guiloklex-hub/wedding-management-system/issues/new?template=feature.md)
- ❓ **Dúvidas de uso:** veja a **Central de Ajuda** dentro do app
  (`/dashboard/help`) ou [docs/troubleshooting.md](docs/troubleshooting.md)

---

<p align="center">
  Feito com ♥ para casais que querem chegar ao altar com o orçamento sob controle.
</p>
