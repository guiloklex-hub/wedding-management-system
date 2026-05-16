# 🔐 Segurança

Visão geral das proteções implementadas e práticas recomendadas para deploy.

## Autenticação

- **Auth.js v5** (NextAuth) com strategy JWT.
- **Provider:** Credentials (email + senha + TOTP opcional).
- **Senhas:** hash com `bcryptjs` (10 rounds).
- **Sessão:** JWT no cookie `next-auth.session-token` (HttpOnly,
  SameSite=Lax).
- **Mensagens de login** não distinguem "usuário não existe" de "senha
  incorreta" — ambos retornam `null` (sem detalhes). Evita enumeração.

### Senha provisória + troca obrigatória

- Quando o admin cria um novo usuário, é gerada uma senha temporária e o
  campo `mustChangePassword = true` é setado.
- No primeiro login, o middleware redireciona para
  `/dashboard/profile/change-password`.
- Após a troca, o JWT é atualizado via `session.update()`.

### Reset de senha

- Token de reset em `PasswordResetToken` (hash do token via `sha256`, valor
  cru só sai pela URL no email).
- Expira em **60 minutos**.
- Consumo atômico: `updateMany` filtrado por `tokenHash`, `expiresAt > now`,
  `usedAt = null`. Se `count = 0`, token inválido ou já usado.

## 2FA (TOTP)

- Implementado em [src/lib/totp.ts](../src/lib/totp.ts) com `otplib` v13.
- Algoritmo: TOTP SHA-1, 30 s, 6 dígitos (compatível Google Authenticator,
  1Password, Authy, etc.).
- **Backup codes:** 10 códigos one-time-use, gerados no setup.
- **Forçar 2FA por role:** em `SecuritySettings.require2FARoles` (JSON
  array). Roles listados aqui não conseguem logar sem 2FA configurado —
  retorna `2FA_SETUP_REQUIRED` no fluxo de login.

### Verificação correta da resposta

```typescript
const isValid = verifyTotpToken(token, secret);  // retorna boolean
```

A versão atual do helper já abstrai a API do `otplib`. Não chame `verify`
direto — passe sempre por [src/lib/totp.ts](../src/lib/totp.ts).

## Autorização — Server Actions e endpoints sensíveis

Em Next.js App Router, **toda função exportada de um arquivo `"use server"`
é um endpoint HTTP público**. Não basta esconder a action no frontend — um
atacante autenticado (ou nem isso) pode invocá-la diretamente via POST.

Use sempre um dos helpers em
[src/lib/finance-access.ts](../src/lib/finance-access.ts) como **primeira
instrução** de cada Server Action:

```typescript
import { denyIfNoEdit } from "@/lib/finance-access";

export async function updateGuest(_state, formData) {
  const denied = await denyIfNoEdit();
  if (denied) return denied;
  // ...
}
```

| Helper | Permite | Use para |
|---|---|---|
| `denyIfNoEdit()` | ADMIN, GROOM, BRIDE, PLANNER | Conteúdo operacional do casamento (convidados, fornecedores, tarefas, lua de mel, enxoval, dia D). |
| `denyIfNoFinance()` | ADMIN, GROOM, BRIDE | Pagamentos, receitas, metas, ativos — qualquer mutação financeira direta. |
| `denyIfNoManage()` | ADMIN, GROOM, BRIDE | Configuração do evento (data, moeda, dados Pix, nomes do casal). |

Exceções (ações públicas por design): `requestPasswordReset`,
`consumePasswordReset`, `validateResetToken`, `publicRsvpRespond`. Estas
**precisam de rate-limit** no lugar do auth check.

Endpoints REST que servem dados financeiros (`/api/backup`, `/api/files/[id]`)
checam role via `canViewSensitiveFinance()` direto — qualquer autenticado
que não esteja nesse grupo recebe `403`. Todo download via `/api/backup`
grava `AuditLog` (`BACKUP_EXPORT`) para rastreabilidade.

## Comparação de secrets — timing-safe

Toda comparação de Bearer token, HMAC, código de reset (quando comparado em
JS), e similares **deve** usar `timingSafeEquals(a, b)` de
[src/lib/timing-safe.ts](../src/lib/timing-safe.ts). Nunca `===`.

## Cron jobs

`/api/cron/reminders` exige `Authorization: Bearer ${CRON_SECRET}`. A
comparação é timing-safe. Gere o secret com `openssl rand -hex 32` e nunca
exponha sem auth.

## Rate limiting

Módulo em [src/lib/rate-limit.ts](../src/lib/rate-limit.ts) — in-memory,
adequado para deploy single-node. Use em:

- Endpoints públicos (RSVP, etc.)
- Login (para mitigar bruteforce)
- Webhooks

Chave deve combinar IP + recurso. Exemplo:

```typescript
const ip = getClientIp(req);
const rl = rateLimit(`login:${ip}`, 10, 60_000);
if (!rl.ok) {
  return Response.json({ error: "Calma" }, { status: 429 });
}
```

O limiter faz **eviction periódica** (sweep a cada 60 s) de buckets
expirados — o `Map` interno não cresce indefinidamente, mesmo sob spray de
IPs únicos.

`getClientIp(headers)` aceita apenas `cf-connecting-ip` (Cloudflare) e o
**último hop** de `x-forwarded-for`. Não confiamos em `x-real-ip` porque
qualquer cliente pode forjar o header quando não há proxy na frente.

> ⚠️ Para deploys com múltiplas réplicas, troque o limiter por Redis.

## Audit log

Cada ação relevante grava em `AuditLog`:

```typescript
await audit("Payment", payment.id, "MARK_PAID", { method: "PIX" });
```

Campos: `entity`, `entityId`, `action`, `payload` (JSON serializado),
`userId`, `createdAt`.

Veja [src/lib/audit.ts](../src/lib/audit.ts) para os tipos disponíveis.

## Validação de entrada

- **Sempre** valide payloads de Server Actions e API routes com **Zod**.
- Imponha **limites explícitos**: `.max(120)` para nomes, `.max(2000)` para
  notas longas, `.max(8000)` para textos do dia D.
- Para datas, prefira regex `/^\d{4}-\d{2}-\d{2}$/` quando vier de
  `<input type="date">`.
- Para moeda, use `z.coerce.number().min(0).max(1_000_000)`.

## Escape de HTML em emails

Templates de email são renderizados como HTML — dados de usuário **devem**
passar por escape. Existe um helper padrão (se ainda não, considere extrair
um `escapeHtml(value)` em `src/lib/html-escape.ts`).

## Upload de arquivos

`/api/files/[id]` aceita uploads de anexos (contratos, fotos de venues,
etc.). Boas práticas:

- Validar **tamanho máximo** antes de aceitar.
- Validar `file.type` declarado contra allowlist.
- Detectar MIME real via **magic bytes** (primeiros bytes do arquivo).
- Armazenar em diretório fora do public, servir via Route Handler que
  valida sessão.

## Recomendações de produção

| Item | Recomendação |
|---|---|
| HTTPS | Obrigatório. Cloudflare Tunnel ou nginx + Let's Encrypt. |
| Cookies | `Secure` + `HttpOnly` (Auth.js já configura quando `NEXTAUTH_URL` é https) |
| `AUTH_TRUST_HOST` | `true` quando atrás de proxy/CDN. |
| Headers de segurança | Configurar `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY` no proxy ou em `next.config.ts`. |
| Banco | Manter `dev.db` em diretório persistente (não em pasta volátil). Backup diário. |
| `.env` | NUNCA versione. Use sua plataforma para injetar. |
| `ADMIN_PASSWORD` | Trocar imediatamente no primeiro login (o sistema força). |
| Atualizações | `npm audit` periódico, especialmente em libs de auth e crypto. |

## LGPD / Privacidade

O sistema armazena dados pessoais (nomes, telefones, emails de convidados,
fornecedores, parceiros). Quem opera o sistema é o responsável pela LGPD —
recomendações:

- Documente o vínculo dos dados (consentimento ao adicionar convidado).
- Disponibilize o **backup JSON** para o titular sob solicitação.
- Aceite pedidos de remoção (delete físico, não soft-delete) em até 15 dias.
- Não compartilhe o banco fora do casal.

## Checklist do reviewer

Ao revisar PR que toque endpoints/Server Actions, conferir:

- [ ] `await auth()` no início + tratamento de sessão ausente
- [ ] Toda query Prisma respeita escopo do usuário (quando aplicável)
- [ ] Body validado por Zod com limites
- [ ] Secrets comparados com `timingSafeEquals`
- [ ] Endpoint público/webhook tem rate limit
- [ ] Dados de usuário em HTML passam por escape
- [ ] Ação relevante grava em `AuditLog`
- [ ] Sem `console.log` de informação sensível
- [ ] Datas no fuso correto (`America/Sao_Paulo` para display, UTC para storage)
