# AGENTS.md — Wedding Finance Planner

> **Fonte única de verdade técnica para qualquer agente IA (Claude Code,
> Gemini Code, Cursor, etc.) ou contribuidor humano que vá tocar neste
> repositório.**
>
> `CLAUDE.md` e `GEMINI.md` apenas redirecionam para este arquivo.

---

## 0. ⚠️ Antes de mais nada

### 0.1 Next.js 16 — APIs e convenções mudaram

Esta versão do Next.js tem **breaking changes** em relação ao que muitos
modelos de IA conhecem. Antes de escrever **qualquer** rota ou componente:

- Leia [node_modules/next/dist/docs/](node_modules/next/dist/docs/) (o
  Next.js publica docs do release dentro do pacote).
- **`params` em Route Handlers e Pages é `Promise`.** Sempre `await params`:
  ```typescript
  export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
  }
  ```
- **App Router only.** Não existe `pages/` neste projeto.
- **Server Components por padrão.** Use `"use client"` apenas para
  interatividade (state, eventos DOM, hooks de navegação).
- Heed deprecation warnings — eles costumam virar erros no próximo minor.

### 0.2 Tailwind 4 — sem `tailwind.config.js`

- Tailwind CSS 4 elimina o config JS legado.
- Tokens vão em `@theme` direto no CSS — veja
  [src/app/globals.css](src/app/globals.css).
- O plugin PostCSS está em [postcss.config.mjs](postcss.config.mjs).
- **Não tente criar** `tailwind.config.js` ou `tailwind.config.ts`.

### 0.3 Prisma — não use `migrate dev`

O projeto usa fluxo **schema-first** com `prisma db push`. NÃO crie
migrations. Veja seção 4 abaixo.

---

## 1. Sobre o projeto

**Wedding Finance Planner** é um sistema open-source (MIT) **single-tenant**
para **casais organizarem o casamento**. Cada instalação serve a um casal.

- **Self-hosted** — qualquer pessoa clona, instala e roda.
- **Cross-platform** — Linux, macOS, Windows nativo, WSL2.
- **Privado por padrão** — banco SQLite local, sem cloud obrigatória.

Stack:

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 16.2 |
| UI | React | 19.2 |
| Estilo | Tailwind CSS | 4 |
| Banco | SQLite + Prisma | Prisma 6 |
| Auth | Auth.js v5 (beta) | 5.0.0-beta.31 |
| 2FA | otplib (TOTP) | 13 |
| Email | Nodemailer | 7 |
| WhatsApp | @whiskeysockets/baileys | 7-rc11 |
| Validação | Zod | 4 |
| Gráficos | Recharts | 3 |
| Testes | Vitest + Testing Library + happy-dom | 4 / 16 / 20 |

---

## 2. Estrutura de diretórios

```
src/
├── app/
│   ├── api/                 # Route Handlers
│   │   ├── auth/[...nextauth]/
│   │   ├── calendar.ics/
│   │   ├── backup/
│   │   ├── cron/reminders/
│   │   └── files/[id]/
│   ├── dashboard/           # painel autenticado
│   │   ├── _components/
│   │   ├── onboarding/      # wizard 1ª config
│   │   ├── help/            # central de ajuda interna
│   │   ├── insights/
│   │   ├── vendors/
│   │   ├── venues/
│   │   ├── tasks/
│   │   ├── payments/
│   │   ├── income/
│   │   ├── assets/
│   │   ├── goals/
│   │   ├── guests/
│   │   ├── gifts/
│   │   ├── wedding-day/
│   │   ├── honeymoon/
│   │   ├── trousseau/
│   │   ├── settings/
│   │   ├── profile/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── actions/             # Server Actions
│   ├── login/
│   ├── forgot-password/
│   ├── reset-password/[token]/
│   ├── rsvp/[token]/
│   └── layout.tsx
├── components/              # globais reutilizáveis
├── lib/
│   ├── prisma.ts
│   ├── event-config.ts
│   ├── notifications/
│   ├── totp.ts
│   ├── format.ts
│   ├── cashflow.ts
│   ├── task-templates.ts
│   ├── recurring-expense.ts
│   ├── audit.ts
│   ├── permissions.ts
│   ├── rate-limit.ts
│   ├── timing-safe.ts
│   ├── help-content.ts      # conteúdo da central de ajuda
│   └── changelog.ts
├── auth.ts                  # NextAuth com Prisma
├── auth.config.ts           # callbacks edge-safe
└── types.ts
prisma/
├── schema.prisma
├── seed.ts
└── dev.db                   # gitignored
docs/                        # documentação técnica (.md)
public/                      # PWA, manifest, sw.js
setup.sh                     # Linux/macOS/WSL
setup.ps1                    # Windows nativo
```

---

## 3. Modelos Prisma (índice rápido)

Veja [prisma/schema.prisma](prisma/schema.prisma) para o schema completo.

| Modelo | Função |
|---|---|
| `User` | Usuários do sistema (admin do casamento, parceiro, cerimonial). 2FA, mustChangePassword, archivedAt. |
| `PasswordResetToken` | Tokens hash sha256, expira em 60min. |
| `NotificationLog` | Histórico email + WhatsApp (idempotência por dia). |
| `SecuritySettings` | Singleton: roles que exigem 2FA, min password length. |
| `EventSettings` | Singleton: data, contingência, moeda, nomes do casal, plano B, `onboardingCompletedAt`. |
| `Vendor` | Fornecedores (status NEGOTIATION → CONTRACTED → FINALIZED). |
| `VendorContact`, `VendorNote`, `Contract`, `Attachment` | Relações de fornecedor. |
| `Venue`, `VenueChecklistItem` | Locais com checklist. |
| `BudgetItem` | Itens orçamentários (estimado vs real). |
| `Payment` | Pagamentos parcelados. |
| `Income` | Receitas (salary, donativos). |
| `Asset` | Caixa/poupança. |
| `SavingsGoal` | Metas. |
| `Honeymoon`, `HoneymoonItem` | Lua de mel (singleton + itens). |
| `TrousseauItem` | Enxoval. |
| `Guest`, `Gift` | Convidados e presentes. |
| `Task` | Tarefas com templates. |
| `AuditLog` | Audit de ações relevantes. |

Convenções:
- **IDs:** `@default(cuid())`.
- **Soft delete:** modelos com `deletedAt: DateTime?` — filtre por
  `deletedAt: null` ao consultar.
- **Singletons:** `id @default("singleton")` + sempre via `upsert`.

---

## 4. Banco de dados

- **Sempre** importe `prisma` de `@/lib/prisma` (singleton).
- **Após alterar schema:**
  ```bash
  npx prisma db push --skip-generate
  npx prisma generate
  ```
- **Não use `prisma migrate dev`** — fluxo é schema-first. Mudanças
  destrutivas exigem aviso no PR e backup antes de aplicar.
- **Seed idempotente** ([prisma/seed.ts](prisma/seed.ts)) — verifica
  existência antes de criar.
- Admin novo é criado com `mustChangePassword: true` para forçar troca
  no primeiro login.

---

## 5. Autenticação e segurança

### 5.1 Padrão de Server Action

```typescript
"use server";
import { auth } from "@/auth";
import { z } from "zod";

export async function minhaAction(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };

  const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  // ...
  await audit("Entidade", id, "ACTION", payload);
  revalidatePath("/dashboard/algo");
  return { success: true };
}
```

### 5.2 Padrão de Route Handler

```typescript
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  // ...
}
```

### 5.3 Comparação de secrets — TIMING-SAFE

Toda comparação de Bearer token, HMAC ou similar **deve** usar
`timingSafeEquals` de [src/lib/timing-safe.ts](src/lib/timing-safe.ts).
**Nunca** `===`.

### 5.4 2FA

`otplib` v13. Use sempre o helper em [src/lib/totp.ts](src/lib/totp.ts) —
`verifyTotpToken(token, secret): boolean`. Não chame `verify` direto da
biblioteca (API mudou em v13).

### 5.5 Reset de senha

`updateMany` filtrado por `tokenHash` + `expiresAt > now` + `usedAt = null`.
Se `count === 0`, token já consumido (previne race).

### 5.6 Mensagens indistintas no login

Login retorna `null` igual para "usuário não existe" e "senha errada".
**Não introduza** mensagens diferenciadas — evita enumeração.

### 5.7 Onboarding wizard

- Flag no JWT: `session.user.onboardingCompleted`.
- Middleware (`authConfig.authorized`) redireciona admins não-completos
  para `/dashboard/onboarding`.
- Após concluir o wizard, atualize via `session.update({ onboardingCompleted: true })`.

### 5.8 Auditoria

Use `audit(entity, entityId, action, payload?, userId?)` de
[src/lib/audit.ts](src/lib/audit.ts) para gravar em `AuditLog`.
Use os enums definidos no arquivo — não invente strings.

### 5.9 Rate limiting

Endpoints públicos (RSVP, login se for endurecer) e webhooks devem usar
[src/lib/rate-limit.ts](src/lib/rate-limit.ts). Chave = IP + recurso.

### 5.10 Validação de entrada com Zod

Todo body/form **deve** ser validado com Zod com limites explícitos:

- Nomes: `.max(120)`.
- Textos longos: `.max(2000)` ou `.max(8000)`.
- Moeda: `z.coerce.number().min(0).max(1_000_000)`.
- IDs: `z.string().min(1).max(64)`.
- Datas YYYY-MM-DD: regex `/^\d{4}-\d{2}-\d{2}$/`.

---

## 6. Convenções de código

### 6.1 TypeScript

- **Strict mode.** Corrija erros de tipo antes de declarar tarefa pronta.
- **Proibido `any`** em contratos públicos. Use `unknown` + narrow ou
  tipos derivados do Prisma (`import type { Vendor } from "@prisma/client"`).
- Imports: alias `@/` → `src/`. Ordem: libs externas → libs internas →
  relativos.

### 6.2 Server vs Client

- Server Components por padrão.
- `"use client"` somente para interatividade.
- Sem fetch direto do client — use Server Actions.

### 6.3 Datas

- **Salve em UTC.** `new Date()` no Node já é UTC interno.
- **Exiba** via `formatDate(date, locale, options?)` de
  [src/i18n/format.ts](src/i18n/format.ts) (re-exportado por
  [src/lib/format.ts](src/lib/format.ts)). Em RSC obtenha o locale com
  `await getLocale()` do next-intl; em client components use `useLocale()`.
- `formatDateBR` / `formatDateTimeBR` continuam disponíveis como atalhos
  para casos onde o output **precisa** estar em pt-BR (legados, recibos
  PDF de teste). Em código novo prefira a versão parametrizada.
- Para cálculos baseados em fuso (cron, vencimentos), considere
  `America/Sao_Paulo`. SQLite armazena DateTime como ISO string UTC.
- **`eventDate` agora é nullable** (`Date | null`). Páginas que dependem
  do evento (`wedding-day`, `insights`) redirecionam para
  `/dashboard/onboarding` quando ausente.

### 6.4 Dinheiro

- Cálculos com percentuais ou splits → centavos (inteiros).
- Exibição → `formatCurrency(value, currency, locale)` em
  [src/i18n/format.ts](src/i18n/format.ts). O locale vem do usuário
  autenticado (`User.locale`) via `getLocale()` em RSC ou `useLocale()`
  no client. Quando o locale não é passado, default = `pt-BR`.
- Moeda configurável (BRL/USD/EUR) em `EventSettings.currency`.

### 6.7 i18n (Internacionalização)

- **Biblioteca:** [next-intl](https://next-intl.dev/) 4.x. Configurado em
  [next.config.ts](next.config.ts) (`withNextIntl`) e
  [src/i18n/request.ts](src/i18n/request.ts).
- **Idiomas suportados:** `pt-BR` (default/fallback), `en`, `es`. Constante
  em [src/i18n/config.ts](src/i18n/config.ts).
- **Sem prefixo de URL.** Locale resolvido na ordem: (1) `?lang=` em rotas
  públicas (RSVP, login) → (2) cookie `NEXT_LOCALE` → (3) JWT `user.locale`
  → (4) header `Accept-Language` → (5) default `pt-BR`.
- **Onde está a preferência:**
  - `User.locale` (`String @default("pt-BR")`) — propagado pelo JWT do
    Auth.js. Pode ser alterado em `/dashboard/profile`.
  - `Guest.language` (`String?`) — locale do convidado para RSVP. Null = usa
    `EventSettings.defaultLocale`.
  - `EventSettings.defaultLocale` — fallback para envios sistêmicos sem
    destinatário identificado (ex.: RSVP de Guest sem `language`).
- **Catálogos:** `src/messages/{pt-BR,en,es}/*.json`. Um arquivo por
  domínio: `common`, `auth`, `dashboard`, `actions`, `notifications`,
  `help`, `changelog`, `rsvp`.
- **Padrão de chaves:** `namespace.area.entity.token` — ex.
  `dashboard.vendors.list.empty`, `actions.passwordReset.invalidEmail`,
  `notifications.PAYMENT_DUE.subject`.
- **Plurais (ICU MessageFormat):** obrigatório em EN/ES.
  `{count, plural, one {# day} other {# days}}`. Funciona com `t("key", { count: 3 })`.
- **Como usar:**
  - **Server Component:** `const t = await getTranslations("dashboard.vendors"); <h1>{t("title")}</h1>`.
  - **Client Component:** `const t = useTranslations("dashboard.vendors"); …`.
  - **Server Action:** `const t = await getTranslations("actions.vendor"); return { success: false, error: t("errors.notFound") };`.
  - **Fora de request lifecycle (cron, scripts):** `getTranslations({ locale, namespace })` — passe `locale` explicitamente vindo do destinatário (`User.locale`). Não use `getLocale()` aqui — retorna o default.
- **Zod messages:** não use `z.setErrorMap` global. Capture os erros e
  traduza via helper [src/lib/zod-i18n.ts](src/lib/zod-i18n.ts):
  ```ts
  const tc = await getTranslations("common");
  const parsed = Schema.safeParse(...);
  if (!parsed.success) return { success: false, error: zodErrorMessage(parsed.error, tc) };
  ```
- **Proibido:**
  - Strings literais em JSX, `return { error: "..." }`, `toast.error("Falha")`, `placeholder="Email"`, etc. Toda string visível ao usuário vem de catálogos.
  - Hardcoded `<html lang="pt-BR">` — use o locale resolvido em
    [src/app/layout.tsx](src/app/layout.tsx).
  - Templates de notificação chamando `getLocale()` — eles recebem locale do destinatário via input.
- **Onboarding:** o admin escolhe o idioma no Step 1 (junto da moeda).
  Salvar grava `User.locale` (admin) e `EventSettings.defaultLocale`.
- **Troca de idioma:** `/dashboard/profile` atualiza `User.locale` + cookie
  `NEXT_LOCALE` + faz hard reload (`window.location.reload()`) para
  reemitir o JWT.
- **Adicionar nova chave:** adicione nos **3** catálogos no mesmo PR. Não
  deixe `en`/`es` com placeholders — traduza ou peça revisão.
- **Status atual da cobertura:**
  - 100%: login, forgot-password, reset-password, RSVP individual e
    grupo, sidebar/mobile-nav, onboarding wizard, profile, templates de
    notificação (9 kinds × 3 idiomas), Server Actions críticas (auth,
    passwordReset, onboarding, profile).
  - **Pendente** (rotam pt-BR via shim de `formatCurrency`/`formatDate`,
    sem tradução de UI nesta entrega): páginas internas do dashboard
    (`vendors`, `venues`, `tasks`, `payments`, `income`, `assets`,
    `goals`, `guests`, `gifts`, `wedding-day`, `honeymoon`, `trousseau`,
    `insights`, `reports`, `settings`) e demais Server Actions. Conteúdo
    detalhado do help center continua em pt-BR até traduções de
    comunidade.

### 6.5 Logs

- Use `console.error` apenas em pontos críticos com prefixo `[modulo]`.
- Não logue secrets (passwords, tokens, twoFactorSecret).
- Para escala futura, considere migrar para Pino.

### 6.6 Comentários

- Padrão: **não comente.** Código auto-explicativo.
- Comente apenas quando o **porquê** for não-óbvio (workaround, restrição
  externa, invariante sutil).
- Nada de `// added for issue #123` — vai pro commit message.

---

## 7. Notificações

- **Sempre** use os orquestradores em
  [src/lib/notifications/](src/lib/notifications/). Não chame Nodemailer
  ou Baileys direto da Server Action / Route Handler.
- Cada envio grava em `NotificationLog` (`kind`, `refType`, `refId`,
  `status`). Idempotência por dia: `kind + refId` + `DATE(createdAt) = today`.
- Templates HTML de email precisam **escapar** dados do usuário antes de
  interpolar (XSS em email é vetor real).
- **Locale do destinatário é obrigatório** em qualquer chamada de
  `notify()` que rode fora do request lifecycle do usuário (crons,
  webhooks, scripts). Leia `User.locale` do banco e propague em
  `NotifyTarget.locale`. Nunca use `getLocale()` dentro de
  [src/lib/notifications/templates.ts](src/lib/notifications/templates.ts).
- A função `render()` é **async** e recebe `locale: Locale` em cada
  variante de `RenderInput`. ICU plurals usam a chave do JSON; o
  interpolador do next-intl já escapa interpolações simples, então
  aplique `escapeHtml`/`escapeWaMarkdown` apenas em valores recebidos
  crus (não duplicar escape).

---

## 8. Testes

- **Framework:** Vitest + Testing Library + happy-dom.
- Testes em arquivos `*.test.ts` ao lado do código.
- Lógica de domínio (cashflow, recurrence) → unitário com dados explícitos.
- Server Action com regra complexa → mock do Prisma via
  `vitest-mock-extended`.
- Bug fix → escreva o teste de regressão antes do fix.

```bash
npm run test            # watch
npm run test:run        # single run
npm run test:coverage   # cobertura v8
```

---

## 9. Comandos

### App

```bash
npm run dev                # next dev -p 3005 (Turbopack)
npm run build              # next build
npm run start              # next start -p 3005
npm run lint               # ESLint
npm run test:run           # vitest run
```

### Banco

```bash
npm run db:push            # prisma db push + generate
npm run db:seed            # tsx prisma/seed.ts
npm run db:studio          # prisma studio (http://localhost:5555)
```

### Setup

```bash
./setup.sh                 # Linux/macOS/WSL
.\setup.ps1                # Windows nativo (PowerShell)
./setup.sh --prod          # com build + PM2
./setup.sh --reset-db      # apaga dev.db
./setup.sh --skip-deps     # pula npm install
./setup.sh --skip-seed     # pula seed
```

---

## 10. Sincronização de documentação

> 📚 **Documentação desatualizada é bug grave.** Todo PR que mexe em
> comportamento visível precisa atualizar 3 lugares **no mesmo PR**:

1. **`docs/`** — arquivo da área tocada
   ([docs/README.md](docs/README.md) lista todos).
2. **`/dashboard/help`** — adicione/edite entrada em
   [src/lib/help-content.ts](src/lib/help-content.ts) e, se for marco,
   atualize [src/lib/changelog.ts](src/lib/changelog.ts).
3. **`README.md`** — apenas se for marco de produto ou mudança de
   variáveis de ambiente.
4. **`src/messages/{pt-BR,en,es}/*.json`** — toda string visível ao
   usuário precisa estar **nos três catálogos**. Adicionar chave em só
   um idioma quebra o app para os demais. Veja
   [docs/i18n.md](docs/i18n.md) para o fluxo.

Não tratar isso como opcional. Doc desatualizada vira armadilha — alguém
confia em algo antigo e perde horas.

---

## 11. Convenções de commit

Formato: `tipo(escopo): mensagem em pt-BR ou en, minúsculo, no presente`.

Tipos comuns: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`,
`style`, `perf`.

Exemplos:

- `feat(payments): suportar pagamento parcial`
- `fix(rsvp): corrigir contagem de +1 quando convidado cancela`
- `docs(notificacoes): atualizar instruções de App Password do Gmail`
- `refactor(cashflow): extrair cálculo de heatmap para função pura`

Sem messages genéricas como "fix", "update", "ajuste", "teste".

---

## 12. Checklist do reviewer

Ao revisar PR que toque endpoints ou Server Actions:

- [ ] `await auth()` no início + tratamento de sessão ausente
- [ ] Toda query Prisma respeita escopo do usuário quando aplicável
- [ ] Body validado por Zod com limites explícitos
- [ ] Secrets comparados com `timingSafeEquals`
- [ ] Endpoint público / webhook tem rate limit
- [ ] Dados de usuário em HTML passam por escape
- [ ] Ação relevante grava em `AuditLog`
- [ ] Sem `console.log` de informação sensível
- [ ] Datas no fuso correto (`America/Sao_Paulo` para display em pt-BR, UTC para storage)
- [ ] `formatDate`/`formatCurrency` chamados com `locale` quando o output for visível ao usuário
- [ ] `eventDate` tratado como `Date | null` (não assuma populado)
- [ ] Sem `any` em contratos
- [ ] **Toda string visível** existe em `src/messages/{pt-BR,en,es}/*.json`
- [ ] Templates de notificação propagam `locale` do destinatário
- [ ] `npm run lint` passa
- [ ] `npm run test:run` passa
- [ ] `npm run build` passa
- [ ] `docs/`, `/help`, `README.md` e os 3 catálogos atualizados se a mudança for visível

---

## 13. Quando perguntar antes de fazer

- Mudança destrutiva no schema (drop coluna, mudar tipo, drop tabela).
- Migração de SQLite para outro banco.
- Adição de dependência pesada (>500 KB minificado, ou que muda paradigma).
- Mudanças no fluxo de auth (callbacks, sessão, tokens).
- Mudanças que afetam o RSVP público (rota sem auth — alta superfície de
  ataque).
- Adicionar um novo idioma ao i18n (impacto em 8 novos arquivos JSON +
  ajustes em `src/i18n/config.ts`, `src/i18n/request.ts` e seletor do
  onboarding/profile).

Em todos esses casos: abra issue de discussão antes do PR.

---

## 14. Recursos rápidos

- **Helpers de segurança:**
  [src/lib/timing-safe.ts](src/lib/timing-safe.ts),
  [src/lib/rate-limit.ts](src/lib/rate-limit.ts).
- **Formatação:** [src/lib/format.ts](src/lib/format.ts).
- **Permissões:** [src/lib/permissions.ts](src/lib/permissions.ts) — `canManageUsers`, `ROLES`.
- **Audit:** [src/lib/audit.ts](src/lib/audit.ts).
- **Configuração de evento:**
  [src/lib/event-config.ts](src/lib/event-config.ts) — `getEventConfig()`,
  `isOnboardingComplete()`.
- **Notificações:** [src/lib/notifications/](src/lib/notifications/).
- **Documentação técnica:** [docs/README.md](docs/README.md).
