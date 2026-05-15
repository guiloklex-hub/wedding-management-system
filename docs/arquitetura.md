# 🏗️ Arquitetura

Visão geral técnica do Wedding Finance Planner.

## Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 16.2 |
| UI | React | 19.2 |
| Estilos | Tailwind CSS | 4 |
| Banco de dados | SQLite | via Prisma |
| ORM | Prisma | 6 |
| Autenticação | Auth.js (NextAuth v5 beta) | 5.0.0-beta.31 |
| 2FA | otplib (TOTP) | 13 |
| Validação | Zod | 4 |
| Email | Nodemailer | 7 |
| WhatsApp | @whiskeysockets/baileys | 7-rc11 |
| Gráficos | Recharts | 3 |
| Ícones | Lucide React | 1.x |
| Testes | Vitest + Testing Library + happy-dom | 4 / 16 / 20 |

## Convenções Next.js 16

- **App Router** (`src/app/`) — não usamos Pages Router.
- **Server Components por padrão.** Use `"use client"` apenas onde a
  interatividade do navegador for necessária (state, eventos, hooks).
- **Server Actions** (`src/app/actions/*.ts`) — formulários e mutações; cada
  ação começa validando a sessão com `await auth()`.
- **Route Handlers** (`src/app/api/`) — APIs REST quando necessário (calendar
  iCal, backup JSON, cron de lembretes, upload de arquivos).
- **Params são Promise.** `{ params }: { params: Promise<{ id: string }> }`
  e depois `const { id } = await params;`.
- **dynamic = "force-dynamic"** nas páginas que dependem da sessão ou de dados
  que mudam frequentemente.

## Convenções Tailwind 4

- Sem `tailwind.config.js` legado.
- Tokens em CSS via `@theme` em [src/app/globals.css](../src/app/globals.css).
- Plugin via PostCSS: [postcss.config.mjs](../postcss.config.mjs).

## Fluxo de autenticação

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐
│ /login  │ ──▶ │ authorize()  │ ──▶ │ JWT no cookie │
└─────────┘     │ (src/auth.ts)│     │ {role,mcp,oc} │
                └──────────────┘     └──────────────┘
                       │
                       ▼
                ┌────────────────────────────────┐
                │ authConfig.authorized()        │
                │ • mustChangePassword → /change │
                │ • !onboardingCompleted (ADMIN) │
                │                  → /onboarding │
                │ • Logado → /dashboard          │
                └────────────────────────────────┘
```

Onde:
- `mcp` = `mustChangePassword`
- `oc` = `onboardingCompleted`

Após cada login, o `authorize` lê `EventSettings.onboardingCompletedAt` e
inclui a flag no JWT. O `authorized` middleware bloqueia o dashboard até que
ambos os pré-requisitos estejam satisfeitos.

## Estrutura de diretórios

```
src/
├── app/
│   ├── (auth-pages)/        # login, forgot-password, reset-password
│   ├── dashboard/           # painel autenticado
│   │   ├── _components/     # nav, charts comuns
│   │   ├── onboarding/      # wizard de primeira config
│   │   ├── help/            # central de ajuda interna
│   │   ├── insights/        # análises financeiras
│   │   ├── vendors/         # fornecedores
│   │   ├── venues/          # locais
│   │   ├── tasks/           # tarefas
│   │   ├── payments/        # pagamentos
│   │   ├── income/          # receitas
│   │   ├── assets/          # caixa/poupança
│   │   ├── goals/           # metas
│   │   ├── guests/          # convidados
│   │   ├── gifts/           # presentes
│   │   ├── wedding-day/     # dia D
│   │   ├── honeymoon/       # lua de mel
│   │   ├── trousseau/       # enxoval
│   │   ├── settings/        # ajustes
│   │   ├── profile/         # troca de senha
│   │   ├── page.tsx         # dashboard inicial
│   │   └── layout.tsx
│   ├── api/                 # Route Handlers
│   │   ├── auth/[...nextauth]/
│   │   ├── calendar.ics/
│   │   ├── backup/
│   │   ├── cron/reminders/
│   │   └── files/[id]/
│   ├── actions/             # Server Actions
│   ├── rsvp/[token]/        # RSVP público
│   └── layout.tsx
├── components/              # componentes globais reutilizáveis
├── lib/                     # helpers e domínio
│   ├── prisma.ts
│   ├── event-config.ts
│   ├── notifications/       # email + whatsapp + templates
│   ├── totp.ts
│   ├── format.ts
│   ├── cashflow.ts
│   ├── task-templates.ts
│   ├── audit.ts
│   ├── permissions.ts
│   ├── rate-limit.ts
│   ├── timing-safe.ts
│   └── ics.ts
├── auth.ts                  # NextAuth handler (com Prisma)
├── auth.config.ts           # callbacks que rodam em edge
└── types.ts
prisma/
├── schema.prisma
├── seed.ts
└── dev.db                   # gerado, gitignored
docs/                        # esta pasta
public/                      # estáticos, manifest PWA, sw.js
```

## Fluxo de dados

1. **Page (RSC)** chama `await prisma...` e/ou `await getEventConfig()`.
2. **Renderiza** com dados; passa para um Client Component se precisar
   interatividade.
3. **Mutação** vai via **Server Action**: valida sessão, valida Zod, escreve
   no Prisma, grava `AuditLog`, retorna `ActionResult` (success/error).
4. **revalidatePath** invalida o cache; a página atualiza.

Helpers e regras de domínio:
- `src/lib/cashflow.ts` — cálculos financeiros (fluxo de caixa mensal,
  contingência, projeção, health score).
- `src/lib/task-templates.ts` — templates de tarefas baseados em offsets a
  partir da data do evento.
- `src/lib/recurring-expense.ts` — despesas recorrentes (se aplicável).
- `src/lib/ics.ts` — geração de calendário iCal.

## Auditoria e logs

- Tabela `AuditLog` registra cada ação relevante via `audit(entity, id,
  action, payload)` em [src/lib/audit.ts](../src/lib/audit.ts).
- Tabela `NotificationLog` registra cada email/WhatsApp enviado
  (sucesso/erro).
- Logs de aplicação atualmente saem via `console.error` em pontos críticos —
  para produção, considere encaminhar para um agregador (Loki, Sentry, etc.).

## PWA

- Manifest: `public/manifest.json`.
- Service Worker: `public/sw.js` registrado pelo
  [src/components/sw-register.tsx](../src/components/sw-register.tsx).
- Offline básico: `public/offline.html`.

## Próximos passos

- Veja [modulos.md](modulos.md) para o detalhe de cada módulo.
- Veja [banco-de-dados.md](banco-de-dados.md) para o schema completo.
- Veja [seguranca.md](seguranca.md) para as práticas de proteção.
