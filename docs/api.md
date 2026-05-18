# 🌐 API REST

Endpoints HTTP expostos pelo Wedding Finance Planner.

> 💡 A maioria das interações é feita via **Server Actions** (em
> [src/app/actions/](../src/app/actions/)), invocadas direto pelos formulários
> React. Este documento lista apenas as rotas **HTTP** clássicas.

---

## Autenticação

```
GET  /api/auth/signin
POST /api/auth/callback/credentials
GET  /api/auth/signout
GET  /api/auth/session
```

Gerenciados pelo **Auth.js v5**. Veja
[NextAuth docs](https://authjs.dev/reference/nextjs).

**Login** (Server Action equivalente):

```typescript
// src/app/login/login-form.tsx
await signIn("credentials", {
  email,
  password,
  totp,         // opcional, se 2FA estiver ativo
  redirect: false,
});
```

**Rate limit:** 5 tentativas/min por email + 30/min por IP. Estourar
qualquer um derruba para `TOO_MANY_ATTEMPTS`.

**Erros conhecidos retornados:**

| Mensagem | Significado |
|---|---|
| `2FA_REQUIRED` | Usuário tem 2FA ativo; reenvie com `totp`. |
| `2FA_SETUP_REQUIRED` | Política exige 2FA mas usuário não configurou. |
| `TOO_MANY_ATTEMPTS` | Rate limit estourado — aguarde 1 minuto. |
| `null` (callback retorna falha) | Credenciais inválidas. Inclui email inexistente, senha errada **e conta arquivada/desativada** (indistinto, anti-enumeração). |

---

## Calendário iCal

```
GET /api/calendar.ics
```

**Requer:** sessão válida.

**Retorna:** arquivo `.ics` (`Content-Type: text/calendar`) com:

- Dia do casamento (se configurado).
- Tarefas com `deadline` setado.
- Pagamentos com `dueDate`.

**Exemplo de uso (Google Calendar):**

1. Crie a URL absoluta:
   `https://casamento.seudominio.com/api/calendar.ics`
2. Google Calendar → "Adicionar calendário" → "Por URL" → cole.

> ⚠️ O endpoint exige autenticação. Para uma versão pública (read-only,
> com token opaco), abra uma issue.

---

## Backup

```
GET /api/backup
```

**Requer:** sessão válida, role com `canViewSensitiveFinance` (ADMIN, GROOM
ou BRIDE). Outras roles recebem `403`.

**Retorna:** JSON com todos os dados do banco. Formato:

```json
{
  "exportedAt": "2026-05-18T10:30:00.000Z",
  "version": 2,
  "eventSettings": { ... },
  "securitySettings": { ... },
  "vendors": [...],
  "vendorContacts": [...],
  "vendorNotes": [...],
  "contracts": [...],
  "attachments": [...],
  "venues": [...],
  "venueChecklistItems": [...],
  "budgetItems": [...],
  "payments": [...],
  "incomes": [...],
  "assets": [...],
  "savingsGoals": [...],
  "honeymoon": { ... } | null,
  "honeymoonItems": [...],
  "trousseauItems": [...],
  "guestGroups": [...],
  "guests": [...],
  "seatingTables": [...],
  "gifts": [...],
  "tasks": [...]
}
```

**Headers:**
- `Content-Type: application/json; charset=utf-8`
- `Content-Disposition: attachment; filename="wfv-backup-YYYY-MM-DD.json"`
- `Cache-Control: no-store`

Cada chamada grava `AuditLog` com action `BACKUP_EXPORT` e contagem por
coleção. Importadores devem inspecionar `payload.version` — `2` inclui as
22 coleções acima; `1` (legado) trazia apenas 5.

Veja [backup-restore.md](backup-restore.md).

---

## Cron de lembretes

```
GET /api/cron/reminders
Authorization: Bearer <CRON_SECRET>
```

**Requer:** Bearer token (`CRON_SECRET` do `.env`), comparado timing-safe.

**O que faz:**
1. Busca pagamentos com `dueDate` em ≤ 3 dias ou já vencidos.
2. Busca tarefas com `deadline` em ≤ 2 dias ou já vencidas.
3. Para cada um, dispara `notify("PAYMENT_DUE"|"PAYMENT_OVERDUE"|"TASK_DUE"|"TASK_OVERDUE")`
   por email e WhatsApp.
4. Grava resultado em `NotificationLog` (idempotente por dia).

**Retorna:**

```json
{
  "ok": true,
  "checked": { "payments": 12, "tasks": 8 },
  "sent":    { "email": 6, "whatsapp": 6 },
  "skipped": { "alreadyToday": 14, "noChannel": 0 }
}
```

**Erros:**
- `401` se Bearer inválido ou ausente.

---

## Upload e download de arquivos

```
POST /api/files
GET  /api/files/[id]
```

**Requer:** sessão válida.

### POST /api/files

**Body:** `multipart/form-data` com:
- `file`: o arquivo (limite 25 MB).
- `ownerType`: `Vendor` | `Contract` | `Venue` (string).
- `ownerId`: id da entidade dona.

**Retorna:** `{ id, filename, mimeType, size, storagePath }` do Attachment
criado.

### GET /api/files/[id]

**Retorna:** o binário do arquivo (`Content-Disposition: inline` ou
`attachment` dependendo do MIME).

> ⚠️ Validações importantes ao implementar/alterar:
> - tamanho máximo
> - allowlist de MIME
> - detecção de magic bytes
> - escopo de acesso (cada arquivo só visível ao usuário/projeto)

---

## RSVP público

```
GET  /rsvp/[token]
POST /rsvp/[token] (via Server Action)
```

**Requer:** apenas o `rsvpToken` (cuid) — não exige login.

**Comportamento:**
- GET: exibe a página com nome do convidado + form (presença, +1s, dietary).
- Server Action: atualiza `rsvpStatus`, `plusOnesConfirmed`, `dietary`,
  `rsvpRespondedAt`.

Para **regenerar tokens** (se algum vazou), use o Prisma Studio ou um script:

```typescript
import { prisma } from "@/lib/prisma";
import { cuid } from "...";
await prisma.guest.update({
  where: { id: guestId },
  data: { rsvpToken: cuid() },
});
```

---

## Webhooks (futuros)

Atualmente o sistema **não recebe webhooks externos**. Caso futuro:

- WhatsApp Cloud API (não Baileys) — opcional para escalar.
- Stripe / Mercado Pago — para pagamentos do casal pela web.

Quaisquer webhooks devem:

- exigir assinatura HMAC (`X-Signature: sha256=<hex>`),
- validar com `timingSafeEquals`,
- ter rate limit por IP + recurso.

---

## Erros padrão

Toda resposta de erro segue:

```json
{ "error": "Mensagem amigável", "code": "OPTIONAL_CODE" }
```

| Status | Significado |
|---|---|
| 401 | Não autenticado |
| 403 | Autenticado mas sem permissão |
| 404 | Recurso não encontrado |
| 409 | Conflito (ex.: email já existe) |
| 422 | Validação falhou (Zod) |
| 429 | Rate limit excedido |
| 500 | Erro interno |

---

## CORS

Não há CORS configurado — o sistema é projetado para ser acessado pelo mesmo
domínio. Se você precisar de um cliente cross-origin (app mobile, por
exemplo), configure `next.config.ts` cuidadosamente.

---

## Versionamento

Não há `v1`/`v2` na URL. Mudanças de contrato são feitas conforme necessário
— o frontend é o único cliente atualmente.

Se isto mudar (clientes terceiros), adote `Accept: application/vnd.wfv.v1+json`
ou prefixo `/api/v1/...`.
