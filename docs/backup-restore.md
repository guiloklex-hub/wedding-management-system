# 💾 Backup e Restauração

O Wedding Finance Planner usa SQLite — todos os dados ficam em um único
arquivo (`prisma/dev.db` por padrão). Isso facilita backup binário e
migração. Em paralelo, o app expõe um **export JSON** com checksum SHA-256
e um endpoint de **restore** que aplica o arquivo de volta em uma única
transação Prisma.

---

## Backup JSON pela UI

```
GET /api/backup
Authorization: cookie de sessão (role com canViewSensitiveFinance — ADMIN/GROOM/BRIDE)
```

Retorna um arquivo com envelope:

```json
{
  "checksum": {
    "algorithm": "sha256",
    "value": "<hash hex>"
  },
  "payload": {
    "version": 3,
    "exportedAt": "2026-05-23T12:00:00.000Z",
    "meta": {
      "appVersion": "0.1.0",
      "hostname": "debian",
      "nodeVersion": "v20.x",
      "exportedBy": { "id": "...", "email": "..." }
    },
    "eventSettings": { ... },
    "securitySettings": { ... },
    "users": [ ... ],
    "vendors": [ ... ],
    ...
  }
}
```

Headers úteis:

- `X-Backup-Version: 3`
- `X-Backup-Checksum: <sha256 hex>`
- `Content-Disposition: attachment; filename="wedding-finance-backup-YYYY-MM-DD.json"`

### Coleções exportadas (v3)

- **Singletons:** `eventSettings`, `securitySettings`, `honeymoon`.
- **Tabelas:** `vendors`, `vendorContacts`, `vendorNotes`, `contracts`,
  `attachments`, `venues`, `venueChecklistItems`, `budgetItems`,
  `payments`, `incomes`, `assets`, `savingsGoals`, `honeymoonItems`,
  `trousseauItems`, `guestGroups`, `guests`, `seatingTables`, `gifts`,
  `tasks`.
- **Sensíveis (apenas ADMIN):** `users` (com `password` bcrypt e
  `twoFactorSecret`), `notificationLogs`, `auditLogs`.

> 🔐 Como o backup contém hashes bcrypt das senhas e secrets de 2FA,
> **trate o arquivo como um secret**. Qualquer pessoa com o arquivo +
> instância nova pode reativar todos os logins.

### Versionamento e compatibilidade

| Versão | Coleções | Checksum | Notas |
|---|---|---|---|
| v1 | 5 (event, vendors, budget, payments, assets) | não | legado, sem importador |
| v2 | 22 (event + tudo da v1 + restante) | não | suportado para restore |
| v3 | 25 (v2 + users + notificationLogs + auditLogs) + meta + checksum | sim | atual |

O `parseBackupText` aceita v2 e v3. Backups v1 antigos precisam ser
convertidos manualmente.

### `BACKUP_EXPORT` no AuditLog

Cada download grava em `AuditLog`:

```json
{
  "entity": "EventSettings",
  "entityId": "singleton",
  "action": "BACKUP_EXPORT",
  "payload": "{\"version\":3,\"checksum\":\"...\",\"counts\":{...},\"includesSensitive\":true}",
  "userId": "..."
}
```

---

## Validação de arquivo (dry-run)

```
POST /api/backup/validate
Content-Type: multipart/form-data
Body: file=@arquivo.json
```

Retorna 200 com:

```json
{
  "ok": true,
  "version": 3,
  "systemVersion": 3,
  "exportedAt": "...",
  "meta": { ... },
  "checksumValid": true,
  "checksum": { "algorithm": "sha256", "value": "..." },
  "counts": { "vendors": 12, "payments": 28, ... },
  "warnings": []
}
```

Em erro, 422 com `issues` (Zod path/message) ou mensagem.

**Quem pode chamar:** mesma permissão do export (`ADMIN/GROOM/BRIDE`).

---

## Restore

```
POST /api/backup/restore
Content-Type: multipart/form-data
Body:
  file=@arquivo.json
  password=<senha do admin logado>
  confirm=WIPE_AND_RESTORE
```

Resposta de sucesso (200):

```json
{
  "ok": true,
  "counts": { "vendors": 12, "users": 3, ... },
  "warnings": [],
  "protectedCurrentUser": false
}
```

### Garantias

1. **Apenas ADMIN.** Outras roles recebem 403.
2. **Re-autenticação obrigatória** — `password` deve bater com o hash
   bcrypt do usuário logado. Sem isso, 401.
3. **Confirmação explícita** — sem `confirm=WIPE_AND_RESTORE`, 400.
4. **Validação do arquivo** — Zod schema + checksum. Checksum inválido
   → 422 e nenhuma escrita no banco.
5. **Rate limit** — 3 tentativas por hora por (userId, IP).
6. **Transação Prisma única** — wipe + insert em
   `prisma.$transaction({ timeout: 120s })`. Se qualquer passo falha,
   nada é commitado.
7. **Proteção do usuário logado** — se o backup tem `users` mas o usuário
   atual não está na lista, ele é preservado para não perder a sessão.
8. **Audit** — grava `BACKUP_RESTORE` em `AuditLog` ao final, com
   `counts`, `version`, `checksum` e `warnings`.

### Ordem de wipe (children → parents)

`AuditLog → NotificationLog → PasswordResetToken → Attachment → Contract
→ VendorNote → VendorContact → VenueChecklistItem → HoneymoonItem →
Payment → Gift → Task → BudgetItem → Asset → Guest → GuestGroup →
SeatingTable → Income → TrousseauItem → SavingsGoal → Vendor → Venue →
Honeymoon`.

`EventSettings` e `SecuritySettings` (singletons) são **upserted**,
nunca deletados.

`User` é wipado **só** se o backup traz a coleção `users` não-vazia.

### Ordem de restore (parents → children)

`User → SecuritySettings → EventSettings → SavingsGoal → Vendor → Venue →
SeatingTable → GuestGroup → Honeymoon → Income → TrousseauItem → Asset →
Guest → BudgetItem → VendorContact → VendorNote → Contract →
VenueChecklistItem → Payment → HoneymoonItem → Gift → Task → Attachment →
NotificationLog → AuditLog`.

Datas em string ISO são convertidas para `Date` via lista canônica
(`createdAt`, `updatedAt`, `eventDate`, `dueDate`, etc.) — ver
`DATE_FIELDS` em [src/lib/backup-restore.ts](../src/lib/backup-restore.ts).

### Sessão após restore

Se o backup contém users e o usuário atual **está** entre eles, o
registro local será sobrescrito — pode ser necessário relogar (a sessão
JWT expira na próxima revalidação, em até 60s).

Se o backup não traz `users` ou o usuário atual **não** está nele, a
sessão segue válida (o registro foi preservado).

---

## Backup direto do arquivo SQLite

Para um backup binário (mais fiel e mais barato que JSON):

```bash
# parar o servidor (ou usar VACUUM INTO em produção)
cp prisma/dev.db backups/dev-$(date +%F).db
```

Em **produção**, cron diário:

```cron
0 3 * * * /usr/bin/cp /var/lib/wedding/prisma/dev.db /var/backups/wedding-$(date +\%F).db && find /var/backups -name "wedding-*.db" -mtime +30 -delete
```

### Restaurar SQLite cru

```bash
pm2 stop wedding-management-system
cp /var/backups/wedding-2025-10-12.db prisma/dev.db
npx prisma db push --skip-generate
npx prisma generate
pm2 start wedding-management-system
```

---

## Onde fica o banco?

| Ambiente | Caminho típico |
|---|---|
| Dev (Linux/macOS/WSL) | `./prisma/dev.db` |
| Dev (Windows nativo) | `.\prisma\dev.db` |
| Prod | `DATABASE_URL="file:/var/lib/wedding/dev.db"` |

Em produção, configure `DATABASE_URL` para um diretório persistente fora
do deploy (não dentro de `/var/www/wedding/...` se você costuma fazer
`git pull && npm run build`).

---

## Backup do `.whatsapp-auth/`

Quando o WhatsApp está conectado, a sessão Baileys vive em
`.whatsapp-auth/` (gitignored). O JSON do `/api/backup` **não** inclui
esse diretório. Para evitar precisar escanear o QR Code toda hora:

```bash
tar czf backups/whatsapp-auth-$(date +%F).tar.gz .whatsapp-auth/
```

Restaurar:

```bash
tar xzf backups/whatsapp-auth-2025-10-12.tar.gz
pm2 restart wedding-management-system
```

> ⚠️ Trate esse diretório como **secret** — quem tem o arquivo pode se
> passar pela sua conta WhatsApp.

---

## Backup do `.env`

Faça! Embora os secrets sejam gerados aleatoriamente, perder o
`NEXTAUTH_SECRET` invalida todas as sessões ativas. Guarde em local seguro.

---

## Plano sugerido

| Frequência | O quê | Destino | Retenção |
|---|---|---|---|
| Diário (3am) | `prisma/dev.db` | local + nuvem | 30 dias |
| Semanal | `/api/backup` JSON | nuvem (criptografado) | 8 semanas |
| Semanal | `.whatsapp-auth/` | nuvem (criptografado) | 4 semanas |
| Quando muda | `.env`, `prisma/schema.prisma` | gerenciador de senhas | sempre |
| Antes de update | `npm run build` (artefato) | local | até próximo deploy |

---

## Migração entre máquinas

### Via JSON (recomendado para mudar de host limpo)

```bash
# Máquina nova: setup limpo
git clone ... && cd wedding-management-system
./setup.sh                    # cria admin temporário
# Faça login com o admin temporário
# Ajustes → Backup → Selecione o arquivo → Validar → Restaurar
```

A sua conta admin temporária será sobrescrita pelos users do backup. Use
as credenciais antigas para entrar.

### Via SQLite (preserva sessões, mais fiel)

```bash
# máquina antiga
tar czf migration.tar.gz prisma/dev.db .env .whatsapp-auth/

# máquina nova
git clone ...
cd wedding-management-system
tar xzf ../migration.tar.gz
./setup.sh --skip-seed
npm run dev   # ou: ./setup.sh --prod --skip-seed
```
